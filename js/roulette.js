'use strict';
// GambelStrike 2 — pre-round roulette: six animated wheels (HP, SPEED, DAMAGE, MAIN, SECONDARY, KNIFE)
(function () {
  const U = GS.U;
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------------ wheel definitions
  function hpColor(v) {
    const t = (v - 1) / 199;
    const g = U.gradient([[0, '#ff1f4b'], [0.25, '#ff7a1f'], [0.5, '#ffd23f'], [0.75, '#4fd18b'], [1, '#00e0ff']]);
    return g(t);
  }
  function speedColor(v) {
    const t = (v - 0.1) / 2.9;
    return U.gradient([[0, '#3d5bff'], [0.31, '#9fd6ff'], [0.32, '#ffffff'], [0.6, '#ffb03d'], [1, '#ff2f6d']])(t);
  }
  function dmgColor(v) {
    const t = (v - 0.5) / 2.0;
    return U.gradient([[0, '#4fd18b'], [0.25, '#e8fff0'], [0.55, '#ffb03d'], [1, '#ff2fd0']])(t);
  }
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  // roll helpers (shared with bots)
  function hpSegments() {
    const vals = new Set();
    while (vals.size < 22) vals.add(U.randi(2, 199));
    const list = [...vals].sort((a, b) => a - b).map((v) => ({ value: v, label: String(v), w: 1 }));
    list.unshift({ value: 1, label: '1', w: 0.5, special: 'danger' });
    list.push({ value: 200, label: '200', w: 0.5, special: 'tank' });
    return list.map((s) => Object.assign(s, { color: hpColor(s.value) }));
  }
  function speedSegments() {
    const out = [];
    for (let i = 1; i <= 30; i++) {
      const v = i / 10;
      out.push({ value: v, label: 'x' + v.toFixed(1), w: v <= 0.3 || v >= 2.8 ? 0.6 : 1, color: speedColor(v), special: v <= 0.2 ? 'snail' : v >= 2.9 ? 'light' : null });
    }
    return out;
  }
  function dmgSegments() {
    const out = [];
    for (let i = 5; i <= 25; i++) {
      const v = i / 10;
      out.push({ value: v, label: 'x' + v.toFixed(1), w: 1, color: dmgColor(v), special: v <= 0.5 ? 'pillow' : v >= 2.5 ? 'overkill' : null });
    }
    return out;
  }
  function itemSegments(kind, ids) {
    const reps = Math.max(1, Math.ceil(8 / ids.length));
    const list = [];
    for (let r = 0; r < reps; r++) for (const id of ids) list.push(id);
    // spread duplicates apart
    const out = [];
    const base = ids.slice();
    for (let r = 0; r < reps; r++) {
      const order = U.shuffle(base.slice());
      if (out.length && order[0] === out[out.length - 1] && order.length > 1) order.push(order.shift());
      out.push(...order);
    }
    const pal = kind === 'knife' ? ['#3a2f0a', '#241d06'] : ['#1b1f2e', '#141724'];
    return out.map((id, i) => {
      const isKnife = kind === 'knife';
      const def = isKnife ? GS.KNIVES[id] : GS.WEAPONS[id];
      const design = GS.Save.equipped(id);
      const rar = isKnife ? GS.RARITIES.knife : GS.RARITIES[(GS.SKINS[design] || GS.SKINS.default).rarity];
      return { value: id, label: def.name, w: 1, color: U.hexToRgb(pal[i % 2]), accent: rar.color, design, item: true, kind: isKnife ? 'knife' : 'gun' };
    });
  }
  function pickWeighted(segs) { return U.weightedIndex(segs.map((s) => s.w)); }

  // a random loadout for a bot (bots own every item)
  function rollBot() {
    const hs = hpSegments(), ss = speedSegments(), ds = dmgSegments();
    const rnd = (o) => U.pick(Object.keys(o));
    const skinFor = () => {
      const r = Math.random();
      const tier = r < 0.45 ? 'common' : r < 0.7 ? 'uncommon' : r < 0.85 ? 'rare' : r < 0.94 ? 'epic' : r < 0.98 ? 'legendary' : 'mythic';
      const pool = Object.keys(GS.SKINS).filter((k) => GS.SKINS[k].rarity === tier && k !== 'default');
      return Math.random() < 0.3 ? 'default' : U.pick(pool);
    };
    const knife = rnd(GS.KNIVES);
    void rnd;
    return {
      hp: hs[pickWeighted(hs)].value,
      speed: ss[pickWeighted(ss)].value,
      damage: ds[pickWeighted(ds)].value,
      main: { id: U.pick(GS.MAINS), design: skinFor() },
      secondary: { id: U.pick(GS.SECONDARIES), design: skinFor() },
      knife: { id: knife, design: Math.random() < 0.5 ? 'default' : U.pick(GS.KNIFE_SKIN_SETS[knife]) },
    };
  }

  function flavour(step, v) {
    if (step === 0) {
      if (v === 1) return { tag: 'DANGER ROUND', cls: 'bad', say: 'Danger round!' };
      if (v === 200) return { tag: 'TANK ROUND', cls: 'gold', say: 'Tank round!' };
      if (v <= 15) return { tag: 'GLASS CANNON', cls: 'bad' };
      if (v >= 175) return { tag: 'BULLET SPONGE', cls: 'good' };
    }
    if (step === 1) {
      if (v <= 0.2) return { tag: 'SNAIL MODE', cls: 'bad', say: 'Snail mode.' };
      if (v <= 0.5) return { tag: 'HEAVY BOOTS', cls: 'bad' };
      if (v >= 2.9) return { tag: 'LIGHTSPEED', cls: 'gold', say: 'Lightspeed!' };
      if (v >= 2.2) return { tag: 'SPEED DEMON', cls: 'good' };
    }
    if (step === 2) {
      if (v <= 0.5) return { tag: 'PILLOW FIGHT', cls: 'bad', say: 'Pillow fight.' };
      if (v >= 2.5) return { tag: 'OVERKILL', cls: 'gold', say: 'Overkill!' };
      if (v >= 2.0) return { tag: 'HEAVY HITTER', cls: 'good' };
    }
    return null;
  }

  const STEPS = [
    { key: 'hp', title: 'HP', sub: 'How much health you start every life with.', fmt: (v) => v + ' HP' },
    { key: 'speed', title: 'SPEED', sub: 'Movement speed multiplier for this round.', fmt: (v) => 'x' + v.toFixed(1) },
    { key: 'damage', title: 'DAMAGE', sub: 'Damage multiplier for every weapon you hold.', fmt: (v) => 'x' + v.toFixed(1) },
    { key: 'main', title: 'MAIN WEAPON', sub: 'Only weapons you own can land here.', fmt: (v) => GS.WEAPONS[v].name },
    { key: 'secondary', title: 'SECONDARY', sub: 'Only secondaries you own can land here.', fmt: (v) => GS.WEAPONS[v].name },
    { key: 'knife', title: 'KNIFE', sub: 'Your unlocked knives — with their equipped skins.', fmt: (v) => GS.KNIVES[v].name },
  ];

  // ------------------------------------------------------------------ wheel renderer
  class Wheel {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.angle = 0;
      this.flap = 0; this.flapV = 0;
      this.leds = 40;
      this.ledPhase = 0;
      this.state = 'idle';
      this.lastIdx = -1;
      this.winColor = null;
      this.zoom = 1;
    }
    resize() {
      const r = this.cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const s = Math.floor(Math.max(200, r.width) * dpr);
      this.S = s;
      if (this.cv.width !== s) { this.cv.width = s; this.cv.height = s; if (this.segs && this.face) this._bake(); }
    }
    setSegments(segs, kind) {
      this.segs = segs;
      this.kind = kind;
      const total = segs.reduce((a, s) => a + s.w, 0);
      let a = 0;
      for (const s of segs) { s.a0 = (a / total) * TAU; a += s.w; s.a1 = (a / total) * TAU; s.mid = (s.a0 + s.a1) / 2; }
      this.resize();
      this._bake();
      this.winColor = null;
      this.lastIdx = -1;
    }
    _bake() {
      const S = this.S;
      const face = this.face || (this.face = document.createElement('canvas'));
      face.width = S; face.height = S;
      const x = face.getContext('2d');
      const c = S / 2, R = S * 0.44;
      x.clearRect(0, 0, S, S);
      x.save();
      x.translate(c, c);
      for (const s of this.segs) {
        // angles measured clockwise from the top -> canvas angle = a - PI/2
        const a0 = s.a0 - Math.PI / 2, a1 = s.a1 - Math.PI / 2;
        x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, a0, a1); x.closePath();
        const col = s.color;
        const g = x.createRadialGradient(0, 0, R * 0.15, 0, 0, R);
        if (s.item) {
          g.addColorStop(0, rgb(col, 1)); g.addColorStop(1, rgb(U.mixRgb(col, [255, 255, 255], 0.06), 1));
        } else {
          g.addColorStop(0, rgb(U.mixRgb(col, [0, 0, 0], 0.55))); g.addColorStop(0.7, rgb(U.mixRgb(col, [0, 0, 0], 0.18))); g.addColorStop(1, rgb(col));
        }
        x.fillStyle = g; x.fill();
        x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = S * 0.003; x.stroke();
        if (s.item) {
          // rarity strip on the rim
          x.beginPath(); x.arc(0, 0, R * 0.985, a0 + 0.01, a1 - 0.01); x.strokeStyle = s.accent; x.lineWidth = S * 0.012; x.stroke();
        }
        if (s.special) {
          x.beginPath(); x.arc(0, 0, R * 0.96, a0, a1); x.strokeStyle = s.special === 'danger' || s.special === 'snail' || s.special === 'pillow' ? '#ff1f4b' : '#ffd23f'; x.lineWidth = S * 0.02; x.stroke();
        }
        // label
        x.save();
        x.rotate(s.mid);
        const span = s.a1 - s.a0;
        if (s.item) {
          const icon = GS.Studio.icon(s.kind, s.value, s.design);
          const iw = Math.min(R * 0.42, R * span * 1.25), ih = iw * (icon.height / icon.width);
          x.save();
          x.translate(0, -R * 0.47);
          x.rotate(-Math.PI / 2);
          x.drawImage(icon, -iw / 2, -ih / 2, iw, ih);
          x.restore();
          x.fillStyle = '#fff';
          x.font = `700 ${Math.max(10, Math.min(S * 0.024, R * span * 0.2))}px "Chakra Petch", sans-serif`;
          x.textAlign = 'left'; x.textBaseline = 'middle';
          x.save(); x.translate(0, -R * 0.94); x.rotate(Math.PI / 2);
          x.fillText(s.label.toUpperCase(), 0, 0);
          x.restore();
        } else {
          const fs = Math.max(9, Math.min(S * 0.034, R * span * 0.55));
          x.font = `800 ${fs}px "Chakra Petch", sans-serif`;
          x.textAlign = 'left'; x.textBaseline = 'middle';
          x.translate(0, -R * 0.93);
          x.rotate(Math.PI / 2);
          const lum = (col[0] * 0.3 + col[1] * 0.59 + col[2] * 0.11);
          x.fillStyle = lum > 150 ? '#101018' : '#ffffff';
          x.fillText(s.label, 0, 0);
        }
        x.restore();
      }
      // inner shading ring
      const sh = x.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
      sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(0.35, 'rgba(0,0,0,0)'); sh.addColorStop(0.92, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)');
      x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fillStyle = sh; x.fill();
      x.restore();
    }
    indexAt(angle) {
      // segment under the top pointer for wheel rotation `angle` (clockwise)
      let a = (-angle) % TAU;
      if (a < 0) a += TAU;
      for (let i = 0; i < this.segs.length; i++) if (a >= this.segs[i].a0 && a < this.segs[i].a1) return i;
      return this.segs.length - 1;
    }
    // plan a spin landing on segment idx
    spin(idx, dur, turns) {
      const s = this.segs[idx];
      const off = s.a0 + (s.a1 - s.a0) * U.rand(0.18, 0.82);
      let target = -off;
      const start = this.angle;
      // make target > start + turns
      const base = start + turns * TAU;
      target = target + Math.ceil((base - target) / TAU) * TAU;
      const total = target - start;
      const a = Math.min(0.55, dur * 0.12), d = dur - a, p = 2.7;
      const V = total / (a / 2 + d / (p + 1));
      this.plan = { start, total, a, d, p, V, dur, t: 0 };
      this.state = 'spin';
      this.result = idx;
    }
    _angleAt(t) {
      const { start, a, d, p, V } = this.plan;
      if (t <= a) return start + 0.5 * V * t * t / a;
      const u = Math.min(1, (t - a) / d);
      return start + V * a / 2 + (V * d / (p + 1)) * (1 - Math.pow(1 - u, p + 1));
    }
    speed() {
      if (this.state !== 'spin') return 0;
      const { a, d, p, V, t } = this.plan;
      if (t <= a) return V * t / a;
      const u = Math.min(1, (t - a) / d);
      return V * Math.pow(1 - u, p);
    }
    update(dt) {
      let done = false;
      if (this.state === 'spin') {
        this.plan.t += dt;
        this.angle = this._angleAt(this.plan.t);
        if (this.plan.t >= this.plan.dur) { this.angle = this._angleAt(this.plan.dur); this.state = 'stopped'; done = true; }
      }
      const idx = this.indexAt(this.angle);
      if (idx !== this.lastIdx) {
        if (this.lastIdx >= 0 && this.state === 'spin') {
          const sp = this.speed();
          this.flapV -= Math.min(14, 4 + sp * 0.6);
          GS.Audio.tick(U.clamp(0.8 + sp * 0.02, 0.8, 1.5), U.clamp(0.35 + sp * 0.02, 0.35, 0.8));
        }
        this.lastIdx = idx;
      }
      this.flapV += (-this.flap * 380 - this.flapV * 16) * dt;
      this.flap += this.flapV * dt;
      this.ledPhase += dt * (this.state === 'spin' ? 6 + this.speed() * 0.8 : 1.2);
      return done;
    }
    draw() {
      const x = this.ctx, S = this.S, c = S / 2, R = S * 0.44;
      x.clearRect(0, 0, S, S);
      // backdrop glow
      const glowCol = this.winColor || [120, 80, 255];
      const bg = x.createRadialGradient(c, c, R * 0.6, c, c, S * 0.5);
      bg.addColorStop(0, rgb(glowCol, 0.32)); bg.addColorStop(1, rgb(glowCol, 0));
      x.fillStyle = bg; x.fillRect(0, 0, S, S);
      // outer rim
      x.save(); x.translate(c, c);
      x.beginPath(); x.arc(0, 0, R * 1.085, 0, TAU);
      const rim = x.createLinearGradient(0, -R, 0, R);
      rim.addColorStop(0, '#3a3f55'); rim.addColorStop(0.5, '#151826'); rim.addColorStop(1, '#2a2e40');
      x.fillStyle = rim; x.fill();
      x.lineWidth = S * 0.006; x.strokeStyle = 'rgba(255,255,255,0.15)'; x.stroke();
      // wheel face
      x.save();
      x.rotate(this.angle);
      x.drawImage(this.face, -c, -c, S, S);
      x.restore();
      // motion blur veil at speed
      const sp = this.speed();
      if (sp > 6) {
        x.beginPath(); x.arc(0, 0, R, 0, TAU);
        x.fillStyle = `rgba(10,10,20,${Math.min(0.35, (sp - 6) * 0.012)})`; x.fill();
      }
      // gloss
      const gl = x.createLinearGradient(-R, -R, R, R);
      gl.addColorStop(0, 'rgba(255,255,255,0.16)'); gl.addColorStop(0.45, 'rgba(255,255,255,0.02)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fillStyle = gl; x.fill();
      // LEDs
      for (let i = 0; i < this.leds; i++) {
        const a = (i / this.leds) * TAU;
        const lx = Math.sin(a) * R * 1.045, ly = -Math.cos(a) * R * 1.045;
        let on;
        if (this.state === 'spin') on = ((i + Math.floor(this.ledPhase * 3)) % 5) === 0 ? 1 : 0.15;
        else if (this.winColor) on = (Math.floor(this.ledPhase * 4) + i) % 2 ? 1 : 0.3;
        else on = 0.45 + 0.4 * Math.sin(this.ledPhase * 2 + i * 0.5);
        const col = this.winColor || [255, 210, 120];
        x.beginPath(); x.arc(lx, ly, S * 0.009, 0, TAU);
        x.fillStyle = rgb(col, 0.25 + on * 0.75); x.fill();
        if (on > 0.6) {
          const lg = x.createRadialGradient(lx, ly, 0, lx, ly, S * 0.03);
          lg.addColorStop(0, rgb(col, 0.6)); lg.addColorStop(1, rgb(col, 0));
          x.fillStyle = lg; x.fillRect(lx - S * 0.03, ly - S * 0.03, S * 0.06, S * 0.06);
        }
      }
      // hub
      const hr = R * 0.2;
      const hg = x.createRadialGradient(-hr * 0.3, -hr * 0.3, hr * 0.1, 0, 0, hr);
      hg.addColorStop(0, '#3b4060'); hg.addColorStop(1, '#0d0f18');
      x.beginPath(); x.arc(0, 0, hr, 0, TAU); x.fillStyle = hg; x.fill();
      x.lineWidth = S * 0.006; x.strokeStyle = 'rgba(160,140,255,0.6)'; x.stroke();
      x.fillStyle = '#fff'; x.font = `900 ${S * 0.05}px "Chakra Petch", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('GS2', 0, -S * 0.004);
      x.font = `600 ${S * 0.016}px "Chakra Petch", sans-serif`; x.fillStyle = 'rgba(255,255,255,0.5)';
      x.fillText('GAMBEL', 0, S * 0.032);
      // pointer
      x.save();
      x.translate(0, -R * 1.07);
      x.rotate(U.clamp(this.flap, -0.6, 0.6));
      x.beginPath(); x.moveTo(-S * 0.03, -S * 0.035); x.lineTo(S * 0.03, -S * 0.035); x.lineTo(0, S * 0.055); x.closePath();
      const pg = x.createLinearGradient(0, -S * 0.04, 0, S * 0.05);
      pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, this.winColor ? rgb(this.winColor) : '#ff2fd0');
      x.fillStyle = pg; x.shadowColor = 'rgba(255,47,208,0.8)'; x.shadowBlur = S * 0.03; x.fill();
      x.restore();
      x.restore();
    }
  }

  // ------------------------------------------------------------------ controller
  const R = (GS.Roulette = {
    rollBot,
    STEPS,
    open(root, ctx, onDone) {
      this.root = root;
      this.ctx = ctx;
      this.onDone = onDone;
      this.step = -1;
      this.result = {};
      this.fast = false;
      this.busy = false;
      const auto = GS.Save.d.settings.game.autoSpin;
      root.innerHTML = `
        <div class="rl">
          <div class="rl-head">
            <div class="rl-title"><span>PRE-ROUND</span> ROULETTE</div>
            <div class="rl-steps">${STEPS.map((s, i) => `<div class="rl-step" data-i="${i}"><div class="n">${i + 1}</div><div class="t">${s.title}</div><div class="v">—</div></div>`).join('')}</div>
          </div>
          <div class="rl-body">
            <div class="rl-wheelbox">
              <canvas class="rl-wheel"></canvas>
              <div class="rl-reveal"></div>
            </div>
            <div class="rl-side glass">
              <div class="rl-count">SPIN <b class="rl-i">1</b> / 6</div>
              <div class="rl-name">HP</div>
              <div class="rl-sub"></div>
              <button class="btn primary big rl-spin" data-sfx>SPIN <kbd>SPACE</kbd></button>
              <div class="rl-row">
                <label class="toggle"><input type="checkbox" class="rl-auto" ${auto ? 'checked' : ''}><span></span>AUTO-SPIN</label>
                <button class="btn ghost small rl-quick" data-sfx>QUICK SPIN ALL</button>
              </div>
              <div class="rl-feedhead">LOBBY RESULTS</div>
              <div class="rl-feed"></div>
            </div>
          </div>
        </div>`;
      this.wheel = new Wheel(root.querySelector('.rl-wheel'));
      this.$spin = root.querySelector('.rl-spin');
      this.$auto = root.querySelector('.rl-auto');
      this.$reveal = root.querySelector('.rl-reveal');
      this.$feed = root.querySelector('.rl-feed');
      this.$spin.onclick = () => this.spin();
      this.$auto.onchange = () => { GS.Save.d.settings.game.autoSpin = this.$auto.checked; GS.Save.save(); if (this.$auto.checked && !this.busy) this.spin(); };
      root.querySelector('.rl-quick').onclick = () => { this.fast = true; this.$auto.checked = true; if (!this.busy) this.spin(); };
      this.keyH = (e) => { if (e.code === 'Space' && !this.busy && this.root.isConnected) { e.preventDefault(); this.spin(); } };
      window.addEventListener('keydown', this.keyH);
      this.running = true;
      GS.Audio.music('music_tense', 0.8);
      this._next();
      requestAnimationFrame(() => this.wheel.resize());
    },
    close() {
      this.running = false;
      window.removeEventListener('keydown', this.keyH);
    },
    _next() {
      this.step++;
      if (this.step >= 6) { this._finish(); return; }
      const st = STEPS[this.step];
      let segs;
      if (this.step === 0) segs = hpSegments();
      else if (this.step === 1) segs = speedSegments();
      else if (this.step === 2) segs = dmgSegments();
      else if (this.step === 3) segs = itemSegments('gun', GS.Save.ownedMains());
      else if (this.step === 4) segs = itemSegments('gun', GS.Save.ownedSecondaries());
      else segs = itemSegments('knife', GS.Save.ownedKnives());
      this.segs = segs;
      this.wheel.setSegments(segs, st.key);
      this.root.querySelector('.rl-i').textContent = this.step + 1;
      this.root.querySelector('.rl-name').textContent = st.title;
      this.root.querySelector('.rl-sub').textContent = st.sub;
      for (const el of this.root.querySelectorAll('.rl-step')) {
        const i = +el.dataset.i;
        el.classList.toggle('active', i === this.step);
        el.classList.toggle('done', i < this.step);
      }
      this.$reveal.className = 'rl-reveal';
      this.$reveal.innerHTML = '';
      this.$spin.disabled = false;
      this.$spin.classList.remove('hidden');
      this.busy = false;
      const wb = this.root.querySelector('.rl-wheelbox');
      wb.classList.remove('in'); void wb.offsetWidth; wb.classList.add('in');
      GS.Audio.ui('ui_open', 0.6);
      if (this.$auto.checked) setTimeout(() => { if (this.running && !this.busy) this.spin(); }, this.fast ? 250 : 700);
    },
    spin() {
      if (this.busy || this.step < 0 || this.step >= 6) return;
      this.busy = true;
      this.$spin.disabled = true;
      const idx = pickWeighted(this.segs);
      const dur = this.fast ? U.rand(1.5, 1.9) : U.rand(4.4, 5.4);
      this.wheel.spin(idx, dur, this.fast ? 3 : U.randi(4, 6));
      this.suspense = false;
      GS.Audio.play('spin_start', { bus: 'ui', vol: 0.7 });
      GS.Audio.duckMusic(0.35);
    },
    update(dt) {
      if (!this.running || !this.wheel) return;
      const w = this.wheel;
      const done = w.update(dt);
      if (w.state === 'spin' && !this.fast && !this.suspense && w.plan.t > w.plan.dur - 1.6) {
        this.suspense = true;
        GS.Audio.play('heartbeat', { bus: 'ui', vol: 0.6 });
        this.root.querySelector('.rl-wheelbox').classList.add('tense');
      }
      w.draw();
      if (done) this._land();
    },
    _land() {
      const seg = this.segs[this.wheel.result];
      const st = STEPS[this.step];
      const v = seg.value;
      if (this.step < 3) this.result[st.key] = v;
      else this.result[st.key] = { id: v, design: seg.design };
      this.root.querySelector('.rl-wheelbox').classList.remove('tense');
      GS.Audio.play('wheel_stop', { bus: 'ui', vol: 0.8 });
      GS.Audio.duckMusic(1, 0.8);
      const fl = flavour(this.step, v);
      this.wheel.winColor = seg.item ? U.hexToRgb(seg.accent) : seg.color;
      // reveal card
      let html;
      if (seg.item) {
        const kind = seg.kind;
        const skinName = kind === 'knife' ? (GS.KNIFE_SKINS[seg.design] || GS.KNIFE_SKINS.default).name : (GS.SKINS[seg.design] || GS.SKINS.default).name;
        html = `<div class="rv-card item" style="--rc:${seg.accent}"><img src="${GS.Studio.iconURL(kind, v, seg.design)}"><div class="rv-val">${U.esc(st.fmt(v))}</div><div class="rv-skin">${kind === 'knife' ? '★ ' : ''}${U.esc(skinName)}</div></div>`;
      } else {
        html = `<div class="rv-card" style="--rc:${rgb(seg.color)}"><div class="rv-label">${st.title}</div><div class="rv-val">${U.esc(st.fmt(v))}</div>${fl ? `<div class="rv-tag ${fl.cls}">${fl.tag}</div>` : ''}</div>`;
      }
      this.$reveal.innerHTML = html;
      this.$reveal.className = 'rl-reveal on' + (fl ? ' ' + fl.cls : '');
      if (fl && fl.cls === 'gold') GS.Audio.play('reveal_big', { bus: 'ui', vol: 0.8 });
      else if (fl && fl.cls === 'bad') GS.Audio.play('reveal_bad', { bus: 'ui', vol: 0.8 });
      else GS.Audio.play('reveal', { bus: 'ui', vol: 0.7 });
      if (fl && fl.say) GS.Audio.speak(fl.say);
      const stepEl = this.root.querySelector(`.rl-step[data-i="${this.step}"] .v`);
      stepEl.textContent = st.fmt(v);
      stepEl.parentElement.classList.add('pop');
      // lobby feed: a couple of other players' results for this wheel
      const bots = this.ctx.bots;
      const n = Math.min(bots.length, U.randi(2, 3));
      const picks = U.shuffle(bots.slice()).slice(0, n);
      for (const b of picks) {
        const bv = b.loadout[st.key];
        const val = this.step < 3 ? st.fmt(bv) : (this.step === 5 ? GS.KNIVES[bv.id].name : GS.WEAPONS[bv.id].name);
        const bfl = this.step < 3 ? flavour(this.step, bv) : null;
        const row = document.createElement('div');
        row.className = 'rl-fr' + (bfl ? ' ' + bfl.cls : '');
        row.innerHTML = `<i style="background:${b.color}"></i><span>${U.esc(b.name)}</span><b>${U.esc(val)}</b>`;
        this.$feed.prepend(row);
      }
      while (this.$feed.children.length > 9) this.$feed.lastChild.remove();
      this.$spin.classList.add('hidden');
      const wait = this.fast ? 650 : fl ? 2100 : 1500;
      setTimeout(() => { if (this.running) this._next(); }, wait);
    },
    _finish() {
      this.close();
      GS.Audio.duckMusic(1);
      this.onDone(this.result);
    },
  });
})();
