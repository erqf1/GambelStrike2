'use strict';
// GambelStrike 2 — keyboard / mouse input with rebindable actions and pointer lock
(function () {
  const keys = new Set();
  const pressed = new Set();
  const released = new Set();
  const I = (GS.Input = {
    mdx: 0, mdy: 0, wheel: 0,
    locked: false, active: false, noLock: false,
    onLockChange: null,
    capture: null, // keybind capture callback
    canvas: null,
    init(canvas) {
      this.canvas = canvas;
      const down = (code) => { if (!keys.has(code)) pressed.add(code); keys.add(code); };
      const up = (code) => { keys.delete(code); released.add(code); };
      window.addEventListener('keydown', (e) => {
        if (this.capture) { e.preventDefault(); this.capture(e.code); return; }
        if (e.repeat) return;
        down(e.code);
        if (this.active && (e.code === 'Tab' || e.code === 'Space' || e.ctrlKey || e.code.startsWith('Arrow') || e.code === 'AltLeft')) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => { up(e.code); if (this.active) e.preventDefault(); });
      window.addEventListener('blur', () => { keys.clear(); });
      window.addEventListener('mousedown', (e) => {
        if (this.capture) { e.preventDefault(); this.capture('Mouse' + e.button); return; }
        if (this.active && (this.locked || this.noLock)) { down('Mouse' + e.button); e.preventDefault(); }
      });
      window.addEventListener('mouseup', (e) => up('Mouse' + e.button));
      window.addEventListener('contextmenu', (e) => { if (this.active) e.preventDefault(); });
      window.addEventListener('wheel', (e) => { if (this.active) this.wheel += Math.sign(e.deltaY); }, { passive: true });
      window.addEventListener('mousemove', (e) => {
        if (!this.active) return;
        if (this.locked || (this.noLock && e.buttons !== undefined)) {
          // ignore absurd spikes some browsers emit on lock
          if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
          this.mdx += e.movementX; this.mdy += e.movementY;
        }
      });
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === this.canvas;
        if (!this.locked) keys.clear();
        if (this.onLockChange) this.onLockChange(this.locked);
      });
      document.addEventListener('pointerlockerror', () => { this.noLock = true; if (this.onLockChange) this.onLockChange(false, true); });
    },
    lock() {
      if (!this.canvas || this.locked) return;
      try {
        const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
        if (p && p.catch) p.catch(() => {
          try { const q = this.canvas.requestPointerLock(); if (q && q.catch) q.catch(() => { this.noLock = true; }); } catch (e) { this.noLock = true; }
        });
      } catch (e) { this.noLock = true; }
    },
    unlock() { if (document.pointerLockElement) document.exitPointerLock(); },
    code(action) { return GS.Save.d.settings.controls.binds[action]; },
    down(action) { return keys.has(this.code(action)); },
    pressed(action) { return pressed.has(this.code(action)); },
    released(action) { return released.has(this.code(action)); },
    rawDown(code) { return keys.has(code); },
    rawPressed(code) { return pressed.has(code); },
    endFrame() { pressed.clear(); released.clear(); this.mdx = 0; this.mdy = 0; this.wheel = 0; },
    clear() { keys.clear(); pressed.clear(); released.clear(); this.mdx = this.mdy = this.wheel = 0; },
    keyName(code) {
      if (!code) return '—';
      if (code.startsWith('Mouse')) return ['LMB', 'MMB', 'RMB', 'MB4', 'MB5'][+code.slice(5)] || code;
      if (code.startsWith('Key')) return code.slice(3);
      if (code.startsWith('Digit')) return code.slice(5);
      const map = { ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', Space: 'SPACE', Tab: 'TAB', CapsLock: 'CAPS', Backquote: '`', Enter: 'ENTER' };
      return map[code] || code.replace('Arrow', '').toUpperCase();
    },
  });
})();
