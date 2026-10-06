'use strict';
// GambelStrike 2 — procedural textures (maps, skins, decals, particles)
(function () {
  const U = GS.U;
  const cache = {};
  let N_MAP = 512, N_SKIN = 512, ANISO = 8;

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h || w;
    return c;
  }
  function pix(N, fn) {
    const c = canvas(N, N);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(N, N);
    const d = img.data;
    const col = [0, 0, 0, 255];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        col[3] = 255;
        fn(x, y, i, col);
        const j = i * 4;
        d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; d[j + 3] = col[3];
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function tex(c, o = {}) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = o.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = o.aniso === undefined ? ANISO : o.aniso;
    if (o.srgb !== false) t.encoding = THREE.sRGBEncoding;
    if (o.nomip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
    t.needsUpdate = true;
    return t;
  }
  function normalMap(h, N, strength = 2) {
    return pix(N, (x, y, i, c) => {
      const l = h[y * N + ((x - 1 + N) % N)], r = h[y * N + ((x + 1) % N)];
      const u = h[((y - 1 + N) % N) * N + x], d = h[((y + 1) % N) * N + x];
      let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;
      c[0] = (nx * 0.5 + 0.5) * 255; c[1] = (ny * 0.5 + 0.5) * 255; c[2] = (nz * 0.5 + 0.5) * 255;
    });
  }
  const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  // ------------------------------------------------------------------ map textures
  const MAPGEN = {
    asphalt(N) {
      const n1 = U.fbm(N, 8, 6, 1), n2 = U.fbm(N, 128, 2, 2), wet = U.fbm(N, 4, 4, 5);
      const cl = U.cells(N, 5, 3);
      const h = new Float32Array(N * N);
      const rough = new Uint8ClampedArray(N * N);
      const map = pix(N, (x, y, i, c) => {
        const crack = U.smoothstep(0.05, 0.0, cl.f2[i] - cl.f1[i]) * U.smoothstep(0.45, 0.6, n1[i]);
        const w = U.smoothstep(0.58, 0.68, wet[i]);
        let v = 34 + n1[i] * 22 + (n2[i] > 0.72 ? 22 : n2[i] * 8);
        v *= 1 - crack * 0.55;
        v *= 1 - w * 0.3;
        c[0] = v * 0.96; c[1] = v * 0.98; c[2] = v * 1.05;
        h[i] = n2[i] * 0.6 + n1[i] * 0.3 - crack * 0.8 - w * 0.2;
        rough[i] = 255 * (0.92 - w * 0.75);
      });
      const rc = pix(N, (x, y, i, c) => { c[0] = c[1] = c[2] = rough[i]; });
      return { map, normal: normalMap(h, N, 3), rough: rc };
    },
    sidewalk(N) {
      const n1 = U.fbm(N, 8, 5, 11), n2 = U.fbm(N, 64, 3, 12);
      const h = new Float32Array(N * N);
      const tiles = 4, ts = N / tiles;
      const map = pix(N, (x, y, i, c) => {
        const gx = x % ts, gy = y % ts;
        const edge = Math.min(gx, gy, ts - gx, ts - gy);
        const seam = edge < 2 ? 1 : 0;
        const tid = Math.floor(x / ts) + Math.floor(y / ts) * 7;
        const tv = ((tid * 37) % 11) / 11;
        let v = 88 + n1[i] * 30 + n2[i] * 14 + tv * 10;
        if (seam) v *= 0.5;
        c[0] = v; c[1] = v * 0.99; c[2] = v * 1.02;
        h[i] = n2[i] * 0.4 - seam * 0.8;
      });
      return { map, normal: normalMap(h, N, 2) };
    },
    concrete(N, seed = 21, base = [150, 148, 142]) {
      const n1 = U.fbm(N, 6, 6, seed), n2 = U.fbm(N, 48, 4, seed + 1), st = U.fbm(N, 3, 4, seed + 2);
      const h = new Float32Array(N * N);
      const map = pix(N, (x, y, i, c) => {
        const seamY = (y % (N / 2)) < 2 ? 1 : 0;
        const seamX = (x % (N / 2)) < 2 ? 1 : 0;
        const hx = (x % (N / 4)) - N / 8, hy = (y % (N / 4)) - N / 8;
        const hole = hx * hx + hy * hy < (N / 90) * (N / 90) ? 1 : 0;
        let k = 0.78 + n1[i] * 0.3 + n2[i] * 0.12 - U.smoothstep(0.55, 0.85, st[i]) * 0.25;
        if (seamX || seamY) k *= 0.72;
        if (hole) k *= 0.45;
        // vertical streaks
        k *= 1 - 0.08 * U.smoothstep(0.6, 1, Math.sin(x * 0.11 + n1[i] * 4) * 0.5 + 0.5) * (y / N);
        c[0] = base[0] * k; c[1] = base[1] * k; c[2] = base[2] * k;
        h[i] = n2[i] * 0.5 + n1[i] * 0.2 - (seamX || seamY ? 0.5 : 0) - hole * 0.6;
      });
      return { map, normal: normalMap(h, N, 2.2) };
    },
    concrete_dark(N) { return MAPGEN.concrete(N, 31, [92, 94, 98]); },
    concrete_warm(N) { return MAPGEN.concrete(N, 41, [196, 176, 148]); },
    brick(N, base = [120, 52, 42]) {
      const n1 = U.fbm(N, 16, 5, 51), n2 = U.fbm(N, 64, 3, 52);
      const h = new Float32Array(N * N);
      const rows = 16, cols = 4, bh = N / rows, bw = N / cols, m = Math.max(2, N / 170);
      const map = pix(N, (x, y, i, c) => {
        const r = Math.floor(y / bh);
        const off = (r % 2) * bw * 0.5;
        const xx = (x + off) % N;
        const cidx = Math.floor(xx / bw);
        const lx = xx % bw, ly = y % bh;
        const mortar = lx < m || ly < m;
        const rnd = (((r * 13 + cidx * 7) * 2654435761) >>> 0) / 4294967296;
        let k;
        if (mortar) { k = 0.55 + n2[i] * 0.2; c[0] = 110 * k; c[1] = 106 * k; c[2] = 100 * k; h[i] = -0.6 + n2[i] * 0.2; }
        else {
          k = 0.7 + rnd * 0.35 + n1[i] * 0.2 + n2[i] * 0.1;
          c[0] = base[0] * k; c[1] = base[1] * k; c[2] = base[2] * k;
          h[i] = 0.3 + n2[i] * 0.3;
        }
      });
      return { map, normal: normalMap(h, N, 2.5) };
    },
    brick_dark(N) { return MAPGEN.brick(N, [70, 52, 58]); },
    panel(N, base = [52, 56, 66]) {
      const n1 = U.fbm(N, 8, 5, 61), n2 = U.fbm(N, 64, 3, 62);
      const h = new Float32Array(N * N);
      const p = N / 4;
      const map = pix(N, (x, y, i, c) => {
        const lx = x % p, ly = y % (p / 2);
        const seam = lx < 2 || ly < 2;
        const pid = Math.floor(x / p) * 3 + Math.floor(y / (p / 2)) * 5;
        const rv = ((pid * 97) % 13) / 13;
        const rx = lx - 8, ry = ly - 8;
        const rivet = rx * rx + ry * ry < 5;
        let k = 0.8 + rv * 0.2 + n1[i] * 0.2 + n2[i] * 0.06;
        if (seam) k *= 0.45;
        if (rivet) k *= 1.4;
        c[0] = base[0] * k; c[1] = base[1] * k; c[2] = base[2] * k;
        h[i] = (seam ? -0.7 : 0) + (rivet ? 0.7 : 0) + n2[i] * 0.1;
      });
      return { map, normal: normalMap(h, N, 2) };
    },
    metal(N) {
      const n1 = U.fbm(N, 8, 5, 71), n2 = U.fbm(N, 128, 2, 72);
      const h = new Float32Array(N * N);
      const s = N / 16;
      const map = pix(N, (x, y, i, c) => {
        // diamond plate
        const cx = (x % s) - s / 2, cy = (y % s) - s / 2;
        const flip = (Math.floor(x / s) + Math.floor(y / s)) % 2;
        const a = flip ? (cx + cy) : (cx - cy), b = flip ? (cx - cy) : (cx + cy);
        const d = (a * a) / (s * s * 0.5) + (b * b) / (s * s * 0.02);
        const bump = d < 0.25 ? 1 : 0;
        let k = 0.75 + n1[i] * 0.3 + n2[i] * 0.1 + bump * 0.2;
        c[0] = 120 * k; c[1] = 124 * k; c[2] = 130 * k;
        h[i] = bump * 0.8 + n2[i] * 0.1;
      });
      return { map, normal: normalMap(h, N, 2) };
    },
    container(N) {
      const n1 = U.fbm(N, 6, 6, 81), n2 = U.fbm(N, 64, 3, 82), rust = U.fbm(N, 8, 5, 83);
      const h = new Float32Array(N * N);
      const ribs = 10;
      const map = pix(N, (x, y, i, c) => {
        const s = Math.sin((x / N) * Math.PI * 2 * ribs);
        const rib = s > 0.3 ? 1 : s < -0.3 ? -1 : s / 0.3;
        const frame = y < N * 0.04 || y > N * 0.96;
        const r = U.smoothstep(0.62, 0.8, rust[i] + n2[i] * 0.1);
        let k = 0.85 + n1[i] * 0.2 + rib * 0.06;
        if (frame) k *= 0.6;
        let rr = 235 * k, gg = 235 * k, bb = 235 * k;
        rr = U.lerp(rr, 120, r); gg = U.lerp(gg, 70, r); bb = U.lerp(bb, 40, r);
        c[0] = rr; c[1] = gg; c[2] = bb;
        h[i] = rib * 0.6 + n2[i] * 0.1 - r * 0.1;
      });
      return { map, normal: normalMap(h, N, 2) };
    },
    sand(N) {
      const n1 = U.fbm(N, 4, 6, 91), n2 = U.fbm(N, 128, 2, 92), n3 = U.fbm(N, 8, 4, 93);
      const h = new Float32Array(N * N);
      const map = pix(N, (x, y, i, c) => {
        const rip = Math.sin(((y + n3[i] * N * 0.25) / N) * Math.PI * 2 * 14);
        let k = 0.82 + n1[i] * 0.22 + n2[i] * 0.08 + rip * 0.03;
        c[0] = 204 * k; c[1] = 166 * k; c[2] = 118 * k;
        h[i] = rip * 0.3 + n2[i] * 0.4 + n1[i] * 0.2;
      });
      return { map, normal: normalMap(h, N, 1.6) };
    },
    crate(N) {
      const n1 = U.fbm(N, 8, 5, 101), n2 = U.fbm(N, 128, 2, 102);
      const h = new Float32Array(N * N);
      const fr = N * 0.09;
      const map = pix(N, (x, y, i, c) => {
        const border = x < fr || y < fr || x > N - fr || y > N - fr;
        const plank = Math.floor(y / (N / 5));
        const grain = Math.sin((x * 0.05 + n1[(y * N + ((x * 7) % N)) % (N * N)] * 8 + plank * 3)) * 0.5 + 0.5;
        const gap = (y % (N / 5)) < 3;
        let k = 0.7 + grain * 0.18 + n2[i] * 0.1 + ((plank * 31) % 7) * 0.02;
        if (border) k *= 0.82;
        if (gap && !border) k *= 0.4;
        c[0] = 168 * k; c[1] = 122 * k; c[2] = 74 * k;
        h[i] = (border ? 0.4 : 0) - (gap ? 0.6 : 0) + grain * 0.2;
      });
      return { map, normal: normalMap(h, N, 2) };
    },
    tiles(N, base = [190, 192, 196]) {
      const n1 = U.fbm(N, 8, 4, 111);
      const h = new Float32Array(N * N);
      const t = N / 8;
      const map = pix(N, (x, y, i, c) => {
        const g = (x % t) < 2 || (y % t) < 2;
        let k = g ? 0.45 : 0.85 + n1[i] * 0.15;
        c[0] = base[0] * k; c[1] = base[1] * k; c[2] = base[2] * k;
        h[i] = g ? -0.5 : 0.1;
      });
      return { map, normal: normalMap(h, N, 1.5) };
    },
    tiles_dark(N) { return MAPGEN.tiles(N, [60, 62, 74]); },
    roof(N) {
      const n1 = U.fbm(N, 8, 5, 121), n2 = U.fbm(N, 256, 1, 122);
      const h = new Float32Array(N * N);
      const map = pix(N, (x, y, i, c) => {
        const k = 0.6 + n1[i] * 0.25 + (n2[i] > 0.6 ? 0.25 : 0);
        c[0] = 70 * k; c[1] = 70 * k; c[2] = 74 * k;
        h[i] = n2[i];
      });
      return { map, normal: normalMap(h, N, 1.5) };
    },
    hazard(N) {
      const n1 = U.fbm(N, 8, 5, 131);
      const map = pix(N, (x, y, i, c) => {
        const s = ((x + y) / (N / 4)) % 2 < 1;
        const worn = n1[i] > 0.7;
        if (s && !worn) { c[0] = 235; c[1] = 190; c[2] = 30; } else { c[0] = 25; c[1] = 25; c[2] = 25; }
      });
      return { map };
    },
    plaster(N) {
      const n1 = U.fbm(N, 8, 6, 141), n2 = U.fbm(N, 64, 3, 142);
      const h = new Float32Array(N * N);
      const map = pix(N, (x, y, i, c) => {
        const k = 0.82 + n1[i] * 0.16 + n2[i] * 0.06;
        c[0] = 176 * k; c[1] = 170 * k; c[2] = 162 * k;
        h[i] = n2[i] * 0.4;
      });
      return { map, normal: normalMap(h, N, 1.2) };
    },
    rubber(N) {
      const n1 = U.fbm(N, 16, 4, 151);
      return { map: pix(N, (x, y, i, c) => { const k = 0.8 + n1[i] * 0.2; c[0] = 30 * k; c[1] = 30 * k; c[2] = 32 * k; }) };
    },
  };

  // building facade with windows: albedo + emissive
  function facade(N, seed, palette) {
    const rnd = U.rng(seed);
    const cols = 8, rows = 8;
    const cw = N / cols, rh = N / rows;
    const lit = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) lit.push(rnd() < palette.lit ? Math.floor(rnd() * palette.colors.length) : -1);
    const n1 = U.fbm(N, 8, 5, seed % 997);
    const map = pix(N, (x, y, i, c) => {
      const cx = Math.floor(x / cw), cy = Math.floor(y / rh);
      const lx = x % cw, ly = y % rh;
      const win = lx > cw * 0.18 && lx < cw * 0.82 && ly > rh * 0.25 && ly < rh * 0.8;
      if (win) {
        const L = lit[cy * cols + cx];
        if (L >= 0) { const col = palette.colors[L]; c[0] = col[0] * 0.5; c[1] = col[1] * 0.5; c[2] = col[2] * 0.5; }
        else { c[0] = 18; c[1] = 22; c[2] = 32; }
      } else {
        const k = 0.7 + n1[i] * 0.3;
        c[0] = palette.wall[0] * k; c[1] = palette.wall[1] * k; c[2] = palette.wall[2] * k;
      }
    });
    const em = pix(N, (x, y, i, c) => {
      const cx = Math.floor(x / cw), cy = Math.floor(y / rh);
      const lx = x % cw, ly = y % rh;
      const win = lx > cw * 0.18 && lx < cw * 0.82 && ly > rh * 0.25 && ly < rh * 0.8;
      const L = lit[cy * cols + cx];
      if (win && L >= 0) {
        const col = palette.colors[L];
        const blind = (ly % 6) < 2 ? 0.7 : 1;
        const grad = 0.7 + 0.3 * (1 - (ly - rh * 0.25) / (rh * 0.55));
        c[0] = col[0] * blind * grad; c[1] = col[1] * blind * grad; c[2] = col[2] * blind * grad;
      } else { c[0] = c[1] = c[2] = 0; }
    });
    return { map, emissive: em };
  }

  // ------------------------------------------------------------------ weapon skins
  // each returns { map, emissive?, metal, rough, emi, anim?, sheen? }
  function camo(N, seed, cols, scale = 4) {
    const a = U.fbm(N, scale, 5, seed), b = U.fbm(N, scale * 2, 4, seed + 1);
    const rgb = cols.map(U.hexToRgb);
    return pix(N, (x, y, i, c) => {
      const v = a[i] * 0.7 + b[i] * 0.3;
      const k = v < 0.38 ? 0 : v < 0.5 ? 1 : v < 0.62 ? 2 : 3;
      const col = rgb[Math.min(k, rgb.length - 1)];
      c[0] = col[0]; c[1] = col[1]; c[2] = col[2];
    });
  }
  function carbonWeave(N, dark = 18, light = 52, tint = [1, 1, 1.05]) {
    const s = N / 32;
    return pix(N, (x, y, i, c) => {
      const u = Math.floor(x / s), v = Math.floor(y / s);
      const dir = ((u + v) % 4) < 2;
      const lx = (x % s) / s, ly = (y % s) / s;
      const sh = dir ? Math.sin(lx * Math.PI) : Math.sin(ly * Math.PI);
      const k = dark + (light - dark) * sh * (0.75 + 0.25 * ((u * 7 + v * 3) % 5) / 5);
      c[0] = k * tint[0]; c[1] = k * tint[1]; c[2] = k * tint[2];
    });
  }
  function drawCircuits(ctx, N, seed, color, bg) {
    const rnd = U.rng(seed);
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, N, N); }
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const g = N / 32;
    for (let k = 0; k < 46; k++) {
      let x = Math.floor(rnd() * 32) * g, y = Math.floor(rnd() * 32) * g;
      ctx.lineWidth = Math.max(1.5, N / 220) * (rnd() < 0.3 ? 2 : 1);
      ctx.beginPath(); ctx.moveTo(x, y);
      const steps = 3 + Math.floor(rnd() * 6);
      for (let s = 0; s < steps; s++) {
        const d = Math.floor(rnd() * 4);
        const len = (1 + Math.floor(rnd() * 5)) * g;
        if (d === 0) x += len; else if (d === 1) y += len; else if (d === 2) { x += len; y += len; } else { x += len; y -= len; }
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, ctx.lineWidth * 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  function blank(N, fill) {
    const c = canvas(N); const x = c.getContext('2d');
    x.fillStyle = fill || '#000'; x.fillRect(0, 0, N, N);
    return c;
  }

  const SKINGEN = {
    default(N) {
      const n = U.fbm(N, 16, 4, 201);
      return { map: pix(N, (x, y, i, c) => { const k = 50 + n[i] * 12; c[0] = k; c[1] = k * 1.02; c[2] = k * 1.08; }), metal: 0.45, rough: 0.45 };
    },
    urban_fog(N) { return { map: camo(N, 211, ['#3a4049', '#6b737e', '#a7aeb8', '#d8dde3']), metal: 0.1, rough: 0.6 }; },
    sand_drift(N) { return { map: camo(N, 221, ['#6d5638', '#9c7b4f', '#c8a874', '#e3cfa1']), metal: 0.1, rough: 0.65 }; },
    carbon_lite(N) { return { map: carbonWeave(N), metal: 0.35, rough: 0.28 }; },
    field_grid(N) {
      const n = U.fbm(N, 8, 5, 231);
      const c = pix(N, (x, y, i, col) => {
        const grid = (x % (N / 8)) < 2 || (y % (N / 8)) < 2;
        const k = (0.85 + n[i] * 0.2) * (grid ? 0.65 : 1);
        col[0] = 91 * k; col[1] = 99 * k; col[2] = 64 * k;
      });
      const x = c.getContext('2d');
      x.fillStyle = 'rgba(230,230,200,0.75)';
      x.font = `bold ${N / 12}px monospace`;
      x.fillText('GS-2', N * 0.08, N * 0.2);
      x.fillText('07', N * 0.6, N * 0.7);
      return { map: c, metal: 0.1, rough: 0.7 };
    },
    digital_dusk(N) {
      const n = U.fbm(N, 4, 5, 241);
      const cols = ['#1b1035', '#3c2a7a', '#6a5acd', '#0f6fa8'].map(U.hexToRgb);
      const b = N / 48;
      return {
        map: pix(N, (x, y, i, c) => {
          const bx = Math.floor(x / b) * b + b / 2, by = Math.floor(y / b) * b + b / 2;
          const v = n[Math.floor(by) * N + Math.floor(bx)];
          const k = v < 0.35 ? 0 : v < 0.5 ? 1 : v < 0.65 ? 2 : 3;
          c[0] = cols[k][0]; c[1] = cols[k][1]; c[2] = cols[k][2];
        }), metal: 0.2, rough: 0.5,
      };
    },
    toxic_drip(N) {
      const rnd = U.rng(251);
      const c = blank(N, '#0e0f0c');
      const e = blank(N, '#000');
      const draw = (ctx, col) => {
        ctx.fillStyle = col;
        const r2 = U.rng(252);
        ctx.fillRect(0, 0, N, N * 0.06);
        for (let k = 0; k < 34; k++) {
          const x = r2() * N, w = N * (0.008 + r2() * 0.03), len = N * (0.1 + r2() * 0.8);
          ctx.fillRect(x - w / 2, 0, w, len);
          ctx.beginPath(); ctx.arc(x, len, w * 0.9, 0, Math.PI * 2); ctx.fill();
        }
        for (let k = 0; k < 60; k++) { ctx.beginPath(); ctx.arc(r2() * N, r2() * N * 0.25, r2() * N * 0.012, 0, Math.PI * 2); ctx.fill(); }
      };
      draw(c.getContext('2d'), '#7dff2f');
      draw(e.getContext('2d'), '#4fbf1a');
      void rnd;
      return { map: c, emissive: e, metal: 0.2, rough: 0.35, emi: 1.4 };
    },
    graffiti_burst(N) {
      const rnd = U.rng(261);
      const c = blank(N, '#d9d4cc');
      const x = c.getContext('2d');
      const pal = ['#ff2fd0', '#00e5ff', '#ffd23f', '#7dff2f', '#ff6b3d', '#7a5cff'];
      for (let k = 0; k < 26; k++) {
        const col = pal[Math.floor(rnd() * pal.length)];
        const cx = rnd() * N, cy = rnd() * N, r = N * (0.04 + rnd() * 0.12);
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, col); g.addColorStop(0.7, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
      }
      x.lineCap = 'round';
      for (let k = 0; k < 9; k++) {
        const col = pal[Math.floor(rnd() * pal.length)];
        const p = [rnd() * N, rnd() * N, rnd() * N, rnd() * N, rnd() * N, rnd() * N, rnd() * N, rnd() * N];
        x.lineWidth = N * 0.05; x.strokeStyle = '#111';
        x.beginPath(); x.moveTo(p[0], p[1]); x.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]); x.stroke();
        x.lineWidth = N * 0.032; x.strokeStyle = col; x.stroke();
      }
      x.font = `900 ${N * 0.22}px Impact, sans-serif`;
      x.lineWidth = N * 0.012; x.strokeStyle = '#111'; x.fillStyle = '#ff2fd0';
      x.save(); x.translate(N * 0.15, N * 0.62); x.rotate(-0.15); x.fillText('GS2', 0, 0); x.strokeText('GS2', 0, 0); x.restore();
      return { map: c, metal: 0.05, rough: 0.55 };
    },
    carbon_pro(N) {
      const c = carbonWeave(N, 14, 46);
      const x = c.getContext('2d');
      x.fillStyle = '#ff2a3c';
      x.save(); x.translate(N / 2, N / 2); x.rotate(-0.6);
      x.fillRect(-N, -N * 0.08, N * 2, N * 0.05);
      x.fillRect(-N, N * 0.02, N * 2, N * 0.015);
      x.restore();
      x.fillStyle = 'rgba(255,255,255,0.8)';
      x.font = `bold ${N * 0.05}px sans-serif`;
      x.fillText('PRO SERIES', N * 0.06, N * 0.94);
      return { map: c, metal: 0.4, rough: 0.22 };
    },
    ice_shard(N) {
      const cl = U.cells(N, 7, 271), n = U.fbm(N, 16, 4, 272);
      const em = new Uint8ClampedArray(N * N);
      const map = pix(N, (x, y, i, c) => {
        const edge = U.smoothstep(0.06, 0.0, cl.f2[i] - cl.f1[i]);
        const t = cl.id[i];
        let r = U.lerp(124, 214, t), g = U.lerp(200, 240, t), b = U.lerp(240, 255, t);
        const sh = 0.85 + cl.f1[i] * 0.25 + n[i] * 0.1;
        r *= sh; g *= sh; b *= sh;
        r = U.lerp(r, 255, edge); g = U.lerp(g, 255, edge); b = U.lerp(b, 255, edge);
        c[0] = clamp255(r); c[1] = clamp255(g); c[2] = clamp255(b);
        em[i] = edge * 120;
      });
      const e = pix(N, (x, y, i, c) => { c[0] = em[i] * 0.6; c[1] = em[i] * 0.85; c[2] = em[i]; });
      return { map, emissive: e, metal: 0.25, rough: 0.12, emi: 0.6 };
    },
    cyber_lines(N) {
      const c = blank(N); drawCircuits(c.getContext('2d'), N, 281, '#00f0ff', '#08101f');
      const e = blank(N); drawCircuits(e.getContext('2d'), N, 281, '#00c8ff', '#000');
      return { map: c, emissive: e, metal: 0.4, rough: 0.3, emi: 1.6 };
    },
    magma_core(N) {
      const cl = U.cells(N, 6, 291), n = U.fbm(N, 8, 5, 292);
      const grad = U.gradient([[0, '#200300'], [0.4, '#ff3c00'], [0.8, '#ffb000'], [1, '#fff3a0']]);
      const emv = new Float32Array(N * N);
      const map = pix(N, (x, y, i, c) => {
        const crack = U.smoothstep(0.12, 0.0, cl.f2[i] - cl.f1[i] - n[i] * 0.04);
        const rock = 20 + n[i] * 30;
        const col = grad(crack);
        c[0] = U.lerp(rock, col[0], crack); c[1] = U.lerp(rock * 0.9, col[1], crack); c[2] = U.lerp(rock * 0.85, col[2], crack);
        emv[i] = crack;
      });
      const e = pix(N, (x, y, i, c) => { const col = grad(emv[i]); c[0] = col[0] * emv[i]; c[1] = col[1] * emv[i]; c[2] = col[2] * emv[i]; });
      return { map, emissive: e, metal: 0.1, rough: 0.7, emi: 2.4, anim: 'pulse' };
    },
    sakura_drift(N) {
      const rnd = U.rng(301);
      const c = canvas(N); const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, N, N);
      g.addColorStop(0, '#ffe3ee'); g.addColorStop(0.5, '#fff6f9'); g.addColorStop(1, '#ffc9dd');
      x.fillStyle = g; x.fillRect(0, 0, N, N);
      x.strokeStyle = '#3b1f2b'; x.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        x.lineWidth = N * (0.006 + rnd() * 0.01);
        x.beginPath(); x.moveTo(rnd() * N, rnd() * N);
        x.bezierCurveTo(rnd() * N, rnd() * N, rnd() * N, rnd() * N, rnd() * N, rnd() * N); x.stroke();
      }
      const pal = ['#ff7aa8', '#ff9cc0', '#ffffff', '#ff5c93', '#ffd1e1'];
      for (let k = 0; k < 90; k++) {
        x.save(); x.translate(rnd() * N, rnd() * N); x.rotate(rnd() * Math.PI);
        x.fillStyle = pal[Math.floor(rnd() * pal.length)];
        x.globalAlpha = 0.6 + rnd() * 0.4;
        const s = N * (0.01 + rnd() * 0.03);
        x.beginPath(); x.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2); x.fill();
        x.restore();
      }
      return { map: c, metal: 0.1, rough: 0.4 };
    },
    glitch_pop(N) {
      const rnd = U.rng(311);
      const c = blank(N, '#141018'); const e = blank(N, '#000');
      const xs = [c.getContext('2d'), e.getContext('2d')];
      const pal = ['#ff2fd0', '#00f0ff', '#ffd23f', '#ffffff'];
      for (let k = 0; k < 70; k++) {
        const col = pal[Math.floor(rnd() * pal.length)];
        const y = rnd() * N, h = N * (0.005 + rnd() * 0.04), x0 = rnd() * N, w = N * (0.05 + rnd() * 0.5);
        const off = (rnd() - 0.5) * N * 0.03;
        for (const [j, ctx] of xs.entries()) {
          ctx.globalAlpha = j ? 0.8 : 1;
          ctx.fillStyle = col; ctx.fillRect(x0, y, w, h);
          ctx.fillStyle = '#ff0040'; ctx.globalAlpha = 0.5; ctx.fillRect(x0 + off, y + h, w * 0.6, h * 0.3);
          ctx.globalAlpha = 1;
        }
      }
      const cx = xs[0];
      cx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0; y < N; y += 4) cx.fillRect(0, y, N, 1);
      return { map: c, emissive: e, metal: 0.3, rough: 0.35, emi: 1.3, anim: 'glitch' };
    },
    neon_rush(N) {
      const make = (bg, mul) => {
        const c = blank(N, bg); const x = c.getContext('2d');
        const rnd = U.rng(321);
        x.save(); x.translate(N / 2, N / 2); x.rotate(-Math.PI / 4);
        for (let k = -12; k < 12; k++) {
          const w = N * (0.01 + rnd() * 0.035);
          const col = rnd() < 0.5 ? '#ff2fd0' : '#00f0ff';
          x.globalAlpha = mul;
          x.fillStyle = col;
          x.fillRect(k * N * 0.09, -N, w, N * 2);
        }
        x.restore();
        return c;
      };
      return { map: make('#0a0a14', 1), emissive: make('#000', 1), metal: 0.5, rough: 0.25, emi: 2.2, anim: 'scroll' };
    },
    galaxy(N) {
      const n1 = U.fbm(N, 4, 6, 331), n2 = U.fbm(N, 8, 5, 332), st = U.fbm(N, 256, 1, 333);
      const grad = U.gradient([[0, '#05010f'], [0.35, '#2a0b5e'], [0.6, '#7a1fa2'], [0.8, '#ff5ecb'], [1, '#5ec8ff']]);
      const emv = new Float32Array(N * N);
      const map = pix(N, (x, y, i, c) => {
        const v = Math.pow(n1[i] * 0.65 + n2[i] * 0.35, 1.6);
        const col = grad(v);
        const star = st[i] > 0.93 ? (st[i] - 0.93) / 0.07 : 0;
        c[0] = clamp255(col[0] + star * 255); c[1] = clamp255(col[1] + star * 255); c[2] = clamp255(col[2] + star * 255);
        emv[i] = v * 0.4 + star;
      });
      const e = pix(N, (x, y, i, c) => { const col = grad(Math.min(1, emv[i])); const k = Math.min(1, emv[i]); c[0] = col[0] * k + k * 60; c[1] = col[1] * k + k * 60; c[2] = col[2] * k + k * 60; });
      return { map, emissive: e, metal: 0.4, rough: 0.3, emi: 1.0, anim: 'drift' };
    },
    chrome_mirror(N) {
      const n = U.fbm(N, 64, 3, 341);
      return { map: pix(N, (x, y, i, c) => { const k = 208 + n[(y * 3 % N) * N + x] * 30; c[0] = k; c[1] = k + 2; c[2] = k + 6; }), metal: 1.0, rough: 0.06 };
    },
    holo_prism(N) {
      const n = U.fbm(N, 4, 5, 351);
      const map = pix(N, (x, y, i, c) => {
        const h = (x + y) / (N * 2) + n[i] * 0.6;
        const col = U.hsl2rgb(h, 0.75, 0.68);
        c[0] = col[0]; c[1] = col[1]; c[2] = col[2];
      });
      return { map, emissive: map, metal: 0.65, rough: 0.18, emi: 0.35, anim: 'holo' };
    },
    gold_leaf(N) {
      const cl = U.cells(N, 14, 361), n = U.fbm(N, 32, 3, 362);
      const cols = ['#f6d27a', '#e0b04a', '#b8862b', '#fff1b8'].map(U.hexToRgb);
      return {
        map: pix(N, (x, y, i, c) => {
          const col = cols[Math.floor(cl.id[i] * 4) % 4];
          const edge = U.smoothstep(0.05, 0.0, cl.f2[i] - cl.f1[i]);
          const k = (0.9 + n[i] * 0.15) * (1 - edge * 0.35);
          c[0] = col[0] * k; c[1] = col[1] * k; c[2] = col[2] * k;
        }), metal: 1.0, rough: 0.22,
      };
    },
    singularity(N) {
      const n = U.fbm(N, 8, 4, 371);
      const grad = U.gradient([[0, '#000000'], [0.45, '#14002e'], [0.7, '#7a2cff'], [0.88, '#00e5ff'], [1, '#ffffff']]);
      const emv = new Float32Array(N * N);
      const map = pix(N, (x, y, i, c) => {
        const dx = x / N - 0.5, dy = y / N - 0.5;
        const r = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx);
        const sw = Math.sin(a * 3 + r * 28 + n[i] * 3) * 0.5 + 0.5;
        const v = Math.pow(sw, 3) * U.smoothstep(0.02, 0.5, r) * (1 - U.smoothstep(0.55, 0.72, r) * 0.6);
        const col = grad(v);
        c[0] = col[0]; c[1] = col[1]; c[2] = col[2];
        emv[i] = v;
      });
      const e = pix(N, (x, y, i, c) => { const col = grad(emv[i]); c[0] = col[0] * emv[i]; c[1] = col[1] * emv[i]; c[2] = col[2] * emv[i]; });
      return { map, emissive: e, metal: 0.5, rough: 0.2, emi: 2.6, anim: 'spin' };
    },
    aurora_flux(N) {
      const n = U.fbm(N, 4, 5, 381);
      const emv = new Float32Array(N * 3 * N);
      const map = pix(N, (x, y, i, c) => {
        const u = x / N, v = y / N;
        const w1 = Math.exp(-Math.pow((v - 0.35 - 0.12 * Math.sin(u * Math.PI * 4 + n[i] * 3)) / 0.07, 2));
        const w2 = Math.exp(-Math.pow((v - 0.68 - 0.1 * Math.sin(u * Math.PI * 2 + 1 + n[i] * 2)) / 0.06, 2));
        const r = 6 + w2 * 160, g = 20 + w1 * 255 + w2 * 60, b = 34 + w1 * 160 + w2 * 255;
        c[0] = clamp255(r); c[1] = clamp255(g); c[2] = clamp255(b);
        emv[i * 3] = w2 * 160; emv[i * 3 + 1] = w1 * 255 + w2 * 40; emv[i * 3 + 2] = w1 * 140 + w2 * 255;
      });
      const e = pix(N, (x, y, i, c) => { c[0] = clamp255(emv[i * 3]); c[1] = clamp255(emv[i * 3 + 1]); c[2] = clamp255(emv[i * 3 + 2]); });
      return { map, emissive: e, metal: 0.3, rough: 0.25, emi: 1.8, anim: 'scroll' };
    },
  };

  // ------------------------------------------------------------------ knife blade skins
  // UV: v runs along blade length (0 = base, 1 = tip), u across the blade
  const KGEN = {
    default(N) {
      const n = U.fbm(N, 128, 2, 401);
      return { map: pix(N, (x, y, i, c) => { const k = 190 + n[(y % N) * N + ((x * 9) % N)] * 40; c[0] = k; c[1] = k + 3; c[2] = k + 8; }), metal: 1, rough: 0.22, handle: '#26282c' };
    },
    neon_fade(N) {
      const g = U.gradient([[0, '#ff2fd0'], [0.5, '#a259ff'], [1, '#00e5ff']]);
      return { map: pix(N, (x, y, i, c) => { const col = g(y / N); c[0] = col[0]; c[1] = col[1]; c[2] = col[2]; }), metal: 0.9, rough: 0.18, handle: '#14141a', emiCol: '#3a0a40', emi: 0.4 };
    },
    blackout(N) {
      const n = U.fbm(N, 16, 4, 411);
      return { map: pix(N, (x, y, i, c) => { const k = 16 + n[i] * 14; c[0] = k; c[1] = k; c[2] = k * 1.1; }), metal: 0.5, rough: 0.55, handle: '#0b0b0c' };
    },
    crimson_wave(N) {
      const n = U.fbm(N, 8, 4, 421);
      return {
        map: pix(N, (x, y, i, c) => {
          const w = Math.sin((x / N) * 8 + (y / N) * 26 + n[i] * 5) * 0.5 + 0.5;
          const k = U.smoothstep(0.55, 0.75, w);
          c[0] = U.lerp(170, 150, k); c[1] = U.lerp(174, 12, k); c[2] = U.lerp(180, 30, k);
        }), metal: 1, rough: 0.2, handle: '#2a0b10',
      };
    },
    frozen_glass(N) {
      const cl = U.cells(N, 6, 431);
      return {
        map: pix(N, (x, y, i, c) => {
          const edge = U.smoothstep(0.05, 0.0, cl.f2[i] - cl.f1[i]);
          c[0] = U.lerp(170 + cl.id[i] * 50, 255, edge); c[1] = U.lerp(225, 255, edge); c[2] = 255;
        }), metal: 0.3, rough: 0.04, handle: '#e8f4ff', emiCol: '#204a6a', emi: 0.5,
      };
    },
    golden_edge(N) {
      const n = U.fbm(N, 64, 3, 441);
      return { map: pix(N, (x, y, i, c) => { const k = 0.85 + n[i] * 0.2; const spine = x / N < 0.25 ? 0.6 : 1; c[0] = 242 * k * spine; c[1] = 193 * k * spine; c[2] = 78 * k * spine; }), metal: 1, rough: 0.18, handle: '#c99a2e' };
    },
    digital_storm(N) {
      const n = U.fbm(N, 4, 5, 451);
      const cols = ['#0b1430', '#1e4fd8', '#9cc7ff', '#ffffff'].map(U.hexToRgb);
      const b = N / 32;
      return {
        map: pix(N, (x, y, i, c) => {
          const v = n[Math.floor(Math.floor(y / b) * b + b / 2) * N + Math.floor(Math.floor(x / b) * b + b / 2)];
          const col = cols[v < 0.35 ? 0 : v < 0.55 ? 1 : v < 0.72 ? 2 : 3];
          c[0] = col[0]; c[1] = col[1]; c[2] = col[2];
        }), metal: 0.5, rough: 0.3, handle: '#0b1430',
      };
    },
    void(N) {
      const n = U.fbm(N, 6, 5, 461);
      const em = new Float32Array(N * N);
      const map = pix(N, (x, y, i, c) => {
        const s = Math.abs(Math.sin(n[i] * 14 + y / N * 4));
        const v = Math.pow(1 - s, 6);
        c[0] = 8 + v * 120; c[1] = 4 + v * 20; c[2] = 14 + v * 200; em[i] = v;
      });
      const e = pix(N, (x, y, i, c) => { c[0] = em[i] * 140; c[1] = em[i] * 30; c[2] = em[i] * 255; });
      return { map, emissive: e, emi: 2.2, metal: 0.6, rough: 0.25, handle: '#08060c', anim: 'pulse' };
    },
    inferno(N) {
      const n = U.fbm(N, 6, 5, 471);
      const g = U.gradient([[0, '#200000'], [0.35, '#a00000'], [0.65, '#ff5a00'], [1, '#ffe14a']]);
      const em = new Float32Array(N * N);
      const map = pix(N, (x, y, i, c) => {
        const v = U.clamp(y / N * 0.6 + n[i] * 0.6 - 0.1, 0, 1);
        const col = g(v); c[0] = col[0]; c[1] = col[1]; c[2] = col[2]; em[i] = U.smoothstep(0.45, 1, v);
      });
      const e = pix(N, (x, y, i, c) => { const col = g(Math.min(1, em[i] + 0.3)); c[0] = col[0] * em[i]; c[1] = col[1] * em[i]; c[2] = col[2] * em[i]; });
      return { map, emissive: e, emi: 2.0, metal: 0.6, rough: 0.3, handle: '#1a0a06', anim: 'pulse' };
    },
    emerald(N) {
      const cl = U.cells(N, 8, 481);
      return {
        map: pix(N, (x, y, i, c) => {
          const k = 0.6 + cl.id[i] * 0.5 + cl.f1[i] * 0.3;
          c[0] = 10 * k; c[1] = 140 * k; c[2] = 90 * k;
        }), metal: 0.9, rough: 0.12, handle: '#06231a', emiCol: '#023020', emi: 0.6,
      };
    },
    neon_circuit(N) {
      const c = blank(N); drawCircuits(c.getContext('2d'), N, 491, '#00f0ff', '#0a0d14');
      const e = blank(N); drawCircuits(e.getContext('2d'), N, 491, '#00c8ff', '#000');
      return { map: c, emissive: e, emi: 2.2, metal: 0.7, rough: 0.25, handle: '#0a0d14' };
    },
    blue_plasma(N) {
      const n = U.fbm(N, 6, 5, 501);
      const em = new Float32Array(N * N);
      const map = pix(N, (x, y, i, c) => {
        const v = Math.pow(1 - Math.abs(n[i] - 0.5) * 2, 8);
        c[0] = 10 + v * 140; c[1] = 30 + v * 200; c[2] = 90 + v * 165; em[i] = v;
      });
      const e = pix(N, (x, y, i, c) => { c[0] = em[i] * 100; c[1] = em[i] * 200; c[2] = em[i] * 255; });
      return { map, emissive: e, emi: 2.6, metal: 0.7, rough: 0.2, handle: '#06122a', anim: 'pulse' };
    },
    crimson_lattice(N) {
      const n = U.fbm(N, 64, 3, 511);
      return {
        map: pix(N, (x, y, i, c) => {
          const u = x / N * 6, v = y / N * 10;
          const a = Math.abs(((u + v) % 1) - 0.5), b = Math.abs(((u - v + 100) % 1) - 0.5);
          const line = Math.max(U.smoothstep(0.47, 0.5, a), U.smoothstep(0.47, 0.5, b));
          const k = 150 + n[i] * 40;
          c[0] = U.lerp(k, 200, line); c[1] = U.lerp(k + 3, 14, line); c[2] = U.lerp(k + 8, 34, line);
        }), metal: 1, rough: 0.22, handle: '#2a0b10',
      };
    },
    night_ops(N) { return { map: camo(N, 521, ['#1c1e22', '#2b2e33', '#3a3e45', '#4a4f57'], 8), metal: 0.4, rough: 0.5, handle: '#15171a' }; },
    ocean_fade(N) {
      const g = U.gradient([[0, '#0047ab'], [0.6, '#00a7c7'], [1, '#7ff6ff']]);
      return { map: pix(N, (x, y, i, c) => { const col = g(y / N); c[0] = col[0]; c[1] = col[1]; c[2] = col[2]; }), metal: 0.9, rough: 0.16, handle: '#0a1d33' };
    },
    damascus_wave(N) {
      const n = U.fbm(N, 6, 5, 531);
      return { map: pix(N, (x, y, i, c) => { const k = 130 + 70 * Math.sin((x / N * 10 + y / N * 4 + n[i] * 7) * Math.PI); c[0] = k; c[1] = k + 2; c[2] = k + 6; }), metal: 1, rough: 0.25, handle: '#3b2a1c' };
    },
    toxic_fade(N) {
      const g = U.gradient([[0, '#00a86b'], [0.6, '#7dff2f'], [1, '#f2ff3c']]);
      return { map: pix(N, (x, y, i, c) => { const col = g(y / N); c[0] = col[0]; c[1] = col[1]; c[2] = col[2]; }), metal: 0.8, rough: 0.2, handle: '#0f1a0c', emiCol: '#183a00', emi: 0.4 };
    },
  };

  // ------------------------------------------------------------------ public
  const T = (GS.Tex = {
    setQuality(q) {
      N_MAP = q === 'low' ? 256 : 512;
      N_SKIN = q === 'low' ? 256 : 512;
      ANISO = q === 'low' ? 1 : q === 'medium' ? 4 : 8;
    },
    get aniso() { return ANISO; },
    canvas,
    // map surface: returns {map, normalMap, roughnessMap}
    surface(name) {
      const key = 'surf_' + name;
      if (cache[key]) return cache[key];
      const g = MAPGEN[name](N_MAP);
      const r = { map: tex(g.map) };
      if (g.normal) r.normalMap = tex(g.normal, { srgb: false });
      if (g.rough) r.roughnessMap = tex(g.rough, { srgb: false });
      return (cache[key] = r);
    },
    facade(seed, palette) {
      const key = 'fac_' + seed;
      if (cache[key]) return cache[key];
      const g = facade(N_MAP, seed, palette);
      return (cache[key] = { map: tex(g.map), emissiveMap: tex(g.emissive) });
    },
    skin(design) {
      const key = 'skin_' + design;
      if (cache[key]) return cache[key];
      const gen = SKINGEN[design] || SKINGEN.default;
      const g = gen(N_SKIN);
      const r = Object.assign({}, g);
      r.map = tex(g.map);
      r.emissiveMap = g.emissive ? (g.emissive === g.map ? r.map : tex(g.emissive)) : null;
      return (cache[key] = r);
    },
    knife(design) {
      const key = 'kskin_' + design;
      if (cache[key]) return cache[key];
      const gen = KGEN[design] || KGEN.default;
      const g = gen(N_SKIN);
      const r = Object.assign({}, g);
      r.map = tex(g.map);
      r.emissiveMap = g.emissive ? tex(g.emissive) : null;
      return (cache[key] = r);
    },
    // swatch canvas (for UI previews of patterns)
    skinSwatch(design, knife) {
      const t = knife ? this.knife(design) : this.skin(design);
      return t.map.image;
    },
    neonSign(text, color, w = 512, h = 128, font) {
      const key = 'sign_' + text + color + w + h;
      if (cache[key]) return cache[key];
      const c = canvas(w, h);
      const x = c.getContext('2d');
      x.clearRect(0, 0, w, h);
      x.font = font || `700 ${Math.floor(h * 0.62)}px "Chakra Petch", "Arial Black", sans-serif`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = color; x.shadowBlur = h * 0.25;
      x.strokeStyle = color; x.lineWidth = h * 0.06;
      x.strokeText(text, w / 2, h / 2);
      x.shadowBlur = h * 0.12;
      x.fillStyle = '#ffffff';
      x.fillText(text, w / 2, h / 2);
      return (cache[key] = tex(c, { aniso: 4 }));
    },
    // soft round sprite
    glow() {
      if (cache.glow) return cache.glow;
      const c = canvas(64); const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      return (cache.glow = tex(c, { clamp: true, srgb: false }));
    },
    smoke() {
      if (cache.smoke) return cache.smoke;
      const N = 64;
      const n = U.fbm(N, 4, 4, 601);
      const c = pix(N, (x, y, i, col) => {
        const dx = x / N - 0.5, dy = y / N - 0.5;
        const r = Math.sqrt(dx * dx + dy * dy) * 2;
        const a = Math.max(0, 1 - r) * (0.5 + n[i] * 0.7);
        col[0] = col[1] = col[2] = 255; col[3] = clamp255(a * 255);
      });
      return (cache.smoke = tex(c, { clamp: true, srgb: false }));
    },
    flash() {
      if (cache.flash) return cache.flash;
      const S = 128;
      const c = canvas(S); const x = c.getContext('2d');
      x.translate(S / 2, S / 2);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, S / 2);
      g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.2, 'rgba(255,220,140,0.9)'); g.addColorStop(0.5, 'rgba(255,140,40,0.35)'); g.addColorStop(1, 'rgba(255,100,0,0)');
      x.fillStyle = g;
      for (let k = 0; k < 7; k++) {
        x.rotate((Math.PI * 2) / 7);
        x.beginPath(); x.moveTo(0, -S * 0.06); x.lineTo(S * 0.5, 0); x.lineTo(0, S * 0.06); x.closePath(); x.fill();
      }
      x.beginPath(); x.arc(0, 0, S * 0.22, 0, Math.PI * 2); x.fill();
      return (cache.flash = tex(c, { clamp: true, srgb: false }));
    },
    bulletHole() {
      if (cache.hole) return cache.hole;
      const S = 64;
      const c = canvas(S); const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.18, 'rgba(10,10,10,0.95)'); g.addColorStop(0.3, 'rgba(40,40,40,0.6)'); g.addColorStop(1, 'rgba(60,60,60,0)');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) {
        const a = Math.random() * Math.PI * 2;
        x.beginPath(); x.moveTo(32, 32); x.lineTo(32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20); x.stroke();
      }
      return (cache.hole = tex(c, { clamp: true }));
    },
    contact() {
      // radial-ish gradient used for fake ambient occlusion around objects
      if (cache.contact) return cache.contact;
      const c = canvas(64); const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.5, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      return (cache.contact = tex(c, { clamp: true, srgb: false }));
    },
    blob() {
      if (cache.blob) return cache.blob;
      const c = canvas(64); const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      return (cache.blob = tex(c, { clamp: true, srgb: false }));
    },
    puddle() {
      if (cache.puddle) return cache.puddle;
      const N = 256;
      const n = U.fbm(N, 4, 5, 701);
      const c = pix(N, (x, y, i, col) => {
        const dx = x / N - 0.5, dy = y / N - 0.5;
        const r = Math.sqrt(dx * dx + dy * dy) * 2;
        const a = U.smoothstep(0.55, 0.45, r + (n[i] - 0.5) * 0.6);
        col[0] = col[1] = col[2] = 255; col[3] = a * 255;
      });
      return (cache.puddle = tex(c, { clamp: true, srgb: false }));
    },
  });
})();
