'use strict';
// GambelStrike 2 — shared utilities
window.GS = window.GS || {};
(function () {
  const U = (GS.U = {});

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smoothstep = (a, b, v) => {
    const t = U.clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  U.damp = (a, b, lambda, dt) => U.lerp(a, b, 1 - Math.exp(-lambda * dt));
  U.rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  U.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.chance = (p) => Math.random() < p;
  U.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  U.weightedIndex = (weights) => {
    let s = 0;
    for (const w of weights) s += w;
    let r = Math.random() * s;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  };
  U.wrapAngle = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };
  U.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  U.rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hashStr = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  U.ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) => {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    },
  };

  U.fmtTime = (s) => {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  U.fmtNum = (n) => Math.round(n).toLocaleString('en-US');
  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // resolves on the next animation frame, or after 60ms when frames are throttled (hidden tab)
  U.nextFrame = () => new Promise((r) => {
    let done = false;
    const fin = () => { if (!done) { done = true; r(); } };
    requestAnimationFrame(fin);
    setTimeout(fin, 60);
  });

  // ---------- tileable noise fields (used for procedural textures) ----------
  const fieldCache = {};
  U.valueNoiseTile = (N, period, rnd) => {
    const lat = new Float32Array(period * period);
    for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    const out = new Float32Array(N * N);
    const sc = period / N;
    for (let y = 0; y < N; y++) {
      const fy = y * sc, iy = Math.floor(fy);
      let ty = fy - iy; ty = ty * ty * (3 - 2 * ty);
      const y0 = (iy % period) * period, y1 = ((iy + 1) % period) * period;
      for (let x = 0; x < N; x++) {
        const fx = x * sc, ix = Math.floor(fx);
        let tx = fx - ix; tx = tx * tx * (3 - 2 * tx);
        const x0 = ix % period, x1 = (ix + 1) % period;
        const a = lat[y0 + x0], b = lat[y0 + x1], c = lat[y1 + x0], d = lat[y1 + x1];
        out[y * N + x] = (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
      }
    }
    return out;
  };
  // fractal noise, normalized to 0..1
  U.fbm = (N, basePeriod, octaves, seed, gain = 0.5) => {
    const key = [N, basePeriod, octaves, seed, gain].join('_');
    if (fieldCache[key]) return fieldCache[key];
    const rnd = U.rng(seed * 7919 + 13);
    const out = new Float32Array(N * N);
    let amp = 1, period = basePeriod;
    for (let o = 0; o < octaves; o++) {
      if (period > N) break;
      const n = U.valueNoiseTile(N, period, rnd);
      for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
      amp *= gain;
      period *= 2;
    }
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < out.length; i++) { if (out[i] < mn) mn = out[i]; if (out[i] > mx) mx = out[i]; }
    const r = mx - mn || 1;
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) / r;
    fieldCache[key] = out;
    return out;
  };
  // tileable worley noise: returns f1, f2 (distance in cell units) and id per pixel
  U.cells = (N, C, seed) => {
    const key = 'c' + [N, C, seed].join('_');
    if (fieldCache[key]) return fieldCache[key];
    const rnd = U.rng(seed * 104729 + 7);
    const px = new Float32Array(C * C), py = new Float32Array(C * C);
    for (let i = 0; i < C * C; i++) { px[i] = rnd(); py[i] = rnd(); }
    const f1 = new Float32Array(N * N), f2 = new Float32Array(N * N), id = new Float32Array(N * N);
    const sc = C / N;
    for (let y = 0; y < N; y++) {
      const fy = y * sc, cy = Math.floor(fy);
      for (let x = 0; x < N; x++) {
        const fx = x * sc, cx = Math.floor(fx);
        let d1 = 9, d2 = 9, best = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const gx = cx + ox, gy = cy + oy;
            const wx = ((gx % C) + C) % C, wy = ((gy % C) + C) % C;
            const k = wy * C + wx;
            const dx = gx + px[k] - fx, dy = gy + py[k] - fy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < d1) { d2 = d1; d1 = d; best = k; } else if (d < d2) d2 = d;
          }
        }
        const i = y * N + x;
        f1[i] = d1; f2[i] = d2; id[i] = (best * 0.6180339887) % 1;
      }
    }
    const res = { f1, f2, id };
    fieldCache[key] = res;
    return res;
  };

  // colour helpers
  U.hexToRgb = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  U.hsl2rgb = (h, s, l) => {
    h = ((h % 1) + 1) % 1;
    const f = (n) => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    };
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  };
  // gradient sampled from stops [[t,'#hex'],...]
  U.gradient = (stops) => {
    const s = stops.map(([t, c]) => [t, U.hexToRgb(c)]);
    return (t) => {
      if (t <= s[0][0]) return s[0][1];
      for (let i = 1; i < s.length; i++) {
        if (t <= s[i][0]) {
          const k = (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
          return U.mixRgb(s[i - 1][1], s[i][1], k);
        }
      }
      return s[s.length - 1][1];
    };
  };
})();
