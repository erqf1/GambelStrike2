'use strict';
// GambelStrike 2 — first-person viewmodel: hands, weapons, knives and all their animations.
(function () {
  const U = GS.U;
  const PI = Math.PI, TAU = PI * 2;
  const C = (dur, t, ev, o) => GS.Anim.clip(Object.assign({ dur, t, ev: ev || [] }, o || {}));

  // ================================================================== gun clips
  // channels: gun.p/gun.r (whole weapon), lh.p/lh.r (left hand, weapon space), rh.p/rh.r,
  // lhMag/lhBolt/rhBolt (socket blend weights), magAttach, mag.p, bolt.p/bolt.r, pump.p, cyl.p/cyl.r, slideLock, shellVis
  const G = {};
  G.draw = C(0.5, {
    'gun.p': [[0, 0.03, -0.26, 0.08], [0.28, 0, 0.012, -0.006], [0.5, 0, 0, 0]],
    'gun.r': [[0, -1.0, 0.3, 0.6], [0.3, 0.07, -0.02, -0.04], [0.5, 0, 0, 0]],
    'lh.p': [[0, -0.03, -0.14, 0.12], [0.2, -0.03, -0.12, 0.1], [0.36, 0, 0.004, 0], [0.5, 0, 0, 0]],
  }, [[0, 'snd:cloth:0.5'], [0.32, 'snd:catch:0.5']]);
  G.drawPistol = C(0.42, {
    'gun.p': [[0, 0.02, -0.22, 0.04], [0.22, 0, 0.01, 0], [0.42, 0, 0, 0]],
    'gun.r': [[0, -0.6, 0.5, 1.2], [0.24, 0.1, -0.05, -0.1], [0.42, 0, 0, 0]],
    'lh.p': [[0, -0.05, -0.15, 0.1], [0.18, -0.05, -0.12, 0.08], [0.32, 0, 0, 0]],
  }, [[0, 'snd:cloth:0.5'], [0.26, 'snd:bolt_fwd:0.5']]);
  G.reload = C(2.0, {
    'gun.r': [[0, 0, 0, 0], [0.28, 0.14, 0.32, 0.42], [0.9, 0.16, 0.3, 0.45], [1.3, 0.2, 0.28, 0.4], [1.42, 0.25, 0.26, 0.36], [1.75, 0.03, 0.04, 0.05], [2.0, 0, 0, 0]],
    'gun.p': [[0, 0, 0, 0], [0.28, 0.01, -0.02, 0.03], [1.3, 0.01, -0.02, 0.03], [1.42, 0.01, -0.006, 0.03], [1.75, 0, 0.005, 0], [2.0, 0, 0, 0]],
    lhMag: [[0, 0], [0.3, 1], [1.5, 1], [1.72, 0]],
    'lh.p': [[0, 0, 0, 0], [0.3, 0, 0, 0], [0.36, 0, 0.01, 0], [0.46, 0, -0.07, 0.01], [0.72, 0.03, -0.42, 0.2], [0.95, 0.03, -0.42, 0.2], [1.2, 0, -0.05, 0.0], [1.34, 0, 0.012, 0], [1.42, 0, 0, 0]],
    'lh.r': [[0, 0, 0, 0], [0.72, 0.5, 0, 0.3], [0.95, 0.5, 0, 0.3], [1.25, 0, 0, 0]],
    magAttach: [[0, 0], [0.35, 0], [0.37, 1], [1.45, 1], [1.48, 0]],
  }, [[0.05, 'snd:cloth:0.6'], [0.37, 'snd:mag_out'], [1.34, 'snd:mag_in']]);
  G.reloadEmpty = C(2.5, {
    'gun.r': [[0, 0, 0, 0], [0.28, 0.14, 0.32, 0.42], [0.9, 0.16, 0.3, 0.45], [1.3, 0.2, 0.28, 0.4], [1.42, 0.25, 0.26, 0.36], [1.65, 0.06, -0.12, -0.32], [2.0, 0.06, -0.14, -0.34], [2.12, 0.08, -0.1, -0.3], [2.5, 0, 0, 0]],
    'gun.p': [[0, 0, 0, 0], [0.28, 0.01, -0.02, 0.03], [1.3, 0.01, -0.02, 0.03], [1.42, 0.01, -0.006, 0.03], [1.7, -0.02, 0.01, 0.02], [2.1, -0.02, 0.01, 0.02], [2.5, 0, 0, 0]],
    lhMag: [[0, 0], [0.3, 1], [1.44, 1], [1.62, 0]],
    lhBolt: [[0, 0], [1.46, 0], [1.66, 1], [2.04, 1], [2.25, 0]],
    'lh.p': [[0, 0, 0, 0], [0.3, 0, 0, 0], [0.36, 0, 0.01, 0], [0.46, 0, -0.07, 0.01], [0.72, 0.03, -0.42, 0.2], [0.95, 0.03, -0.42, 0.2], [1.2, 0, -0.05, 0.0], [1.34, 0, 0.012, 0], [1.42, 0, 0, 0], [1.72, 0, 0, 0], [1.86, 0, 0, 0.055], [1.93, 0, 0, 0.055], [1.99, 0, 0.004, 0.0], [2.25, 0, 0, 0]],
    'lh.r': [[0, 0, 0, 0], [0.72, 0.5, 0, 0.3], [0.95, 0.5, 0, 0.3], [1.25, 0, 0, 0]],
    magAttach: [[0, 0], [0.35, 0], [0.37, 1], [1.43, 1], [1.46, 0]],
    'bolt.p': [[0, 0, 0, 0], [1.72, 0, 0, 0], [1.86, 0, 0, 0.055], [1.93, 0, 0, 0.055], [1.98, 0, 0, 0]],
  }, [[0.05, 'snd:cloth:0.6'], [0.37, 'snd:mag_out'], [1.34, 'snd:mag_in'], [1.85, 'snd:bolt_back'], [1.97, 'snd:bolt_fwd']]);
  G.reloadPistol = C(1.5, {
    'gun.r': [[0, 0, 0, 0], [0.2, 0.28, 0.2, 0.32], [1.02, 0.28, 0.2, 0.32], [1.12, 0.34, 0.16, 0.28], [1.32, 0.02, 0, 0.02], [1.5, 0, 0, 0]],
    'gun.p': [[0, 0, 0, 0], [0.2, -0.02, 0.035, 0.0], [1.1, -0.02, 0.035, 0], [1.35, 0, 0, 0]],
    lhMag: [[0, 0], [0.2, 1], [1.14, 1], [1.34, 0]],
    'lh.p': [[0, 0, 0, 0], [0.22, 0, -0.03, 0], [0.32, 0, -0.04, 0], [0.55, 0.06, -0.32, 0.1], [0.74, 0.06, -0.32, 0.1], [0.96, 0, -0.025, 0], [1.04, 0, 0.006, 0], [1.1, 0, 0, 0]],
    magAttach: [[0, 0], [0.18, 0], [0.2, 1], [1.08, 1], [1.11, 0]],
  }, [[0.16, 'snd:mag_out'], [1.03, 'snd:mag_in']]);
  G.reloadPistolEmpty = C(1.8, {
    'gun.r': [[0, 0, 0, 0], [0.2, 0.28, 0.2, 0.32], [1.02, 0.28, 0.2, 0.32], [1.12, 0.34, 0.16, 0.28], [1.3, 0.1, -0.2, -0.2], [1.5, 0.12, -0.2, -0.22], [1.8, 0, 0, 0]],
    'gun.p': [[0, 0, 0, 0], [0.2, -0.02, 0.035, 0.0], [1.1, -0.02, 0.035, 0], [1.4, 0, 0.01, 0], [1.8, 0, 0, 0]],
    lhMag: [[0, 0], [0.2, 1], [1.14, 1], [1.3, 0]],
    'lh.p': [[0, 0, 0, 0], [0.22, 0, -0.03, 0], [0.32, 0, -0.04, 0], [0.55, 0.06, -0.32, 0.1], [0.74, 0.06, -0.32, 0.1], [0.96, 0, -0.025, 0], [1.04, 0, 0.006, 0], [1.1, 0, 0, 0]],
    magAttach: [[0, 0], [0.18, 0], [0.2, 1], [1.08, 1], [1.11, 0]],
    slideLock: [[0, 1], [1.4, 1, 'e'], [1.43, 0]],
  }, [[0.16, 'snd:mag_out'], [1.03, 'snd:mag_in'], [1.42, 'snd:bolt_fwd']]);
  G.sgStart = C(0.4, {
    'gun.r': [[0, 0, 0, 0], [0.4, 0.12, -0.28, -0.5]],
    'gun.p': [[0, 0, 0, 0], [0.4, -0.03, 0.01, 0.02]],
    lhMag: [[0, 0], [0.35, 1]],
    'lh.p': [[0, 0, 0, 0], [0.35, 0, -0.08, 0.04]],
  }, [[0.05, 'snd:cloth:0.6']], { hold: true });
  G.sgShell = C(0.42, {
    'gun.r': [[0, 0.12, -0.28, -0.5], [0.25, 0.14, -0.27, -0.49], [0.3, 0.1, -0.29, -0.51], [0.42, 0.12, -0.28, -0.5]],
    'gun.p': [[0, -0.03, 0.01, 0.02], [0.42, -0.03, 0.01, 0.02]],
    lhMag: [[0, 1], [0.42, 1]],
    'lh.p': [[0, 0, -0.08, 0.04], [0.12, 0, -0.1, 0.06], [0.24, 0, -0.004, 0], [0.3, 0, 0, 0], [0.42, 0, -0.08, 0.04]],
    shellVis: [[0, 1], [0.29, 1], [0.3, 0], [0.38, 0], [0.4, 1]],
  }, [[0.27, 'snd:shell_in']], { hold: true });
  G.sgEnd = C(0.45, {
    'gun.r': [[0, 0.12, -0.28, -0.5], [0.45, 0, 0, 0]],
    'gun.p': [[0, -0.03, 0.01, 0.02], [0.45, 0, 0, 0]],
    lhMag: [[0, 1], [0.3, 0]],
    'lh.p': [[0, 0, -0.08, 0.04], [0.3, 0, 0, 0]],
  });
  G.pump = C(0.55, {
    'pump.p': [[0, 0, 0, 0], [0.1, 0, 0, 0], [0.2, 0, 0, 0.085], [0.36, 0, 0, 0], [0.55, 0, 0, 0]],
    'lh.p': [[0, 0, 0, 0], [0.1, 0, 0, 0], [0.2, 0, 0, 0.085], [0.36, 0, 0, 0], [0.55, 0, 0, 0]],
    'gun.r': [[0, 0, 0, 0], [0.18, 0.07, 0.05, 0.1], [0.4, 0, 0, 0]],
    'gun.p': [[0, 0, 0, 0], [0.2, 0, -0.006, 0.012], [0.4, 0, 0, 0]],
  }, [[0.12, 'snd:pump'], [0.22, 'eject']]);
  G.bolt = C(0.85, {
    rhBolt: [[0, 0], [0.15, 1], [0.62, 1], [0.8, 0]],
    'bolt.r': [[0, 0, 0, 0], [0.2, 0, 0, 0], [0.28, 0, 0, 1.1], [0.52, 0, 0, 1.1], [0.6, 0, 0, 0]],
    'bolt.p': [[0, 0, 0, 0], [0.3, 0, 0, 0], [0.4, 0, 0, 0.07], [0.46, 0, 0, 0.07], [0.55, 0, 0, 0]],
    'rh.p': [[0, 0, 0, 0], [0.2, 0, 0, 0], [0.28, 0, 0.018, 0], [0.3, 0, 0.018, 0], [0.4, 0, 0.018, 0.07], [0.46, 0, 0.018, 0.07], [0.55, 0, 0.018, 0], [0.6, 0, 0, 0]],
    'gun.r': [[0, 0, 0, 0], [0.2, 0.05, 0.06, 0.22], [0.6, 0.06, 0.06, 0.24], [0.85, 0, 0, 0]],
    'gun.p': [[0, 0, 0, 0], [0.2, -0.01, 0.01, 0.02], [0.6, -0.01, 0.01, 0.02], [0.85, 0, 0, 0]],
  }, [[0.27, 'snd:bolt_back'], [0.42, 'eject'], [0.53, 'snd:bolt_fwd']]);
  G.revolver = C(2.6, {
    'gun.r': [[0, 0, 0, 0], [0.25, 0.5, 0.25, 0.65], [2.1, 0.5, 0.25, 0.65], [2.35, 0.02, 0, 0.02], [2.6, 0, 0, 0]],
    'gun.p': [[0, 0, 0, 0], [0.25, -0.05, 0.04, 0.02], [2.1, -0.05, 0.04, 0.02], [2.4, 0, 0, 0]],
    'cyl.p': [[0, 0, 0, 0], [0.32, 0, 0, 0], [0.42, -0.034, 0, 0], [1.9, -0.034, 0, 0], [2.0, 0, 0, 0]],
    'cyl.r': [[0, 0, 0, 0], [0.45, 0, 0, 0], [0.95, 0, 0, TAU * 2], [1.9, 0, 0, TAU * 2]],
    lhMag: [[0, 0], [0.3, 1], [2.05, 1], [2.3, 0]],
    'lh.p': [[0, 0, 0, 0], [0.3, 0, 0, 0], [0.9, 0, -0.08, 0.06], [1.2, 0, -0.26, 0.15], [1.45, 0, -0.02, -0.02], [1.6, 0, 0, 0], [1.9, 0.012, 0, 0], [2.05, 0, 0, 0]],
  }, [[0.4, 'snd:mag_out'], [0.95, 'snd:shell'], [1.5, 'snd:shell_in'], [1.98, 'snd:mag_in']]);
  G.inspect = C(3.4, {
    'gun.r': [[0, 0, 0, 0], [0.55, 0.12, 0.85, 0.35], [1.5, 0.17, 0.95, 0.3], [2.0, -0.28, -0.45, -0.62], [2.8, -0.24, -0.5, -0.6], [3.4, 0, 0, 0]],
    'gun.p': [[0, 0, 0, 0], [0.55, -0.06, 0.03, 0.07], [1.5, -0.06, 0.035, 0.07], [2.0, 0.02, 0.05, 0.05], [2.8, 0.02, 0.05, 0.05], [3.4, 0, 0, 0]],
  }, [[0.1, 'snd:cloth:0.6'], [1.85, 'snd:cloth:0.6']]);
  G.inspectPistol = C(2.9, {
    'gun.r': [[0, 0, 0, 0], [0.4, 0.15, 0.95, 0.4], [1.2, 0.2, 1.05, 0.35], [1.6, -0.3, -0.6, -0.9], [2.3, -0.28, -0.65, -0.9], [2.9, 0, 0, 0]],
    'gun.p': [[0, 0, 0, 0], [0.4, -0.08, 0.05, 0.02], [1.2, -0.08, 0.05, 0.02], [1.5, -0.02, 0.09, 0.0], [1.6, 0, 0.06, 0.02], [2.3, 0, 0.06, 0.02], [2.9, 0, 0, 0]],
    'lh.p': [[0, 0, 0, 0], [0.3, -0.02, -0.12, 0.1], [2.5, -0.02, -0.12, 0.1], [2.8, 0, 0, 0]],
  }, [[0.1, 'snd:cloth:0.6'], [1.45, 'snd:whoosh:0.6'], [1.6, 'snd:catch:0.5']]);

  // ================================================================== knife clips
  // channels: hand.p/hand.r (right hand), knife.p/knife.r (knife inside the hand), curl, spread, trail,
  // bfB/bfH (butterfly blade / bite handle), fold (folding knives)
  const K = {};
  K.slash = C(0.42, {
    'hand.p': [[0, 0, 0, 0], [0.07, 0.07, 0.035, 0.03], [0.19, -0.24, -0.03, -0.12], [0.42, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.07, 0.25, 0.45, 0.35], [0.19, -0.15, -1.0, -0.7], [0.42, 0, 0, 0]],
    trail: [[0, 0], [0.08, 0], [0.11, 1], [0.24, 1], [0.32, 0]],
  }, [[0.06, 'snd:swish']]);
  K.slash2 = C(0.42, {
    'hand.p': [[0, 0, 0, 0], [0.07, -0.12, 0.06, 0.02], [0.19, 0.12, -0.06, -0.1], [0.42, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.07, 0.4, -0.8, -0.5], [0.19, -0.3, 0.7, 0.6], [0.42, 0, 0, 0]],
    trail: [[0, 0], [0.08, 0], [0.11, 1], [0.24, 1], [0.32, 0]],
  }, [[0.06, 'snd:swish']]);
  K.stab = C(1.0, {
    'hand.p': [[0, 0, 0, 0], [0.24, 0.05, 0.07, 0.13], [0.38, -0.07, 0.0, -0.28], [0.52, -0.06, 0.0, -0.24], [1.0, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.24, 0.55, 0.25, 0.15], [0.38, -0.4, -0.1, 0.0], [0.6, -0.35, -0.08, 0], [1.0, 0, 0, 0]],
    trail: [[0, 0], [0.3, 0], [0.34, 1], [0.44, 1], [0.55, 0]],
  }, [[0.28, 'snd:swish_heavy']]);

  // generic fixed blade
  K.fixed_draw = C(0.85, {
    'hand.p': [[0, 0.04, -0.22, 0.1], [0.2, 0.0, -0.01, 0.0], [0.5, 0, 0.012, 0], [0.85, 0, 0, 0]],
    'hand.r': [[0, -0.7, 0.4, 0.6], [0.22, 0.25, 0.1, 0.1], [0.48, 0.1, 0, 0], [0.85, 0, 0, 0]],
    'knife.p': [[0, 0, 0, 0], [0.2, 0, 0, 0], [0.32, 0, 0.09, -0.02], [0.46, 0, 0, 0]],
    'knife.r': [[0, 0, 0, 0], [0.2, 0, 0, 0], [0.46, -TAU, 0, 0]],
    curl: [[0, 1], [0.2, 1], [0.24, 0.3], [0.44, 0.3], [0.5, 1]],
    trail: [[0, 0], [0.22, 1], [0.46, 1], [0.55, 0]],
  }, [[0.05, 'snd:knife_draw'], [0.22, 'snd:whoosh'], [0.47, 'snd:catch']]);
  K.fixed_insp = C(2.9, {
    'hand.p': [[0, 0, 0, 0], [0.45, -0.05, 0.06, 0.03], [1.3, -0.05, 0.065, 0.03], [1.75, -0.04, 0.06, 0.03], [2.4, -0.04, 0.06, 0.03], [2.9, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.45, 1.3, 0.0, 1.0], [1.3, 1.4, 0.05, 1.05], [1.75, -0.6, -1.0, -1.0], [2.4, -0.7, -1.05, -1.05], [2.9, 0, 0, 0]],
    'knife.r': [[0, 0, 0, 0], [1.35, 0, 0, 0], [1.75, 0, TAU, 0], [2.9, 0, TAU, 0]],
    trail: [[0, 0], [1.38, 0], [1.45, 0.7], [1.7, 0.7], [1.8, 0]],
  }, [[0.1, 'snd:cloth:0.5'], [1.4, 'snd:whoosh']]);
  K.fixed_insp2 = C(2.6, {
    'hand.p': [[0, 0, 0, 0], [0.35, -0.04, 0.05, 0.03], [2.1, -0.05, 0.06, 0.03], [2.6, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.35, 0.3, 0.3, 0.3], [0.5, 0.3, 0.3, 0.3], [0.85, -1.05, -1.1, 1.4], [1.35, -1.1, -1.1, 1.4], [1.7, 0.3, 0.3, 0.3], [2.1, 0.2, 0.2, 0.2], [2.6, 0, 0, 0]],
    'knife.r': [[0, 0, 0, 0], [0.5, 0, 0, 0], [0.75, -PI, 0, 0], [1.35, -PI, 0, 0], [1.6, -TAU, 0, 0]],
    curl: [[0, 1], [0.5, 1], [0.56, 0.4], [0.72, 0.4], [0.78, 1], [1.35, 1], [1.4, 0.4], [1.56, 0.4], [1.62, 1]],
    trail: [[0, 0], [0.5, 0], [0.55, 0.8], [0.75, 0.8], [0.8, 0], [1.35, 0], [1.4, 0.8], [1.6, 0.8], [1.65, 0]],
  }, [[0.52, 'snd:whoosh'], [0.76, 'snd:catch'], [1.38, 'snd:whoosh'], [1.62, 'snd:catch']]);

  // folding (flip / talon): fold = blade rotation, -PI = closed
  K.fold_draw = C(0.9, {
    'hand.p': [[0, 0.04, -0.22, 0.1], [0.24, 0, -0.01, 0], [0.5, 0, 0.01, 0], [0.9, 0, 0, 0]],
    'hand.r': [[0, -0.6, 0.4, 0.5], [0.26, 0.2, 0.15, 0.1], [0.38, 0.35, -0.2, -0.1], [0.52, -0.05, 0.05, 0], [0.9, 0, 0, 0]],
    fold: [[0, -PI], [0.3, -PI], [0.42, 0.12], [0.48, 0]],
    trail: [[0, 0], [0.3, 0], [0.34, 1], [0.48, 1], [0.55, 0]],
  }, [[0.05, 'snd:cloth:0.6'], [0.33, 'snd:whoosh'], [0.43, 'snd:bf_click'], [0.46, 'snd:knife_draw:0.6']]);
  K.fold_insp = C(2.7, {
    'hand.p': [[0, 0, 0, 0], [0.35, -0.05, 0.06, 0.04], [2.2, -0.05, 0.06, 0.04], [2.7, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.35, 0.4, 0.8, 0.25], [0.9, 0.45, 0.9, 0.2], [1.2, 0.1, -0.3, -0.2], [1.6, 0.4, 0.7, 0.2], [2.2, 0.35, 0.8, 0.2], [2.7, 0, 0, 0]],
    fold: [[0, 0], [0.95, 0], [1.1, -PI], [1.3, -PI], [1.42, 0.1], [1.48, 0]],
    'knife.r': [[0, 0, 0, 0], [1.6, 0, 0, 0], [2.0, 0, TAU, 0]],
    trail: [[0, 0], [1.3, 0], [1.34, 0.8], [1.5, 0.8], [1.6, 0], [1.62, 0.6], [2.0, 0.6], [2.1, 0]],
  }, [[0.1, 'snd:cloth:0.5'], [1.05, 'snd:bf_click'], [1.4, 'snd:bf_clack'], [1.65, 'snd:whoosh']]);

  // butterfly: bfB = blade rotation about pin (−PI = folded in safe handle), bfH = bite handle
  const BF_OPEN_FWD = (t0, s = 1) => ({
    bfB: [[t0, -PI], [t0 + 0.2 * s, 0.12], [t0 + 0.26 * s, 0]],
    bfH: [[t0, -PI], [t0 + 0.2 * s, -PI], [t0 + 0.38 * s, 0.1], [t0 + 0.44 * s, 0]],
  });
  K.bf_draw = C(1.1, {
    'hand.p': [[0, 0.05, -0.26, 0.1], [0.22, 0.0, -0.02, 0.02], [0.45, 0.0, 0.012, 0.0], [0.72, 0, 0.0, 0], [1.1, 0, 0, 0]],
    'hand.r': [[0, -0.6, 0.4, 0.5], [0.22, 0.2, 0.2, 0.2], [0.36, 0.08, -0.55, 0.12], [0.56, 0.12, 0.5, -0.12], [0.76, 0, -0.18, 0], [1.1, 0, 0, 0]],
    bfB: [[0, -PI], [0.24, -PI], [0.42, 0.14], [0.5, 0]],
    bfH: [[0, -PI], [0.44, -PI], [0.62, 0.12], [0.7, 0]],
    curl: [[0, 1], [0.28, 0.72], [0.62, 0.8], [0.78, 1]],
    trail: [[0, 0], [0.26, 1], [0.7, 1], [0.84, 0]],
  }, [[0.04, 'snd:cloth:0.6'], [0.27, 'snd:whoosh'], [0.44, 'snd:bf_click'], [0.6, 'snd:whoosh'], [0.69, 'snd:bf_clack']]);
  K.bf_draw2 = C(1.25, {
    'hand.p': [[0, 0.05, -0.26, 0.1], [0.2, 0.0, -0.02, 0.02], [0.5, -0.02, 0.02, 0.0], [0.85, 0, 0.0, 0], [1.25, 0, 0, 0]],
    'hand.r': [[0, -0.6, 0.4, 0.5], [0.2, 0.2, 0.2, 0.2], [0.5, 0.2, 0.6, 0.2], [0.85, 0.05, -0.2, 0], [1.25, 0, 0, 0]],
    'knife.r': [[0, 0, 0, 0], [0.22, 0, 0, 0], [0.82, 0, -TAU, 0]],
    bfB: [[0, -PI], [0.26, -PI], [0.5, 0.15], [0.58, 0]],
    bfH: [[0, -PI], [0.52, -PI], [0.72, 0.1], [0.8, 0]],
    curl: [[0, 1], [0.24, 0.55], [0.8, 0.6], [0.9, 1]],
    trail: [[0, 0], [0.24, 1], [0.84, 1], [0.95, 0]],
  }, [[0.04, 'snd:cloth:0.6'], [0.26, 'snd:whoosh'], [0.5, 'snd:bf_click'], [0.6, 'snd:whoosh'], [0.79, 'snd:bf_clack']]);
  // close + reopen helpers (relative from open state)
  const bfCloseOpen = (t0, s = 1) => ({
    bfH: [[t0, 0], [t0 + 0.14 * s, -PI], [t0 + 0.34 * s, -PI], [t0 + 0.5 * s, 0]],
    bfB: [[t0, 0], [t0 + 0.12 * s, 0], [t0 + 0.24 * s, -PI], [t0 + 0.3 * s, -PI], [t0 + 0.42 * s, 0]],
  });
  function mergeTracks(...objs) {
    const out = {};
    for (const o of objs) for (const k in o) out[k] = (out[k] || []).concat(o[k]);
    for (const k in out) {
      out[k].sort((a, b) => a[0] - b[0]);
      // drop duplicate times (keep last)
      out[k] = out[k].filter((v, i, arr) => i === arr.length - 1 || Math.abs(arr[i + 1][0] - v[0]) > 1e-4);
    }
    return out;
  }
  K.bf_insp_flip = C(2.6, Object.assign({
    'hand.p': [[0, 0, 0, 0], [0.4, -0.05, 0.05, 0.03], [2.1, -0.05, 0.05, 0.03], [2.6, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.4, 0.4, 0.6, 0.2], [0.6, 0.3, 0.2, 0.1], [0.9, 0.45, 0.75, 0.2], [1.3, 0.4, 0.6, 0.2], [1.6, 0.2, 1.4, 0.2], [2.1, 0.35, 1.0, 0.2], [2.6, 0, 0, 0]],
    'knife.r': [[0, 0, 0, 0], [1.25, 0, 0, 0], [1.75, 0, TAU, 0]],
    curl: [[0, 1], [0.5, 0.85], [1.1, 0.85], [1.25, 0.6], [1.8, 0.6], [1.95, 1]],
    trail: [[0, 0], [0.5, 0.8], [1.0, 0.8], [1.25, 0.8], [1.8, 0.8], [1.95, 0]],
  }, mergeTracks(bfCloseOpen(0.5))), [[0.1, 'snd:cloth:0.5'], [0.56, 'snd:whoosh'], [0.62, 'snd:bf_click'], [0.78, 'snd:whoosh'], [0.92, 'snd:bf_clack'], [1.3, 'snd:whoosh'], [1.55, 'snd:whoosh']]);
  K.bf_insp_spin = C(2.4, {
    'hand.p': [[0, 0, 0, 0], [0.35, -0.04, 0.05, 0.0], [1.9, -0.04, 0.05, 0.0], [2.4, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.35, 0.25, 0.4, 0.15], [1.0, 0.15, 0.3, 0.1], [1.6, 0.3, 0.5, 0.2], [1.9, 0.25, 0.4, 0.15], [2.4, 0, 0, 0]],
    'knife.r': [[0, 0, 0, 0], [0.45, 0, 0, 0], [0.9, -TAU, 0, 0], [1.35, -TAU * 2, 0, 0], [1.6, -TAU * 2, 0, 0]],
    bfH: [[0, 0], [0.5, 0], [0.7, -0.9], [0.9, 0.3], [1.1, -1.0], [1.3, 0.2], [1.45, 0]],
    bfB: [[0, 0], [0.6, 0], [0.8, -0.25], [1.0, 0.1], [1.2, -0.2], [1.4, 0]],
    curl: [[0, 1], [0.45, 1], [0.5, 0.35], [1.35, 0.35], [1.45, 1]],
    spread: [[0, 0], [0.45, 0], [0.55, 0.8], [1.35, 0.8], [1.45, 0]],
    trail: [[0, 0], [0.45, 0], [0.5, 1], [1.4, 1], [1.5, 0]],
  }, [[0.1, 'snd:cloth:0.5'], [0.5, 'snd:whoosh'], [0.75, 'snd:bf_click'], [0.95, 'snd:whoosh'], [1.15, 'snd:bf_click'], [1.42, 'snd:bf_clack']]);
  K.bf_insp_double = C(2.7, Object.assign({
    'hand.p': [[0, 0, 0, 0], [0.35, -0.05, 0.04, 0.02], [2.2, -0.05, 0.04, 0.02], [2.7, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.35, 0.3, 0.5, 0.25], [0.55, 0.15, -0.3, 0.1], [0.8, 0.4, 0.7, 0.3], [1.05, 0.15, -0.3, 0.1], [1.3, 0.4, 0.7, 0.3], [1.6, 0.3, 0.9, 0.2], [2.2, 0.3, 0.6, 0.25], [2.7, 0, 0, 0]],
    curl: [[0, 1], [0.4, 0.7], [1.5, 0.7], [1.6, 1]],
    trail: [[0, 0], [0.4, 1], [1.45, 1], [1.6, 0]],
  }, mergeTracks(bfCloseOpen(0.42, 0.85), bfCloseOpen(0.92, 0.85))),
  [[0.42, 'snd:whoosh'], [0.6, 'snd:bf_click'], [0.78, 'snd:bf_clack'], [0.92, 'snd:whoosh'], [1.1, 'snd:bf_click'], [1.28, 'snd:bf_clack']]);
  K.bf_insp_twirl = C(2.5, {
    'hand.p': [[0, 0, 0, 0], [0.4, -0.06, 0.06, 0.03], [2.0, -0.06, 0.06, 0.03], [2.5, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.4, 0.55, 1.1, 0.25], [0.8, 0.5, 1.15, 0.3], [1.5, 0.3, -0.4, -0.2], [2.0, 0.3, -0.45, -0.2], [2.5, 0, 0, 0]],
    'knife.r': [[0, 0, 0, 0], [0.8, 0, 0, 0], [1.4, 0, TAU * 2, 0]],
    bfH: [[0, 0], [0.85, 0], [1.0, -0.5], [1.2, 0.3], [1.35, 0]],
    curl: [[0, 1], [0.8, 1], [0.85, 0.5], [1.38, 0.5], [1.45, 1]],
    trail: [[0, 0], [0.8, 0], [0.85, 1], [1.4, 1], [1.5, 0]],
  }, [[0.1, 'snd:cloth:0.5'], [0.86, 'snd:whoosh'], [1.1, 'snd:whoosh'], [1.36, 'snd:bf_clack']]);
  // rare: aerial toss
  K.bf_insp_aerial = C(3.8, Object.assign({
    'hand.p': [[0, 0, 0, 0], [0.35, -0.05, 0.0, 0.02], [0.55, -0.05, -0.04, 0.02], [0.65, -0.05, 0.03, 0.02], [1.35, -0.05, 0.02, 0.02], [1.45, -0.05, -0.02, 0.02], [1.6, -0.05, 0.02, 0.02], [3.2, -0.05, 0.03, 0.02], [3.8, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.35, 0.2, 0.3, 0.1], [1.4, 0.2, 0.3, 0.1], [2.0, 0.3, 0.6, 0.2], [2.6, 0.5, 1.2, 0.3], [3.2, 0.4, 1.0, 0.25], [3.8, 0, 0, 0]],
    'knife.p': [[0, 0, 0, 0], [0.6, 0, 0, 0], [0.95, 0, 0.26, -0.04], [1.38, 0, 0, 0]],
    'knife.r': [[0, 0, 0, 0], [0.6, 0, 0, 0], [1.38, -TAU * 3, 0, 0]],
    curl: [[0, 1], [0.55, 1], [0.62, 0.15], [1.3, 0.15], [1.38, 1]],
    spread: [[0, 0], [0.6, 0], [0.7, 1], [1.3, 1], [1.38, 0]],
    trail: [[0, 0], [0.6, 1], [1.4, 1], [2.4, 1], [2.55, 0]],
  }, mergeTracks(
    { bfH: [[0, 0], [0.7, 0], [0.85, -1.4], [1.05, 0.6], [1.25, -0.4], [1.38, 0]] },
    bfCloseOpen(1.7, 0.9),
    { bfB: [[2.15, 0]] },
  )), [[0.58, 'snd:whoosh'], [0.8, 'snd:whoosh'], [1.05, 'snd:whoosh'], [1.38, 'snd:catch'], [1.4, 'snd:bf_clack'], [1.72, 'snd:whoosh'], [1.85, 'snd:bf_click'], [2.05, 'snd:bf_clack'], [2.6, 'snd:knife_draw:0.5']]);

  // karambit (knife origin = finger ring; spinning = knife.r x)
  K.kar_draw = C(1.0, {
    'hand.p': [[0, 0.04, -0.24, 0.1], [0.24, 0, -0.01, 0], [0.5, 0, 0.012, 0], [1.0, 0, 0, 0]],
    'hand.r': [[0, -0.6, 0.4, 0.5], [0.26, 0.15, 0.1, 0.1], [0.6, 0.1, 0.0, 0.0], [1.0, 0, 0, 0]],
    'knife.r': [[0, 0, 0, 0], [0.18, 0, 0, 0], [0.7, -TAU, 0, 0]],
    curl: [[0, 1], [0.2, 1], [0.26, 0.5], [0.66, 0.5], [0.74, 1]],
    trail: [[0, 0], [0.22, 1], [0.7, 1], [0.8, 0]],
  }, [[0.04, 'snd:cloth:0.6'], [0.22, 'snd:ring_spin'], [0.72, 'snd:catch'], [0.74, 'snd:knife_draw:0.5']]);
  K.kar_insp_spin = C(2.5, {
    'hand.p': [[0, 0, 0, 0], [0.35, -0.04, 0.06, 0.02], [2.0, -0.04, 0.06, 0.02], [2.5, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.35, 0.3, 0.5, 0.2], [2.0, 0.35, 0.55, 0.2], [2.5, 0, 0, 0]],
    'knife.r': [[0, 0, 0, 0], [0.45, 0, 0, 0], [0.9, -TAU, 0, 0], [1.3, -TAU * 2, 0, 0], [1.4, -TAU * 2, 0, 0], [1.85, -TAU, 0, 0]],
    curl: [[0, 1], [0.45, 1], [0.5, 0.45], [1.85, 0.45], [1.92, 1]],
    trail: [[0, 0], [0.45, 0], [0.5, 1], [1.3, 1], [1.4, 0], [1.45, 1], [1.85, 1], [1.95, 0]],
  }, [[0.1, 'snd:cloth:0.5'], [0.48, 'snd:ring_spin'], [0.92, 'snd:ring_spin'], [1.42, 'snd:ring_spin'], [1.87, 'snd:catch']]);
  K.kar_insp_reverse = C(2.8, {
    'hand.p': [[0, 0, 0, 0], [0.35, -0.04, 0.04, 0.02], [0.9, -0.05, 0.06, 0.03], [1.75, -0.05, 0.065, 0.03], [2.2, -0.04, 0.05, 0.02], [2.8, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.35, 0.2, 0.3, 0.2], [0.6, 0.2, 0.3, 0.2], [0.95, -1.05, -0.7, 1.4], [1.7, -1.0, -0.75, 1.35], [2.0, 0.2, 0.3, 0.2], [2.8, 0, 0, 0]],
    'knife.r': [[0, 0, 0, 0], [0.45, 0, 0, 0], [0.75, -PI, 0, 0], [1.75, -PI, 0, 0], [2.1, -TAU, 0, 0]],
    curl: [[0, 1], [0.45, 1], [0.5, 0.5], [0.72, 0.5], [0.78, 1], [1.75, 1], [1.8, 0.5], [2.05, 0.5], [2.12, 1]],
    trail: [[0, 0], [0.45, 0], [0.5, 1], [0.75, 1], [0.82, 0], [1.75, 0], [1.8, 1], [2.1, 1], [2.2, 0]],
  }, [[0.47, 'snd:ring_spin'], [0.76, 'snd:catch'], [1.78, 'snd:ring_spin'], [2.1, 'snd:catch']]);
  K.kar_insp_show = C(2.9, {
    'hand.p': [[0, 0, 0, 0], [0.45, -0.05, 0.06, 0.03], [1.25, -0.05, 0.065, 0.03], [1.7, -0.04, 0.06, 0.03], [2.4, -0.04, 0.06, 0.03], [2.9, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.45, 1.3, 0.0, 1.0], [1.25, 1.4, 0.05, 1.05], [1.7, -0.6, -1.0, -1.0], [2.4, -0.7, -1.05, -1.05], [2.9, 0, 0, 0]],
    'knife.r': [[0, 0, 0, 0], [0.45, 0.12, 0, 0], [1.25, 0.08, 0, 0], [1.7, -0.12, 0, 0], [2.4, -0.08, 0, 0], [2.9, 0, 0, 0]],
  }, [[0.1, 'snd:cloth:0.5'], [1.45, 'snd:cloth:0.5']]);
  K.kar_insp_flip = C(2.2, {
    'hand.p': [[0, 0, 0, 0], [0.35, -0.04, 0.0, 0.02], [0.5, -0.04, -0.03, 0.02], [0.6, -0.04, 0.03, 0.02], [1.2, -0.04, 0.02, 0.02], [1.32, -0.04, -0.015, 0.02], [1.5, -0.04, 0.02, 0.02], [2.2, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.35, 0.2, 0.35, 0.1], [1.5, 0.25, 0.4, 0.1], [2.2, 0, 0, 0]],
    'knife.p': [[0, 0, 0, 0], [0.55, 0, 0, 0], [0.88, 0, 0.2, -0.03], [1.25, 0, 0, 0]],
    'knife.r': [[0, 0, 0, 0], [0.55, 0, 0, 0], [1.25, -TAU * 2, 0, 0]],
    curl: [[0, 1], [0.52, 1], [0.58, 0.2], [1.2, 0.2], [1.26, 1]],
    spread: [[0, 0], [0.55, 0], [0.65, 1], [1.2, 1], [1.26, 0]],
    trail: [[0, 0], [0.55, 1], [1.25, 1], [1.35, 0]],
  }, [[0.55, 'snd:whoosh'], [0.8, 'snd:ring_spin'], [1.26, 'snd:catch']]);
  // rare: tornado
  K.kar_insp_tornado = C(4.0, {
    'hand.p': [[0, 0, 0, 0], [0.3, -0.05, 0.05, 0.02], [1.6, -0.05, 0.05, 0.02], [1.75, -0.05, 0.0, 0.02], [1.85, -0.05, 0.05, 0.02], [2.6, -0.05, 0.04, 0.02], [2.7, -0.05, 0.0, 0.02], [2.85, -0.05, 0.05, 0.02], [3.4, -0.07, 0.07, 0.04], [4.0, 0, 0, 0]],
    'hand.r': [[0, 0, 0, 0], [0.3, 0.25, 0.4, 0.15], [1.0, 0.1, -0.3, 0.0], [1.6, 0.3, 0.6, 0.2], [2.7, 0.25, 0.4, 0.15], [3.1, 0.55, 1.25, 0.35], [3.5, 0.5, 1.2, 0.3], [4.0, 0, 0, 0]],
    'knife.r': [[0, 0, 0, 0], [0.35, 0, 0, 0], [0.75, -TAU, 0, 0], [1.1, -TAU * 2, 0, 0], [1.25, -TAU * 2 - 0.4, 0, 0], [1.6, -TAU * 3, 0, 0], [1.8, -TAU * 3, 0, 0], [2.65, -TAU * 6, 0, 0], [2.7, -TAU * 6, 0, 0]],
    'knife.p': [[0, 0, 0, 0], [1.8, 0, 0, 0], [2.2, 0, 0.3, -0.05], [2.65, 0, 0, 0]],
    curl: [[0, 1], [0.35, 1], [0.4, 0.4], [1.6, 0.4], [1.75, 0.15], [2.6, 0.15], [2.68, 1]],
    spread: [[0, 0], [1.75, 0], [1.85, 1], [2.6, 1], [2.68, 0]],
    trail: [[0, 0], [0.35, 0], [0.4, 1], [2.7, 1], [2.8, 0]],
  }, [[0.38, 'snd:ring_spin'], [0.78, 'snd:ring_spin'], [1.2, 'snd:ring_spin'], [1.62, 'snd:catch'], [1.82, 'snd:whoosh'], [2.1, 'snd:ring_spin'], [2.4, 'snd:whoosh'], [2.68, 'snd:catch'], [3.0, 'snd:knife_draw:0.5']]);

  // per-knife animation sets & hold poses
  const KSETS = {
    tactical: { draw: ['fixed_draw'], insp: ['fixed_insp', 'fixed_insp2'], rare: null },
    combat: { draw: ['fixed_draw'], insp: ['fixed_insp', 'fixed_insp2'], rare: null },
    fang: { draw: ['fixed_draw'], insp: ['fixed_insp2', 'fixed_insp'], rare: null },
    shadow: { draw: ['fixed_draw'], insp: ['fixed_insp', 'fixed_insp2'], rare: null },
    flip: { draw: ['fold_draw'], insp: ['fold_insp', 'fixed_insp'], rare: null },
    talon: { draw: ['fold_draw'], insp: ['fold_insp', 'fixed_insp2'], rare: null },
    butterfly: { draw: ['bf_draw', 'bf_draw2'], insp: ['bf_insp_flip', 'bf_insp_spin', 'bf_insp_double', 'bf_insp_twirl'], rare: 'bf_insp_aerial' },
    karambit: { draw: ['kar_draw'], insp: ['kar_insp_spin', 'kar_insp_reverse', 'kar_insp_show', 'kar_insp_flip'], rare: 'kar_insp_tornado' },
  };
  for (const k in G) G[k].name = k;
  for (const k in K) K[k].name = k;
  const KHOLD = {
    default: { p: [0, 0.0, 0], r: [0, 0, 0] },
    karambit: { p: [0, -0.045, 0.0], r: [0, 0, PI] },
  };

  // ================================================================== trail
  class Trail {
    constructor(n = 16) {
      this.n = n;
      this.pos = new Float32Array(n * 2 * 3);
      this.alpha = new Float32Array(n * 2);
      this.int = new Float32Array(n);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
      const idx = [];
      for (let i = 0; i < n - 1; i++) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, b, c, b, d, c);
      }
      g.setIndex(idx);
      this.geo = g;
      this.mat = new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(1.6, 1.8, 2.2) } },
        vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 color; varying float vA; void main(){ gl_FragColor = vec4(color * vA, vA); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      this.mesh = new THREE.Mesh(g, this.mat);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 10;
      this.has = false;
    }
    push(tip, base, intensity) {
      const p = this.pos, n = this.n;
      if (!this.has) {
        for (let i = 0; i < n; i++) { p.set([tip.x, tip.y, tip.z], i * 6); p.set([base.x, base.y, base.z], i * 6 + 3); }
        this.has = true;
      }
      p.copyWithin(6, 0, (n - 1) * 6);
      this.int.copyWithin(1, 0, n - 1);
      p[0] = tip.x; p[1] = tip.y; p[2] = tip.z; p[3] = base.x; p[4] = base.y; p[5] = base.z;
      this.int[0] = intensity;
      for (let i = 0; i < n; i++) {
        const f = (1 - i / (n - 1));
        this.alpha[i * 2] = this.int[i] * f * 0.55;
        this.alpha[i * 2 + 1] = 0;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.alpha.needsUpdate = true;
      this.mesh.visible = this.int.some((v) => v > 0.01);
    }
    reset() { this.has = false; this.int.fill(0); this.mesh.visible = false; }
  }

  // ================================================================== viewmodel
  const V3 = THREE.Vector3;
  const tmpV = new V3(), tmpV2 = new V3(), tmpV3 = new V3();
  const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpE = new THREE.Euler();
  const ch3 = [0, 0, 0], ch1 = [0];
  const Z3 = [0, 0, 0];

  class ViewModel {
    constructor() {
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(64, 1, 0.01, 10);
      this.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x3a3028, 0.8);
      this.sun = new THREE.DirectionalLight(0xffffff, 1.4);
      this.sun.position.set(0.4, 1, 0.3);
      this.fill = new THREE.DirectionalLight(0xc8d4ff, 0.75);
      this.fill.position.set(-0.35, 0.6, 0.65);
      this.flashLight = new THREE.PointLight(0xffb060, 0, 1.4, 2);
      this.scene.add(this.hemi, this.sun, this.sun.target, this.fill, this.flashLight);
      this.root = new THREE.Group();
      this.scene.add(this.root);
      this.gunPivot = new THREE.Group();
      this.gunHolder = new THREE.Group();
      this.gunPivot.add(this.gunHolder);
      this.knifePivot = new THREE.Group();
      this.root.add(this.gunPivot, this.knifePivot);
      this.rHand = GS.Models.hand(false);
      this.lHand = GS.Models.hand(true);
      this.rArm = GS.Models.arm();
      this.lArm = GS.Models.arm();
      this.scene.add(this.rArm.group, this.lArm.group);
      this.knifeHolder = new THREE.Group();
      this.shell = new THREE.Mesh(GS.Models.cy(0.0095, 0.0095, 0.06, 10, 'y'), new THREE.MeshStandardMaterial({ color: 0xc0262e, roughness: 0.5 }));
      this.shell.position.set(0.0, 0.0, -0.02);
      this.lHand.group.add(this.shell);
      this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: GS.Tex.flash(), color: new THREE.Color(4, 3, 2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      this.flash.visible = false;
      this.flash.renderOrder = 20;
      this.trail = new Trail(16);
      this.scene.add(this.trail.mesh);
      this.anim = new GS.Anim.Player();
      this.anim.onEvent = (e) => this._event(e);
      this.models = {};
      this.item = null;
      this.pending = null;
      this.holster = 0;
      // procedural state
      this.t = 0;
      this.bob = 0; this.bobAmt = 0;
      this.sway = { x: 0, y: 0, vx: 0, vy: 0 };
      this.kick = { z: 0, vz: 0, x: 0, vx: 0, y: 0, vy: 0 };
      this.land = { y: 0, v: 0 };
      this.sprintW = 0; this.adsW = 0; this.crouchW = 0;
      this.cycleT = 1; this.flashT = 0;
      this.locked = false;
      this.hidden = false;
      this.onEvent = null;
      this.lastTip = new V3(); this.tipSpeed = 0;
      // knife rest pose (pivot position in camera space, hand rotation)
      this.kRest = { p: [0.13, -0.16, -0.33], r: [-0.6, -0.9, 0.3], s: 1.3 };
    }

    setLighting(o) {
      this.hemi.color.set(o.sky); this.hemi.groundColor.set(o.ground); this.hemi.intensity = o.hemi;
      this.sun.color.set(o.sun); this.sun.intensity = o.sunI;
      this.sunDirWorld = new V3().copy(o.sunDir).normalize();
      this.scene.environment = o.env || null;
    }
    resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }

    _model(item) {
      const key = item.kind + ':' + item.id + ':' + item.design;
      if (this.models[key]) return this.models[key];
      let m;
      if (item.kind === 'gun') {
        m = GS.Models.gun(item.id, item.design);
        const def = GS.WEAPONS[item.id];
        const s = m.sockets;
        m.center = new V3(0, 0.02, def.pistol ? -0.05 : -0.18);
        const hipP = def.pistol ? [0.12, -0.14, -0.34] : def.scope ? [0.135, -0.16, -0.29] : [0.14, -0.165, -0.31];
        m.hip = new V3().fromArray(hipP);
        const sight = s.sight ? s.sight.position : new V3(0, 0.07, 0);
        const eye = def.scope ? 0.16 : def.pistol ? 0.3 : 0.2;
        m.ads = new V3(-sight.x, -sight.y, -eye - sight.z);
        // hand poses
        m.gripPose = { p: new V3(0, -0.047, 0.024), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(def.pistol ? -0.22 : -0.28, 0, 0)) };
        const sp = (o, e) => ({ p: o ? o.position.clone() : new V3(), q: new THREE.Quaternion().setFromEuler(e) });
        const vg = m.info && m.info.vgrip;
        m.guardPose = def.pistol && !vg
          ? sp(s.guard, new THREE.Euler(-0.3, 0.25, 0.15))
          : vg ? sp(s.guard, new THREE.Euler(0, 0, 0)) : sp(s.guard, new THREE.Euler(PI / 2, 0, -0.35));
        m.magPose = sp(s.magHand, new THREE.Euler(0.15, 0, 0));
        m.boltPose = sp(s.boltHand, new THREE.Euler(0, 0, 0.6));
        m.rBoltPose = sp(s.boltHand, new THREE.Euler(-0.3, 0, -0.4));
        if (m.parts.mag) m.magRest = m.parts.mag.position.clone();
        for (const k in m.parts) m.parts[k].userData.rest = m.parts[k].position.clone();
      } else {
        m = GS.Models.knife(item.id, item.design);
        for (const k in m.parts) m.parts[k].userData.rest = m.parts[k].position.clone();
      }
      this.models[key] = m;
      return m;
    }

    clearCache() {
      for (const k in this.models) {
        const m = this.models[k];
        if (m.root.parent) m.root.parent.remove(m.root);
      }
      this.models = {};
    }

    // equip an item: { kind: 'gun'|'knife', id, design }
    equip(item, instant) {
      if (!instant && this.item && !this.hidden) {
        this.pending = item;
        return;
      }
      this._set(item);
    }
    _set(item) {
      this.pending = null;
      this.holster = 0;
      if (this.model) this.model.root.parent && this.model.root.parent.remove(this.model.root);
      this.item = item;
      this.model = this._model(item);
      this.def = item.kind === 'gun' ? GS.WEAPONS[item.id] : GS.KNIVES[item.id];
      this.trail.reset();
      this.locked = false;
      if (item.kind === 'gun') {
        this.gunHolder.add(this.model.root);
        this.gunHolder.position.copy(this.model.center).multiplyScalar(-1);
        this.model.root.add(this.rHand.group);
        this.model.root.add(this.lHand.group);
        this.lHand.group.visible = true;
        this.lArm.group.visible = true;
        this.knifePivot.visible = false;
        this.gunPivot.visible = true;
        if (this.model.sockets.muzzle) this.model.sockets.muzzle.add(this.flash);
        this.anim.play(this.def.pistol ? G.drawPistol : G.draw, { blend: 0, speed: (this.def.pistol ? 0.42 : 0.5) / Math.max(0.25, this.def.equip) });
      } else {
        this.knifePivot.add(this.rHand.group);
        this.rHand.group.add(this.knifeHolder);
        this.knifeHolder.add(this.model.root);
        this.model.root.scale.setScalar(this.kRest.s);
        const hold = KHOLD[item.id] || KHOLD.default;
        this.knifeHold = hold;
        this.lHand.group.visible = false;
        this.lArm.group.visible = false;
        this.knifePivot.visible = true;
        this.gunPivot.visible = false;
        this.knifeSet = KSETS[item.id] || KSETS.tactical;
        this.anim.play(K[U.pick(this.knifeSet.draw)], { blend: 0 });
      }
      this.shell.visible = false;
    }

    // ---------------------------------------------------------------- actions
    fire(opts = {}) {
      const def = this.def;
      if (!def || this.item.kind !== 'gun') return;
      const info = this.model.info || {};
      const k = def.kick;
      const ads = this.adsW;
      this.kick.vz += (info.recoilZ || 0.035) * 22 * (1 - ads * 0.5);
      this.kick.vx += k * 0.5 * (1 - ads * 0.6) + 0.15;
      this.kick.vy += (Math.random() - 0.5) * k * 0.4;
      this.cycleT = 0;
      this.flashT = 0.05;
      this.flash.visible = true;
      const sc = def.cls === 'Shotgun' ? 0.3 : def.scope ? 0.28 : def.pistol ? 0.16 : 0.22;
      this.flash.scale.setScalar(sc * U.rand(0.8, 1.2));
      this.flash.material.rotation = Math.random() * TAU;
      this.flashLight.intensity = 3;
      if (opts.empty && def.pistol && !def.revolver) this.locked = true;
      if (this.anim.name.startsWith('inspect')) this.anim.stop(0.06);
      if (def.pump) setTimeout(() => { if (this.def === def) this.anim.play(G.pump, { blend: 0.05, speed: 0.55 / (60 / def.rpm * 0.8) }); }, 90);
      if (def.bolt) setTimeout(() => { if (this.def === def) this.anim.play(G.bolt, { blend: 0.06, speed: 0.85 / (60 / def.rpm * 0.85) }); }, 120);
    }
    reload(empty, duration) {
      if (!this.item || this.item.kind !== 'gun') return;
      const def = this.def;
      let clip;
      if (def.revolver) clip = G.revolver;
      else if (def.pistol) clip = empty ? G.reloadPistolEmpty : G.reloadPistol;
      else clip = empty ? G.reloadEmpty : G.reload;
      this.anim.play(clip, { blend: 0.1, speed: clip.dur / duration });
    }
    shellStart() { this.anim.play(G.sgStart, { blend: 0.08 }); }
    shellInsert(dur) { this.anim.play(G.sgShell, { blend: 0.02, speed: G.sgShell.dur / dur }); }
    shellEnd() { this.anim.play(G.sgEnd, { blend: 0.05 }); }
    cancelReload() {
      const n = this.anim.name;
      if (this.anim.playing && n !== 'draw') this.anim.stop(0.1);
    }
    slash(alt) { this.anim.play(alt ? K.slash2 : K.slash, { blend: 0.04 }); }
    stab() { this.anim.play(K.stab, { blend: 0.05 }); }
    inspect() {
      if (!this.item) return;
      if (this.item.kind === 'gun') {
        this.anim.play(this.def.pistol ? G.inspectPistol : G.inspect, { blend: 0.15 });
        return 'gun';
      }
      const set = this.knifeSet;
      let name;
      const rare = set.rare && Math.random() < 0.08;
      if (rare) name = set.rare;
      else {
        do { name = U.pick(set.insp); } while (set.insp.length > 1 && name === this._lastInsp);
      }
      this._lastInsp = name;
      this.anim.play(K[name], { blend: 0.15 });
      return rare ? 'rare' : 'knife';
    }
    get inspecting() {
      const c = this.anim.cur;
      return !!c && this.anim.playing && (c === G.inspect || c === G.inspectPistol || (this.knifeSet && (this.knifeSet.insp.includes(c.name) || c.name === this.knifeSet.rare)));
    }
    stopInspect() { if (this.inspecting) this.anim.stop(0.12); }

    _event(e) {
      if (e.startsWith('snd:')) {
        const [, name, vol] = e.split(':');
        GS.Audio.play(name, { bus: 'weapons', vol: vol ? parseFloat(vol) : 0.8 });
      } else if (e === 'eject') {
        if (this.onEvent) this.onEvent('eject');
      }
    }

    // ---------------------------------------------------------------- per frame
    // st: { dt, speed01, sprint, ads, grounded, crouch, lookDX, lookDY, time }
    update(dt, st) {
      this.t += dt;
      const a = this.anim;
      // holster: quick drop before swapping
      if (this.pending) {
        this.holster = Math.min(1, this.holster + dt / 0.09);
        if (this.holster >= 1) this._set(this.pending);
      }
      a.update(dt);
      if (!this.item) return;

      // springs
      const kk = this.kick;
      kk.vz += (-kk.z * 260 - kk.vz * 22) * dt; kk.z += kk.vz * dt;
      kk.vx += (-kk.x * 220 - kk.vx * 18) * dt; kk.x += kk.vx * dt;
      kk.vy += (-kk.y * 220 - kk.vy * 18) * dt; kk.y += kk.vy * dt;
      const sw = this.sway;
      const adsF = 1 - this.adsW * 0.8;
      const tx = U.clamp(-st.lookDY * 0.0016, -0.09, 0.09) * adsF, ty = U.clamp(-st.lookDX * 0.0016, -0.09, 0.09) * adsF;
      sw.vx += ((tx - sw.x) * 140 - sw.vx * 15) * dt; sw.x += sw.vx * dt;
      sw.vy += ((ty - sw.y) * 140 - sw.vy * 15) * dt; sw.y += sw.vy * dt;
      this.land.v += (-this.land.y * 180 - this.land.v * 14) * dt; this.land.y += this.land.v * dt;
      if (st.landImpact) this.land.v -= Math.min(1.2, st.landImpact) * 0.9;

      this.sprintW = U.damp(this.sprintW, st.sprint ? 1 : 0, 9, dt);
      this.adsW = U.damp(this.adsW, st.ads ? 1 : 0, st.ads ? 16 : 13, dt);
      this.crouchW = U.damp(this.crouchW, st.crouch ? 1 : 0, 10, dt);
      const moving = st.grounded ? st.speed01 : 0;
      this.bobAmt = U.damp(this.bobAmt, moving, 8, dt);
      this.bob += dt * (st.bobRate || 0) * TAU;

      // root: bob, sway, breathing, landing
      const bA = this.bobAmt * (1 - this.adsW * 0.85) * (1 + this.sprintW * 0.6);
      const r = this.root;
      r.position.set(
        Math.sin(this.bob) * 0.012 * bA,
        -Math.abs(Math.cos(this.bob)) * 0.01 * bA + Math.sin(this.t * 1.7) * 0.0015 * (1 - this.adsW) + this.land.y * 0.03 - this.crouchW * 0.01 - this.holster * 0.25,
        0
      );
      r.rotation.set(
        sw.x + Math.sin(this.t * 1.3) * 0.004 * (1 - this.adsW) + this.holster * 0.5,
        sw.y,
        Math.sin(this.bob) * 0.018 * bA + sw.y * 0.4
      );

      if (this.item.kind === 'gun') this._updateGun(dt);
      else this._updateKnife(dt);

      // muzzle flash
      if (this.flashT > 0) {
        this.flashT -= dt;
        if (this.flashT <= 0) { this.flash.visible = false; }
      }
      this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 60);
      if (this.flash.visible) this.flash.getWorldPosition(this.flashLight.position);

      // arms
      this.scene.updateMatrixWorld(true);
      this._arm(this.rArm, this.rHand, tmpV.set(0.3, -0.62, 0.22));
      if (this.lHand.group.visible) this._arm(this.lArm, this.lHand, tmpV.set(-0.16, -0.62, 0.05));

      // sun in camera space
      if (this.sunDirWorld && st.camQuat) {
        tmpQ.copy(st.camQuat).invert();
        this.sun.position.copy(this.sunDirWorld).applyQuaternion(tmpQ);
      }
      this.camera.fov = U.lerp(64, 54, this.adsW);
      this.camera.updateProjectionMatrix();
    }

    _arm(arm, hand, anchorRoot) {
      const w = hand.wrist.getWorldPosition(tmpV2);
      const anchor = this.root.localToWorld(anchorRoot);
      arm.group.position.copy(w);
      arm.group.lookAt(anchor);
      arm.fore.scale.z = Math.max(0.05, w.distanceTo(anchor));
    }

    _updateGun(dt) {
      const m = this.model, a = this.anim, def = this.def;
      // weapon pivot
      const sprintBlock = this.adsW > 0.5 ? 0 : this.sprintW;
      const base = tmpV.copy(m.hip).lerp(m.ads, this.adsW);
      a.sample('gun.p', 3, Z3, ch3);
      const gp = this.gunPivot;
      gp.position.set(
        base.x + m.center.x + ch3[0] - sprintBlock * 0.03,
        base.y + m.center.y + ch3[1] - sprintBlock * 0.035,
        base.z + m.center.z + ch3[2] + this.kick.z * 0.9
      );
      a.sample('gun.r', 3, Z3, ch3);
      gp.rotation.set(
        ch3[0] + this.kick.x * 0.06 - sprintBlock * 0.32,
        ch3[1] + this.kick.y * 0.03 + sprintBlock * 0.62 + 0.035 * (1 - this.adsW),
        ch3[2] + sprintBlock * 0.35
      );
      // right hand (grip <-> bolt)
      a.sample('rhBolt', 1, Z3, ch1);
      const rb = ch1[0];
      const rh = this.rHand.group;
      rh.position.copy(m.gripPose.p).lerp(m.rBoltPose.p, rb);
      rh.quaternion.copy(m.gripPose.q).slerp(m.rBoltPose.q, rb);
      a.sample('rh.p', 3, Z3, ch3);
      rh.position.x += ch3[0]; rh.position.y += ch3[1]; rh.position.z += ch3[2];
      this.rHand.setCurl(U.lerp(1, 0.55, rb));
      // left hand: blend guard / mag / bolt sockets
      a.sample('lhMag', 1, Z3, ch1); const wm = ch1[0];
      a.sample('lhBolt', 1, Z3, ch1); const wb = ch1[0];
      const lh = this.lHand.group;
      lh.position.copy(m.guardPose.p).lerp(m.magPose.p, wm);
      tmpQ.copy(m.guardPose.q).slerp(m.magPose.q, wm);
      if (wb > 0) { lh.position.lerp(m.boltPose.p, wb); tmpQ.slerp(m.boltPose.q, wb); }
      a.sample('lh.p', 3, Z3, ch3);
      const lhOff = tmpV3.set(ch3[0], ch3[1], ch3[2]);
      lh.position.add(lhOff);
      a.sample('lh.r', 3, Z3, ch3);
      tmpQ2.setFromEuler(tmpE.set(ch3[0], ch3[1], ch3[2]));
      lh.quaternion.copy(tmpQ).multiply(tmpQ2);
      lh.scale.set(-1, 1, 1);
      this.lHand.setCurl(U.lerp(0.85, 1, wm));
      // magazine follows the hand while attached
      if (m.parts.mag) {
        a.sample('magAttach', 1, Z3, ch1);
        const att = ch1[0];
        const mp = m.parts.mag.position.copy(m.magRest);
        if (att > 0) {
          const handFromSock = tmpV2.copy(lh.position).sub(m.magPose.p);
          mp.addScaledVector(handFromSock, att);
          m.parts.mag.rotation.set(ch3[0] * att, ch3[1] * att, ch3[2] * att);
        } else m.parts.mag.rotation.set(0, 0, 0);
      }
      // shotgun shell in hand
      a.sample('shellVis', 1, Z3, ch1);
      this.shell.visible = ch1[0] > 0.5;
      // bolt / slide / pump / cylinder
      this.cycleT += dt;
      const cyc = this.cycleT < 0.09 ? Math.sin((this.cycleT / 0.09) * PI) : 0;
      if (m.parts.bolt) {
        a.sample('bolt.p', 3, Z3, ch3);
        const rest = m.parts.bolt.userData.rest;
        const auto = def.bolt ? 0 : cyc * 0.03;
        m.parts.bolt.position.set(rest.x + ch3[0], rest.y + ch3[1], rest.z + ch3[2] + auto);
        a.sample('bolt.r', 3, Z3, ch3);
        m.parts.bolt.rotation.set(ch3[0], ch3[1], ch3[2]);
      }
      if (m.parts.slide) {
        a.sample('slideLock', 1, [this.locked ? 1 : 0], ch1);
        const rest = m.parts.slide.userData.rest;
        m.parts.slide.position.z = rest.z + Math.max(cyc * 0.032, ch1[0] * 0.032);
      }
      if (m.parts.pump) {
        a.sample('pump.p', 3, Z3, ch3);
        m.parts.pump.position.z = m.parts.pump.userData.rest.z + ch3[2];
      }
      if (m.parts.cyl) {
        a.sample('cyl.p', 3, Z3, ch3);
        const rest = m.parts.cyl.userData.rest;
        m.parts.cyl.position.set(rest.x + ch3[0], rest.y + ch3[1], rest.z + ch3[2]);
        a.sample('cyl.r', 3, Z3, ch3);
        m.parts.cyl.rotation.z = ch3[2] + (this.cycleT < 0.12 ? (this.cycleT / 0.12) * (TAU / 6) : 0);
      }
    }

    _updateKnife(dt) {
      const a = this.anim;
      const kp = this.knifePivot;
      const spr = this.sprintW;
      const KR = this.kRest;
      kp.position.set(KR.p[0] - spr * 0.02, KR.p[1] - spr * 0.04, KR.p[2] + spr * 0.02);
      kp.rotation.set(-spr * 0.25, spr * 0.35, spr * 0.2);
      const h = this.rHand.group;
      a.sample('hand.p', 3, Z3, ch3);
      h.position.set(ch3[0], ch3[1], ch3[2]);
      a.sample('hand.r', 3, Z3, ch3);
      h.rotation.set(KR.r[0] + ch3[0], KR.r[1] + ch3[1], KR.r[2] + ch3[2]);
      h.scale.set(1, 1, 1);
      a.sample('curl', 1, [1], ch1); const curl = ch1[0];
      a.sample('spread', 1, Z3, ch1);
      this.rHand.setCurl(curl, ch1[0]);
      const hold = this.knifeHold;
      a.sample('knife.p', 3, Z3, ch3);
      this.knifeHolder.position.set(hold.p[0] + ch3[0], hold.p[1] + ch3[1], hold.p[2] + ch3[2]);
      a.sample('knife.r', 3, Z3, ch3);
      this.knifeHolder.rotation.set(hold.r[0] + ch3[0], hold.r[1] + ch3[1], hold.r[2] + ch3[2]);
      const p = this.model.parts;
      if (p.bfBlade) {
        a.sample('bfB', 1, Z3, ch1); p.bfBlade.rotation.x = ch1[0];
        a.sample('bfH', 1, Z3, ch1); p.bfHandle.rotation.x = ch1[0];
      }
      if (p.blade) { a.sample('fold', 1, Z3, ch1); p.blade.rotation.x = ch1[0]; }
      // motion trail from blade tip
      a.sample('trail', 1, Z3, ch1);
      const tipS = this.model.sockets.tip;
      if (tipS) {
        this.scene.updateMatrixWorld(true);
        const tip = tipS.getWorldPosition(tmpV);
        const base = this.knifeHolder.getWorldPosition(tmpV2).lerp(tip, 0.45);
        const sp = tip.distanceTo(this.lastTip) / Math.max(dt, 1e-3);
        this.lastTip.copy(tip);
        this.tipSpeed = U.damp(this.tipSpeed, sp, 20, dt);
        this.trail.push(tip, base, ch1[0] * U.smoothstep(0.6, 2.5, this.tipSpeed));
      }
    }

    // vm-space point -> world position via the main camera
    toWorld(obj, mainCam, out) {
      obj.getWorldPosition(out);
      // vm camera is identity at origin: vm world == camera space
      out.applyMatrix4(mainCam.matrixWorld);
      return out;
    }
    muzzleWorld(mainCam, out) {
      if (this.item && this.item.kind === 'gun' && this.model.sockets.muzzle) return this.toWorld(this.model.sockets.muzzle, mainCam, out);
      return out.set(0, 0, -0.5).applyMatrix4(mainCam.matrixWorld);
    }
    ejectWorld(mainCam, out) {
      if (this.item && this.item.kind === 'gun' && this.model.sockets.eject) return this.toWorld(this.model.sockets.eject, mainCam, out);
      return out.set(0.1, -0.1, -0.3).applyMatrix4(mainCam.matrixWorld);
    }
  }

  GS.ViewModel = ViewModel;
  GS.VMClips = { G, K, KSETS };
})();
