'use strict';
// GambelStrike 2 — combatants, weapon state, firing, hit detection and damage (shared by player & bots)
(function () {
  const U = GS.U;
  const V3 = THREE.Vector3;
  const BASE_SPEED = 6.0;
  const GRAVITY = 20;
  const JUMP_V = 6.9;

  // ------------------------------------------------------------------ weapon state
  function weaponState(slot, id, design) {
    if (slot === 'knife') {
      const def = GS.KNIVES[id];
      return { slot, id, design, def, knife: true, nextFire: 0, ammo: Infinity, reserve: Infinity, reloading: null };
    }
    const def = GS.WEAPONS[id];
    return {
      slot, id, design, def, knife: false,
      ammo: def.mag, reserve: def.reserve, nextFire: 0, reloading: null, reloadT: 0, reloadEmpty: false,
      bloom: 0, burstLeft: 0, lastShot: -9,
    };
  }
  function refill(ws) {
    if (ws.knife) return;
    ws.ammo = ws.def.mag; ws.reserve = ws.def.reserve; ws.reloading = null; ws.bloom = 0; ws.burstLeft = 0;
  }
  // returns false if no reload started
  function startReload(ws, now) {
    if (ws.knife || ws.reloading) return false;
    const d = ws.def;
    if (ws.ammo >= d.mag || ws.reserve <= 0) return false;
    if (d.shellReload) {
      ws.reloading = 'start';
      ws.reloadT = now + d.reloadStart;
      ws.reloadEmpty = ws.ammo === 0;
    } else {
      ws.reloadEmpty = ws.ammo === 0;
      ws.reloading = 'mag';
      ws.reloadT = now + (ws.reloadEmpty ? d.reloadEmpty : d.reload);
      ws.reloadDur = ws.reloadEmpty ? d.reloadEmpty : d.reload;
    }
    ws.burstLeft = 0;
    return true;
  }
  // advance reload; returns an event string or null
  function updateReload(ws, now) {
    if (!ws.reloading || now < ws.reloadT) return null;
    const d = ws.def;
    if (ws.reloading === 'mag') {
      const take = Math.min(d.mag - ws.ammo, ws.reserve);
      ws.ammo += take; ws.reserve -= take;
      ws.reloading = null;
      return 'done';
    }
    if (ws.reloading === 'start') { ws.reloading = 'shell'; ws.reloadT = now + d.reload; return 'shellStart'; }
    if (ws.reloading === 'shell') {
      ws.ammo++; ws.reserve--;
      if (ws.ammo >= d.mag || ws.reserve <= 0) { ws.reloading = 'end'; ws.reloadT = now + 0.42; return 'shellLast'; }
      ws.reloadT = now + d.reload;
      return 'shell';
    }
    if (ws.reloading === 'end') { ws.reloading = null; return 'done'; }
    return null;
  }
  function cancelReload(ws) {
    if (!ws.reloading) return;
    ws.reloading = null;
  }

  // ------------------------------------------------------------------ geometry helpers
  function rayAABB(o, d, x0, y0, z0, x1, y1, z1, maxT) {
    let tmin = 0, tmax = maxT;
    const ix = 1 / (Math.abs(d.x) < 1e-8 ? 1e-8 : d.x), iy = 1 / (Math.abs(d.y) < 1e-8 ? 1e-8 : d.y), iz = 1 / (Math.abs(d.z) < 1e-8 ? 1e-8 : d.z);
    let t1 = (x0 - o.x) * ix, t2 = (x1 - o.x) * ix;
    tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
    t1 = (y0 - o.y) * iy; t2 = (y1 - o.y) * iy;
    tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
    t1 = (z0 - o.z) * iz; t2 = (z1 - o.z) * iz;
    tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
    return tmax >= tmin ? tmin : -1;
  }
  function spreadDir(dir, angle, out) {
    if (angle <= 0) return out.copy(dir);
    // random direction within cone (uniform-ish, biased to centre)
    const r = angle * Math.sqrt(Math.random()) * (0.6 + Math.random() * 0.4);
    const a = Math.random() * Math.PI * 2;
    const up = Math.abs(dir.y) < 0.99 ? _up : _right;
    const t1 = _t1.crossVectors(dir, up).normalize();
    const t2 = _t2.crossVectors(dir, t1).normalize();
    out.copy(dir).addScaledVector(t1, Math.cos(a) * Math.tan(r)).addScaledVector(t2, Math.sin(a) * Math.tan(r)).normalize();
    return out;
  }
  const _up = new V3(0, 1, 0), _right = new V3(1, 0, 0), _t1 = new V3(), _t2 = new V3();

  // ------------------------------------------------------------------ combatant
  let NEXT_ID = 1;
  class Combatant {
    constructor(name, color, isPlayer) {
      this.id = NEXT_ID++;
      this.name = name;
      this.color = color;
      this.isPlayer = !!isPlayer;
      this.pos = new V3();
      this.vel = new V3();
      this.body = { pos: this.pos, vel: this.vel, r: 0.35, h: 1.8, grounded: false, coyote: 0 };
      this.yaw = 0; this.pitch = 0;
      this.crouch = 0;
      this.alive = false;
      this.hp = 100; this.maxHp = 100;
      this.speedMul = 1; this.dmgMul = 1;
      this.kills = 0; this.deaths = 0; this.headshots = 0; this.streak = 0; this.bestStreak = 0; this.damageDealt = 0;
      this.weapons = {};
      this.slot = 'main';
      this.invuln = 0;
      this.respawnT = 0;
      this.lastHit = { by: null, t: -99 };
      this.hb = { head: [0, 0, 0, 0, 0, 0], body: [0, 0, 0, 0, 0, 0], legs: [0, 0, 0, 0, 0, 0] };
    }
    setLoadout(lo) {
      this.loadout = lo;
      this.maxHp = lo.hp; this.speedMul = lo.speed; this.dmgMul = lo.damage;
      this.weapons = {
        main: weaponState('main', lo.main.id, lo.main.design),
        secondary: weaponState('secondary', lo.secondary.id, lo.secondary.design),
        knife: weaponState('knife', lo.knife.id, lo.knife.design),
      };
    }
    get ws() { return this.weapons[this.slot]; }
    get height() { return 1.8 - this.crouch * 0.55; }
    eye(out) { return out.set(this.pos.x, this.pos.y + this.height - 0.16, this.pos.z); }
    chest(out) { return out.set(this.pos.x, this.pos.y + this.height * 0.66, this.pos.z); }
    head(out) { return out.set(this.pos.x, this.pos.y + this.height - 0.13, this.pos.z); }
    forward(out) {
      const cp = Math.cos(this.pitch);
      return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    }
    updateHitboxes() {
      const p = this.pos, h = this.height;
      const set = (a, x0, y0, z0, x1, y1, z1) => { a[0] = x0; a[1] = y0; a[2] = z0; a[3] = x1; a[4] = y1; a[5] = z1; };
      set(this.hb.head, p.x - 0.15, p.y + h - 0.29, p.z - 0.15, p.x + 0.15, p.y + h + 0.01, p.z + 0.15);
      set(this.hb.body, p.x - 0.25, p.y + h * 0.48, p.z - 0.21, p.x + 0.25, p.y + h - 0.29, p.z + 0.21);
      set(this.hb.legs, p.x - 0.21, p.y, p.z - 0.17, p.x + 0.21, p.y + h * 0.48, p.z + 0.17);
    }
    speedFor(ws) {
      return BASE_SPEED * (ws ? ws.def.mobility : 1) * this.speedMul;
    }
  }

  // ------------------------------------------------------------------ firing
  const _o = new V3(), _d = new V3(), _sd = new V3(), _hp = new V3(), _n = new V3(), _m = new V3();
  const Combat = (GS.Combat = {
    BASE_SPEED, GRAVITY, JUMP_V,
    weaponState, refill, startReload, updateReload, cancelReload, rayAABB, spreadDir, Combatant,
    spreadFor(c, ws, ads) {
      const d = ws.def;
      const sp = Math.sqrt(c.vel.x * c.vel.x + c.vel.z * c.vel.z);
      const moveF = U.clamp(sp / 6, 0, 1.4);
      let s = ads ? d.adsSpread : d.spread;
      s += ws.bloom;
      s += moveF * (ads ? 0.012 : 0.03) * (d.scope && !ads ? 1.5 : 1);
      if (!c.body.grounded) s += 0.07;
      if (c.crouch > 0.5) s *= 0.75;
      return s;
    },
    // trace a single ray against world + combatants
    trace(o, d, maxD, shooter, out) {
      const g = GS.game;
      const wh = g.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, maxD, out.wh || (out.wh = {}));
      let tMax = wh ? wh.t : maxD;
      out.victim = null; out.part = null; out.t = tMax; out.world = wh;
      for (const c of g.combatants) {
        if (c === shooter || !c.alive) continue;
        // quick reject: distance from ray to body centre
        _m.set(c.pos.x - o.x, c.pos.y + 1 - o.y, c.pos.z - o.z);
        const along = _m.dot(d);
        if (along < -1 || along > tMax + 1) continue;
        const perp2 = _m.lengthSq() - along * along;
        if (perp2 > 2.2) continue;
        const hb = c.hb;
        for (const part of ['head', 'body', 'legs']) {
          const a = hb[part];
          const t = rayAABB(o, d, a[0], a[1], a[2], a[3], a[4], a[5], tMax);
          if (t >= 0 && t < out.t) { out.t = t; out.victim = c; out.part = part; }
        }
      }
      if (out.victim) out.world = null;
      return out;
    },
    falloff(def, dist) {
      const [n, f, m] = def.range;
      if (dist <= n) return 1;
      if (dist >= f) return m;
      return U.lerp(1, m, (dist - n) / (f - n));
    },
    // fire the current weapon. origin/dir = aim ray. returns summary
    fire(c, ws, origin, dir, opts = {}) {
      const g = GS.game;
      const def = ws.def;
      const pellets = def.pellets || 1;
      const spread = opts.spread !== undefined ? opts.spread : Combat.spreadFor(c, ws, opts.ads);
      const hits = new Map();
      const res = { hit: false, head: false, kill: false, victims: hits };
      const tr = {};
      const muzzle = opts.muzzle || origin;
      for (let i = 0; i < pellets; i++) {
        spreadDir(dir, spread, _sd);
        Combat.trace(origin, _sd, 300, c, tr);
        _hp.copy(origin).addScaledVector(_sd, tr.t);
        if (tr.victim) {
          const mult = tr.part === 'head' ? def.hs : tr.part === 'legs' ? 0.75 : 1;
          const dmg = def.dmg * mult * Combat.falloff(def, tr.t) * c.dmgMul;
          let h = hits.get(tr.victim);
          if (!h) { h = { dmg: 0, head: false, point: _hp.clone() }; hits.set(tr.victim, h); }
          h.dmg += dmg;
          if (tr.part === 'head') h.head = true;
          g.effects.hit(_hp, _sd, tr.victim.color, tr.part === 'head');
        } else if (tr.world) {
          const w = tr.world;
          _n.set(w.nx, w.ny, w.nz);
          g.effects.impact(_hp, _n, w.box.surf, { decal: pellets === 1 || i % 3 === 0 });
          if (i === 0 || Math.random() < 0.3) GS.Audio.play('imp_' + (w.box.surf === 'metal' ? 'metal' : w.box.surf === 'sand' ? 'sand' : 'concrete'), { pos: _hp, vol: 0.5, bus: 'effects', maxDist: 60 });
        }
        if (i === 0 || Math.random() < 0.35) g.effects.tracer(_o.copy(muzzle).addScaledVector(_sd, 0.4), _hp);
      }
      for (const [v, h] of hits) {
        res.hit = true;
        if (h.head) res.head = true;
        const killed = Combat.damage(v, c, h.dmg, { head: h.head, weapon: def.name, point: h.point, dir: _d.copy(dir) });
        if (killed) res.kill = true;
        if (c.isPlayer) g.effects.number(h.point, h.dmg, h.head, killed);
      }
      // shooter sound + alert
      g.onShot(c, origin, def);
      return res;
    },
    melee(c, kind) {
      const g = GS.game;
      const ws = c.weapons.knife;
      const def = ws.def;
      const eye = c.eye(_o);
      const fwd = c.forward(_d);
      let best = null, bd = Infinity;
      for (const v of g.combatants) {
        if (v === c || !v.alive) continue;
        v.chest(_m);
        const to = _n.copy(_m).sub(eye);
        const dist = to.length();
        if (dist > def.range + 0.35) continue;
        to.divideScalar(dist || 1);
        if (to.dot(fwd) < (dist < 1 ? 0.2 : 0.62)) continue;
        if (!g.world.los(eye.x, eye.y, eye.z, _m.x, _m.y, _m.z)) continue;
        if (dist < bd) { bd = dist; best = v; }
      }
      if (!best) {
        // wall hit feedback
        const wh = g.world.raycast(eye.x, eye.y, eye.z, fwd.x, fwd.y, fwd.z, def.range);
        if (wh) {
          _hp.set(wh.x, wh.y, wh.z);
          g.effects.impact(_hp, _n.set(wh.nx, wh.ny, wh.nz), wh.box.surf, { decal: false });
          GS.Audio.play('knife_wall', { pos: _hp, vol: 0.7, bus: 'weapons' });
        }
        return { hit: false };
      }
      // backstab bonus for heavy attacks
      const vf = best.forward(_m);
      vf.y = 0; vf.normalize();
      const toAtt = _n.set(c.pos.x - best.pos.x, 0, c.pos.z - best.pos.z).normalize();
      const back = vf.dot(toAtt) < -0.45;
      let dmg = (kind === 'stab' ? def.stab : def.slash) * c.dmgMul;
      if (kind === 'stab' && back) dmg *= 2.2;
      const p = best.chest(new V3());
      g.effects.hit(p, fwd, best.color, false);
      g.effects.slashHit(p, '#ffffff');
      GS.Audio.play('knife_hit', { pos: p, vol: 0.9, bus: 'weapons' });
      const killed = Combat.damage(best, c, dmg, { head: false, weapon: def.name, point: p, dir: fwd.clone(), melee: true, backstab: back && kind === 'stab' });
      if (c.isPlayer) g.effects.number(p, dmg, false, killed);
      return { hit: true, kill: killed, victim: best };
    },
    damage(v, attacker, amount, info) {
      const g = GS.game;
      if (!v.alive || v.invuln > 0 || g.state !== 'live') return false;
      amount = Math.max(1, amount);
      v.hp -= amount;
      v.lastHit = { by: attacker, t: g.time };
      if (attacker) attacker.damageDealt += Math.min(amount, v.hp + amount);
      g.onDamage(v, attacker, amount, info);
      if (v.hp <= 0) {
        v.hp = 0;
        g.onKill(v, attacker, info);
        return true;
      }
      return false;
    },
  });
})();
