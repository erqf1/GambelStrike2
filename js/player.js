'use strict';
// GambelStrike 2 — the local player: movement, look, weapons, recoil
(function () {
  const U = GS.U;
  const C = GS.Combat;
  const V3 = THREE.Vector3;
  const _f = new V3(), _r = new V3(), _w = new V3(), _o = new V3(), _d = new V3(), _m = new V3(), _e = new V3();

  class Player extends C.Combatant {
    constructor(name) {
      super(name, '#00ffd0', true);
      this.eyeY = 1.64;
      this.recoil = { p: 0, y: 0 };
      this.punch = { p: 0, v: 0 };
      this.adsW = 0; this.ads = false;
      this.sprinting = false;
      this.readyAt = 0;
      this.lastSlot = 'secondary';
      this.stepDist = 0;
      this.bobRate = 0;
      this.landImpact = 0;
      this.altSlash = false;
      this.lastFireT = -9;
      this.sprintOutT = 0;
      this.autoReloadT = 0;
    }
    item(slot) {
      const ws = this.weapons[slot];
      return { kind: slot === 'knife' ? 'knife' : 'gun', id: ws.id, design: ws.design };
    }
    spawn(p, yaw) {
      this.pos.copy(p);
      this.vel.set(0, 0, 0);
      this.yaw = yaw; this.pitch = 0;
      this.alive = true;
      this.hp = this.maxHp;
      this.invuln = 1.6;
      this.crouch = 0;
      this.body.h = 1.8;
      this.recoil.p = this.recoil.y = 0;
      for (const k in this.weapons) C.refill(this.weapons[k]);
      this.slot = 'main';
      this.lastSlot = 'secondary';
      const g = GS.game;
      this.readyAt = g.time + this.weapons.main.def.equip;
      g.vm.equip(this.item('main'), true);
      g.vm.hidden = false;
      this.eyeY = this.pos.y + 1.64;
      this.streak = 0;
    }
    switchTo(slot) {
      if (slot === this.slot || !this.weapons[slot]) return;
      const g = GS.game;
      const ws = this.ws;
      C.cancelReload(ws);
      ws.burstLeft = 0;
      this.lastSlot = this.slot;
      this.slot = slot;
      const nws = this.ws;
      this.readyAt = g.time + 0.09 + (nws.knife ? 0.42 : nws.def.equip);
      g.vm.equip(this.item(slot));
      if (nws.knife) GS.Audio.play('cloth', { bus: 'weapons', vol: 0.5 });
    }

    update(dt, now) {
      const I = GS.Input;
      const g = GS.game;
      const s = GS.Save.d.settings;
      if (!this.alive) return;
      const frozen = g.state !== 'live';
      // ---------------- look
      const ws = this.ws;
      const zoom = this.adsW > 0.5 && !ws.knife ? ws.def.adsZoom : 1;
      const sens = 0.0021 * s.controls.sens * (this.adsW > 0.5 ? s.controls.adsSens * zoom : 1);
      this.yaw -= I.mdx * sens;
      this.pitch -= I.mdy * sens * (s.controls.invertY ? -1 : 1);
      this.pitch = U.clamp(this.pitch, -1.55, 1.55);
      this.lookDX = I.mdx; this.lookDY = I.mdy;

      // ---------------- movement
      const fwd = (I.down('forward') ? 1 : 0) - (I.down('back') ? 1 : 0);
      const str = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
      _f.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      _r.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      _w.set(0, 0, 0).addScaledVector(_f, fwd).addScaledVector(_r, str);
      if (_w.lengthSq() > 0) _w.normalize();
      if (frozen) _w.set(0, 0, 0);
      const wantCrouch = I.down('crouch') && !frozen;
      if (wantCrouch) this.crouch = Math.min(1, this.crouch + dt * 7);
      else if (this.crouch > 0) {
        const nh = 1.8 - Math.max(0, this.crouch - dt * 7) * 0.55;
        if (g.world.fits(this.pos.x, this.pos.y, this.pos.z, this.body.r - 0.02, nh)) this.crouch = Math.max(0, this.crouch - dt * 7);
      }
      this.body.h = this.height;
      this.sprinting = I.down('sprint') && fwd > 0 && !this.ads && this.crouch < 0.3 && !frozen && now > this.lastFireT + 0.15;
      if (this.sprinting) this.sprintOutT = now + 0.12;
      let speed = this.speedFor(ws);
      if (this.sprinting) speed *= 1.35;
      if (this.crouch > 0.5) speed *= 0.5;
      if (this.adsW > 0.5 && !ws.knife) speed *= 0.62;
      const grounded = this.body.grounded;
      const rate = grounded ? 13 : 2.2;
      const k = 1 - Math.exp(-rate * dt);
      this.vel.x += (_w.x * speed - this.vel.x) * k;
      this.vel.z += (_w.z * speed - this.vel.z) * k;
      if (I.pressed('jump') && (grounded || this.body.coyote > 0) && !frozen) {
        this.vel.y = C.JUMP_V;
        this.body.grounded = false; this.body.coyote = 0; this.body.jumped = true;
        GS.Audio.play('jump', { bus: 'effects', vol: 0.5 });
      }
      this.vel.y -= C.GRAVITY * dt;
      const wasGround = this.body.grounded;
      g.world.move(this.body, dt);
      if (this.body.landed < -5.5 && !wasGround) {
        this.landImpact = Math.min(1.5, -this.body.landed / 10);
        GS.Audio.play('land', { bus: 'effects', vol: U.clamp(-this.body.landed / 14, 0.3, 1) });
      }
      // footsteps
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (this.body.grounded && hs > 0.8) {
        this.stepDist += hs * dt;
        const stride = this.sprinting ? 2.7 : 2.15;
        if (this.stepDist > stride) {
          this.stepDist = 0;
          const surf = g.world.surfaceAt(this.pos.x, this.pos.y, this.pos.z);
          const snd = surf === 'metal' ? 'step_metal' : surf === 'sand' ? 'step_sand' : 'step';
          if (this.crouch < 0.5) GS.Audio.play(snd, { bus: 'effects', vol: this.sprinting ? 0.5 : 0.32 });
        }
      }
      this.bobRate = this.body.grounded ? hs / 4.4 : 0;
      if (this.pos.y < g.world.killY) { C.damage(this, null, 9999, { weapon: 'Gravity' }); return; }
      // eye smoothing (step ups)
      const targetEye = this.pos.y + this.height - 0.16;
      this.eyeY = targetEye > this.eyeY ? U.damp(this.eyeY, targetEye, 18, dt) : targetEye;
      if (Math.abs(this.eyeY - targetEye) > 0.6) this.eyeY = targetEye;

      // ---------------- weapons
      if (!frozen) this._weapons(dt, now);
      this.invuln = Math.max(0, this.invuln - dt);
      // recoil recovery
      const firing = now - this.lastFireT < 0.12;
      const rec = firing ? 1.5 : 9;
      this.recoil.p *= Math.exp(-rec * dt);
      this.recoil.y *= Math.exp(-rec * dt);
      this.punch.v += (-this.punch.p * 320 - this.punch.v * 24) * dt;
      this.punch.p += this.punch.v * dt;
      const wantAds = this.ads;
      this.adsW = U.damp(this.adsW, wantAds ? 1 : 0, wantAds ? 16 : 13, dt);
      ws.bloom = Math.max(0, ws.bloom - dt * 0.09);
    }

    aimDir(out) {
      const p = this.pitch + this.recoil.p, y = this.yaw + this.recoil.y;
      const cp = Math.cos(p);
      return out.set(-Math.sin(y) * cp, Math.sin(p), -Math.cos(y) * cp);
    }

    _weapons(dt, now) {
      const I = GS.Input;
      const g = GS.game;
      const vm = g.vm;
      // switching
      if (I.pressed('slot1')) this.switchTo('main');
      else if (I.pressed('slot2')) this.switchTo('secondary');
      else if (I.pressed('slot3')) this.switchTo('knife');
      else if (I.pressed('lastWeapon')) this.switchTo(this.lastSlot);
      else if (I.wheel) {
        const order = ['main', 'secondary', 'knife'];
        const i = order.indexOf(this.slot);
        this.switchTo(order[(i + (I.wheel > 0 ? 1 : 2)) % 3]);
      }
      const ws = this.ws;
      const def = ws.def;
      const ready = now >= this.readyAt;
      // reload progress
      if (!ws.knife && ws.reloading) {
        const ev = C.updateReload(ws, now);
        if (ev === 'shellStart' || ev === 'shell') vm.shellInsert(def.reload);
        else if (ev === 'shellLast') vm.shellEnd();
      }
      this.ads = !ws.knife && I.down('aim') && !ws.reloading && !this.sprinting && ready && !(def.bolt && now < ws.nextFire - 0.05);
      if (def.scope) g.hud.scope(this.adsW > 0.85 && this.ads);
      else g.hud.scope(false);
      if (!ready) return;
      // inspect
      if (I.pressed('inspect') && !ws.reloading && !vm.inspecting && now >= ws.nextFire) {
        const r = vm.inspect();
        if (r === 'rare') { g.hud.toast('RARE INSPECT', 'gold'); }
      }
      if (ws.knife) {
        if (I.pressed('shoot') && now >= ws.nextFire) {
          this.altSlash = !this.altSlash;
          vm.slash(this.altSlash);
          ws.nextFire = now + def.slashRate;
          this.invuln = 0;
          g.later(0.11, () => { if (this.alive && this.slot === 'knife') this._meleeResult(C.melee(this, 'slash')); });
        } else if (I.pressed('aim') && now >= ws.nextFire) {
          vm.stab();
          ws.nextFire = now + def.stabRate;
          this.invuln = 0;
          g.later(0.36, () => { if (this.alive && this.slot === 'knife') this._meleeResult(C.melee(this, 'stab')); });
        }
        return;
      }
      // reload
      if (I.pressed('reload') && !ws.reloading) this._reload(now);
      if (ws.ammo === 0 && !ws.reloading && ws.reserve > 0 && this.autoReloadT && now > this.autoReloadT) { this.autoReloadT = 0; this._reload(now); }
      // fire
      const trig = def.auto ? I.down('shoot') : I.pressed('shoot');
      if ((trig || ws.burstLeft > 0) && !this.sprinting && now > this.sprintOutT - 0.12) this._tryFire(now, I.pressed('shoot'));
    }
    _reload(now) {
      const ws = this.ws;
      if (C.startReload(ws, now)) {
        const vm = GS.game.vm;
        vm.stopInspect();
        if (ws.def.shellReload) vm.shellStart();
        else vm.reload(ws.reloadEmpty, ws.reloadDur);
      }
    }
    _tryFire(now, fresh) {
      const g = GS.game;
      const ws = this.ws;
      const def = ws.def;
      if (now < ws.nextFire) return;
      if (ws.reloading) {
        if (def.shellReload && ws.ammo > 0 && fresh) { C.cancelReload(ws); g.vm.shellEnd(); ws.nextFire = now + 0.25; }
        return;
      }
      if (ws.ammo <= 0) {
        if (fresh) { GS.Audio.play('dry', { bus: 'weapons', vol: 0.7 }); ws.nextFire = now + 0.2; }
        if (ws.reserve > 0) this._reload(now);
        ws.burstLeft = 0;
        return;
      }
      ws.ammo--;
      ws.nextFire = now + 60 / def.rpm;
      if (def.burst) {
        if (ws.burstLeft <= 0) ws.burstLeft = def.burst;
        ws.burstLeft--;
        if (ws.burstLeft === 0 || ws.ammo === 0) { ws.burstLeft = 0; ws.nextFire = now + def.burstDelay; }
      }
      this.lastFireT = now;
      this.invuln = 0;
      const vm = g.vm;
      vm.stopInspect();
      const origin = this.eye(_o);
      origin.y = this.eyeY;
      const dir = this.aimDir(_d);
      const ads = this.adsW > 0.7;
      const muzzle = vm.muzzleWorld(g.camera, _m);
      const res = C.fire(this, ws, origin, dir, { ads, muzzle });
      ws.bloom = Math.min(ws.bloom + def.bloom, 0.045);
      const km = (ads ? 0.72 : 1) * (this.crouch > 0.5 ? 0.85 : 1);
      this.recoil.p = Math.min(this.recoil.p + U.degToRad(def.kick) * km, U.degToRad(14));
      this.recoil.y += U.degToRad(def.kickH) * (Math.random() * 2 - 1) * km;
      this.punch.v += def.kick * 0.9;
      vm.fire({ empty: ws.ammo === 0 });
      GS.Audio.play('shot_' + def.snd, { bus: 'weapons', vol: 0.95, rev: 0.35, vary: 0.03 });
      if (!def.pump && !def.bolt && !def.revolver) this.eject();
      if (res.hit) g.hud.hitmarker(res.head, res.kill);
      if (ws.ammo === 0) this.autoReloadT = now + 0.35;
    }
    eject() {
      const g = GS.game;
      const p = g.vm.ejectWorld(g.camera, _e);
      _r.set(1, 0, 0).applyQuaternion(g.camera.quaternion);
      const v = _r.multiplyScalar(U.rand(1.6, 2.4));
      v.y += U.rand(1.2, 2.0);
      v.add(this.vel);
      g.effects.shell(p, v, true);
    }
    _meleeResult(r) {
      if (r && r.hit) GS.game.hud.hitmarker(false, r.kill);
    }
  }
  U.degToRad = (d) => (d * Math.PI) / 180;
  GS.Player = Player;
})();
