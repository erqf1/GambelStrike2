'use strict';
// GambelStrike 2 — collision world: axis-aligned boxes in a spatial hash, raycasts,
// capsule-ish body movement with step-up, and an automatically generated nav graph for bots.
(function () {
  const U = GS.U;
  const CELL = 4;
  const STEP = 0.48;

  class World {
    constructor() {
      this.boxes = [];
      this.grid = new Map();
      this.stamp = 1;
      this.bounds = { x0: -60, z0: -60, x1: 60, z1: 60 };
      this.nav = null;
      this.killY = -20;
    }
    key(ix, iz) { return (ix + 1024) * 4096 + (iz + 1024); }
    addBox(x0, y0, z0, x1, y1, z1, surf = 'concrete') {
      if (x1 < x0) [x0, x1] = [x1, x0];
      if (y1 < y0) [y0, y1] = [y1, y0];
      if (z1 < z0) [z0, z1] = [z1, z0];
      const b = { x0, y0, z0, x1, y1, z1, surf, s: 0, id: this.boxes.length };
      this.boxes.push(b);
      const ix0 = Math.floor(x0 / CELL), ix1 = Math.floor(x1 / CELL), iz0 = Math.floor(z0 / CELL), iz1 = Math.floor(z1 / CELL);
      for (let ix = ix0; ix <= ix1; ix++) {
        for (let iz = iz0; iz <= iz1; iz++) {
          const k = this.key(ix, iz);
          let c = this.grid.get(k);
          if (!c) { c = []; this.grid.set(k, c); }
          c.push(b);
        }
      }
      return b;
    }
    // iterate candidate boxes overlapping an XZ rectangle (unique)
    query(x0, z0, x1, z1, out) {
      out.length = 0;
      const st = ++this.stamp;
      const ix0 = Math.floor(x0 / CELL), ix1 = Math.floor(x1 / CELL), iz0 = Math.floor(z0 / CELL), iz1 = Math.floor(z1 / CELL);
      for (let ix = ix0; ix <= ix1; ix++) {
        for (let iz = iz0; iz <= iz1; iz++) {
          const c = this.grid.get(this.key(ix, iz));
          if (!c) continue;
          for (let i = 0; i < c.length; i++) {
            const b = c[i];
            if (b.s !== st) { b.s = st; out.push(b); }
          }
        }
      }
      return out;
    }
    overlapList(x0, y0, z0, x1, y1, z1, out) {
      const cand = this.query(x0, z0, x1, z1, this._q || (this._q = []));
      out.length = 0;
      for (let i = 0; i < cand.length; i++) {
        const b = cand[i];
        if (b.x0 < x1 && b.x1 > x0 && b.y0 < y1 && b.y1 > y0 && b.z0 < z1 && b.z1 > z0) out.push(b);
      }
      return out;
    }
    overlapAny(x0, y0, z0, x1, y1, z1) {
      const cand = this.query(x0, z0, x1, z1, this._q2 || (this._q2 = []));
      for (let i = 0; i < cand.length; i++) {
        const b = cand[i];
        if (b.x0 < x1 && b.x1 > x0 && b.y0 < y1 && b.y1 > y0 && b.z0 < z1 && b.z1 > z0) return b;
      }
      return null;
    }
    // highest box top at point (x,z) that is <= maxY. returns -Infinity if none
    floorAt(x, z, maxY) {
      const c = this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
      let best = -Infinity, bb = null;
      if (!c) return best;
      for (let i = 0; i < c.length; i++) {
        const b = c[i];
        if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 <= maxY + 1e-4 && b.y1 > best) { best = b.y1; bb = b; }
      }
      this._floorBox = bb;
      return best;
    }
    surfaceAt(x, y, z) {
      this.floorAt(x, z, y + 0.05);
      return this._floorBox ? this._floorBox.surf : 'concrete';
    }

    // ray vs boxes using a 2D DDA over the spatial grid. dir must be normalised.
    raycast(ox, oy, oz, dx, dy, dz, maxT, hit) {
      hit = hit || {};
      hit.t = maxT; hit.box = null;
      if (Math.abs(dx) < 1e-7) dx = 1e-7;
      if (Math.abs(dy) < 1e-7) dy = 1e-7;
      if (Math.abs(dz) < 1e-7) dz = 1e-7;
      const st = ++this.stamp;
      let ix = Math.floor(ox / CELL), iz = Math.floor(oz / CELL);
      const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
      const tDX = Math.abs(dx) > 1e-9 ? Math.abs(CELL / dx) : Infinity;
      const tDZ = Math.abs(dz) > 1e-9 ? Math.abs(CELL / dz) : Infinity;
      let tMX = Math.abs(dx) > 1e-9 ? ((dx > 0 ? (ix + 1) * CELL - ox : ox - ix * CELL) / Math.abs(dx)) : Infinity;
      let tMZ = Math.abs(dz) > 1e-9 ? ((dz > 0 ? (iz + 1) * CELL - oz : oz - iz * CELL) / Math.abs(dz)) : Infinity;
      const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz;
      let tCell = 0;
      for (let guard = 0; guard < 200; guard++) {
        const c = this.grid.get(this.key(ix, iz));
        if (c) {
          for (let i = 0; i < c.length; i++) {
            const b = c[i];
            if (b.s === st) continue;
            b.s = st;
            // slab test
            let t1 = (b.x0 - ox) * idx, t2 = (b.x1 - ox) * idx;
            let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), ax = 0;
            t1 = (b.y0 - oy) * idy; t2 = (b.y1 - oy) * idy;
            let ymn = Math.min(t1, t2);
            if (ymn > tmin) { tmin = ymn; ax = 1; }
            tmax = Math.min(tmax, Math.max(t1, t2));
            t1 = (b.z0 - oz) * idz; t2 = (b.z1 - oz) * idz;
            let zmn = Math.min(t1, t2);
            if (zmn > tmin) { tmin = zmn; ax = 2; }
            tmax = Math.min(tmax, Math.max(t1, t2));
            if (tmax >= Math.max(0, tmin) && tmin < hit.t && tmin >= 0) {
              hit.t = tmin; hit.box = b; hit.axis = ax;
            }
          }
        }
        const tNext = Math.min(tMX, tMZ);
        if (hit.box && hit.t <= tNext) break;
        if (tNext > hit.t || tNext > maxT) break;
        tCell = tNext;
        if (tMX < tMZ) { ix += stepX; tMX += tDX; } else { iz += stepZ; tMZ += tDZ; }
      }
      void tCell;
      if (!hit.box) return null;
      hit.nx = hit.axis === 0 ? -Math.sign(dx) : 0;
      hit.ny = hit.axis === 1 ? -Math.sign(dy) : 0;
      hit.nz = hit.axis === 2 ? -Math.sign(dz) : 0;
      hit.x = ox + dx * hit.t; hit.y = oy + dy * hit.t; hit.z = oz + dz * hit.t;
      return hit;
    }
    // line of sight between two points
    los(ax, ay, az, bx, by, bz) {
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-4) return true;
      const h = this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d, this._losHit || (this._losHit = {}));
      return !h;
    }

    // ---------------------------------------------------------------- body movement
    // body: { pos: Vector3 (feet), vel: Vector3, r, h, grounded }
    _moveV(b, d) {
      const p = b.pos;
      p.y += d;
      const list = this.overlapList(p.x - b.r, p.y, p.z - b.r, p.x + b.r, p.y + b.h, p.z + b.r, this._ol || (this._ol = []));
      if (!list.length) return 0;
      if (d <= 0) {
        let top = -Infinity;
        for (const bx of list) if (bx.y1 > top) top = bx.y1;
        p.y = top + 0.0005;
        return -1;
      }
      let bot = Infinity;
      for (const bx of list) if (bx.y0 < bot) bot = bx.y0;
      p.y = bot - b.h - 0.0005;
      return 1;
    }
    _moveH(b, axis, d) {
      if (d === 0) return false;
      const p = b.pos, r = b.r;
      p[axis] += d;
      const list = this.overlapList(p.x - r, p.y, p.z - r, p.x + r, p.y + b.h, p.z + r, this._ol || (this._ol = []));
      if (!list.length) return false;
      if (b.grounded || b.coyote > 0) {
        let top = -Infinity;
        for (const bx of list) if (bx.y1 > top) top = bx.y1;
        const rise = top - p.y;
        if (rise > 0 && rise <= STEP && !this.overlapAny(p.x - r, top + 0.001, p.z - r, p.x + r, top + 0.001 + b.h, p.z + r)) {
          p.y = top + 0.001;
          b.stepped = (b.stepped || 0) + rise;
          return false;
        }
      }
      if (axis === 'x') {
        for (const bx of list) {
          if (d > 0) p.x = Math.min(p.x, bx.x0 - r - 1e-4); else p.x = Math.max(p.x, bx.x1 + r + 1e-4);
        }
      } else {
        for (const bx of list) {
          if (d > 0) p.z = Math.min(p.z, bx.z0 - r - 1e-4); else p.z = Math.max(p.z, bx.z1 + r + 1e-4);
        }
      }
      return true;
    }
    move(b, dt) {
      const v = b.vel;
      const dist = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) * dt;
      const n = Math.max(1, Math.min(12, Math.ceil(dist / 0.2)));
      const sdt = dt / n;
      b.hitWall = false;
      b.landed = 0;
      for (let i = 0; i < n; i++) {
        const was = b.grounded;
        b.grounded = false;
        const r = this._moveV(b, v.y * sdt);
        if (r === -1) {
          b.grounded = true;
          if (!was && v.y < -1) b.landed = Math.min(b.landed, v.y);
          if (v.y < 0) v.y = 0;
        } else if (r === 1 && v.y > 0) v.y = 0;
        if (b.grounded) b.coyote = 0.1;
        if (this._moveH(b, 'x', v.x * sdt)) { v.x = 0; b.hitWall = true; }
        if (this._moveH(b, 'z', v.z * sdt)) { v.z = 0; b.hitWall = true; }
        // snap down stairs / slopes
        if (was && !b.grounded && v.y <= 0 && !b.jumped) {
          const p = b.pos;
          const f = this.floorAtBody(p.x, p.z, p.y + 0.01, b.r);
          if (f > -Infinity && p.y - f <= STEP + 0.02 && p.y - f > 0) {
            if (!this.overlapAny(p.x - b.r, f + 0.001, p.z - b.r, p.x + b.r, f + 0.001 + b.h, p.z + b.r)) {
              p.y = f + 0.0005;
              b.grounded = true;
              v.y = 0;
            }
          }
        }
      }
      b.coyote = Math.max(0, (b.coyote || 0) - dt);
      b.jumped = false;
    }
    floorAtBody(x, z, maxY, r) {
      // highest floor under any of the 4 corners + centre
      let f = this.floorAt(x, z, maxY);
      f = Math.max(f, this.floorAt(x - r * 0.8, z - r * 0.8, maxY), this.floorAt(x + r * 0.8, z - r * 0.8, maxY), this.floorAt(x - r * 0.8, z + r * 0.8, maxY), this.floorAt(x + r * 0.8, z + r * 0.8, maxY));
      return f;
    }
    fits(x, y, z, r, h) { return !this.overlapAny(x - r, y + 0.001, z - r, x + r, y + h, z + r); }

    // ---------------------------------------------------------------- nav graph
    buildNav(spacing = 1.5) {
      const t0 = performance.now();
      const { x0, z0, x1, z1 } = this.bounds;
      const nx = Math.floor((x1 - x0) / spacing) + 1, nz = Math.floor((z1 - z0) / spacing) + 1;
      const nodes = [];
      const cols = new Map();
      const R = 0.32, H = 1.75;
      const tops = [];
      for (let ix = 0; ix < nx; ix++) {
        for (let iz = 0; iz < nz; iz++) {
          const x = x0 + ix * spacing, z = z0 + iz * spacing;
          const c = this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
          if (!c) continue;
          tops.length = 0;
          for (const b of c) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) tops.push(b.y1);
          tops.sort((a, b) => b - a);
          let last = Infinity;
          const list = [];
          for (const y of tops) {
            if (Math.abs(y - last) < 0.05) continue;
            last = y;
            if (y > 30) continue;
            // standable if the body fits above step height (stairs count as walkable)
            if (!this.overlapAny(x - R, y + 0.45, z - R, x + R, y + H, z + R)) {
              const n = { i: nodes.length, x, y, z, ix, iz, e: [], c: 0 };
              nodes.push(n);
              list.push(n.i);
            }
          }
          if (list.length) cols.set(ix * 100000 + iz, list);
        }
      }
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const a of nodes) {
        for (const [dx, dz] of dirs) {
          const list = cols.get((a.ix + dx) * 100000 + (a.iz + dz));
          if (!list) continue;
          for (const bi of list) {
            const b = nodes[bi];
            const dy = b.y - a.y;
            if (Math.abs(dy) <= 1.9 && this._walkable(a, b)) a.e.push(bi, Math.hypot(b.x - a.x, dy * 1.5, b.z - a.z));
            else if (dy < -0.8 && dy > -5.4 && this._droppable(a, b)) a.e.push(bi, Math.hypot(b.x - a.x, b.z - a.z) + 1.5);
          }
        }
      }
      // explicit nav lines (stairs): chain nodes and stitch both ends into the grid
      const addCol = (n) => {
        const k = n.ix * 100000 + n.iz;
        const l = cols.get(k);
        if (l) l.push(n.i); else cols.set(k, [n.i]);
      };
      for (const line of this.navLines || []) {
        const chain = line.map(([x, y, z]) => {
          const n = { i: nodes.length, x, y, z, ix: Math.round((x - x0) / spacing), iz: Math.round((z - z0) / spacing), e: [], c: 0, line: true };
          nodes.push(n);
          addCol(n);
          return n;
        });
        for (let i = 0; i + 1 < chain.length; i++) {
          const a = chain[i], b = chain[i + 1];
          const d = Math.hypot(b.x - a.x, (b.y - a.y) * 1.5, b.z - a.z);
          a.e.push(b.i, d); b.e.push(a.i, d);
        }
        for (const end of [chain[0], chain[chain.length - 1]]) {
          for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
              const list = cols.get((end.ix + dx) * 100000 + (end.iz + dz));
              if (!list) continue;
              for (const gi of list) {
                const g = nodes[gi];
                if (g.line || Math.abs(g.y - end.y) > 0.35) continue;
                if (Math.hypot(g.x - end.x, g.z - end.z) > 2.4) continue;
                if (this._walkable(end, g)) end.e.push(gi, Math.hypot(g.x - end.x, g.z - end.z));
                if (this._walkable(g, end)) g.e.push(end.i, Math.hypot(g.x - end.x, g.z - end.z));
              }
            }
          }
        }
      }
      // connected components (undirected)
      let comp = 0, bestComp = 0, bestSize = 0;
      const back = nodes.map(() => []);
      for (const a of nodes) for (let k = 0; k < a.e.length; k += 2) back[a.e[k]].push(a.i);
      for (const n of nodes) {
        if (n.c) continue;
        comp++;
        let size = 0;
        const stack = [n.i];
        n.c = comp;
        while (stack.length) {
          const i = stack.pop();
          size++;
          const m = nodes[i];
          for (let k = 0; k < m.e.length; k += 2) { const j = m.e[k]; if (!nodes[j].c) { nodes[j].c = comp; stack.push(j); } }
          for (const j of back[i]) if (!nodes[j].c) { nodes[j].c = comp; stack.push(j); }
        }
        if (size > bestSize) { bestSize = size; bestComp = comp; }
      }
      const main = nodes.filter((n) => n.c === bestComp && n.e.length >= 4);
      this.nav = {
        nodes, cols, spacing, main, ix0: x0, iz0: z0,
        g: new Float32Array(nodes.length), f: new Float32Array(nodes.length),
        came: new Int32Array(nodes.length), closed: new Uint32Array(nodes.length), open: new Uint32Array(nodes.length), run: 0,
      };
      console.log(`[nav] ${nodes.length} nodes, main ${main.length}, ${(performance.now() - t0).toFixed(0)}ms`);
      return this.nav;
    }
    _walkable(a, b) {
      const k = 6;
      let y = a.y;
      for (let i = 1; i <= k; i++) {
        const t = i / k;
        const x = U.lerp(a.x, b.x, t), z = U.lerp(a.z, b.z, t);
        const f = this.floorAt(x, z, y + STEP);
        if (f === -Infinity || y - f > 0.62) return false;
        y = f;
        if (this.overlapAny(x - 0.26, y + 0.42, z - 0.26, x + 0.26, y + 1.6, z + 0.26)) return false;
      }
      return Math.abs(y - b.y) < 0.3;
    }
    _droppable(a, b) {
      // walk off the edge at a's height, then fall into b's column
      const k = 5;
      for (let i = 1; i <= k; i++) {
        const t = i / k;
        const x = U.lerp(a.x, b.x, t), z = U.lerp(a.z, b.z, t);
        if (this.overlapAny(x - 0.26, a.y + 0.42, z - 0.26, x + 0.26, a.y + 1.6, z + 0.26)) return false;
      }
      return !this.overlapAny(b.x - 0.26, b.y + 0.05, b.z - 0.26, b.x + 0.26, a.y + 1.6, b.z + 0.26);
    }
    nearestNode(x, y, z, maxDy = 2.5) {
      const nav = this.nav;
      if (!nav) return -1;
      const ix = Math.round((x - nav.ix0) / nav.spacing), iz = Math.round((z - nav.iz0) / nav.spacing);
      let best = -1, bd = Infinity;
      for (let r = 0; r <= 3 && best < 0; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const list = nav.cols.get((ix + dx) * 100000 + (iz + dz));
            if (!list) continue;
            for (const i of list) {
              const n = nav.nodes[i];
              const dy = y - n.y;
              if (dy < -0.8 || dy > maxDy) continue;
              const d = (n.x - x) ** 2 + (n.z - z) ** 2 + dy * dy * 4;
              if (d < bd && n.e.length) { bd = d; best = i; }
            }
          }
        }
      }
      return best;
    }
    // A* — returns array of node indices (start excluded) or null
    path(from, to, maxIter = 6000) {
      const nav = this.nav;
      if (!nav || from < 0 || to < 0) return null;
      if (from === to) return [to];
      const N = nav.nodes, g = nav.g, f = nav.f, came = nav.came, closed = nav.closed, open = nav.open;
      const run = ++nav.run;
      const goal = N[to];
      const h = (n) => Math.hypot(n.x - goal.x, n.y - goal.y, n.z - goal.z);
      const heap = [from];
      g[from] = 0; f[from] = h(N[from]); came[from] = -1; open[from] = run;
      const push = (i) => {
        heap.push(i);
        let c = heap.length - 1;
        while (c > 0) {
          const p = (c - 1) >> 1;
          if (f[heap[p]] <= f[heap[c]]) break;
          [heap[p], heap[c]] = [heap[c], heap[p]]; c = p;
        }
      };
      const pop = () => {
        const top = heap[0];
        const last = heap.pop();
        if (heap.length) {
          heap[0] = last;
          let c = 0;
          for (;;) {
            const l = c * 2 + 1, r = l + 1;
            let m = c;
            if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
            if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
            if (m === c) break;
            [heap[m], heap[c]] = [heap[c], heap[m]]; c = m;
          }
        }
        return top;
      };
      let iter = 0;
      while (heap.length && iter++ < maxIter) {
        const cur = pop();
        if (closed[cur] === run) continue;
        closed[cur] = run;
        if (cur === to) {
          const out = [];
          let c = to;
          while (c !== from && c >= 0) { out.push(c); c = came[c]; }
          return out.reverse();
        }
        const n = N[cur];
        for (let k = 0; k < n.e.length; k += 2) {
          const j = n.e[k];
          if (closed[j] === run) continue;
          const ng = g[cur] + n.e[k + 1];
          if (open[j] !== run || ng < g[j]) {
            open[j] = run; g[j] = ng; f[j] = ng + h(N[j]); came[j] = cur;
            push(j);
          }
        }
      }
      return null;
    }
    randomNode(filter) {
      const m = this.nav && this.nav.main;
      if (!m || !m.length) return -1;
      for (let i = 0; i < 20; i++) {
        const n = U.pick(m);
        if (!filter || filter(n)) return n.i;
      }
      return U.pick(m).i;
    }
  }

  GS.World = World;
  GS.World.STEP = STEP;
})();
