'use strict';
// GambelStrike 2 — procedural audio. Every sound is synthesised once into an AudioBuffer
// (OfflineAudioContext) at boot, then played back cheaply with spatial panning.
(function () {
  const U = GS.U;
  const SR = 44100;
  let ctx = null, master = null, comp = null, reverb = null, reverbIn = null;
  const buses = {};
  const bank = {};
  let musicNode = null, musicName = null, ambNode = null, ambName = null;
  let lastTick = 0;
  const listener = { x: 0, y: 0, z: 0, rx: 1, ry: 0, rz: 0, fx: 0, fy: 0, fz: -1 };
  let occluder = null; // fn(ax,ay,az,bx,by,bz) -> boolean blocked
  let unlocked = false;

  // ------------------------------------------------------------ synthesis helpers (offline)
  function noiseBuf(oc, seconds, kind = 'white') {
    const len = Math.max(1, Math.floor(oc.sampleRate * seconds));
    const b = oc.createBuffer(1, len, oc.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (kind === 'pink') { last = 0.97 * last + 0.03 * w; d[i] = (w * 0.4 + last * 2.2); }
      else d[i] = w;
    }
    return b;
  }
  function envelope(param, t, a, peak, dec, endVal = 0.0001) {
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + Math.max(0.0005, a));
    param.exponentialRampToValueAtTime(Math.max(endVal, 0.0001), t + a + Math.max(0.001, dec));
  }
  function N(oc, out, o) {
    // filtered noise burst
    const src = oc.createBufferSource();
    src.buffer = noiseBuf(oc, (o.attack || 0.001) + o.decay + 0.05, o.kind || 'white');
    const f = oc.createBiquadFilter();
    f.type = o.type || 'lowpass';
    const t = o.t || 0;
    f.frequency.setValueAtTime(o.f0 || 3000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + (o.fdur || o.decay));
    f.Q.value = o.Q || 0.7;
    const g = oc.createGain();
    envelope(g.gain, t, o.attack || 0.001, o.gain || 0.5, o.decay);
    src.connect(f); f.connect(g);
    if (o.pan !== undefined && oc.createStereoPanner) { const p = oc.createStereoPanner(); p.pan.value = o.pan; g.connect(p); p.connect(out); }
    else g.connect(out);
    src.start(t);
    src.stop(t + (o.attack || 0.001) + o.decay + 0.05);
  }
  function O(oc, out, o) {
    const osc = oc.createOscillator();
    osc.type = o.type || 'sine';
    const t = o.t || 0;
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.fdur || o.decay));
    if (o.detune) osc.detune.value = o.detune;
    const g = oc.createGain();
    envelope(g.gain, t, o.attack || 0.002, o.gain || 0.3, o.decay);
    let node = osc;
    if (o.lp) { const f = oc.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.Q || 0.7; osc.connect(f); node = f; }
    node.connect(g);
    if (o.pan !== undefined && oc.createStereoPanner) { const p = oc.createStereoPanner(); p.pan.value = o.pan; g.connect(p); p.connect(out); }
    else g.connect(out);
    osc.start(t);
    osc.stop(t + (o.attack || 0.002) + o.decay + 0.05);
  }
  function metal(oc, out, o) {
    // inharmonic partials -> metallic ping
    const ratios = o.ratios || [1, 2.76, 5.40, 8.93];
    ratios.forEach((r, i) => { if (o.f * r < 19000) O(oc, out, { t: o.t, f0: o.f * r, decay: o.decay / (1 + i * 0.6), gain: (o.gain || 0.2) / (1 + i * 0.8), type: 'sine' }); });
  }
  function click(oc, out, o) {
    N(oc, out, { t: o.t, type: 'bandpass', f0: o.f || 3000, Q: o.Q || 3, decay: o.decay || 0.012, gain: o.gain || 0.6 });
    if (o.ping) metal(oc, out, { t: o.t, f: o.ping, decay: 0.05, gain: (o.gain || 0.6) * 0.25 });
  }
  function render(seconds, fn, channels = 1) {
    const oc = new OfflineAudioContext(channels, Math.ceil(SR * seconds), SR);
    const out = oc.createGain();
    out.connect(oc.destination);
    fn(oc, out);
    return oc.startRendering();
  }

  // ------------------------------------------------------------ gunshot recipe
  function gun(p) {
    return (oc, out) => {
      const v = 0.85 + Math.random() * 0.3;
      // transient crack
      N(oc, out, { type: 'highpass', f0: 2500 * v, decay: 0.018, gain: p.crack || 0.9 });
      // body
      N(oc, out, { type: 'lowpass', f0: p.body0 * v, f1: p.body1, fdur: p.bodyDur, decay: p.bodyDur, gain: p.bodyGain || 0.9, attack: 0.001 });
      // low thump
      O(oc, out, { type: 'sine', f0: p.thump0 * v, f1: p.thump1, decay: p.thumpDur, gain: p.thumpGain || 0.8 });
      // mid snap
      O(oc, out, { type: 'triangle', f0: p.snap || 420, f1: 90, decay: 0.05, gain: 0.25 });
      // mechanism
      if (p.mech) click(oc, out, { t: 0.03 + Math.random() * 0.01, f: p.mech, decay: 0.02, gain: 0.25, ping: p.mech * 0.9 });
      // tail
      N(oc, out, { t: 0.02, type: 'lowpass', f0: p.tailF || 900, f1: 200, decay: p.tail || 0.4, gain: p.tailGain || 0.18, kind: 'pink' });
      if (p.echo) {
        N(oc, out, { t: p.echo, type: 'bandpass', f0: 700, Q: 0.6, decay: 0.5, gain: 0.12 });
        N(oc, out, { t: p.echo * 2.1, type: 'bandpass', f0: 500, Q: 0.6, decay: 0.6, gain: 0.06 });
      }
    };
  }
  const GUNS = {
    pistol: { body0: 7000, body1: 700, bodyDur: 0.09, thump0: 170, thump1: 50, thumpDur: 0.1, snap: 600, mech: 3200, tail: 0.3 },
    pistol2: { body0: 8000, body1: 900, bodyDur: 0.08, thump0: 190, thump1: 60, thumpDur: 0.08, snap: 700, mech: 3600, tail: 0.25 },
    mp: { body0: 6000, body1: 800, bodyDur: 0.07, thump0: 160, thump1: 60, thumpDur: 0.07, snap: 520, mech: 2800, tail: 0.22, bodyGain: 0.75 },
    heavy: { body0: 5500, body1: 350, bodyDur: 0.16, thump0: 130, thump1: 38, thumpDur: 0.2, thumpGain: 1, snap: 380, mech: 2200, tail: 0.7, tailGain: 0.25, echo: 0.18 },
    revolver: { body0: 5000, body1: 300, bodyDur: 0.18, thump0: 120, thump1: 35, thumpDur: 0.22, thumpGain: 1, snap: 330, mech: 1800, tail: 0.8, tailGain: 0.28, echo: 0.2 },
    rifle: { body0: 6500, body1: 500, bodyDur: 0.12, thump0: 150, thump1: 42, thumpDur: 0.13, snap: 480, mech: 2600, tail: 0.5, tailGain: 0.2 },
    rifle2: { body0: 5200, body1: 420, bodyDur: 0.14, thump0: 135, thump1: 40, thumpDur: 0.15, snap: 430, mech: 2300, tail: 0.55, tailGain: 0.22 },
    rifle3: { body0: 7200, body1: 600, bodyDur: 0.1, thump0: 160, thump1: 48, thumpDur: 0.11, snap: 520, mech: 3000, tail: 0.45 },
    smg: { body0: 7500, body1: 900, bodyDur: 0.065, thump0: 180, thump1: 70, thumpDur: 0.07, snap: 650, mech: 3400, tail: 0.22, bodyGain: 0.7 },
    smg2: { body0: 8200, body1: 1100, bodyDur: 0.055, thump0: 200, thump1: 80, thumpDur: 0.06, snap: 700, mech: 3800, tail: 0.2, bodyGain: 0.65 },
    br: { body0: 6000, body1: 380, bodyDur: 0.15, thump0: 125, thump1: 38, thumpDur: 0.17, thumpGain: 0.95, snap: 400, mech: 2000, tail: 0.65, tailGain: 0.24, echo: 0.15 },
    shotgun: { body0: 4500, body1: 250, bodyDur: 0.22, thump0: 110, thump1: 32, thumpDur: 0.25, thumpGain: 1.1, snap: 300, tail: 0.8, tailGain: 0.3, bodyGain: 1.1, echo: 0.2 },
    sniper: { body0: 6000, body1: 220, bodyDur: 0.25, thump0: 95, thump1: 28, thumpDur: 0.35, thumpGain: 1.2, snap: 280, tail: 1.3, tailGain: 0.32, crack: 1.2, echo: 0.28 },
  };

  // ------------------------------------------------------------ recipe table [seconds, fn, variations, channels]
  const R = {};
  for (const k in GUNS) R['shot_' + k] = [k === 'sniper' ? 1.9 : 1.3, gun(GUNS[k]), 3];
  R.far_shot = [0.9, (oc, out) => {
    N(oc, out, { type: 'lowpass', f0: 1800, f1: 300, decay: 0.25, gain: 0.8 });
    O(oc, out, { f0: 110, f1: 40, decay: 0.2, gain: 0.5 });
    N(oc, out, { t: 0.12, type: 'bandpass', f0: 500, Q: 0.5, decay: 0.5, gain: 0.25, kind: 'pink' });
  }, 3];
  R.dry = [0.15, (oc, out) => click(oc, out, { f: 2600, decay: 0.015, gain: 0.7, ping: 1900 }), 1];
  R.mag_out = [0.35, (oc, out) => {
    click(oc, out, { f: 1800, decay: 0.02, gain: 0.7, ping: 1300 });
    N(oc, out, { t: 0.04, type: 'bandpass', f0: 900, Q: 1, decay: 0.12, gain: 0.25 });
  }, 2];
  R.mag_in = [0.35, (oc, out) => {
    N(oc, out, { type: 'bandpass', f0: 1200, Q: 1.2, decay: 0.05, gain: 0.4 });
    click(oc, out, { t: 0.06, f: 2400, decay: 0.02, gain: 0.9, ping: 1700 });
    O(oc, out, { t: 0.06, f0: 180, f1: 90, decay: 0.06, gain: 0.25 });
  }, 2];
  R.bolt_back = [0.3, (oc, out) => {
    N(oc, out, { type: 'bandpass', f0: 2500, f1: 1200, Q: 2, decay: 0.08, gain: 0.5 });
    click(oc, out, { t: 0.08, f: 3000, decay: 0.015, gain: 0.7, ping: 2100 });
  }, 2];
  R.bolt_fwd = [0.3, (oc, out) => {
    N(oc, out, { type: 'bandpass', f0: 1200, f1: 2600, Q: 2, decay: 0.06, gain: 0.5 });
    click(oc, out, { t: 0.06, f: 2200, decay: 0.02, gain: 1, ping: 1500 });
    O(oc, out, { t: 0.06, f0: 220, f1: 110, decay: 0.05, gain: 0.3 });
  }, 2];
  R.shell_in = [0.25, (oc, out) => {
    N(oc, out, { type: 'bandpass', f0: 900, Q: 1, decay: 0.05, gain: 0.4 });
    click(oc, out, { t: 0.05, f: 1600, decay: 0.03, gain: 0.7, ping: 900 });
  }, 3];
  R.pump = [0.5, (oc, out) => {
    N(oc, out, { type: 'bandpass', f0: 800, f1: 1600, Q: 1.5, decay: 0.12, gain: 0.6 });
    click(oc, out, { t: 0.12, f: 1400, decay: 0.03, gain: 0.9, ping: 800 });
    N(oc, out, { t: 0.2, type: 'bandpass', f0: 1600, f1: 900, Q: 1.5, decay: 0.1, gain: 0.5 });
    click(oc, out, { t: 0.3, f: 1800, decay: 0.03, gain: 1, ping: 1000 });
  }, 2];
  R.cloth = [0.4, (oc, out) => N(oc, out, { type: 'bandpass', f0: 1500, f1: 600, Q: 0.8, attack: 0.05, decay: 0.25, gain: 0.25, kind: 'pink' }), 3];
  R.shell = [0.4, (oc, out) => {
    const f = 3500 + Math.random() * 1500;
    metal(oc, out, { f, decay: 0.18, gain: 0.12, ratios: [1, 1.5, 2.7] });
    metal(oc, out, { t: 0.09 + Math.random() * 0.05, f: f * 1.05, decay: 0.12, gain: 0.06, ratios: [1, 1.5, 2.7] });
  }, 4];
  R.imp_concrete = [0.35, (oc, out) => {
    N(oc, out, { type: 'bandpass', f0: 2200 + Math.random() * 800, Q: 1.2, decay: 0.05, gain: 0.8 });
    N(oc, out, { type: 'lowpass', f0: 1200, f1: 300, decay: 0.15, gain: 0.35 });
  }, 3];
  R.imp_metal = [0.6, (oc, out) => {
    N(oc, out, { type: 'highpass', f0: 3000, decay: 0.03, gain: 0.6 });
    metal(oc, out, { f: 1400 + Math.random() * 900, decay: 0.35, gain: 0.25 });
  }, 3];
  R.imp_sand = [0.3, (oc, out) => N(oc, out, { type: 'lowpass', f0: 2500, f1: 400, decay: 0.12, gain: 0.6, kind: 'pink' }), 2];
  R.imp_body = [0.3, (oc, out) => {
    O(oc, out, { f0: 160, f1: 60, decay: 0.08, gain: 0.7 });
    N(oc, out, { type: 'bandpass', f0: 4200, Q: 2, decay: 0.03, gain: 0.35 });
  }, 2];
  R.hit = [0.15, (oc, out) => { O(oc, out, { type: 'square', f0: 2200, decay: 0.03, gain: 0.12, lp: 6000 }); N(oc, out, { type: 'highpass', f0: 5000, decay: 0.015, gain: 0.25 }); }, 1];
  R.headshot = [0.6, (oc, out) => {
    metal(oc, out, { f: 2100, decay: 0.45, gain: 0.35, ratios: [1, 2.01, 3.0, 4.2] });
    N(oc, out, { type: 'highpass', f0: 6000, decay: 0.02, gain: 0.4 });
  }, 1];
  R.kill = [0.7, (oc, out) => {
    O(oc, out, { type: 'triangle', f0: 880, decay: 0.25, gain: 0.25 });
    O(oc, out, { t: 0.06, type: 'triangle', f0: 1318, decay: 0.35, gain: 0.22 });
    N(oc, out, { type: 'highpass', f0: 5000, decay: 0.03, gain: 0.25 });
  }, 1];
  R.hurt = [0.3, (oc, out) => { O(oc, out, { f0: 120, f1: 50, decay: 0.15, gain: 0.8 }); N(oc, out, { type: 'lowpass', f0: 900, decay: 0.12, gain: 0.4 }); }, 2];
  R.death = [1.6, (oc, out) => {
    O(oc, out, { f0: 140, f1: 30, fdur: 1.0, decay: 1.2, gain: 0.8 });
    N(oc, out, { type: 'lowpass', f0: 2000, f1: 100, fdur: 1, decay: 1.1, gain: 0.4, kind: 'brown' });
  }, 1];
  R.eliminate = [0.8, (oc, out) => {
    for (let i = 0; i < 6; i++) O(oc, out, { t: i * 0.025, type: 'square', f0: 1200 + i * 220, decay: 0.08, gain: 0.05, lp: 5000 });
    N(oc, out, { type: 'bandpass', f0: 3000, f1: 800, Q: 1, decay: 0.4, gain: 0.25 });
  }, 1];
  // knives
  R.knife_draw = [0.9, (oc, out) => {
    N(oc, out, { type: 'highpass', f0: 2500, f1: 7000, fdur: 0.25, attack: 0.08, decay: 0.25, gain: 0.35 });
    metal(oc, out, { t: 0.18, f: 3100, decay: 0.6, gain: 0.18, ratios: [1, 1.48, 2.32, 3.7] });
  }, 2];
  R.swish = [0.4, (oc, out) => N(oc, out, { type: 'bandpass', f0: 600, f1: 3000, fdur: 0.12, Q: 1.4, attack: 0.04, decay: 0.16, gain: 0.55 }), 4];
  R.swish_heavy = [0.6, (oc, out) => N(oc, out, { type: 'bandpass', f0: 400, f1: 2200, fdur: 0.2, Q: 1.2, attack: 0.08, decay: 0.25, gain: 0.6 }), 2];
  R.knife_hit = [0.4, (oc, out) => { O(oc, out, { f0: 200, f1: 70, decay: 0.12, gain: 0.8 }); N(oc, out, { type: 'bandpass', f0: 1800, Q: 1, decay: 0.08, gain: 0.5 }); }, 2];
  R.knife_wall = [0.5, (oc, out) => { click(oc, out, { f: 4000, decay: 0.02, gain: 0.8 }); metal(oc, out, { f: 2600, decay: 0.3, gain: 0.15 }); }, 2];
  R.bf_click = [0.25, (oc, out) => { click(oc, out, { f: 3800, decay: 0.012, gain: 0.8, ping: 2900 + Math.random() * 600 }); }, 4];
  R.bf_clack = [0.3, (oc, out) => {
    click(oc, out, { f: 2600, decay: 0.015, gain: 0.9, ping: 2200 });
    click(oc, out, { t: 0.035, f: 3400, decay: 0.012, gain: 0.6, ping: 3000 });
  }, 3];
  R.whoosh = [0.35, (oc, out) => N(oc, out, { type: 'bandpass', f0: 900, f1: 2400, fdur: 0.1, Q: 2, attack: 0.05, decay: 0.12, gain: 0.3 }), 4];
  R.ring_spin = [0.6, (oc, out) => {
    N(oc, out, { type: 'bandpass', f0: 700, f1: 2600, fdur: 0.3, Q: 2.5, attack: 0.15, decay: 0.2, gain: 0.35 });
    metal(oc, out, { t: 0.3, f: 4200, decay: 0.15, gain: 0.08 });
  }, 3];
  R.catch = [0.3, (oc, out) => { O(oc, out, { f0: 260, f1: 140, decay: 0.05, gain: 0.35 }); click(oc, out, { t: 0.01, f: 2000, decay: 0.02, gain: 0.4 }); }, 2];
  // movement
  R.step = [0.25, (oc, out) => {
    N(oc, out, { type: 'lowpass', f0: 900 + Math.random() * 300, f1: 200, decay: 0.08, gain: 0.7, kind: 'pink' });
    O(oc, out, { f0: 90, f1: 50, decay: 0.05, gain: 0.35 });
  }, 5];
  R.step_metal = [0.35, (oc, out) => {
    N(oc, out, { type: 'lowpass', f0: 1200, f1: 300, decay: 0.07, gain: 0.6 });
    metal(oc, out, { f: 600 + Math.random() * 200, decay: 0.18, gain: 0.12 });
  }, 3];
  R.step_sand = [0.3, (oc, out) => N(oc, out, { type: 'bandpass', f0: 1800, f1: 600, Q: 0.7, attack: 0.01, decay: 0.12, gain: 0.55, kind: 'pink' }), 4];
  R.land = [0.4, (oc, out) => { O(oc, out, { f0: 110, f1: 40, decay: 0.15, gain: 0.9 }); N(oc, out, { type: 'lowpass', f0: 800, decay: 0.12, gain: 0.6, kind: 'pink' }); }, 2];
  R.jump = [0.3, (oc, out) => N(oc, out, { type: 'bandpass', f0: 1200, f1: 500, Q: 0.8, attack: 0.02, decay: 0.12, gain: 0.25, kind: 'pink' }), 2];
  // UI
  R.ui_hover = [0.12, (oc, out) => O(oc, out, { type: 'sine', f0: 1700, f1: 1900, decay: 0.04, gain: 0.08 }), 1];
  R.ui_click = [0.2, (oc, out) => { O(oc, out, { type: 'triangle', f0: 900, f1: 600, decay: 0.06, gain: 0.25 }); click(oc, out, { f: 4000, decay: 0.008, gain: 0.25 }); }, 1];
  R.ui_back = [0.2, (oc, out) => O(oc, out, { type: 'triangle', f0: 600, f1: 380, decay: 0.08, gain: 0.22 }), 1];
  R.ui_open = [0.5, (oc, out) => { N(oc, out, { type: 'bandpass', f0: 400, f1: 2400, fdur: 0.2, Q: 1.5, attack: 0.06, decay: 0.2, gain: 0.2 }); O(oc, out, { t: 0.08, type: 'sine', f0: 660, decay: 0.2, gain: 0.1 }); }, 1];
  R.ui_error = [0.35, (oc, out) => { O(oc, out, { type: 'square', f0: 180, decay: 0.08, gain: 0.12, lp: 1200 }); O(oc, out, { t: 0.1, type: 'square', f0: 140, decay: 0.12, gain: 0.12, lp: 1200 }); }, 1];
  R.ui_buy = [0.9, (oc, out) => {
    [1318, 1568, 2093].forEach((f, i) => metal(oc, out, { t: i * 0.06, f, decay: 0.4, gain: 0.12, ratios: [1, 2.0, 3.0] }));
    N(oc, out, { type: 'highpass', f0: 6000, attack: 0.02, decay: 0.3, gain: 0.08 });
  }, 1];
  R.ui_equip = [0.4, (oc, out) => { click(oc, out, { f: 2000, decay: 0.02, gain: 0.5, ping: 1500 }); O(oc, out, { t: 0.04, type: 'triangle', f0: 1046, decay: 0.15, gain: 0.15 }); }, 1];
  R.ui_type = [0.08, (oc, out) => click(oc, out, { f: 5000, decay: 0.006, gain: 0.2 }), 2];
  // roulette & cases
  R.tick = [0.1, (oc, out) => { click(oc, out, { f: 3200, Q: 4, decay: 0.006, gain: 0.7 }); O(oc, out, { type: 'triangle', f0: 1500, f1: 900, decay: 0.02, gain: 0.12 }); }, 3];
  R.case_tick = [0.1, (oc, out) => { click(oc, out, { f: 2400, Q: 3, decay: 0.008, gain: 0.55 }); O(oc, out, { type: 'sine', f0: 1100, decay: 0.03, gain: 0.1 }); }, 2];
  R.wheel_stop = [0.6, (oc, out) => { O(oc, out, { f0: 160, f1: 70, decay: 0.2, gain: 0.7 }); click(oc, out, { f: 1500, decay: 0.03, gain: 0.6, ping: 900 }); }, 1];
  R.spin_start = [1.0, (oc, out) => {
    N(oc, out, { type: 'bandpass', f0: 300, f1: 2500, fdur: 0.6, Q: 1.2, attack: 0.3, decay: 0.4, gain: 0.25 });
    O(oc, out, { type: 'sawtooth', f0: 80, f1: 240, fdur: 0.6, attack: 0.2, decay: 0.5, gain: 0.08, lp: 900 });
  }, 1];
  R.reveal = [1.6, (oc, out) => {
    [523, 659, 784, 1046].forEach((f, i) => O(oc, out, { t: i * 0.035, type: 'triangle', f0: f, decay: 1.0, gain: 0.12 }));
    N(oc, out, { type: 'highpass', f0: 5000, attack: 0.01, decay: 0.6, gain: 0.08 });
    O(oc, out, { f0: 130, f1: 65, decay: 0.3, gain: 0.5 });
  }, 1];
  R.reveal_big = [2.6, (oc, out) => {
    O(oc, out, { f0: 90, f1: 40, decay: 0.8, gain: 0.9 });
    N(oc, out, { type: 'lowpass', f0: 3000, f1: 200, decay: 1.2, gain: 0.4, kind: 'pink' });
    [392, 523, 659, 784, 1046, 1318].forEach((f, i) => O(oc, out, { t: 0.05 + i * 0.05, type: 'sawtooth', f0: f, decay: 1.6, gain: 0.05, lp: 3000 }));
    metal(oc, out, { t: 0.1, f: 2093, decay: 1.4, gain: 0.12, ratios: [1, 2, 3] });
  }, 1];
  R.reveal_bad = [1.8, (oc, out) => {
    [392, 370, 349, 311].forEach((f, i) => O(oc, out, { t: i * 0.14, type: 'square', f0: f, decay: 0.3, gain: 0.06, lp: 1600 }));
    O(oc, out, { t: 0.55, f0: 80, f1: 40, decay: 0.8, gain: 0.6 });
  }, 1];
  R.suspense = [2.2, (oc, out) => {
    O(oc, out, { type: 'sawtooth', f0: 55, f1: 110, fdur: 2, attack: 1.6, decay: 0.4, gain: 0.12, lp: 600 });
    N(oc, out, { type: 'bandpass', f0: 200, f1: 3000, fdur: 2, Q: 2, attack: 1.8, decay: 0.3, gain: 0.12 });
  }, 1];
  R.heartbeat = [0.8, (oc, out) => { O(oc, out, { f0: 70, f1: 40, decay: 0.12, gain: 0.8 }); O(oc, out, { t: 0.18, f0: 60, f1: 35, decay: 0.15, gain: 0.6 }); }, 1];
  R.case_open = [1.2, (oc, out) => {
    click(oc, out, { f: 1500, decay: 0.03, gain: 0.8, ping: 700 });
    click(oc, out, { t: 0.12, f: 1800, decay: 0.03, gain: 0.8, ping: 900 });
    N(oc, out, { t: 0.2, type: 'bandpass', f0: 300, f1: 3000, fdur: 0.5, Q: 1, attack: 0.2, decay: 0.4, gain: 0.3 });
  }, 1];
  R.drop_common = [1.0, (oc, out) => { [659, 784].forEach((f, i) => O(oc, out, { t: i * 0.06, type: 'triangle', f0: f, decay: 0.5, gain: 0.15 })); }, 1];
  R.drop_rare = [2.0, (oc, out) => {
    [523, 659, 784, 1046, 1318].forEach((f, i) => O(oc, out, { t: i * 0.07, type: 'triangle', f0: f, decay: 0.9, gain: 0.12 }));
    N(oc, out, { type: 'highpass', f0: 6000, attack: 0.3, decay: 1.0, gain: 0.08 });
  }, 1];
  R.drop_epic = [3.0, (oc, out) => {
    O(oc, out, { f0: 80, f1: 45, decay: 0.6, gain: 0.7 });
    [392, 523, 659, 784, 1046, 1318, 1568, 2093].forEach((f, i) => metal(oc, out, { t: 0.05 + i * 0.07, f, decay: 1.2, gain: 0.08, ratios: [1, 2, 3.01] }));
    N(oc, out, { type: 'highpass', f0: 7000, attack: 0.4, decay: 1.6, gain: 0.1 });
  }, 1];
  R.drop_knife = [4.5, (oc, out) => {
    O(oc, out, { f0: 60, f1: 30, decay: 1.4, gain: 1.0 });
    N(oc, out, { type: 'lowpass', f0: 5000, f1: 300, decay: 2.0, gain: 0.4, kind: 'pink' });
    const ch = [261, 329, 392, 523, 659, 784, 1046, 1318, 1568, 2093, 2637];
    ch.forEach((f, i) => metal(oc, out, { t: 0.08 + i * 0.09, f, decay: 2.2, gain: 0.07, ratios: [1, 2, 3.0, 4.01] }));
    [261, 329, 392].forEach((f) => O(oc, out, { t: 0.1, type: 'sawtooth', f0: f, decay: 3.2, attack: 0.3, gain: 0.05, lp: 2400 }));
  }, 1];
  R.flash = [0.8, (oc, out) => N(oc, out, { type: 'highpass', f0: 1500, f1: 9000, fdur: 0.3, attack: 0.15, decay: 0.4, gain: 0.25 }), 1];
  // match flow
  R.countdown = [0.4, (oc, out) => O(oc, out, { type: 'square', f0: 880, decay: 0.15, gain: 0.12, lp: 3000 }), 1];
  R.go = [1.2, (oc, out) => {
    O(oc, out, { type: 'sawtooth', f0: 440, decay: 0.8, gain: 0.12, lp: 2500 });
    O(oc, out, { type: 'sawtooth', f0: 659, decay: 0.8, gain: 0.1, lp: 2500 });
    O(oc, out, { type: 'sawtooth', f0: 880, decay: 0.8, gain: 0.08, lp: 2500 });
    O(oc, out, { f0: 100, f1: 50, decay: 0.4, gain: 0.7 });
  }, 1];
  R.round_end = [2.5, (oc, out) => {
    [784, 659, 523, 392].forEach((f, i) => O(oc, out, { t: i * 0.15, type: 'sawtooth', f0: f, decay: 0.9, gain: 0.08, lp: 2200 }));
    O(oc, out, { t: 0.6, f0: 70, f1: 35, decay: 1.2, gain: 0.7 });
  }, 1];
  R.streak = [1.2, (oc, out) => {
    [523, 784, 1046].forEach((f, i) => O(oc, out, { t: i * 0.05, type: 'square', f0: f, decay: 0.5, gain: 0.06, lp: 4000 }));
    N(oc, out, { type: 'highpass', f0: 4000, attack: 0.05, decay: 0.4, gain: 0.1 });
  }, 1];
  R.spawn = [1.0, (oc, out) => {
    N(oc, out, { type: 'bandpass', f0: 3000, f1: 600, fdur: 0.6, Q: 3, attack: 0.05, decay: 0.6, gain: 0.25 });
    O(oc, out, { type: 'sine', f0: 400, f1: 900, decay: 0.5, gain: 0.12 });
  }, 1];
  R.coin = [0.5, (oc, out) => { metal(oc, out, { f: 2637, decay: 0.3, gain: 0.12, ratios: [1, 2.0] }); metal(oc, out, { t: 0.07, f: 3520, decay: 0.3, gain: 0.1, ratios: [1, 2.0] }); }, 1];

  // ------------------------------------------------------------ music (rendered loops)
  function musicMenu(oc, out) {
    const bpm = 96, beat = 60 / bpm, bar = beat * 4;
    const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const delay = oc.createDelay(1); delay.delayTime.value = beat * 0.75;
    const fb = oc.createGain(); fb.gain.value = 0.35;
    const dl = oc.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2500;
    delay.connect(dl); dl.connect(fb); fb.connect(delay); dl.connect(out);
    for (let b = 0; b < 8; b++) {
      const ch = chords[Math.floor(b / 2) % 4];
      const t0 = b * bar;
      // pad
      for (const n of ch) {
        for (const det of [-7, 7]) {
          const o = oc.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = det;
          const f = oc.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(600, t0); f.frequency.linearRampToValueAtTime(1400, t0 + bar); f.Q.value = 0.5;
          const g = oc.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.025, t0 + 0.6); g.gain.setValueAtTime(0.025, t0 + bar - 0.2); g.gain.linearRampToValueAtTime(0.0001, t0 + bar + 0.1);
          o.connect(f); f.connect(g); g.connect(out); o.start(t0); o.stop(t0 + bar + 0.2);
        }
      }
      // bass (8ths)
      for (let i = 0; i < 8; i++) {
        const t = t0 + i * beat / 2;
        O(oc, out, { t, type: 'sawtooth', f0: mtof(ch[0] - 24), decay: beat * 0.45, gain: i % 2 ? 0.07 : 0.1, lp: 420 + (i % 4) * 90, Q: 4 });
      }
      // arp (16ths)
      for (let i = 0; i < 16; i++) {
        const t = t0 + i * beat / 4;
        const n = ch[i % 3] + 12 + (i % 8 >= 6 ? 12 : 0);
        const osc = oc.createOscillator(); osc.type = 'square'; osc.frequency.value = mtof(n);
        const f = oc.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200 + 600 * Math.sin(b + i * 0.4);
        const g = oc.createGain(); envelope(g.gain, t, 0.004, 0.022, beat * 0.22);
        osc.connect(f); f.connect(g); g.connect(out); g.connect(delay); osc.start(t); osc.stop(t + beat * 0.3);
      }
      // drums
      for (let i = 0; i < 4; i++) {
        const t = t0 + i * beat;
        O(oc, out, { t, f0: 150, f1: 45, decay: 0.25, gain: 0.32 });
        if (i % 2 === 1) N(oc, out, { t, type: 'bandpass', f0: 1800, Q: 0.7, decay: 0.16, gain: 0.12 });
        N(oc, out, { t: t + beat / 2, type: 'highpass', f0: 8000, decay: 0.04, gain: 0.06 });
      }
    }
  }
  function musicTense(oc, out) {
    const bpm = 120, beat = 60 / bpm, bar = beat * 4;
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const roots = [45, 45, 46, 44];
    for (let b = 0; b < 4; b++) {
      const t0 = b * bar, r = roots[b];
      const o = oc.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(r - 12);
      const f = oc.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t0); f.frequency.linearRampToValueAtTime(900, t0 + bar); f.Q.value = 6;
      const g = oc.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.06, t0 + 0.2); g.gain.setValueAtTime(0.06, t0 + bar - 0.1); g.gain.linearRampToValueAtTime(0.0001, t0 + bar);
      o.connect(f); f.connect(g); g.connect(out); o.start(t0); o.stop(t0 + bar + 0.05);
      for (let i = 0; i < 16; i++) {
        const t = t0 + i * beat / 4;
        N(oc, out, { t, type: 'highpass', f0: 7000, decay: 0.03, gain: i % 4 === 2 ? 0.07 : 0.035 });
        if (i % 4 === 0) O(oc, out, { t, f0: 120, f1: 40, decay: 0.2, gain: 0.3 });
        if (i % 8 === 4) N(oc, out, { t, type: 'bandpass', f0: 1500, decay: 0.12, gain: 0.08 });
        if (i % 2 === 0) O(oc, out, { t, type: 'square', f0: mtof(r + 24 + (i % 6 === 0 ? 7 : 0)), decay: 0.06, gain: 0.018, lp: 3000 });
      }
    }
  }
  function ambCity(oc, out) {
    N(oc, out, { type: 'lowpass', f0: 400, decay: 8.4, attack: 0.001, gain: 0.25, kind: 'brown' });
    // rain hiss
    const src = oc.createBufferSource(); src.buffer = noiseBuf(oc, 8.5, 'white');
    const f = oc.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5000; f.Q.value = 0.4;
    const g = oc.createGain(); g.gain.value = 0.05; src.connect(f); f.connect(g); g.connect(out); src.start(0);
    for (let i = 0; i < 40; i++) click(oc, out, { t: Math.random() * 8, f: 3000 + Math.random() * 4000, decay: 0.01, gain: 0.05 + Math.random() * 0.05 });
    // distant hum
    O(oc, out, { type: 'sine', f0: 60, decay: 8, attack: 0.5, gain: 0.03 });
  }
  function ambDesert(oc, out) {
    const src = oc.createBufferSource(); src.buffer = noiseBuf(oc, 8.5, 'pink');
    const f = oc.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(400, 0);
    for (let i = 1; i <= 8; i++) f.frequency.linearRampToValueAtTime(300 + Math.random() * 700, i);
    const g = oc.createGain(); g.gain.value = 0.18; src.connect(f); f.connect(g); g.connect(out); src.start(0);
  }
  async function renderLoop(seconds, fn, tail = 1.5) {
    const buf = await render(seconds + tail, fn, 2);
    // fold tail into the start for a seamless loop
    const len = Math.floor(seconds * SR);
    const outB = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: SR });
    for (let c = 0; c < 2; c++) {
      const src = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
      const dst = outB.getChannelData(c);
      for (let i = 0; i < len; i++) dst[i] = src[i];
      for (let i = len; i < src.length; i++) dst[i - len] += src[i];
    }
    return outB;
  }

  // ------------------------------------------------------------ public API
  function makeImpulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  // ?mute in the URL silences everything (used for automated tests)

  const A = (GS.Audio = {
    ready: false,
    _mute: false,
    get muted() { return this._mute || /[?&]mute/.test(location.search + location.hash); },
    set muted(v) { this._mute = !!v; },
    get ctx() { return ctx; },
    init() {
      if (ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      master = ctx.createGain();
      master.connect(comp); comp.connect(ctx.destination);
      for (const b of ['music', 'weapons', 'effects', 'ui', 'voice']) {
        buses[b] = ctx.createGain();
        buses[b].connect(master);
      }
      reverb = ctx.createConvolver();
      reverb.buffer = makeImpulse(1.6, 3);
      reverbIn = ctx.createGain(); reverbIn.gain.value = 0.35;
      const rv = ctx.createGain(); rv.gain.value = 0.5;
      reverbIn.connect(reverb); reverb.connect(rv); rv.connect(master);
      this.applyVolumes();
    },
    unlock() {
      if (!ctx) this.init();
      if (ctx && ctx.state !== 'running') ctx.resume();
      unlocked = true;
    },
    async build(progress) {
      const names = Object.keys(R);
      let done = 0;
      const total = names.length + 4;
      const jobs = [];
      for (const n of names) {
        const [dur, fn, vars] = R[n];
        jobs.push((async () => {
          const arr = [];
          for (let i = 0; i < vars; i++) arr.push(await render(dur, fn));
          bank[n] = arr;
          done++; progress && progress(done / total);
        })());
        if (jobs.length >= 8) { await Promise.all(jobs); jobs.length = 0; }
      }
      await Promise.all(jobs);
      bank.music_menu = [await renderLoop(8 * 4 * 60 / 96, musicMenu)]; done++; progress && progress(done / total);
      bank.music_tense = [await renderLoop(4 * 4 * 60 / 120, musicTense)]; done++; progress && progress(done / total);
      bank.amb_city = [await renderLoop(8, ambCity, 0.5)]; done++; progress && progress(done / total);
      bank.amb_desert = [await renderLoop(8, ambDesert, 0.5)]; done++; progress && progress(done / total);
      this.ready = true;
    },
    applyVolumes() {
      if (!ctx) return;
      const s = GS.Save.d.settings.sound;
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(this.muted ? 0 : s.master, t, 0.05);
      buses.music.gain.setTargetAtTime(s.music * 0.6, t, 0.05);
      buses.weapons.gain.setTargetAtTime(s.weapons, t, 0.05);
      buses.effects.gain.setTargetAtTime(s.effects, t, 0.05);
      buses.ui.gain.setTargetAtTime(s.ui, t, 0.05);
      buses.voice.gain.setTargetAtTime(s.voice, t, 0.05);
    },
    setReverb(amount) { if (reverbIn) reverbIn.gain.setTargetAtTime(amount, ctx.currentTime, 0.1); },
    setOccluder(fn) { occluder = fn; },
    setListener(pos, fwd, right) {
      listener.x = pos.x; listener.y = pos.y; listener.z = pos.z;
      listener.fx = fwd.x; listener.fy = fwd.y; listener.fz = fwd.z;
      listener.rx = right.x; listener.ry = right.y; listener.rz = right.z;
    },
    has(name) { return !!bank[name]; },
    // play a sound. opts: bus, vol, rate, pan, pos {x,y,z}, rev (reverb send), maxDist
    play(name, o = {}) {
      if (!ctx || !this.ready || ctx.state !== 'running') return null;
      const arr = bank[name];
      if (!arr) return null;
      const buf = arr[Math.floor(Math.random() * arr.length)];
      let vol = o.vol === undefined ? 1 : o.vol;
      let pan = o.pan || 0;
      let lp = 0;
      if (o.pos) {
        const dx = o.pos.x - listener.x, dy = o.pos.y - listener.y, dz = o.pos.z - listener.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const ref = o.ref || 4;
        const maxD = o.maxDist || 120;
        if (d > maxD) return null;
        vol *= ref / (ref + Math.max(0, d - ref) * 1.15);
        vol *= 1 - U.smoothstep(maxD * 0.6, maxD, d);
        if (d > 0.01) pan = U.clamp((dx * listener.rx + dy * listener.ry + dz * listener.rz) / d, -1, 1) * 0.85;
        lp = d > 12 ? U.clamp(18000 - (d - 12) * 220, 1200, 18000) : 0;
        if (occluder && d > 3 && o.occlude !== false && occluder(o.pos)) { vol *= 0.55; lp = Math.min(lp || 18000, 1400); }
        if (vol < 0.012) return null;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = (o.rate || 1) * (1 + (o.vary === undefined ? 0.04 : o.vary) * (Math.random() * 2 - 1));
      const g = ctx.createGain();
      g.gain.value = vol;
      let node = src;
      if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
      node.connect(g);
      let outNode = g;
      if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); outNode = p; }
      outNode.connect(buses[o.bus || 'effects']);
      if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(reverbIn); }
      src.start(ctx.currentTime + (o.delay || 0));
      return src;
    },
    ui(name, vol = 1) { return this.play(name, { bus: 'ui', vol, vary: 0.02 }); },
    tick(rate = 1, vol = 0.8, name = 'tick') {
      const now = performance.now();
      if (now - lastTick < 22) return;
      lastTick = now;
      this.play(name, { bus: 'ui', vol, rate, vary: 0.03 });
    },
    music(name, fade = 1.2) {
      if (!ctx || !this.ready) return;
      if (musicName === name) return;
      const t = ctx.currentTime;
      if (musicNode) {
        const old = musicNode;
        old.g.gain.cancelScheduledValues(t);
        old.g.gain.setValueAtTime(old.g.gain.value, t);
        old.g.gain.linearRampToValueAtTime(0.0001, t + fade);
        old.src.stop(t + fade + 0.05);
        musicNode = null;
      }
      musicName = name;
      if (!name || !bank[name]) return;
      const src = ctx.createBufferSource();
      src.buffer = bank[name][0];
      src.loop = true;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(1, t + fade);
      src.connect(g); g.connect(buses.music);
      src.start(t);
      musicNode = { src, g };
    },
    ambience(name, vol = 1) {
      if (!ctx || !this.ready) return;
      if (ambName === name) return;
      const t = ctx.currentTime;
      if (ambNode) {
        const old = ambNode;
        old.g.gain.setTargetAtTime(0.0001, t, 0.4);
        old.src.stop(t + 2);
        ambNode = null;
      }
      ambName = name;
      if (!name || !bank[name]) return;
      const src = ctx.createBufferSource();
      src.buffer = bank[name][0];
      src.loop = true;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.setTargetAtTime(vol, t, 0.6);
      src.connect(g); g.connect(buses.effects);
      src.start(t);
      ambNode = { src, g };
    },
    duckMusic(amount, time = 0.3) {
      if (!ctx || !musicNode) return;
      musicNode.g.gain.setTargetAtTime(amount, ctx.currentTime, time);
    },
    speak(text, rate = 1.0) {
      if (this.muted) return;
      try {
        const vol = GS.Save.d.settings.sound.voice * GS.Save.d.settings.sound.master;
        if (!window.speechSynthesis || vol <= 0.01) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.volume = U.clamp(vol, 0, 1);
        u.rate = rate;
        u.pitch = 0.7;
        const voices = window.speechSynthesis.getVoices();
        const en = voices.find((v) => /en[-_](US|GB)/i.test(v.lang) && /male|david|george|guy|daniel/i.test(v.name)) || voices.find((v) => /^en/i.test(v.lang));
        if (en) u.voice = en;
        window.speechSynthesis.speak(u);
      } catch (e) { /* ignore */ }
    },
  });
})();
