'use strict';
// GambelStrike 2 — map construction. Static geometry is merged per material for few draw calls;
// every solid box also lands in the collision world.
(function () {
  const U = GS.U;
  const PI = Math.PI;

  // ================================================================== builder
  class MapBuilder {
    constructor(world, group) {
      this.world = world;
      this.group = group;
      this.mats = {};
      this.buckets = {};
      this.contact = { pos: [], uv: [] };
      this.glows = { pos: [], uv: [], col: [] };
      this.anim = [];
      this.lights = [];
      this.emitters = [];
    }
    mat(name, material, scale = 2, surf = 'concrete') {
      material.vertexColors = true;
      this.mats[name] = { material, scale, surf };
    }
    _bucket(name) {
      let b = this.buckets[name];
      if (!b) b = this.buckets[name] = { pos: [], nor: [], uv: [], col: [] };
      return b;
    }
    // axis aligned box. o: { collide, top, bottom, sides, ao, surf, skip:{px,nx,py,ny,pz,nz}, contact }
    box(x0, y0, z0, x1, y1, z1, mat, o = {}) {
      if (x1 < x0) [x0, x1] = [x1, x0];
      if (y1 < y0) [y0, y1] = [y1, y0];
      if (z1 < z0) [z0, z1] = [z1, z0];
      const md = this.mats[mat];
      if (o.collide !== false) this.world.addBox(x0, y0, z0, x1, y1, z1, o.surf || (md && md.surf) || 'concrete');
      if (mat && o.visible !== false) this._geoBox(x0, y0, z0, x1, y1, z1, mat, o);
      const onGround = o.groundY !== undefined ? Math.abs(y0 - o.groundY) < 0.05 : y0 <= 0.2;
      if (o.contact !== false && onGround && y1 - y0 > 0.3 && (x1 - x0) < 30 && (z1 - z0) < 30 && o.collide !== false) this._contact(x0, z0, x1, z1, y0 + 0.012, o.contactW || 0.55);
      return this;
    }
    _geoBox(x0, y0, z0, x1, y1, z1, mat, o) {
      const sk = o.skip || {};
      const tall = y1 - y0;
      const aoB = o.ao === false ? 1 : tall > 4 ? 0.82 : 0.68;
      const face = (name, m, verts, n, uvf) => {
        if (sk[name]) return;
        const md = this.mats[m];
        if (!md) return;
        const b = this._bucket(m);
        const s = md.scale;
        const idx = [0, 1, 2, 0, 2, 3];
        for (const i of idx) {
          const v = verts[i];
          b.pos.push(v[0], v[1], v[2]);
          b.nor.push(n[0], n[1], n[2]);
          const uv = uvf(v);
          b.uv.push(uv[0] / s, uv[1] / s);
          const c = n[1] === 0 && v[1] <= y0 + 1e-4 ? aoB : 1;
          b.col.push(c, c, c);
        }
      };
      const side = o.sides || mat, top = o.top || mat, bot = o.bottom || mat;
      face('px', side, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], (v) => [-v[2], v[1]]);
      face('nx', side, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], (v) => [v[2], v[1]]);
      face('pz', side, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], (v) => [v[0], v[1]]);
      face('nz', side, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], (v) => [-v[0], v[1]]);
      face('py', top, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], (v) => [v[0], -v[2]]);
      if (y0 > 0.01 || o.bottom) face('ny', bot, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], (v) => [v[0], v[2]]);
    }
    _contact(x0, z0, x1, z1, y, w) {
      const c = this.contact;
      const q = (ax, az, bx, bz, cx, cz, dx, dz) => {
        // a,b = inner edge (v=0), c,d = outer edge (v=1)
        c.pos.push(ax, y, az, bx, y, bz, cx, y, cz, ax, y, az, cx, y, cz, dx, y, dz);
        c.uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      };
      q(x0, z1, x1, z1, x1 + w, z1 + w, x0 - w, z1 + w);
      q(x1, z0, x0, z0, x0 - w, z0 - w, x1 + w, z0 - w);
      q(x1, z1, x1, z0, x1 + w, z0 - w, x1 + w, z1 + w);
      q(x0, z0, x0, z1, x0 - w, z1 + w, x0 - w, z0 - w);
    }
    // soft additive glow pool on the ground (fake light)
    glow(x, y, z, r, color, k = 1) {
      const g = this.glows;
      const c = new THREE.Color(color).multiplyScalar(k);
      const pts = [[x - r, z - r, 0, 0], [x + r, z - r, 1, 0], [x + r, z + r, 1, 1], [x - r, z + r, 0, 1]];
      for (const i of [0, 2, 1, 0, 3, 2]) {
        g.pos.push(pts[i][0], y, pts[i][1]);
        g.uv.push(pts[i][2], pts[i][3]);
        g.col.push(c.r, c.g, c.b);
      }
    }
    // add arbitrary geometry (baked into a material bucket)
    geo(geometry, mat, matrix, uvScale = 1) {
      const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      if (matrix) g.applyMatrix4(matrix);
      const b = this._bucket(mat);
      const p = g.attributes.position.array, n = g.attributes.normal.array, uv = g.attributes.uv ? g.attributes.uv.array : null;
      for (let i = 0; i < p.length; i++) b.pos.push(p[i]);
      for (let i = 0; i < n.length; i++) b.nor.push(n[i]);
      for (let i = 0; i < p.length / 3; i++) {
        b.uv.push(uv ? uv[i * 2] * uvScale : 0, uv ? uv[i * 2 + 1] * uvScale : 0);
        b.col.push(1, 1, 1);
      }
      g.dispose();
    }
    mesh(m) { this.group.add(m); return m; }
    finalize(shadows) {
      for (const name in this.buckets) {
        const b = this.buckets[name];
        if (!b.pos.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
        g.computeBoundingSphere();
        const md = this.mats[name];
        const m = new THREE.Mesh(g, md.material);
        m.castShadow = shadows && !md.material.userData.noShadow;
        m.receiveShadow = true;
        m.matrixAutoUpdate = false;
        this.group.add(m);
      }
      if (this.contact.pos.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.contact.pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.contact.uv, 2));
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: GS.Tex.contact(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        m.renderOrder = 1;
        m.matrixAutoUpdate = false;
        this.group.add(m);
      }
      if (this.glows.pos.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.glows.pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.glows.uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.glows.col, 3));
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: GS.Tex.glow(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
        m.renderOrder = 2;
        m.matrixAutoUpdate = false;
        this.group.add(m);
      }
    }
  }

  // ================================================================== construction helpers
  function wall(B, axis, c, a0, a1, y0, y1, t, mat, holes = [], o = {}) {
    const hs = holes.slice().sort((a, b) => a.a - b.a);
    const put = (p0, p1, q0, q1) => {
      if (p1 - p0 < 0.01 || q1 - q0 < 0.01) return;
      if (axis === 'x') B.box(p0, q0, c - t / 2, p1, q1, c + t / 2, mat, o);
      else B.box(c - t / 2, q0, p0, c + t / 2, q1, p1, mat, o);
    };
    let cur = a0;
    for (const h of hs) {
      put(cur, h.a, y0, y1);
      put(h.a, h.b, h.y1, y1);
      put(h.a, h.b, y0, h.y0);
      cur = h.b;
    }
    put(cur, a1, y0, y1);
  }
  // slab with rectangular holes, split into a minimal-ish set of boxes
  function slab(B, x0, z0, x1, z1, yTop, th, mat, holes = [], o = {}) {
    const xs = [x0, x1], zs = [z0, z1];
    for (const h of holes) { xs.push(U.clamp(h.x0, x0, x1), U.clamp(h.x1, x0, x1)); zs.push(U.clamp(h.z0, z0, z1), U.clamp(h.z1, z0, z1)); }
    const ux = [...new Set(xs)].sort((a, b) => a - b), uz = [...new Set(zs)].sort((a, b) => a - b);
    const inHole = (x, z) => holes.some((h) => x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1);
    for (let j = 0; j < uz.length - 1; j++) {
      let start = -1;
      for (let i = 0; i <= ux.length - 1; i++) {
        const solid = i < ux.length - 1 && !inHole((ux[i] + ux[i + 1]) / 2, (uz[j] + uz[j + 1]) / 2);
        if (solid && start < 0) start = i;
        if (!solid && start >= 0) {
          B.box(ux[start], yTop - th, uz[j], ux[i], yTop, uz[j + 1], mat, Object.assign({ contact: false }, o));
          start = -1;
        }
      }
    }
  }
  // stairs: (x,z) = centre of the bottom edge, dir = ascent direction. returns run length
  function stairs(B, x, z, dir, w, y0, y1, mat, o = {}) {
    const rise = y1 - y0;
    const n = Math.max(1, Math.ceil(rise / 0.3 - 1e-6));
    const h = rise / n, run = o.run || 0.34;
    for (let i = 0; i < n; i++) {
      const a = i * run, b = (i + 1) * run;
      const top = y0 + (i + 1) * h;
      const bot = o.thin ? top - 0.1 : y0;
      let bx0, bx1, bz0, bz1;
      if (dir === '+x') { bx0 = x + a; bx1 = x + b; bz0 = z - w / 2; bz1 = z + w / 2; }
      else if (dir === '-x') { bx0 = x - b; bx1 = x - a; bz0 = z - w / 2; bz1 = z + w / 2; }
      else if (dir === '+z') { bz0 = z + a; bz1 = z + b; bx0 = x - w / 2; bx1 = x + w / 2; }
      else { bz0 = z - b; bz1 = z - a; bx0 = x - w / 2; bx1 = x + w / 2; }
      B.box(bx0, bot, bz0, bx1, top, bz1, mat, { contact: false, ao: !o.thin });
    }
    // explicit nav line along the stair centre so bots can always use it
    {
      const L = n * run;
      const dx = dir === '+x' ? 1 : dir === '-x' ? -1 : 0, dz = dir === '+z' ? 1 : dir === '-z' ? -1 : 0;
      const pts = [[x - dx * 0.65, y0, z - dz * 0.65]];
      for (let t = 0.2; t < L - 0.1; t += 0.68) {
        const i = Math.min(n - 1, Math.floor(t / run));
        pts.push([x + dx * t, y0 + (i + 1) * h, z + dz * t]);
      }
      pts.push([x + dx * (L + 0.65), y1, z + dz * (L + 0.65)]);
      (B.world.navLines || (B.world.navLines = [])).push(pts);
    }
    if (o.rails !== false && o.thin) {
      // side rails (visual)
      const L = n * run;
      const rm = o.railMat || mat;
      const p = (s) => s;
      void p;
      if (dir === '+z' || dir === '-z') {
        const zA = z, zB = dir === '+z' ? z + L : z - L;
        for (const xs of [x - w / 2 - 0.04, x + w / 2 + 0.04]) railLine(B, xs, y0 + 1.0, zA, xs, y1 + 1.0, zB, rm);
      } else {
        const xA = x, xB = dir === '+x' ? x + L : x - L;
        for (const zs of [z - w / 2 - 0.04, z + w / 2 + 0.04]) railLine(B, xA, y0 + 1.0, zs, xB, y1 + 1.0, zs, rm);
      }
    }
    return n * run;
  }
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3();
  function railLine(B, ax, ay, az, bx, by, bz, mat, r = 0.035) {
    _v.set(bx - ax, by - ay, bz - az);
    const len = _v.length();
    const g = new THREE.CylinderGeometry(r, r, len, 6, 1);
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.normalize());
    _m4.compose(_v2.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), _q, _s.set(1, 1, 1));
    B.geo(g, mat, _m4);
    g.dispose();
  }
  function cylDecor(B, mat, x, y, z, r, h, axis = 'y', seg = 16, rt) {
    const g = new THREE.CylinderGeometry(rt === undefined ? r : rt, r, h, seg, 1);
    if (axis === 'x') g.rotateZ(PI / 2);
    if (axis === 'z') g.rotateX(PI / 2);
    _m4.makeTranslation(x, y, z);
    B.geo(g, mat, _m4, Math.max(1, h / 2));
    g.dispose();
  }
  // enterable building
  function house(B, s) {
    const t = s.t || 0.35;
    const { x0, z0, x1, z1 } = s;
    const lv = s.levels, roof = s.roof;
    const wm = s.wall, fm = s.floor, rm = s.roofMat || 'roof';
    // walls (full height), holes provided per side in absolute coords
    const H = s.holes || {};
    wall(B, 'x', z0 + t / 2, x0, x1, lv[0], roof, t, wm, H.n || [], { contact: true });
    wall(B, 'x', z1 - t / 2, x0, x1, lv[0], roof, t, wm, H.s || [], { contact: true });
    wall(B, 'z', x0 + t / 2, z0 + t, z1 - t, lv[0], roof, t, wm, H.w || [], { contact: true });
    wall(B, 'z', x1 - t / 2, z0 + t, z1 - t, lv[0], roof, t, wm, H.e || [], { contact: true });
    // ground floor finish
    B.box(x0 + t, lv[0], z0 + t, x1 - t, lv[0] + 0.02, z1 - t, fm, { contact: false, collide: false });
    // upper slabs
    for (let i = 1; i < lv.length; i++) {
      slab(B, x0 + t, z0 + t, x1 - t, z1 - t, lv[i], 0.3, fm, (s.slabHoles || []).filter((h) => h.lvl === i));
    }
    slab(B, x0, z0, x1, z1, roof, 0.35, rm, (s.slabHoles || []).filter((h) => h.lvl === 'roof'), { bottom: s.ceil || fm });
    // parapet
    const ph = s.parapet === undefined ? 1.0 : s.parapet;
    if (ph > 0) {
      const g = s.parapetGaps || {};
      wall(B, 'x', z0 + 0.15, x0, x1, roof, roof + ph, 0.3, wm, (g.n || []).map((p) => ({ a: p[0], b: p[1], y0: roof, y1: roof + ph + 1 })));
      wall(B, 'x', z1 - 0.15, x0, x1, roof, roof + ph, 0.3, wm, (g.s || []).map((p) => ({ a: p[0], b: p[1], y0: roof, y1: roof + ph + 1 })));
      wall(B, 'z', x0 + 0.15, z0 + 0.3, z1 - 0.3, roof, roof + ph, 0.3, wm, (g.w || []).map((p) => ({ a: p[0], b: p[1], y0: roof, y1: roof + ph + 1 })));
      wall(B, 'z', x1 - 0.15, z0 + 0.3, z1 - 0.3, roof, roof + ph, 0.3, wm, (g.e || []).map((p) => ({ a: p[0], b: p[1], y0: roof, y1: roof + ph + 1 })));
    }
  }
  function crate(B, x, y, z, s = 1.0, mat = 'crate') { B.box(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, mat, { surf: 'wood', groundY: y }); }
  function rail(B, axis, c, a0, a1, y, mat, h = 1.05) {
    if (axis === 'x') B.box(a0, y, c - 0.05, a1, y + h, c + 0.05, mat, { contact: false, surf: 'metal' });
    else B.box(c - 0.05, y, a0, c + 0.05, y + h, a1, mat, { contact: false, surf: 'metal' });
  }
  function sign(B, text, color, x, y, z, w, h, rotY, k = 2.2) {
    const tex = GS.Tex.neonSign(text, color, 512, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(k, k, k), fog: true }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.renderOrder = 3;
    B.mesh(m);
    // backing panel
    const bp = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.04, h * 1.1), new THREE.MeshStandardMaterial({ color: 0x07070c, roughness: 0.6 }));
    bp.position.set(x, y, z);
    bp.rotation.y = rotY;
    bp.translateZ(-0.03);
    B.mesh(bp);
    B.anim.push({ type: 'flicker', mesh: m, base: k, seed: Math.random() * 100 });
    return m;
  }
  function neonTube(B, color, x0, y0, z0, x1, y1, z1, k = 3) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const g = new THREE.CylinderGeometry(0.035, 0.035, len, 6);
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
    B.mesh(m);
    return m;
  }
  function car(B, x, z, axis, color, y = 0) {
    const L = 4.4, W = 1.9;
    const hx = axis === 'x' ? L / 2 : W / 2, hz = axis === 'x' ? W / 2 : L / 2;
    const paint = 'car_' + color;
    if (!B.mats[paint]) B.mat(paint, new THREE.MeshStandardMaterial({ color: new THREE.Color(color), metalness: 0.6, roughness: 0.35, envMap: B.env }), 2, 'metal');
    B.box(x - hx, y + 0.28, z - hz, x + hx, y + 1.0, z + hz, paint, { surf: 'metal', contact: false });
    const cx = axis === 'x' ? 1.25 : 0.82, cz = axis === 'x' ? 0.82 : 1.25;
    B.box(x - cx, y + 1.0, z - cz, x + cx, y + 1.5, z + cz, 'glass_dark', { surf: 'metal' });
    B.box(x - cx + 0.05, y + 1.5, z - cz + 0.05, x + cx - 0.05, y + 1.56, z + cz - 0.05, paint, { collide: false });
    // wheels
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const wx = axis === 'x' ? x + sx * 1.4 : x + sx * (W / 2 - 0.05), wz = axis === 'x' ? z + sz * (W / 2 - 0.05) : z + sz * 1.4;
      cylDecor(B, 'rubber', wx, y + 0.33, wz, 0.33, 0.24, axis === 'x' ? 'z' : 'x', 12);
    }
    B._contact(x - hx, z - hz, x + hx, z + hz, y + 0.012, 0.6);
    // lights
    const fl = new THREE.Color(3, 2.8, 2.4), bl = new THREE.Color(3, 0.2, 0.2);
    const lm = (c) => new THREE.MeshBasicMaterial({ color: c });
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 0.04 : 0.35, 0.12, axis === 'x' ? 0.35 : 0.04), lm(fl));
      const b = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 0.04 : 0.35, 0.1, axis === 'x' ? 0.35 : 0.04), lm(bl));
      if (axis === 'x') { a.position.set(x + L / 2 + 0.01, y + 0.75, z + s * 0.6); b.position.set(x - L / 2 - 0.01, y + 0.8, z + s * 0.6); }
      else { a.position.set(x + s * 0.6, y + 0.75, z - L / 2 - 0.01); b.position.set(x + s * 0.6, y + 0.8, z + L / 2 + 0.01); }
      B.mesh(a); B.mesh(b);
    }
  }
  function lamp(B, x, z, y, color, headDir = [1, 0]) {
    B.box(x - 0.09, y, z - 0.09, x + 0.09, y + 6, z + 0.09, 'metal', { surf: 'metal', contact: false });
    const hx = x + headDir[0] * 1.0, hz = z + headDir[1] * 1.0;
    B.box(Math.min(x, hx) - 0.07, y + 5.9, Math.min(z, hz) - 0.07, Math.max(x, hx) + 0.07, y + 6.02, Math.max(z, hz) + 0.07, 'metal', { collide: false });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4) }));
    head.position.set(hx, y + 5.86, hz);
    if (headDir[1]) head.rotation.y = PI / 2;
    B.mesh(head);
    B.glow(hx, y + 0.02, hz, 4.2, color, 0.55);
  }
  function addLight(B, color, intensity, dist, x, y, z) {
    const l = new THREE.PointLight(color, intensity, dist, 2);
    l.position.set(x, y, z);
    B.group.add(l);
    B.lights.push(l);
    return l;
  }

  // sky dome
  function skyDome(top, mid, bottom, sun) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bottom: { value: new THREE.Color(bottom) },
        sunDir: { value: sun ? sun.dir.clone().normalize() : new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(sun ? sun.color : 0x000000) },
        sunK: { value: sun ? sun.k : 0 },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunK; varying vec3 vDir;
        void main(){ float h = normalize(vDir).y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.6)) : mix(mid, bottom, pow(-h, 0.4));
        float s = max(dot(normalize(vDir), sunDir), 0.0); c += sunCol * (pow(s, 600.0) * 8.0 + pow(s, 8.0) * 0.35) * sunK; gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
    m.renderOrder = -10;
    m.frustumCulled = false;
    return m;
  }
  function stars(n, r) {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * PI * 2, h = Math.random() * 0.9 + 0.1;
      const rr = Math.sqrt(1 - h * h);
      pos.set([Math.cos(a) * rr * r, h * r, Math.sin(a) * rr * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
  }
  function rain(count, area) {
    const pos = new Float32Array(count * 2 * 3);
    const seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * area, y = Math.random() * 30, z = (Math.random() - 0.5) * area;
      pos.set([x, y, z, x, y, z], i * 6);
      seed[i * 2] = 0; seed[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('tip', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, area: { value: area } },
      vertexShader: `uniform float time; uniform vec3 cam; uniform float area; attribute float tip; varying float vT;
        void main(){ vec3 p = position; p.y = mod(p.y - time * 22.0, 30.0) - 6.0 + cam.y; p.x = cam.x + mod(p.x - cam.x + area*0.5, area) - area*0.5; p.z = cam.z + mod(p.z - cam.z + area*0.5, area) - area*0.5;
        p.y -= tip * 0.55; p.x -= tip * 0.08; vT = tip; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: 'varying float vT; void main(){ gl_FragColor = vec4(vec3(0.55,0.65,0.9) * 0.35, 0.35 * (1.0 - vT)); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const m = new THREE.LineSegments(g, mat);
    m.frustumCulled = false;
    return m;
  }
  function dust(count, area) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) pos.set([(Math.random() - 0.5) * area, Math.random() * 12, (Math.random() - 0.5) * area], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, area: { value: area }, map: { value: GS.Tex.glow() } },
      vertexShader: `uniform float time; uniform vec3 cam; uniform float area; void main(){ vec3 p = position; p.x += time * 1.6 + sin(time*0.7 + p.z) * 0.6; p.y += sin(time + p.x*0.3) * 0.4;
        p.x = cam.x + mod(p.x - cam.x + area*0.5, area) - area*0.5; p.z = cam.z + mod(p.z - cam.z + area*0.5, area) - area*0.5;
        vec4 mv = modelViewMatrix * vec4(p,1.0); gl_PointSize = 60.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform sampler2D map; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vec3(1.0,0.92,0.78), a * 0.22); }',
      transparent: true, depthWrite: false,
    });
    const m = new THREE.Points(g, mat);
    m.frustumCulled = false;
    return m;
  }
  function envFrom(renderer, build) {
    const sc = new THREE.Scene();
    build(sc);
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(sc, 0.03);
    pm.dispose();
    return rt.texture;
  }

  // ================================================================== materials
  function stdMat(surface, o = {}) {
    const t = surface ? GS.Tex.surface(surface) : {};
    const m = new THREE.MeshStandardMaterial(Object.assign({
      map: t.map || null, normalMap: t.normalMap || null, roughnessMap: t.roughnessMap || null,
      roughness: 0.85, metalness: 0.0,
    }, o));
    if (m.normalMap) m.normalScale = new THREE.Vector2(o.ns || 0.8, o.ns || 0.8);
    return m;
  }

  // ================================================================== NEON DISTRICT
  function buildNeon(renderer, shadows) {
    const world = new GS.World();
    world.bounds = { x0: -50, z0: -50, x1: 50, z1: 50 };
    const group = new THREE.Group();
    const B = new MapBuilder(world, group);
    const env = envFrom(renderer, (sc) => {
      sc.add(skyDome(0x06061a, 0x1a0f3a, 0x05050a));
      const cols = [0xff2fd0, 0x00f0ff, 0x7a5cff, 0xff9f1c, 0x3d8bff];
      for (let i = 0; i < 18; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(cols[i % 5]).multiplyScalar(2.5) }));
        const a = (i / 18) * PI * 2;
        m.position.set(Math.cos(a) * 30, 4 + (i % 3) * 5, Math.sin(a) * 30);
        m.lookAt(0, 4, 0);
        sc.add(m);
      }
    });
    B.env = env;
    B.mat('asphalt', stdMat('asphalt', { roughness: 1, metalness: 0.15, envMap: env, envMapIntensity: 1.4, ns: 0.6 }), 6, 'asphalt');
    B.mat('sidewalk', stdMat('sidewalk', { roughness: 0.75, envMap: env, envMapIntensity: 0.6 }), 4);
    B.mat('brick', stdMat('brick_dark', { roughness: 0.9 }), 3);
    B.mat('brickR', stdMat('brick', { roughness: 0.9 }), 3);
    B.mat('panel', stdMat('panel', { roughness: 0.5, metalness: 0.4, envMap: env }), 4, 'metal');
    B.mat('concrete', stdMat('concrete', { roughness: 0.9 }), 4);
    B.mat('concreteD', stdMat('concrete_dark', { roughness: 0.9 }), 4);
    B.mat('tiles', stdMat('tiles_dark', { roughness: 0.35, envMap: env, envMapIntensity: 0.7 }), 3);
    B.mat('plaster', stdMat('plaster', { roughness: 0.9, color: 0x9a90a8 }), 3);
    B.mat('roof', stdMat('roof', { roughness: 0.95 }), 4);
    B.mat('metal', stdMat('metal', { roughness: 0.4, metalness: 0.8, envMap: env }), 2, 'metal');
    B.mat('crate', stdMat('crate', { roughness: 0.8 }), 1.2, 'wood');
    B.mat('hazard', stdMat('hazard', { roughness: 0.7 }), 1.5);
    B.mat('rubber', stdMat('rubber', { roughness: 0.9 }), 1);
    B.mat('glass_dark', new THREE.MeshStandardMaterial({ color: 0x0a0e18, roughness: 0.08, metalness: 0.6, envMap: env }), 2, 'metal');
    B.mat('trim', new THREE.MeshStandardMaterial({ color: 0x15151d, roughness: 0.5, metalness: 0.5, envMap: env }), 2, 'metal');
    B.mat('paintY', new THREE.MeshStandardMaterial({ color: 0xe8c23a, roughness: 0.6 }), 2);
    B.mat('paintW', new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.6 }), 2);
    B.mat('canopyR', new THREE.MeshStandardMaterial({ color: 0xb8203a, roughness: 0.8, side: THREE.DoubleSide }), 2);
    B.mat('canopyB', new THREE.MeshStandardMaterial({ color: 0x2040b8, roughness: 0.8, side: THREE.DoubleSide }), 2);
    B.mat('canopyY', new THREE.MeshStandardMaterial({ color: 0xc89a20, roughness: 0.8, side: THREE.DoubleSide }), 2);
    const facPal = [
      { lit: 0.42, wall: [62, 58, 84], colors: [[255, 190, 120], [120, 200, 255], [255, 120, 220], [255, 230, 180]] },
      { lit: 0.3, wall: [52, 60, 78], colors: [[120, 220, 255], [200, 140, 255], [255, 210, 160]] },
      { lit: 0.5, wall: [76, 50, 66], colors: [[255, 160, 200], [255, 220, 150], [150, 255, 230]] },
    ];
    for (let i = 0; i < 3; i++) {
      const ft = GS.Tex.facade(1000 + i, facPal[i]);
      B.mat('fac' + i, new THREE.MeshStandardMaterial({ map: ft.map, emissiveMap: ft.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.6, metalness: 0.3, envMap: env }), 28);
    }

    // ---- ground & streets
    B.box(-75, -1, -75, 75, 0, 75, 'asphalt', { contact: false });
    B.box(-50, 0, -50, -7, 0.15, -6, 'sidewalk', { contact: false });
    B.box(7, 0, -50, 50, 0.15, -6, 'sidewalk', { contact: false });
    B.box(-50, 0, 6, -7, 0.15, 50, 'sidewalk', { contact: false });
    B.box(7, 0, 6, 50, 0.15, 50, 'sidewalk', { contact: false });
    // lane markings
    for (let z = -48; z < 48; z += 6) if (Math.abs(z) > 9) B.box(-0.08, 0, z, 0.08, 0.012, z + 3, 'paintY', { collide: false, contact: false });
    for (let x = -48; x < 48; x += 6) if (Math.abs(x) > 10) B.box(x, 0, -0.08, x + 3, 0.012, 0.08, 'paintY', { collide: false, contact: false });
    for (let i = -6; i <= 6; i++) {
      B.box(i * 1.0 - 0.3, 0, -8.6, i * 1.0 + 0.3, 0.012, -6.6, 'paintW', { collide: false, contact: false });
      B.box(i * 1.0 - 0.3, 0, 6.6, i * 1.0 + 0.3, 0.012, 8.6, 'paintW', { collide: false, contact: false });
      B.box(-8.6, 0, i * 0.9 - 0.25, -7.2, 0.012, i * 0.9 + 0.25, 'paintW', { collide: false, contact: false });
      B.box(7.2, 0, i * 0.9 - 0.25, 8.6, 0.012, i * 0.9 + 0.25, 'paintW', { collide: false, contact: false });
    }

    // ---- perimeter towers
    const tower = (x0, z0, x1, z1, h, f) => {
      B.box(x0, 0, z0, x1, h, z1, 'fac' + f, { top: 'roof' });
      B.box(x0 + 0.5, h, z0 + 0.5, x0 + 2.5, h + 1.6, z0 + 2, 'metal', { collide: false });
    };
    const ring = [
      [-62, -62, -36, -50, 34, 0], [-36, -62, -14, -50, 26, 1], [-14, -62, 14, -50, 40, 2], [14, -62, 36, -50, 30, 0], [36, -62, 62, -50, 36, 1],
      [-62, 50, -30, 62, 30, 2], [-30, 50, -6, 62, 38, 0], [-6, 50, 18, 62, 26, 1], [18, 50, 40, 62, 42, 2], [40, 50, 62, 62, 28, 0],
      [-62, -50, -50, -20, 28, 1], [-62, -20, -50, 20, 36, 2], [-62, 20, -50, 50, 24, 0],
      [50, -50, 62, -15, 32, 2], [50, -15, 62, 18, 24, 0], [50, 18, 62, 50, 38, 1],
    ];
    for (const r of ring) tower(r[0], r[1], r[2], r[3], r[4], r[5]);
    // distant skyline
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * PI * 2, d = 95 + Math.random() * 60;
      const w = 10 + Math.random() * 16, h = 30 + Math.random() * 90;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      B.box(x - w / 2, 0, z - w / 2, x + w / 2, h, z + w / 2, 'fac' + (i % 3), { collide: false, contact: false });
    }
    // big screen at the north end of the avenue
    const scr = GS.Tex.neonSign('GAMBELSTRIKE 2', '#ff2fd0', 1024, 256);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.2), new THREE.MeshBasicMaterial({ map: scr, color: new THREE.Color(2, 2, 2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    screen.position.set(0, 14, -49.9);
    B.mesh(screen);
    B.box(-7.5, 11.5, -50.2, 7.5, 16.5, -49.95, 'trim', { collide: false });
    sign(B, 'SPIN TO WIN', '#00f0ff', 0, 10, 49.9, 9, 2.2, PI, 2.4);

    // ---- NW: tower A, arcade B, courtyard, alley
    B.box(-50, 0.15, -50, -34, 30, -34, 'fac2', { top: 'roof' });
    sign(B, 'GAMBEL', '#ff2fd0', -33.9, 12, -42, 10, 2.5, PI / 2, 2.6);
    house(B, {
      x0: -30, z0: -46, x1: -12, z1: -30, levels: [0.15, 4.5], roof: 9, wall: 'brickR', floor: 'tiles', ceil: 'plaster',
      holes: {
        s: [{ a: -25.2, b: -22.8, y0: 0.15, y1: 2.9 }, { a: -17.2, b: -14.8, y0: 0.15, y1: 2.9 }, { a: -21.6, b: -18.6, y0: 1.1, y1: 2.4 }, { a: -27.5, b: -24.5, y0: 5.5, y1: 6.9 }, { a: -19.5, b: -16.5, y0: 5.5, y1: 6.9 }],
        e: [{ a: -39.2, b: -36.8, y0: 0.15, y1: 2.9 }, { a: -44, b: -41.5, y0: 5.5, y1: 6.9 }, { a: -35, b: -32.5, y0: 5.5, y1: 6.9 }],
        w: [{ a: -40, b: -37, y0: 5.5, y1: 6.9 }],
      },
      slabHoles: [{ lvl: 1, x0: -28.7, z0: -45.66, x1: -23.4, z1: -44.0 }],
      parapetGaps: { e: [[-40, -37.2], [-31.8, -30.3]] },
    });
    stairs(B, -28.5, -44.85, '+x', 1.5, 0.15, 4.5, 'concreteD');
    // arcade machines
    for (let i = 0; i < 5; i++) {
      const x = -28 + i * 2.4;
      B.box(x, 0.15, -43.4, x + 1.2, 2.0, -42.6, 'trim', { surf: 'metal' });
      const scrM = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(i / 5, 1, 0.5).multiplyScalar(2.2) }));
      scrM.position.set(x + 0.6, 1.45, -42.59);
      B.mesh(scrM);
    }
    for (let i = 0; i < 3; i++) B.box(-27.5 + i * 4, 0.15, -36, -26.3 + i * 4, 2.0, -35.2, 'trim', { surf: 'metal' });
    B.box(-20, 4.5, -42, -15, 5.6, -41.2, 'trim', { surf: 'metal' });
    B.box(-26, 4.5, -36, -24, 5.3, -33, 'crate', { surf: 'wood' });
    addLight(B, 0x00e0ff, 6, 16, -21, 3.3, -37);
    sign(B, 'ARCADE', '#00f0ff', -20, 3.6, -29.78, 6, 1.5, 0, 2.6);
    // fire escape to arcade roof
    stairs(B, -10.85, -31, '-z', 1.5, 0.15, 4.5, 'metal', { thin: true });
    B.box(-11.6, 4.35, -37.7, -8.3, 4.5, -36.1, 'metal', { contact: false });
    stairs(B, -9.1, -36.1, '+z', 1.5, 4.5, 9, 'metal', { thin: true });
    B.box(-12, 8.85, -31.6, -8.3, 9.0, -29.6, 'metal', { contact: false });
    rail(B, 'z', -8.25, -37.7, -36.1, 4.5, 'metal');
    rail(B, 'z', -8.25, -31.6, -29.6, 9, 'metal');
    // bridge over the avenue
    B.box(-12, 8.6, -40, 10, 9.0, -37.2, 'concreteD', { contact: false });
    rail(B, 'x', -40, -12, 10, 9.0, 'metal');
    rail(B, 'x', -37.2, -12, 10, 9.0, 'metal');
    B.box(-7, 0, -39.0, -6.2, 8.6, -38.2, 'concreteD');
    B.box(6.2, 0, -39.0, 7, 8.6, -38.2, 'concreteD');
    neonTube(B, '#ff2fd0', -12, 8.55, -40.05, 10, 8.55, -40.05);
    neonTube(B, '#00f0ff', -12, 8.55, -37.15, 10, 8.55, -37.15);
    // courtyard
    B.box(-46, 0.15, -24, -40, 3.2, -19, 'panel');
    B.box(-46.2, 2.6, -19, -39.8, 2.75, -17.6, 'canopyR');
    B.box(-45.5, 0.15, -19, -40.5, 1.1, -18.6, 'trim');
    sign(B, 'RAMEN', '#ff9f1c', -43, 3.7, -18.95, 4.2, 1.1, 0, 2.6);
    addLight(B, 0xff8a3a, 5, 14, -43, 2.5, -16);
    crate(B, -34, 0.15, -22, 1.0); crate(B, -33, 0.15, -22, 1.0); crate(B, -33.5, 1.15, -22, 1.0);
    crate(B, -20, 0.15, -15, 1.2); crate(B, -18.6, 0.15, -15.2, 1.0);
    B.box(-28, 0.15, -14, -23, 2.4, -11.6, 'panel', { surf: 'metal' });
    B.box(-16, 0.15, -20.3, -10, 1.05, -19.5, 'concrete');
    B.box(-38, 0.15, -28.8, -35.6, 1.5, -27.6, 'paintY', { surf: 'metal' });
    // alley
    B.box(-33.6, 0.15, -45, -31.4, 1.5, -43.6, 'metal', { surf: 'metal' });
    crate(B, -31, 0.15, -38, 1.0);
    B.emitters.push({ type: 'steam', x: -32, y: 0.2, z: -36 });
    neonTube(B, '#9dff00', -33.9, 4, -48, -33.9, 4, -36);

    // ---- NE: tower C, hotel D, parking
    B.box(34, 0.15, -50, 50, 26, -30, 'fac1', { top: 'roof' });
    sign(B, 'SPIN TO WIN', '#ffd23f', 33.9, 9, -40, 8, 2, -PI / 2, 2.4);
    house(B, {
      x0: 10, z0: -46, x1: 30, z1: -28, levels: [0.15, 4.5], roof: 9, wall: 'panel', floor: 'tiles', ceil: 'plaster',
      holes: {
        s: [{ a: 18.5, b: 21.5, y0: 0.15, y1: 3.2 }, { a: 12, b: 15.5, y0: 1.0, y1: 2.6 }, { a: 24.5, b: 28, y0: 1, y1: 2.6 }, { a: 12, b: 15, y0: 5.5, y1: 7 }, { a: 17, b: 20, y0: 5.5, y1: 7 }, { a: 24, b: 27, y0: 5.5, y1: 7 }],
        w: [{ a: -35.2, b: -32.8, y0: 0.15, y1: 2.9 }, { a: -44, b: -41.5, y0: 5.5, y1: 7 }],
        e: [{ a: -42, b: -39.6, y0: 0.15, y1: 2.9 }, { a: -36, b: -33, y0: 5.5, y1: 7 }],
      },
      slabHoles: [{ lvl: 1, x0: 11.9, z0: -45.66, x1: 17.1, z1: -44.0 }, { lvl: 'roof', x0: 27.9, z0: -35.1, x1: 29.66, z1: -29.9 }],
      parapetGaps: { w: [[-40, -37.2]] },
    });
    stairs(B, 12, -44.85, '+x', 1.5, 0.15, 4.5, 'concreteD');
    stairs(B, 28.8, -30, '-z', 1.5, 4.5, 9, 'concreteD');
    B.box(14, 0.15, -32, 19, 1.15, -31, 'trim', { surf: 'wood' });
    B.box(23, 0.15, -38, 26, 0.75, -36.5, 'canopyB');
    B.box(13, 0.15, -40, 13.6, 4.2, -39.4, 'concrete');
    B.box(20, 4.5, -45.65, 20.3, 8.6, -38, 'plaster');
    B.box(13, 4.5, -36, 16, 5.3, -34, 'crate', { surf: 'wood' });
    sign(B, 'HOTEL NOVA', '#ff7ad9', 20, 3.9, -27.78, 7, 1.6, 0, 2.6);
    addLight(B, 0xffb070, 5, 16, 20, 3.4, -33);
    // parking
    for (const p of [[14, -24], [30, -24], [14, -16], [30, -16]]) B.box(p[0] - 0.2, 0.15, p[1] - 0.2, p[0] + 0.2, 2.9, p[1] + 0.2, 'concreteD');
    B.box(13.5, 2.9, -24.5, 30.5, 3.1, -15.5, 'metal', { contact: false });
    crate(B, 31.1, 0.15, -20.5, 1.0); crate(B, 31.1, 0.15, -21.5, 1.0); crate(B, 31.1, 1.15, -21.5, 1.0);
    car(B, 16, -11, 'z', '#1f6feb', 0.15); car(B, 22, -11, 'z', '#b81d4a', 0.15); car(B, 34, -11, 'z', '#d8d8d8', 0.15);
    car(B, 40, -21, 'x', '#2a2a2a', 0.15); car(B, 24, -20, 'z', '#e0a020', 0.15);
    B.box(34, 0.15, -30, 50, 1.3, -26.5, 'concrete');
    stairs(B, 36.75, -25.14, '-z', 1.5, 0.15, 1.3, 'concreteD');
    B.box(42, 0.15, -18, 48, 2.75, -15.5, 'metal', { surf: 'metal' });
    for (const x of [12, 26, 38]) B.box(x - 1.2, 0, -7.4, x + 1.2, 0.9, -6.8, 'concrete');
    addLight(B, 0x3d8bff, 5, 18, 22, 2.7, -20);

    // ---- SW: tower E, club F, market
    B.box(-50, 0.15, 32, -32, 34, 50, 'fac0', { top: 'roof' });
    house(B, {
      x0: -28, z0: 30, x1: -10, z1: 48, levels: [0.15], roof: 6.5, wall: 'brick', floor: 'tiles', ceil: 'trim',
      holes: {
        s: [{ a: -21, b: -17, y0: 0.15, y1: 3.0 }],
        e: [{ a: 38.8, b: 41.2, y0: 0.15, y1: 2.9 }],
        w: [{ a: 34, b: 36, y0: 0.15, y1: 2.9 }],
      },
      parapetGaps: { w: [[41.48, 43.9]] },
    });
    const dance = new THREE.Mesh(new THREE.PlaneGeometry(10, 8, 10, 8), new THREE.MeshBasicMaterial({ vertexColors: true }));
    {
      const g = dance.geometry.toNonIndexed();
      const col = [];
      for (let i = 0; i < g.attributes.position.count / 6; i++) {
        const c = new THREE.Color().setHSL(Math.random(), 1, 0.5).multiplyScalar(0.9);
        for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      dance.geometry = g;
    }
    dance.rotation.x = -PI / 2;
    dance.position.set(-19, 0.18, 40);
    B.mesh(dance);
    B.anim.push({ type: 'dance', mesh: dance });
    B.box(-22, 0.15, 45, -16, 1.1, 47.65, 'trim', { surf: 'metal' });
    stairs(B, -16.75, 43.64, '+z', 1.5, 0.15, 1.1, 'trim');
    B.box(-27.65, 0.15, 33, -26.5, 1.1, 43, 'trim', { surf: 'wood' });
    B.box(-24.3, 0.15, 33.7, -23.7, 6.15, 34.3, 'concreteD');
    B.box(-14.3, 0.15, 33.7, -13.7, 6.15, 34.3, 'concreteD');
    neonTube(B, '#a259ff', -27.6, 5.5, 31, -27.6, 5.5, 47);
    neonTube(B, '#ff2fd0', -10.4, 5.5, 31, -10.4, 5.5, 47);
    const disco = addLight(B, 0xff2fd0, 8, 18, -19, 4.5, 40);
    B.anim.push({ type: 'disco', light: disco });
    sign(B, 'CLUB VOID', '#a259ff', -19, 4.0, 29.78, 6.5, 1.5, PI, 2.8);
    stairs(B, -30.85, 34, '+z', 1.5, 0.15, 6.5, 'metal', { thin: true });
    B.box(-31.6, 6.35, 41.48, -28, 6.5, 43.9, 'metal', { contact: false });
    rail(B, 'z', -31.65, 41.48, 43.9, 6.5, 'metal');
    // market
    const canopies = ['canopyR', 'canopyB', 'canopyY'];
    let ci = 0;
    for (const cz of [13, 21]) {
      for (const cx of [-44, -37, -30, -23, -16]) {
        if (cx === -30 && cz === 13) continue;
        B.box(cx - 1.5, 0.15, cz - 0.5, cx + 1.5, 1.15, cz + 0.5, 'crate', { surf: 'wood' });
        B.box(cx - 1.8, 2.6, cz - 1.6, cx + 1.8, 2.7, cz + 1.6, canopies[ci++ % 3], { contact: false });
        B.box(cx - 1.75, 0.15, cz - 1.55, cx - 1.6, 2.6, cz - 1.4, 'metal', { contact: false });
        B.box(cx + 1.6, 0.15, cz - 1.55, cx + 1.75, 2.6, cz - 1.4, 'metal', { contact: false });
        const lan = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.4) }));
        lan.position.set(cx, 2.35, cz + 1.2);
        B.mesh(lan);
        B.glow(cx, 0.17, cz + 1.4, 2.6, '#ff9040', 0.5);
      }
    }
    addLight(B, 0xff9040, 5, 16, -30, 3, 17);
    crate(B, -12, 0.15, 10, 1.0); crate(B, -12, 0.15, 11.2, 1.0);

    // ---- SE: garage G, tower H, plaza, kiosk
    B.box(38, 0.15, 22, 50, 22, 50, 'fac2', { top: 'roof' });
    slab(B, 12, 16, 34, 40, 4.3, 0.4, 'concreteD', [{ x0: 30.1, z0: 33.24, x1: 31.9, z1: 38.1 }]);
    slab(B, 12, 16, 34, 40, 8.4, 0.4, 'concreteD', [{ x0: 14.1, z0: 17.9, x1: 15.9, z1: 22.76 }]);
    for (const px of [12.3, 18, 23, 28, 33.7]) for (const pz of [16.3, 22, 28, 34, 39.7]) B.box(px - 0.3, 0.15, pz - 0.3, px + 0.3, 8.0, pz + 0.3, 'concrete');
    stairs(B, 31, 38, '-z', 1.5, 0.15, 4.3, 'concreteD');
    stairs(B, 15, 18, '+z', 1.5, 4.3, 8.4, 'concreteD');
    wall(B, 'x', 39.85, 12, 34, 4.3, 5.3, 0.3, 'concrete', [{ a: 22, b: 25, y0: 4.3, y1: 6 }]);
    wall(B, 'x', 16.15, 12, 34, 4.3, 5.3, 0.3, 'concrete');
    wall(B, 'z', 12.15, 16.3, 39.7, 4.3, 5.3, 0.3, 'concrete');
    wall(B, 'z', 33.85, 16.3, 39.7, 4.3, 5.3, 0.3, 'concrete', [{ a: 24, b: 27, y0: 4.3, y1: 6 }]);
    wall(B, 'x', 39.85, 12, 34, 8.4, 9.4, 0.3, 'concrete');
    wall(B, 'x', 16.15, 12, 34, 8.4, 9.4, 0.3, 'concrete');
    wall(B, 'z', 12.15, 16.3, 39.7, 8.4, 9.4, 0.3, 'concrete');
    wall(B, 'z', 33.85, 16.3, 39.7, 8.4, 9.4, 0.3, 'concrete');
    car(B, 20, 26, 'x', '#6b2fd8', 0.15); car(B, 26, 33, 'x', '#2f9e5b', 4.3); car(B, 19, 34, 'x', '#c03030', 4.3);
    B.box(22, 0.15, 19, 24, 1.1, 20, 'hazard');
    B.box(27, 8.4, 24, 29, 9.6, 27, 'metal', { surf: 'metal' });
    neonTube(B, '#00f0ff', 12.2, 3.85, 16.3, 33.8, 3.85, 16.3);
    neonTube(B, '#00f0ff', 12.2, 3.85, 39.7, 33.8, 3.85, 39.7);
    addLight(B, 0xbfe6ff, 5, 18, 23, 3.6, 28);
    B.box(18, 0.15, 44, 24, 0.75, 48, 'concrete');
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 2.2, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2.6), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    fountain.position.set(21, 1.8, 46);
    B.mesh(fountain);
    B.box(28, 0.15, 45, 31, 0.6, 45.6, 'trim', { surf: 'wood' });
    B.box(10, 0.15, 44, 11, 2.1, 45, 'trim', { surf: 'metal' });
    B.box(38, 0.15, 8, 46, 3.5, 14, 'panel');
    sign(B, '24/7', '#9dff00', 42, 3.0, 14.02, 3, 1, 0, 2.6);
    addLight(B, 0x9dff00, 4, 12, 42, 2.4, 16);

    // ---- centre plaza + street furniture
    B.box(-2.5, 0, -2.5, 2.5, 0.8, 2.5, 'trim', { surf: 'metal' });
    const holo = new THREE.Group();
    const segs = 12;
    for (let i = 0; i < segs; i++) {
      const g = new THREE.RingGeometry(1.0, 2.4, 6, 1, (i / segs) * PI * 2, (PI * 2) / segs - 0.03);
      const c = new THREE.Color().setHSL(i / segs, 1, 0.55).multiplyScalar(1.8);
      holo.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    }
    holo.position.set(0, 4.2, 0);
    B.mesh(holo);
    B.anim.push({ type: 'spin', obj: holo, speed: 0.8 });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.2, 3.4, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.3, 1.6), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(0, 2.5, 0);
    B.mesh(beam);
    addLight(B, 0xff2fd0, 7, 20, 0, 3, 0);
    for (const p of [[-4, -9], [4, 9], [-9, 4], [9, -4]]) B.box(p[0] - 1, 0, p[1] - 0.5, p[0] + 1, 0.9, p[1] + 0.5, 'concrete');
    car(B, 3, -18, 'z', '#f2c200'); car(B, -3, 20, 'z', '#f2c200'); car(B, 2.5, 36, 'z', '#3050a0');
    car(B, -24, 2.5, 'x', '#808890'); car(B, 22, -2.5, 'x', '#a02040'); car(B, 40, 2, 'x', '#f2c200');
    B.box(-43, 0, -2.75, -33, 3.0, -0.25, 'panel', { surf: 'metal' });
    B.box(-1.5, 0, -30.4, 1.5, 0.9, -29.6, 'concrete');
    B.box(-2.5, 0, 27.6, 0.5, 0.9, 28.4, 'concrete');
    for (const p of [[-8, -20], [-8, 20], [8, -34], [8, 30], [-22, -6.6], [24, 6.6], [-38, 6.6], [38, -6.6]]) {
      const dir = Math.abs(p[0]) === 8 ? [p[0] > 0 ? -1 : 1, 0] : [0, p[1] > 0 ? -1 : 1];
      lamp(B, p[0], p[1], 0.15, '#bcd4ff', dir);
    }
    B.glow(0, 0.02, 0, 7, '#ff2fd0', 0.6);
    B.glow(-20, 0.17, -28.5, 5, '#00f0ff', 0.5);
    B.glow(-19, 0.17, 28.5, 5, '#a259ff', 0.6);
    B.glow(20, 0.17, -26.5, 5, '#ff7ad9', 0.4);
    // puddles
    const pudMat = new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 0.02, metalness: 0.9, envMap: env, envMapIntensity: 2.2, transparent: true, alphaMap: GS.Tex.puddle(), depthWrite: false });
    for (const p of [[-3, -14, 3], [4, 24, 4], [-20, 3, 3.5], [16, -2, 3], [0, 42, 3.5], [-40, 2, 3], [34, 3, 2.5], [5, -36, 3]]) {
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(p[2] * 2, p[2] * 1.4), pudMat);
      pm.rotation.x = -PI / 2;
      pm.rotation.z = Math.random() * PI;
      pm.position.set(p[0], 0.008, p[1]);
      pm.renderOrder = 1;
      B.mesh(pm);
    }
    B.emitters.push({ type: 'steam', x: 5, y: 0.05, z: -12 }, { type: 'steam', x: -6, y: 0.05, z: 30 });

    B.finalize(shadows);
    const sky = skyDome(0x05040f, 0x1b0e36, 0x030308);
    group.add(sky);
    const st = stars(900, 450);
    group.add(st);
    const rn = rain(4000, 60);
    group.add(rn);

    const spawns = [
      [-40, 0.15, -12], [-25, 0.15, -10], [-15, 0.15, -24], [-32, 0.15, -40], [-20, 0.15, -38], [-16, 4.5, -40], [-20, 9, -36],
      [12, 0.15, -20], [28, 0.15, -12], [44, 0.15, -22], [42, 1.3, -28], [16, 0.15, -36], [24, 4.5, -40], [20, 9, -36],
      [-40, 0.15, 10], [-20, 0.15, 17], [-30, 0.15, 24], [-20, 0.15, 40], [-18, 6.5, 40], [-30, 0.15, 46],
      [20, 0.15, 30], [26, 4.3, 24], [22, 8.4, 32], [40, 0.15, 18], [28, 0.15, 46], [12, 0.15, 10],
      [0, 0, -40], [0, 0, 42], [-40, 0, 3], [40, 0, -3], [-12, 0, 0], [12, 0, 0],
    ];
    return {
      id: 'neon', group, world, env, spawns, builder: B,
      fog: new THREE.FogExp2(0x140b26, 0.0135),
      background: new THREE.Color(0x05040f),
      light: {
        hemi: [0x5a4aa0, 0x18101e, 0.75], sun: [0x9fb0ff, 0.55], sunDir: new THREE.Vector3(-0.35, 1, 0.25),
        shadowBox: 60,
      },
      vm: { sky: 0x8a7ae0, ground: 0x3a2840, hemi: 1.3, sun: 0xd8d8ff, sunI: 1.1, sunDir: new THREE.Vector3(-0.35, 1, 0.25) },
      grade: { tint: [1.02, 0.96, 1.08], contrast: 1.08, sat: 1.12, vignette: 0.45, exposure: 1.05 },
      bloom: { strength: 0.85, radius: 0.55, threshold: 0.72 },
      ambience: 'amb_city', reverb: 0.45,
      update(t, dt, cam) {
        rn.material.uniforms.time.value = t;
        if (cam) rn.material.uniforms.cam.value.copy(cam.position);
        for (const a of B.anim) {
          if (a.type === 'spin') a.obj.rotation.z = t * a.speed;
          else if (a.type === 'flicker') {
            const f = Math.sin(t * 13 + a.seed) * Math.sin(t * 7.3 + a.seed * 2) > 0.97 ? 0.3 : 1;
            a.mesh.material.color.setScalar(a.base * f);
          } else if (a.type === 'disco') {
            a.light.color.setHSL((t * 0.15) % 1, 1, 0.5);
          } else if (a.type === 'dance') {
            a.mesh.material.color.setScalar(0.6 + 0.4 * Math.abs(Math.sin(t * 4)));
          }
        }
        holo.rotation.x = PI / 2;
      },
      menuPath: [[0, 4, 32], [2, 5, 12], [-4, 6, -2], [-22, 5, 1], [-38, 7, 3], [-26, 10, -2], [-4, 12, -24], [0, 13, -36], [5, 8, -22], [4, 5, 8]],
      thumb: { pos: [16, 14, 20], look: [-6, 3, -16] },
    };
  }

  // ================================================================== DESERT FACILITY
  function buildDesert(renderer, shadows) {
    const world = new GS.World();
    world.bounds = { x0: -55, z0: -55, x1: 55, z1: 55 };
    const group = new THREE.Group();
    const B = new MapBuilder(world, group);
    const env = envFrom(renderer, (sc) => {
      sc.add(skyDome(0x3f7fd0, 0xbfd8f0, 0xc8a070, { dir: new THREE.Vector3(0.5, 0.8, 0.3), color: 0xfff0d0, k: 1 }));
      const gnd = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0xc9a274 }));
      gnd.rotation.x = -PI / 2; gnd.position.y = -2;
      sc.add(gnd);
    });
    B.env = env;
    B.mat('sand', stdMat('sand', { roughness: 1, ns: 0.7 }), 8, 'sand');
    B.mat('concrete', stdMat('concrete_warm', { roughness: 0.9 }), 4);
    B.mat('concreteD', stdMat('concrete', { roughness: 0.9, color: 0xc8c0b4 }), 4);
    B.mat('pad', stdMat('concrete_warm', { roughness: 0.95, color: 0xb8a890 }), 6);
    B.mat('tiles', stdMat('tiles', { roughness: 0.5, envMap: env, envMapIntensity: 0.4 }), 3);
    B.mat('roof', stdMat('roof', { roughness: 0.95, color: 0xa09080 }), 4);
    B.mat('metal', stdMat('metal', { roughness: 0.45, metalness: 0.8, envMap: env }), 2, 'metal');
    B.mat('panel', stdMat('panel', { roughness: 0.5, metalness: 0.5, envMap: env, color: 0xb0b8c0 }), 4, 'metal');
    B.mat('crate', stdMat('crate', { roughness: 0.8 }), 1.2, 'wood');
    B.mat('hazard', stdMat('hazard', { roughness: 0.7 }), 1.5);
    B.mat('rubber', stdMat('rubber', { roughness: 0.9 }), 1);
    B.mat('asphalt', stdMat('asphalt', { roughness: 0.95, color: 0xb0a898 }), 6, 'asphalt');
    B.mat('glass_dark', new THREE.MeshStandardMaterial({ color: 0x182028, roughness: 0.1, metalness: 0.6, envMap: env }), 2, 'metal');
    B.mat('sandbag', stdMat('sand', { roughness: 1, color: 0xb09870 }), 1, 'sand');
    B.mat('rock', stdMat('concrete', { roughness: 1, color: 0x9a7a5a }), 3, 'concrete');
    for (const [n, c] of [['contR', 0xa83a2a], ['contB', 0x2a5aa8], ['contG', 0x3a7a4a], ['contO', 0xd0802a], ['contW', 0xd8d4c8]]) {
      B.mat(n, stdMat('container', { roughness: 0.6, metalness: 0.5, color: c, envMap: env }), 6, 'metal');
    }
    const CONT = ['contR', 'contB', 'contG', 'contO', 'contW'];

    // ---- ground
    B.box(-90, -1, -90, 90, 0, 90, 'sand', { contact: false });
    B.box(-16, 0, -14, 16, 0.12, 14, 'pad', { contact: false });
    B.box(-36, 0, -54, 8, 0.05, -24, 'pad', { contact: false, collide: false });
    B.box(-2, 0, -55, 2, 0.02, -14, 'pad', { collide: false, contact: false });
    B.box(-55, 0, -21, 55, 0.02, -17, 'pad', { collide: false, contact: false });
    B.box(-2, 0, 14, 2, 0.02, 55, 'pad', { collide: false, contact: false });
    // perimeter wall
    const per = (x0, z0, x1, z1) => B.box(x0, 0, z0, x1, 6, z1, 'concrete', { top: 'concreteD' });
    per(-57, -57, 57, -55); per(-57, 55, 57, 57); per(-57, -55, -55, 55); per(55, -55, 57, 55);
    for (let i = -54; i <= 54; i += 9) {
      B.box(i - 0.4, 6, -56.4, i + 0.4, 7.4, -55.6, 'metal', { collide: false });
      B.box(i - 0.4, 6, 55.6, i + 0.4, 7.4, 56.4, 'metal', { collide: false });
    }
    // dunes & mesas outside
    const duneMat = 'sand';
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * PI * 2, d = 90 + Math.random() * 70;
      const g = new THREE.SphereGeometry(1, 16, 8, 0, PI * 2, 0, PI / 2);
      const m4 = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * d, -1, Math.sin(a) * d), new THREE.Quaternion(), new THREE.Vector3(30 + Math.random() * 30, 8 + Math.random() * 18, 30 + Math.random() * 30));
      B.geo(g, duneMat, m4, 10);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2 + 0.3, d = 200 + Math.random() * 60;
      const x = Math.cos(a) * d, z = Math.sin(a) * d, w = 30 + Math.random() * 40, h = 25 + Math.random() * 30;
      B.box(x - w / 2, 0, z - w / 2, x + w / 2, h, z + w / 2, 'rock', { collide: false, contact: false });
    }

    // ---- main lab
    house(B, {
      x0: -12, z0: -10, x1: 12, z1: 10, levels: [0.12, 4.6], roof: 9, t: 0.4, wall: 'concrete', floor: 'tiles', ceil: 'concreteD',
      holes: {
        n: [{ a: -1.5, b: 1.5, y0: 0.12, y1: 3.2 }, { a: -9, b: -6, y0: 5.6, y1: 7 }, { a: 6, b: 9, y0: 5.6, y1: 7 }, { a: -8, b: -5, y0: 1.2, y1: 2.4 }, { a: 5, b: 8, y0: 1.2, y1: 2.4 }],
        s: [{ a: -1.5, b: 1.5, y0: 0.12, y1: 3.2 }, { a: -9, b: -6, y0: 5.6, y1: 7 }, { a: 6, b: 9, y0: 5.6, y1: 7 }, { a: -8, b: -5, y0: 1.2, y1: 2.4 }, { a: 5, b: 8, y0: 1.2, y1: 2.4 }],
        e: [{ a: -5.2, b: -2.8, y0: 0.12, y1: 2.9 }, { a: 3, b: 6, y0: 5.6, y1: 7 }],
        w: [{ a: 2.8, b: 5.2, y0: 0.12, y1: 2.9 }, { a: -6, b: -3, y0: 5.6, y1: 7 }],
      },
      slabHoles: [{ lvl: 1, x0: -4, z0: -4, x1: 4, z1: 4 }, { lvl: 1, x0: -11.61, z0: -8.1, x1: -10.0, z1: -2.9 }, { lvl: 1, x0: 10.0, z0: 2.9, x1: 11.61, z1: 8.1 }],
      parapetGaps: { e: [[7.8, 9.7]] },
    });
    stairs(B, -10.85, -8, '+z', 1.5, 0.12, 4.6, 'concreteD');
    stairs(B, 10.85, 8, '-z', 1.5, 0.12, 4.6, 'concreteD');
    rail(B, 'x', -4.05, -4, 4, 4.6, 'metal'); rail(B, 'x', 4.05, -4, 4, 4.6, 'metal');
    rail(B, 'z', -4.05, -4, 4, 4.6, 'metal'); rail(B, 'z', 4.05, -4, 4, 4.6, 'metal');
    // lab furniture
    for (const p of [[-7, -6], [-7, 6], [7, -6.5], [6.5, 6]]) B.box(p[0] - 1.5, 0.12, p[1] - 0.6, p[0] + 1.5, 1.05, p[1] + 0.6, 'panel', { surf: 'metal' });
    for (let i = 0; i < 4; i++) {
      B.box(-9.5 + i * 1.0, 4.6, -9.55, -8.7 + i * 1.0, 6.8, -8.8, 'metal', { surf: 'metal' });
      const led = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2, 1.2) }));
      led.position.set(-9.1 + i * 1.0, 5.7, -8.79);
      B.mesh(led);
    }
    B.box(-2, 0.12, -2, 2, 1.2, 2, 'metal', { surf: 'metal' });
    cylDecor(B, 'glass_dark', 0, 2.2, 0, 0.9, 2.0, 'y', 16);
    B.box(5, 4.6, -7, 8, 5.5, -6, 'crate', { surf: 'wood' });
    B.box(-8, 4.6, 6, -6, 5.6, 7, 'crate', { surf: 'wood' });
    // exterior roof stairs (east side)
    stairs(B, 13.2, 8, '-z', 1.5, 0.12, 4.6, 'metal', { thin: true });
    B.box(12.4, 4.45, 1.3, 15.9, 4.6, 2.9, 'metal', { contact: false });
    stairs(B, 15.05, 2.9, '+z', 1.5, 4.6, 9, 'metal', { thin: true });
    B.box(12, 8.85, 8.0, 15.8, 9.0, 9.6, 'metal', { contact: false });
    rail(B, 'z', 15.95, 1.3, 2.9, 4.6, 'metal');
    rail(B, 'z', 15.85, 8.0, 9.6, 9.0, 'metal');
    B.box(-6, 9, -6, -3, 10.2, -3, 'metal', { surf: 'metal' });
    B.box(3, 9, 2, 7, 9.8, 4, 'metal', { surf: 'metal' });

    // ---- hangar
    house(B, {
      x0: -34, z0: -52, x1: 6, z1: -26, levels: [0.05], roof: 11, t: 0.5, wall: 'panel', floor: 'concreteD', ceil: 'metal', parapet: 0,
      holes: {
        s: [{ a: -29, b: -19, y0: 0, y1: 7 }, { a: -11, b: -1, y0: 0, y1: 7 }],
        e: [{ a: -40, b: -36, y0: 0, y1: 4 }],
        w: [{ a: -34, b: -31, y0: 0, y1: 3.5 }],
      },
    });
    B.box(-33.5, 4.75, -51.5, 5.5, 5.0, -49, 'metal', { contact: false });
    rail(B, 'x', -48.95, -31.9, 3.9, 5.0, 'metal');
    stairs(B, -32.75, -42.6, '-z', 1.5, 0.05, 5.0, 'metal', { thin: true });
    B.box(-33.5, 4.85, -49.1, -32, 5.0, -48.3, 'metal', { contact: false });
    stairs(B, 4.75, -42.6, '-z', 1.5, 0.05, 5.0, 'metal', { thin: true });
    B.box(4.0, 4.85, -49.1, 5.5, 5.0, -48.3, 'metal', { contact: false });
    // aircraft
    B.box(-22, 0.05, -40.5, -8, 3.2, -36.5, 'panel', { visible: false, surf: 'metal' });
    cylDecor(B, 'panel', -15, 1.9, -38.5, 2.0, 14, 'x', 20);
    cylDecor(B, 'panel', -23.5, 1.9, -38.5, 2.0, 3, 'x', 20, 0.4);
    cylDecor(B, 'glass_dark', -7.0, 2.3, -38.5, 1.4, 2, 'x', 16, 0.3);
    B.box(-17, 1.6, -46, -13, 2.0, -31, 'panel', { contact: false });
    B.box(-23.5, 3, -38.8, -21.5, 6, -38.2, 'panel', { collide: false });
    for (const p of [[-29, -30], [-28, -30], [-28.5, -31], [2, -45], [2, -44], [-6, -30]]) crate(B, p[0], 0.05, p[1], 1.0);
    crate(B, -28.5, 1.05, -30, 1.0);
    for (const x of [-26, -12]) {
      const lampM = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.8, 2.2) }));
      lampM.position.set(x, 10.3, -39);
      B.mesh(lampM);
    }
    addLight(B, 0xffe8c0, 6, 24, -19, 8, -39);

    // ---- container yard
    const cont = (x0, z0, axis, len, y = 0, ci = 0) => {
      const w = 2.44, h = 2.6;
      const x1 = axis === 'z' ? x0 + w : x0 + len, z1 = axis === 'z' ? z0 + len : z0 + w;
      B.box(x0, y, z0, x1, y + h, z1, CONT[ci % CONT.length], { surf: 'metal', groundY: 0 });
    };
    cont(22, -32, 'z', 12.2, 0, 0); cont(22, -16, 'z', 12.2, 0, 1); cont(22, 2, 'z', 6.06, 0, 2); cont(22, 12, 'z', 12.2, 0, 3);
    cont(29, -30, 'z', 12.2, 0, 4); cont(29, -30, 'z', 12.2, 2.6, 1); cont(29, -12, 'z', 12.2, 0, 2); cont(29, 6, 'z', 12.2, 0, 0);
    cont(36, -33, 'z', 6.06, 0, 3); cont(36, -22, 'z', 12.2, 0, 0); cont(36, -22, 'z', 12.2, 2.6, 4); cont(36, -4, 'z', 12.2, 0, 1); cont(36, 14, 'z', 6.06, 0, 2);
    cont(43, -28, 'z', 12.2, 0, 2); cont(43, -10, 'z', 12.2, 0, 3); cont(43, -10, 'z', 12.2, 2.6, 0); cont(43, 8, 'z', 12.2, 0, 4);
    cont(42, -34.5, 'x', 10, 0, 1);
    stairs(B, 44.56, -11.25, '-x', 1.5, 0, 5.2, 'metal', { thin: true });
    B.box(31.44, 5.0, -21, 36, 5.2, -19.5, 'metal', { contact: false });
    stairs(B, 49.0, -2.7, '-z', 1.5, 0, 5.2, 'metal', { thin: true });
    B.box(45.44, 5.05, -9.5, 49.75, 5.2, -8.5, 'metal', { contact: false });
    for (const p of [[26, -2], [33, 3], [40, 11], [47, -32], [26.5, -18]]) crate(B, p[0], 0, p[1], 1.1);

    // ---- tunnel (west)
    wall(B, 'z', -47.2, -24, 30, 0, 4.2, 0.4, 'concrete', [
      { a: -20, b: -17, y0: 0, y1: 3 }, { a: -6, b: -3, y0: 0, y1: 3 }, { a: 8, b: 11, y0: 0, y1: 3 }, { a: 22, b: 25, y0: 0, y1: 3 },
    ]);
    B.box(-55, 4.2, -24, -47, 4.6, 30, 'concreteD', { contact: false, bottom: 'concreteD' });
    for (let z = -20; z < 30; z += 8) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.4, 1.8) }));
      strip.position.set(-51, 4.16, z);
      B.mesh(strip);
      B.glow(-51, 0.03, z, 3.2, '#ffe0a0', 0.35);
    }
    cylDecor(B, 'metal', -54.4, 3.4, 3, 0.35, 54, 'z', 12);
    cylDecor(B, 'metal', -54.4, 2.6, 3, 0.25, 54, 'z', 12);
    for (const seg of [[-24, -21], [-16, -7], [-2, 7], [12, 21], [26, 29.5]]) {
      B.box(-46.4, 0, seg[0], -45.4, 0.95, seg[1], 'metal', { visible: false, surf: 'metal' });
      cylDecor(B, 'metal', -45.9, 0.5, (seg[0] + seg[1]) / 2, 0.45, seg[1] - seg[0], 'z', 14);
    }
    stairs(B, -45.75, 36, '-z', 1.5, 0, 4.6, 'concreteD');
    B.box(-47, 4.45, 29.8, -45, 4.6, 30.6, 'concreteD', { contact: false });
    addLight(B, 0xffd8a0, 3, 14, -51, 3.5, 3);

    // ---- bunker + radar (north west)
    house(B, {
      x0: -44, z0: -46, x1: -37, z1: -39, levels: [0.0], roof: 3.2, t: 0.4, wall: 'concrete', floor: 'concreteD', ceil: 'concreteD', parapet: 0.6,
      holes: { e: [{ a: -44, b: -41.6, y0: 0, y1: 2.6 }] },
      parapetGaps: { s: [[-41.2, -39.3]] },
    });
    stairs(B, -40.25, -35.26, '-z', 1.5, 0, 3.2, 'concreteD');
    const radar = new THREE.Group();
    const dish = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 10, 0, PI * 2, 0, PI / 3), new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide, envMap: env }));
    dish.rotation.x = -PI / 2 - 0.5;
    dish.position.y = 1.6;
    radar.add(dish);
    radar.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0x777777 })));
    radar.position.set(-42, 4.0, -43);
    B.mesh(radar);
    B.box(-42.3, 3.2, -43.3, -41.7, 4.8, -42.7, 'metal', { contact: false });
    B.anim.push({ type: 'radar', obj: radar });

    // ---- watchtower (south)
    for (const p of [[-2.3, 37.7], [2.3, 37.7], [-2.3, 42.3], [2.3, 42.3]]) B.box(p[0] - 0.2, 0, p[1] - 0.2, p[0] + 0.2, 6.8, p[1] + 0.2, 'metal', { surf: 'metal' });
    B.box(-2.5, 6.8, 37.5, 2.5, 7.0, 42.5, 'metal', { contact: false });
    rail(B, 'x', 37.55, -2.5, 2.5, 7.0, 'concreteD', 1.1);
    rail(B, 'x', 42.45, -2.5, 2.5, 7.0, 'concreteD', 1.1);
    rail(B, 'z', -2.45, 37.5, 42.5, 7.0, 'concreteD', 1.1);
    rail(B, 'z', 2.45, 37.5, 40.5, 7.0, 'concreteD', 1.1);
    B.box(-2.8, 9.6, 37.2, 2.8, 9.8, 42.8, 'metal', { contact: false });
    for (const p of [[-2.4, 37.6], [2.4, 37.6], [-2.4, 42.4], [2.4, 42.4]]) B.box(p[0] - 0.06, 8.1, p[1] - 0.06, p[0] + 0.06, 9.6, p[1] + 0.06, 'metal', { collide: false });
    stairs(B, 3.55, 50, '-z', 1.5, 0, 7, 'metal', { thin: true });
    B.box(2.5, 6.85, 40.6, 4.4, 7.0, 42.4, 'metal', { contact: false });
    addLight(B, 0xfff0d0, 3, 12, 0, 9.3, 40);

    // ---- fuel tanks (south east)
    const tank = (x, z, r, h) => {
      const s = r * 0.7;
      B.box(x - s, 0, z - s, x + s, h, z + s, 'panel', { visible: false, surf: 'metal' });
      cylDecor(B, 'panel', x, h / 2, z, r, h, 'y', 28);
      cylDecor(B, 'metal', x, h + 0.2, z, r * 0.9, 0.4, 'y', 28, r * 0.5);
      B._contact(x - r, z - r, x + r, z + r, 0.012, 0.8);
    };
    tank(28, 40, 3.2, 7); tank(38, 46, 3.2, 7); tank(45, 34, 3.2, 7);
    cylDecor(B, 'metal', 33, 1.0, 43, 0.3, 11, 'x', 10);
    B.box(27.5, 0, 42.7, 38.5, 1.3, 43.3, 'metal', { visible: false, surf: 'metal' });

    // ---- scattered cover
    const sandbags = (x, z, axis, len) => {
      if (axis === 'x') B.box(x - len / 2, 0, z - 0.45, x + len / 2, 1.0, z + 0.45, 'sandbag', { surf: 'sand' });
      else B.box(x - 0.45, 0, z - len / 2, x + 0.45, 1.0, z + len / 2, 'sandbag', { surf: 'sand' });
    };
    sandbags(-20, 28, 'x', 5); sandbags(-23, 30.5, 'z', 4); sandbags(20, 24, 'x', 5); sandbags(-8, 26, 'z', 3);
    sandbags(-26, -16, 'x', 4); sandbags(14, -22.5, 'x', 5); sandbags(0, -16, 'x', 4); sandbags(-36, 4, 'z', 5);
    sandbags(30, -40, 'x', 4); sandbags(-14, 46, 'x', 4);
    // truck
    B.box(-28, 0, 40, -24, 2.8, 42.6, 'contW', { surf: 'metal' });
    B.box(-36, 0.5, 40, -28.2, 3.2, 42.6, 'contR', { surf: 'metal' });
    for (const x of [-34.5, -31, -26.5]) for (const z of [39.9, 42.7]) cylDecor(B, 'rubber', x, 0.5, z, 0.5, 0.35, 'z', 12);
    // rocks
    for (const r of [[-30, 14, 2.4, 1.6], [16, -14, 2, 1.4], [-8, 32, 1.6, 1.2], [42, -44, 3, 2.2], [-22, -18, 2.2, 1.3], [-40, 20, 2.5, 2], [18, 50, 3, 2], [-46, 46, 3.4, 2.6]]) {
      const [x, z, s, h] = r;
      B.box(x - s / 2, 0, z - s / 2, x + s / 2, h, z + s / 2, 'rock', { visible: false });
      const g = new THREE.DodecahedronGeometry(1, 0);
      const m4 = new THREE.Matrix4().compose(new THREE.Vector3(x, h * 0.45, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random(), Math.random() * 3, Math.random())), new THREE.Vector3(s * 0.62, h * 0.62, s * 0.62));
      B.geo(g, 'rock', m4, 2);
      B._contact(x - s / 2, z - s / 2, x + s / 2, z + s / 2, 0.012, 0.6);
    }
    // barrels
    for (const p of [[18, 6], [18.8, 6.4], [18.3, 7.2], [-18, 14], [-17.3, 14.6], [8, -40], [8.7, -40.4], [-50, -30], [50, 30], [-30, 50]]) {
      B.box(p[0] - 0.32, 0, p[1] - 0.32, p[0] + 0.32, 1.0, p[1] + 0.32, 'contO', { visible: false, surf: 'metal' });
      cylDecor(B, Math.random() < 0.5 ? 'contO' : 'contB', p[0], 0.5, p[1], 0.32, 1.0, 'y', 12);
    }
    for (const x of [-30, -14, 10, 20]) B.box(x - 1.2, 0, -12.8, x + 1.2, 0.9, -12.2, 'concrete');
    for (const z of [-30, 20]) B.box(-30.6, 0, z - 1.2, -30.0, 0.9, z + 1.2, 'concrete');

    B.finalize(shadows);
    const sunDir = new THREE.Vector3(0.55, 0.85, 0.35).normalize();
    group.add(skyDome(0x1f58b8, 0x9cc0e6, 0xc8a878, { dir: sunDir, color: 0xfff2d8, k: 1 }));
    const ds = dust(700, 70);
    group.add(ds);

    const spawns = [
      [-8, 0.12, -2], [8, 0.12, 2], [-7, 4.6, 2], [7, 4.6, -2.5], [0, 9, 0], [-14, 0.12, 12], [14, 0.12, -12],
      [-28, 0.05, -44], [0, 0.05, -44], [-20, 0.05, -30], [-32, 5, -50], [3, 5, -50],
      [26, 0, -24], [33, 0, -6], [40, 0, 2], [47, 0, 12], [37, 5.2, -15], [33, 0, 24],
      [-51, 0, -18], [-51, 0, 4], [-51, 0, 24], [-51, 4.6, 0],
      [-40, 0, -32], [-40.5, 3.2, -42],
      [0, 0, 34], [0, 7, 40], [-20, 0, 34], [20, 0, 30], [36, 0, 36], [-30, 0, 46], [-40, 0, 10], [44, 0, -46],
    ];
    return {
      id: 'desert', group, world, env, spawns, builder: B,
      fog: new THREE.Fog(0xc9b08c, 60, 260),
      background: new THREE.Color(0xc4dcf2),
      light: { hemi: [0xbcd8f5, 0xb08a60, 0.62], sun: [0xfff0d8, 1.9], sunDir, shadowBox: 64 },
      vm: { sky: 0xbcd8f5, ground: 0xb08860, hemi: 0.8, sun: 0xfff0d8, sunI: 1.5, sunDir },
      grade: { tint: [1.04, 1.0, 0.94], contrast: 1.12, sat: 1.14, vignette: 0.4, exposure: 0.8 },
      bloom: { strength: 0.35, radius: 0.4, threshold: 0.9 },
      ambience: 'amb_desert', reverb: 0.22,
      update(t, dt, cam) {
        ds.material.uniforms.time.value = t;
        if (cam) ds.material.uniforms.cam.value.copy(cam.position);
        for (const a of B.anim) if (a.type === 'radar') a.obj.rotation.y = t * 0.6;
      },
      menuPath: [[30, 12, 30], [10, 8, 20], [0, 6, 14], [-20, 5, 10], [-30, 8, -10], [-20, 10, -24], [10, 9, -20], [30, 8, -10], [40, 10, 10]],
      thumb: { pos: [24, 16, 26], look: [-4, 2, -6] },
    };
  }

  GS.Maps = {
    build(id, renderer, shadows) {
      const m = id === 'desert' ? buildDesert(renderer, shadows) : buildNeon(renderer, shadows);
      const w = m.world;
      w.buildNav(1.5);
      // validate spawn points
      const ok = [];
      for (const s of m.spawns) {
        const y = w.floorAt(s[0], s[2], s[1] + 0.3);
        if (y > -Infinity && w.fits(s[0], y, s[2], 0.35, 1.8)) ok.push(new THREE.Vector3(s[0], y + 0.01, s[2]));
        else console.warn('[map] bad spawn', s);
      }
      m.spawnPoints = ok;
      // shared lights (sun + hemisphere)
      const L = m.light;
      m.hemi = new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]);
      m.sun = new THREE.DirectionalLight(L.sun[0], L.sun[1]);
      m.sun.position.copy(L.sunDir).multiplyScalar(80);
      m.sun.castShadow = !!shadows;
      const sc = m.sun.shadow.camera;
      sc.left = -L.shadowBox; sc.right = L.shadowBox; sc.top = L.shadowBox; sc.bottom = -L.shadowBox;
      sc.near = 10; sc.far = 200;
      m.sun.shadow.bias = -0.0004;
      m.sun.shadow.normalBias = 0.04;
      m.group.add(m.hemi, m.sun, m.sun.target);
      return m;
    },
  };
})();
