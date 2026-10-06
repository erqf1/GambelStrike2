'use strict';
// GambelStrike 2 — bot players: perception, navigation, aiming, combat
(function () {
  const U = GS.U;
  const C = GS.Combat;
  const V3 = THREE.Vector3;
  const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _e = new V3(), _w = new V3();

  const DIFF = {
    easy: { react: [0.5, 0.85], turn: 4.2, err: 0.09, errDecay: 1.3, burst: [3, 6], fovCos: 0.45, hear: 28, headP: 0.12, aimTol: 0.085, acc: 1.5, think: 0.25 },
    normal: { react: [0.3, 0.55], turn: 6.8, err: 0.06, errDecay: 2.0, burst: [4, 9], fovCos: 0.3, hear: 38, headP: 0.24, aimTol: 0.06, acc: 1.15, think: 0.18 },
    hard: { react: [0.17, 0.32], turn: 10, err: 0.035, errDecay: 3.2, burst: [6, 12], fovCos: 0.15, hear: 50, headP: 0.36, aimTol: 0.045, acc: 0.92, think: 0.12 },
  };
  const PREF_RANGE = { 'Assault Rifle': 22, SMG: 11, Shotgun: 5, 'Sniper Rifle': 38, 'Battle Rifle': 28, Pistol: 14, 'Heavy Pistol': 16, 'Machine Pistol': 10, 'Burst Pistol': 14 };

  const wcache = {};
  function weaponMesh(slot, id, design) {
    const key = slot + id + design;
    if (!wcache[key]) {
      if (slot === 'knife') {
        const k = GS.Models.knife(id, design);
        const flat = GS.Models.flatten(k.root);
        wcache[key] = { group: flat, muzzle: new V3(0, 0, -0.1) };
      } else {
        const full = GS.Models.gun(id, design);
        const muzzle = full.sockets.muzzle ? full.sockets.muzzle.position.clone() : new V3(0, 0.05, -0.6);
        wcache[key] = { group: GS.Models.flatten(full.root), muzzle };
      }
    }
    const c = wcache[key];
    const g = c.group.clone();
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { group: g, muzzle: c.muzzle };
  }

  class Bot extends C.Combatant {
    constructor(name, color, difficulty) {
      super(name, color, false);
      this.D = DIFF[difficulty] || DIFF.normal;
      this.ch = GS.Models.character(color);
      this.root = this.ch.root;
      this.root.visible = false;
      this.wm = {};
      this.target = null; this.targetVisible = false; this.lastSeen = new V3(); this.lastSeenT = -99;
      this.aimYaw = 0; this.aimPitch = 0; this.errY = 0; this.errP = 0;
      this.reactT = 0; this.thinkT = Math.random() * 0.2;
      this.path = null; this.pi = 0; this.goal = -1; this.repathT = 0;
      this.strafe = 1; this.strafeT = 0;
      this.burst = 0; this.pauseT = 0; this.semiT = 0;
      this.stuckT = 0; this.lastPos = new V3(); this.progressT = 0;
      this.investigate = null; this.investigateT = 0;
      this.walkPhase = 0; this.stepDist = 0;
      this.aimHead = false;
      this.crouchT = 0;
      this.readyAt = 0;
    }
    setLoadout(lo) {
      super.setLoadout(lo);
      for (const k in this.wm) this.wm[k].group.parent && this.wm[k].group.parent.remove(this.wm[k].group);
      this.wm = {
        main: weaponMesh('main', lo.main.id, lo.main.design),
        secondary: weaponMesh('secondary', lo.secondary.id, lo.secondary.design),
        knife: weaponMesh('knife', lo.knife.id, lo.knife.design),
      };
      for (const k in this.wm) {
        const g = this.wm[k].group;
        if (k === 'knife') g.rotation.set(-1.2, 0, 0);
        this.ch.gunMount.add(g);
        g.visible = false;
      }
    }
    showWeapon(slot) {
      for (const k in this.wm) this.wm[k].group.visible = k === slot;
    }
    switchTo(slot, now) {
      if (this.slot === slot) return;
      C.cancelReload(this.ws);
      this.slot = slot;
      this.showWeapon(slot);
      this.readyAt = now + (slot === 'knife' ? 0.35 : this.ws.def.equip);
      this.burst = 0;
    }
    spawn(p, yaw) {
      this.pos.copy(p);
      this.vel.set(0, 0, 0);
      this.yaw = this.aimYaw = yaw; this.pitch = this.aimPitch = 0;
      this.alive = true;
      this.hp = this.maxHp;
      this.invuln = 1.6;
      this.crouch = 0; this.body.h = 1.8;
      for (const k in this.weapons) C.refill(this.weapons[k]);
      this.slot = 'main';
      this.showWeapon('main');
      this.target = null; this.path = null; this.goal = -1; this.investigate = null;
      this.root.visible = true;
      this.root.position.copy(p);
      this.streak = 0;
      this.readyAt = GS.game.time + 0.5;
    }
    die() {
      this.alive = false;
      this.root.visible = false;
    }

    // ------------------------------------------------------------ events
    hearShot(src, pos) {
      if (!this.alive || src === this) return;
      const d = this.pos.distanceTo(pos);
      if (d > this.D.hear) return;
      if (!this.target || !this.targetVisible) {
        this.investigate = pos.clone();
        this.investigateT = GS.game.time + 6;
        this.path = null;
      }
    }
    onHurt(attacker) {
      if (!attacker || !attacker.alive) return;
      if (!this.target || !this.targetVisible || Math.random() < 0.6) {
        if (this.target !== attacker) { this.target = attacker; this.reactT = U.rand(this.D.react[0], this.D.react[1]) * 0.8; }
        this.lastSeen.copy(attacker.pos); this.lastSeenT = GS.game.time;
        this.errY = U.rand(-1, 1) * this.D.err * 1.6; this.errP = U.rand(-1, 1) * this.D.err;
      }
    }

    // ------------------------------------------------------------ update
    update(dt, now) {
      if (!this.alive) return;
      const g = GS.game;
      const live = g.state === 'live';
      this.invuln = Math.max(0, this.invuln - dt);
      this.thinkT -= dt;
      if (this.thinkT <= 0 && live) { this.thinkT = this.D.think * U.rand(0.8, 1.2); this._perceive(now); }
      const ws = this.ws;
      if (!ws.knife && ws.reloading) C.updateReload(ws, now);

      // ---- decide movement + aim
      let moveDir = _w.set(0, 0, 0);
      let speedF = 1;
      let lookAt = null;
      const t = this.target;
      if (live && t && t.alive && this.targetVisible) {
        const dist = this.pos.distanceTo(t.pos);
        const pref = ws.knife ? 1.2 : PREF_RANGE[ws.def.cls] || 18;
        _a.set(t.pos.x - this.pos.x, 0, t.pos.z - this.pos.z).normalize();
        _b.set(-_a.z, 0, _a.x).multiplyScalar(this.strafe);
        this.strafeT -= dt;
        if (this.strafeT <= 0 || this.body.hitWall) { this.strafe *= -1; this.strafeT = U.rand(0.4, 1.3); }
        let approach = dist > pref * 1.3 ? 1 : dist < pref * 0.6 ? -0.7 : 0;
        if (ws.knife) approach = 1.2;
        moveDir.copy(_b).multiplyScalar(ws.knife ? 0.4 : 0.85).addScaledVector(_a, approach);
        // don't strafe off ledges
        if (moveDir.lengthSq() > 0.01) {
          moveDir.normalize();
          const f = g.world.floorAt(this.pos.x + moveDir.x * 0.9, this.pos.z + moveDir.z * 0.9, this.pos.y + 0.5);
          if (f < this.pos.y - 1.2) { this.strafe *= -1; moveDir.set(0, 0, 0); }
        }
        speedF = ws.knife ? 1.3 : 0.85;
        lookAt = this.aimHead ? t.head(_c) : t.chest(_c);
        // crouch-peek sometimes
        this.crouchT -= dt;
        if (this.crouchT <= 0) { this.crouchT = U.rand(1, 3); this.wantCrouch = !ws.knife && Math.random() < 0.18; }
        // knife lunge / swap logic
        if (!ws.knife && dist < 2.2 && Math.random() < dt * 1.5) this.switchTo('knife', now);
        if (ws.knife && dist > 7 && now > this.readyAt) this.switchTo(this.weapons.main.ammo > 0 || this.weapons.main.reserve > 0 ? 'main' : 'secondary', now);
      } else {
        this.wantCrouch = false;
        if (ws.knife && now > this.readyAt) this.switchTo('main', now);
        // navigate: last seen / investigate / roam
        let dest = null;
        if (t && t.alive && now - this.lastSeenT < 4) dest = this.lastSeen;
        else if (this.investigate && now < this.investigateT) dest = this.investigate;
        else { this.investigate = null; if (t && (!t.alive || now - this.lastSeenT >= 4)) this.target = null; }
        const dir = this._navigate(dt, now, dest);
        if (dir) { moveDir.copy(dir); speedF = dest ? 1.15 : 1.0; }
        // reload while not fighting
        if (!ws.knife && !ws.reloading && ws.ammo < ws.def.mag * 0.5 && ws.reserve > 0) C.startReload(ws, now);
        if (moveDir.lengthSq() > 0.01) {
          _c.set(this.pos.x + moveDir.x * 10, this.pos.y + 1.5, this.pos.z + moveDir.z * 10);
          lookAt = _c;
        }
      }
      if (!live) moveDir.set(0, 0, 0);

      // ---- aim
      if (lookAt) {
        this.eye(_d);
        _e.subVectors(lookAt, _d);
        const wantYaw = Math.atan2(-_e.x, -_e.z);
        const wantPitch = Math.atan2(_e.y, Math.hypot(_e.x, _e.z));
        const engaged = t && this.targetVisible;
        const ey = engaged ? this.errY : 0, ep = engaged ? this.errP : 0;
        const dy = U.wrapAngle(wantYaw + ey - this.aimYaw), dp = wantPitch + ep - this.aimPitch;
        const turn = this.D.turn * (engaged ? 1 : 0.6) * dt;
        this.aimYaw += U.clamp(dy * Math.min(1, dt * 12), -turn, turn);
        this.aimPitch += U.clamp(dp * Math.min(1, dt * 12), -turn, turn);
        this.aimPitch = U.clamp(this.aimPitch, -1.2, 1.2);
        if (engaged) {
          const k = Math.exp(-this.D.errDecay * dt);
          this.errY *= k; this.errP *= k;
          // tracking error grows with target lateral speed
          const lat = Math.abs(t.vel.x * Math.cos(this.aimYaw) - t.vel.z * Math.sin(this.aimYaw));
          this.errY += U.rand(-1, 1) * lat * 0.0025 * this.D.acc;
        }
      }
      this.yaw = this.aimYaw; this.pitch = this.aimPitch;

      // ---- movement physics
      this.crouch = U.damp(this.crouch, this.wantCrouch ? 1 : 0, 8, dt);
      this.body.h = this.height;
      const speed = this.speedFor(ws) * speedF * (this.crouch > 0.5 ? 0.5 : 1);
      const k = 1 - Math.exp(-(this.body.grounded ? 11 : 2) * dt);
      this.vel.x += (moveDir.x * speed - this.vel.x) * k;
      this.vel.z += (moveDir.z * speed - this.vel.z) * k;
      this.vel.y -= C.GRAVITY * dt;
      if (this.body.grounded && this.body.hitWall && moveDir.lengthSq() > 0.1 && Math.random() < dt * 3) {
        this.vel.y = C.JUMP_V; this.body.grounded = false; this.body.jumped = true;
      }
      g.world.move(this.body, dt);
      if (this.pos.y < g.world.killY) { C.damage(this, null, 9999, { weapon: 'Gravity' }); return; }

      // ---- shooting
      if (live && t && t.alive && this.targetVisible) {
        this.reactT -= dt;
        if (this.reactT <= 0 && now >= this.readyAt) this._shoot(now, t);
      }
      ws.bloom = Math.max(0, (ws.bloom || 0) - dt * 0.09);

      // ---- footsteps (audible to the player)
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (this.body.grounded && hs > 1) {
        this.stepDist += hs * dt;
        if (this.stepDist > 2.3) {
          this.stepDist = 0;
          const pl = g.player;
          if (pl && pl.alive && pl.pos.distanceToSquared(this.pos) < 22 * 22) {
            const surf = g.world.surfaceAt(this.pos.x, this.pos.y, this.pos.z);
            GS.Audio.play(surf === 'metal' ? 'step_metal' : surf === 'sand' ? 'step_sand' : 'step', { pos: this.pos, vol: 0.5, ref: 3, maxDist: 22 });
          }
        }
      }
      this._animate(dt, hs);
    }

    _perceive(now) {
      const g = GS.game;
      const eye = this.eye(_a);
      this.forward(_b);
      let best = null, bestScore = Infinity;
      for (const c of g.combatants) {
        if (c === this || !c.alive) continue;
        _c.subVectors(c.pos, this.pos);
        const d = _c.length();
        if (d > 85) continue;
        _c.y += 1.2; _c.normalize();
        const facing = _c.dot(_b);
        const recentlyHurt = this.lastHit.by === c && now - this.lastHit.t < 2;
        if (facing < this.D.fovCos && d > 5 && !recentlyHurt && c !== this.target) continue;
        // a bit of noise on far targets
        const chest = c.chest(_d);
        if (!g.world.los(eye.x, eye.y, eye.z, chest.x, chest.y, chest.z)) {
          const hd = c.head(_d);
          if (!g.world.los(eye.x, eye.y, eye.z, hd.x, hd.y, hd.z)) continue;
        }
        let score = d;
        if (c === this.target) score -= 10;
        if (recentlyHurt) score -= 15;
        if (c.invuln > 0) score += 30;
        if (score < bestScore) { bestScore = score; best = c; }
      }
      if (best) {
        if (best !== this.target) {
          this.target = best;
          const d = this.pos.distanceTo(best.pos);
          this.reactT = U.rand(this.D.react[0], this.D.react[1]) * (0.8 + d / 80);
          this.errY = U.rand(-1, 1) * this.D.err * (1 + d / 35) * 1.4;
          this.errP = U.rand(-1, 1) * this.D.err * (1 + d / 35);
          this.aimHead = Math.random() < this.D.headP;
          this.burst = 0;
        }
        this.targetVisible = true;
        this.lastSeen.copy(best.pos); this.lastSeenT = now;
        this.path = null;
        // weapon choice
        const ws = this.ws;
        if (!ws.knife && ws.ammo === 0 && ws.reserve === 0) this.switchTo(this.slot === 'main' ? 'secondary' : 'knife', now);
        else if (!ws.knife && ws.ammo === 0 && !ws.reloading) {
          const d = this.pos.distanceTo(best.pos);
          if (this.slot === 'main' && d < 18 && this.weapons.secondary.ammo > 0 && Math.random() < 0.6) this.switchTo('secondary', now);
          else C.startReload(ws, now);
        }
      } else {
        this.targetVisible = false;
      }
    }

    _shoot(now, t) {
      const g = GS.game;
      const ws = this.ws;
      const def = ws.def;
      // aim check
      this.eye(_a);
      const tp = this.aimHead ? t.head(_c) : t.chest(_c);
      _d.subVectors(tp, _a);
      const dist = _d.length();
      _d.divideScalar(dist);
      this.forward(_e);
      const ang = Math.acos(U.clamp(_e.dot(_d), -1, 1));
      const tol = Math.max(this.D.aimTol, Math.atan(0.4 / Math.max(1, dist))) * 1.6;
      if (ws.knife) {
        if (dist < 2.3 && now >= ws.nextFire) {
          const heavy = Math.random() < 0.25;
          ws.nextFire = now + (heavy ? def.stabRate : def.slashRate);
          this.invuln = 0;
          g.later(heavy ? 0.36 : 0.11, () => { if (this.alive && this.slot === 'knife') C.melee(this, heavy ? 'stab' : 'slash'); });
          GS.Audio.play(heavy ? 'swish_heavy' : 'swish', { pos: this.pos, vol: 0.7, bus: 'weapons' });
        }
        return;
      }
      if (ang > tol || now < ws.nextFire || ws.reloading) return;
      if (ws.ammo <= 0) { if (ws.reserve > 0) C.startReload(ws, now); return; }
      if (now < this.pauseT) return;
      // shot timing per weapon type
      if (!def.auto && now < this.semiT) return;
      ws.ammo--;
      ws.nextFire = now + 60 / def.rpm;
      if (def.burst) {
        if (ws.burstLeft <= 0) ws.burstLeft = def.burst;
        ws.burstLeft--;
        if (ws.burstLeft === 0) ws.nextFire = now + def.burstDelay + U.rand(0.05, 0.25);
      }
      if (!def.auto) this.semiT = now + Math.max(60 / def.rpm, U.rand(0.14, 0.32) * (def.scope ? 3 : 1));
      else {
        this.burst++;
        if (this.burst >= U.randi(this.D.burst[0], this.D.burst[1])) { this.burst = 0; this.pauseT = now + U.rand(0.18, 0.45); }
      }
      this.invuln = 0;
      const spread = C.spreadFor(this, ws, dist > 14 && !def.pistol) * this.D.acc + (def.scope && dist < 10 ? 0.03 : 0);
      const muzzle = this.ch.gunMount.localToWorld(_e.copy(this.wm[this.slot].muzzle));
      C.fire(this, ws, _a, this.forward(_b), { spread, muzzle });
      ws.bloom = Math.min((ws.bloom || 0) + def.bloom, 0.045);
      g.effects.muzzle(muzzle, def.cls === 'Shotgun' || def.scope);
      // simulated recoil
      this.aimPitch += U.degToRad(def.kick) * 0.35 * U.rand(0.5, 1);
      this.aimYaw += U.degToRad(def.kickH) * U.rand(-0.5, 0.5);
    }

    _navigate(dt, now, dest) {
      const g = GS.game;
      const w = g.world;
      if (!w.nav) return null;
      this.repathT -= dt;
      if (!this.path || this.pi >= this.path.length || this.repathT <= 0) {
        const from = w.nearestNode(this.pos.x, this.pos.y, this.pos.z);
        let to;
        if (dest) to = w.nearestNode(dest.x, dest.y, dest.z, 3);
        else {
          if (this.goal < 0 || !this.path || this.pi >= this.path.length) this.goal = w.randomNode();
          to = this.goal;
        }
        this.path = from >= 0 && to >= 0 ? w.path(from, to) : null;
        this.pi = 0;
        this.repathT = dest ? 1.2 : 6;
        if (!this.path) { this.goal = -1; this.repathT = 0.5; return null; }
      }
      // progress / stuck detection
      this.progressT += dt;
      if (this.progressT > 1.4) {
        if (this.pos.distanceTo(this.lastPos) < 0.6) { this.path = null; this.goal = -1; this.repathT = 0; this.strafe *= -1; }
        this.lastPos.copy(this.pos);
        this.progressT = 0;
      }
      if (!this.path) return null;
      const N = w.nav.nodes;
      let n = N[this.path[this.pi]];
      let dx = n.x - this.pos.x, dz = n.z - this.pos.z;
      if (dx * dx + dz * dz < 0.55 && Math.abs(n.y - this.pos.y) < 1.5) {
        this.pi++;
        if (this.pi >= this.path.length) { this.goal = -1; return null; }
        n = N[this.path[this.pi]];
        dx = n.x - this.pos.x; dz = n.z - this.pos.z;
      }
      // look-ahead skip when the next node is straight & level
      if (this.pi + 1 < this.path.length) {
        const n2 = N[this.path[this.pi + 1]];
        if (Math.abs(n2.y - this.pos.y) < 0.2 && Math.abs(n.y - this.pos.y) < 0.2 && dx * dx + dz * dz < 2.5) {
          const ex = n2.x - this.pos.x, ez = n2.z - this.pos.z;
          if ((ex * dx + ez * dz) > 0) { dx = ex; dz = ez; }
        }
      }
      const l = Math.hypot(dx, dz) || 1;
      return _e.set(dx / l, 0, dz / l);
    }

    _animate(dt, hs) {
      const ch = this.ch;
      this.root.position.copy(this.pos);
      this.root.rotation.y = this.aimYaw;
      this.walkPhase += hs * dt * 1.7;
      const sw = U.clamp(hs / 6, 0, 1) * 0.75;
      const air = this.body.grounded ? 0 : 0.6;
      ch.legL.rotation.x = Math.sin(this.walkPhase) * sw + air + this.crouch * 0.9;
      ch.legR.rotation.x = -Math.sin(this.walkPhase) * sw - air * 0.3 + this.crouch * 0.9;
      ch.hips.position.y = 0.94 - this.crouch * 0.45 + Math.abs(Math.cos(this.walkPhase)) * 0.03 * sw;
      ch.spine.rotation.x = -this.crouch * 0.25;
      ch.aim.rotation.x = this.aimPitch + this.crouch * 0.25;
      ch.neck.rotation.x = this.aimPitch * 0.4;
      // spawn protection shimmer
      ch.accent.emissiveIntensity = this.invuln > 0 ? 0.6 + Math.sin(GS.game.time * 20) * 0.4 : 0.08;
    }
  }

  GS.Bot = Bot;
  GS.BotDiff = DIFF;
})();
