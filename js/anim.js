'use strict';
// GambelStrike 2 — keyframe animation with C1-continuous Hermite curves and cross-fade blending.
// Clips: { dur, t: { channel: [[time, v0, v1, ...(, 'e')], ...] }, ev: [[time, name], ...], hold, loop }
// A trailing 'e' on a key forces a zero tangent there (ease / hold).
(function () {
  const U = GS.U;
  const TAU = Math.PI * 2;

  function compileTrack(keys) {
    const n = keys.length;
    const ease = keys.map((k) => typeof k[k.length - 1] === 'string');
    const dim = keys[0].length - 1 - (ease[0] ? 1 : 0);
    const T = new Float32Array(n), V = new Float32Array(n * dim), Mt = new Float32Array(n * dim);
    for (let i = 0; i < n; i++) {
      T[i] = keys[i][0];
      for (let d = 0; d < dim; d++) V[i * dim + d] = keys[i][1 + d];
    }
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < dim; d++) {
        if (i === 0 || i === n - 1 || ease[i]) Mt[i * dim + d] = 0;
        else Mt[i * dim + d] = (V[(i + 1) * dim + d] - V[(i - 1) * dim + d]) / (T[i + 1] - T[i - 1]);
      }
    }
    return { n, dim, T, V, M: Mt };
  }

  function evalTrack(tr, t, out) {
    const { n, dim, T, V, M } = tr;
    if (n === 1 || t <= T[0]) { for (let d = 0; d < dim; d++) out[d] = V[d]; return out; }
    if (t >= T[n - 1]) { for (let d = 0; d < dim; d++) out[d] = V[(n - 1) * dim + d]; return out; }
    let i = 0;
    while (i < n - 2 && t >= T[i + 1]) i++;
    const h = T[i + 1] - T[i];
    const s = (t - T[i]) / h, s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    for (let d = 0; d < dim; d++) {
      out[d] = h00 * V[i * dim + d] + h10 * h * M[i * dim + d] + h01 * V[(i + 1) * dim + d] + h11 * h * M[(i + 1) * dim + d];
    }
    return out;
  }

  function clip(def) {
    const c = { dur: def.dur, tracks: {}, ev: (def.ev || []).slice().sort((a, b) => a[0] - b[0]), hold: !!def.hold, loop: !!def.loop, name: def.name || '' };
    for (const ch in def.t) c.tracks[ch] = compileTrack(def.t[ch]);
    return c;
  }

  const isAngle = (ch) => ch.endsWith('.r') || ch === 'bfB' || ch === 'bfH' || ch === 'fold';

  class Player {
    constructor() {
      this.cur = null; this.time = 0; this.speed = 1;
      this.prev = null; this.prevTime = 0; this.prevSpeed = 1;
      this.w = 1; this.blendDur = 0.1;
      this.onEvent = null; this.onEnd = null;
      this._a = new Float32Array(4); this._b = new Float32Array(4);
      this.finished = true;
    }
    play(c, o = {}) {
      // snapshot current state as "prev" (the blend source)
      this.prev = this.cur; this.prevTime = this.time; this.prevSpeed = this.cur ? this.speed : 1;
      this.prevHold = true;
      this.cur = c; this.time = o.start || 0; this.speed = o.speed || 1;
      this.w = 0; this.blendDur = o.blend === undefined ? 0.08 : o.blend;
      this.onEnd = o.onEnd || null;
      this.finished = !c;
      this._evIdx = 0;
      if (c) while (this._evIdx < c.ev.length && c.ev[this._evIdx][0] < this.time) this._evIdx++;
    }
    stop(blend = 0.15) { this.play(null, { blend }); }
    get playing() { return !!this.cur && !this.finished; }
    get name() { return this.cur ? this.cur.name : ''; }
    get progress() { return this.cur ? this.time / this.cur.dur : 1; }
    update(dt) {
      if (this.w < 1) this.w = this.blendDur <= 0 ? 1 : Math.min(1, this.w + dt / this.blendDur);
      if (this.prev && this.prevTime < this.prev.dur) this.prevTime = Math.min(this.prev.dur, this.prevTime + dt * this.prevSpeed);
      const c = this.cur;
      if (!c || this.finished) return;
      this.time += dt * this.speed;
      while (this._evIdx < c.ev.length && c.ev[this._evIdx][0] <= this.time) {
        const e = c.ev[this._evIdx++];
        if (this.onEvent) this.onEvent(e[1], c);
      }
      if (this.time >= c.dur) {
        if (c.loop) {
          this.time %= c.dur;
          this._evIdx = 0;
        } else {
          this.time = c.dur;
          this.finished = true;
          const cb = this.onEnd;
          this.onEnd = null;
          if (!c.hold) {
            // blend back to rest
            this.prev = c; this.prevTime = c.dur; this.prevSpeed = 0;
            this.cur = null; this.w = 0; this.blendDur = c.blendOut || 0.14;
          }
          if (cb) cb();
        }
      }
    }
    _eval(c, t, ch, dim, def, out) {
      const tr = c && c.tracks[ch];
      if (!tr) { for (let d = 0; d < dim; d++) out[d] = def[d]; return out; }
      return evalTrack(tr, t, out);
    }
    // sample a channel into out (array of length dim). def = rest value array
    sample(ch, dim, def, out) {
      const a = this._eval(this.cur, this.time, ch, dim, def, this._a);
      if (this.w >= 1) { for (let d = 0; d < dim; d++) out[d] = a[d]; return out; }
      const b = this._eval(this.prev, this.prevTime, ch, dim, def, this._b);
      const w = U.ease.inOutQuad(this.w);
      const ang = isAngle(ch);
      for (let d = 0; d < dim; d++) {
        if (ang) out[d] = b[d] + U.wrapAngle(a[d] - b[d]) * w;
        else out[d] = b[d] + (a[d] - b[d]) * w;
      }
      // normalise angle once fully blended away from a finished clip
      return out;
    }
  }

  GS.Anim = { clip, Player, TAU };
})();
