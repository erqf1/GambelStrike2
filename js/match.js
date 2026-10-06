'use strict';
// GambelStrike 2 — free-for-all match: spawning, scoring, kill feed, HUD, round flow
(function () {
  const U = GS.U;
  const V3 = THREE.Vector3;
  const _a = new V3(), _b = new V3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

  // ================================================================== HUD
  class Hud {
    constructor() {
      const $ = (id) => document.getElementById(id);
      this.root = $('hud');
      this.el = {
        timer: $('hud-timer'), k: $('hud-k'), d: $('hud-d'), place: $('hud-place'), mini: $('hud-mini'), feed: $('killfeed'),
        cross: $('crosshair'), hit: $('hitmarker'), target: $('target-name'), hpVal: $('hp-val'), hpBar: $('hp-bar-fill'), hpMax: $('hp-max'),
        mods: $('hud-mods'), wName: $('w-name'), wSkin: $('w-skin'), ammo: $('w-ammo'), reserve: $('w-reserve'), slots: $('w-slots'),
        center: $('hud-center'), toast: $('hud-toast'), scope: $('scope-overlay'), hurt: $('hurt-vignette'), dirs: $('dmg-dirs'),
        death: $('death-screen'), board: $('scoreboard'), fps: $('fps'), prot: $('spawn-prot'), reload: $('reload-ring'), streak: $('hud-streak'),
      };
      this.cache = {};
      this.boardT = 0;
      this.hurtA = 0;
      this.fpsT = 0; this.frames = 0;
    }
    show() { this.root.classList.remove('hidden'); }
    hide() { this.root.classList.add('hidden'); this.scope(false); this.hideDeath(); this.scoreboard(false); }
    set(key, el, val, prop = 'textContent') {
      if (this.cache[key] === val) return;
      this.cache[key] = val;
      el[prop] = val;
    }
    setup(m) {
      this.cache = {};
      const p = m.player;
      const lo = p.loadout;
      const chips = [];
      const spd = lo.speed.toFixed(1), dmg = lo.damage.toFixed(1);
      chips.push(`<span class="mod ${lo.speed >= 2 ? 'hi' : lo.speed <= 0.5 ? 'lo' : ''}">SPD x${spd}</span>`);
      chips.push(`<span class="mod ${lo.damage >= 2 ? 'hi' : lo.damage <= 0.7 ? 'lo' : ''}">DMG x${dmg}</span>`);
      this.el.mods.innerHTML = chips.join('');
      this.el.hpMax.textContent = '/ ' + p.maxHp;
      this.el.feed.innerHTML = '';
      this.el.center.innerHTML = '';
      this.el.dirs.innerHTML = '';
      const sl = ['main', 'secondary', 'knife'].map((s, i) => {
        const ws = p.weapons[s];
        const name = ws.def.name;
        return `<div class="slot" data-slot="${s}"><b>${i + 1}</b><span>${U.esc(name)}</span></div>`;
      });
      this.el.slots.innerHTML = sl.join('');
      this.el.cross.style.setProperty('--cc', GS.Save.d.settings.game.crosshair);
      this.el.fps.style.display = GS.Save.d.settings.graphics.showFps ? '' : 'none';
    }
    update(dt, m) {
      const p = m.player, el = this.el;
      // fps
      this.frames++; this.fpsT += dt;
      if (this.fpsT > 0.5) { el.fps.textContent = Math.round(this.frames / this.fpsT) + ' FPS'; this.frames = 0; this.fpsT = 0; }
      this.set('timer', el.timer, U.fmtTime(m.timeLeft));
      el.timer.classList.toggle('low', m.timeLeft < 30 && m.state === 'live');
      this.set('k', el.k, String(p.kills));
      this.set('d', el.d, String(p.deaths));
      const st = m.standings();
      const place = st.indexOf(p) + 1;
      this.set('place', el.place, `#${place} / ${st.length}`);
      // hp
      const hp = Math.ceil(p.hp);
      this.set('hp', el.hpVal, String(hp));
      const frac = U.clamp(p.hp / p.maxHp, 0, 1);
      this.set('hpw', el.hpBar.style, (frac * 100).toFixed(1) + '%', 'width');
      el.hpVal.classList.toggle('low', frac < 0.3);
      // weapon
      const ws = p.ws;
      this.set('wn', el.wName, ws.def.name);
      const sk = ws.knife ? GS.KNIFE_SKINS[ws.design] : GS.SKINS[ws.design];
      const rar = ws.knife ? GS.RARITIES.knife : GS.RARITIES[(sk && sk.rarity) || 'common'];
      this.set('ws', el.wSkin, ws.design === 'default' ? (ws.knife ? '★ Vanilla' : 'Factory') : (ws.knife ? '★ ' : '') + sk.name);
      this.set('wsc', el.wSkin.style, ws.design === 'default' && !ws.knife ? '#8a93a3' : rar.color, 'color');
      this.set('am', el.ammo, ws.knife ? '∞' : String(ws.ammo));
      this.set('rs', el.reserve, ws.knife ? '' : '/ ' + ws.reserve);
      el.ammo.classList.toggle('low', !ws.knife && ws.ammo <= Math.ceil(ws.def.mag * 0.2));
      if (this.cache.slot !== p.slot) {
        this.cache.slot = p.slot;
        for (const s of el.slots.children) s.classList.toggle('on', s.dataset.slot === p.slot);
      }
      // reload ring
      const rl = !ws.knife && ws.reloading;
      el.reload.classList.toggle('on', !!rl);
      // crosshair
      const ads = p.adsW > 0.6 && !ws.knife;
      const sp = ws.knife ? 0 : GS.Combat.spreadFor(p, ws, ads);
      const gap = 4 + sp * 900 * (p.adsW > 0.5 ? 0.5 : 1);
      el.cross.style.setProperty('--gap', Math.min(gap, 60).toFixed(1) + 'px');
      el.cross.classList.toggle('hide', (ads && !ws.def.pellets) || !p.alive || (ws.def.scope && p.adsW > 0.3));
      el.cross.classList.toggle('knife', ws.knife);
      // spawn protection
      el.prot.classList.toggle('on', p.alive && p.invuln > 0);
      // hurt vignette
      this.hurtA = Math.max(0, this.hurtA - dt * 1.4);
      const low = p.alive ? U.smoothstep(0.35, 0.1, frac) * 0.5 : 0;
      el.hurt.style.opacity = Math.max(this.hurtA, low).toFixed(3);
      // mini scoreboard
      this.boardT -= dt;
      if (this.boardT <= 0) {
        this.boardT = 0.3;
        const rows = st.slice(0, 4);
        if (!rows.includes(p)) rows.push(p);
        el.mini.innerHTML = rows.map((c) => `<div class="row${c === p ? ' me' : ''}"><span class="pl">#${st.indexOf(c) + 1}</span><span class="nm" style="--c:${c.color}">${U.esc(c.name)}</span><span class="kl">${c.kills}</span></div>`).join('');
        if (this.boardOpen) this._renderBoard(m);
      }
      // target name
      if (m.aimTarget) {
        const t = m.aimTarget;
        this.set('tn', el.target, `<b style="color:${t.color}">${U.esc(t.name)}</b><span>${Math.ceil(t.hp)} / ${t.maxHp} HP · SPD x${t.speedMul.toFixed(1)} · DMG x${t.dmgMul.toFixed(1)}</span>`, 'innerHTML');
        el.target.classList.add('on');
      } else el.target.classList.remove('on');
      // death countdown
      if (!p.alive && this.deathOn) {
        const t = Math.max(0, p.respawnT);
        const e = el.death.querySelector('.respawn');
        if (e) e.textContent = m.state === 'live' ? `RESPAWN IN ${t.toFixed(1)}` : '';
      }
    }
    hitmarker(head, kill) {
      const h = this.el.hit;
      h.className = '';
      void h.offsetWidth;
      h.className = 'on' + (head ? ' head' : '') + (kill ? ' kill' : '');
      GS.Audio.play(head ? 'headshot' : 'hit', { bus: 'ui', vol: head ? 0.55 : 0.5 });
      if (kill) GS.Audio.play('kill', { bus: 'ui', vol: 0.6 });
    }
    feed(killer, victim, weapon, head, mine) {
      const d = document.createElement('div');
      d.className = 'kf' + (mine ? ' mine' : '');
      const kn = killer ? `<span style="color:${killer.color}">${U.esc(killer.name)}</span>` : '';
      d.innerHTML = `${kn}<em>${U.esc(weapon || '')}${head ? ' <i class="hs">⌖</i>' : ''}</em><span style="color:${victim.color}">${U.esc(victim.name)}</span>`;
      this.el.feed.prepend(d);
      while (this.el.feed.children.length > 6) this.el.feed.lastChild.remove();
      setTimeout(() => d.classList.add('out'), 5000);
      setTimeout(() => d.remove(), 5600);
    }
    center(text, sub, cls = '', dur = 1.6) {
      const c = this.el.center;
      c.innerHTML = `<div class="big ${cls}">${text}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`;
      c.classList.remove('on');
      void c.offsetWidth;
      c.classList.add('on');
      clearTimeout(this._ct);
      if (dur > 0) this._ct = setTimeout(() => c.classList.remove('on'), dur * 1000);
    }
    streak(text) {
      const s = this.el.streak;
      s.textContent = text;
      s.classList.remove('on');
      void s.offsetWidth;
      s.classList.add('on');
    }
    toast(text, cls = '') {
      const t = document.createElement('div');
      t.className = 'toast ' + cls;
      t.textContent = text;
      this.el.toast.appendChild(t);
      setTimeout(() => t.remove(), 2200);
    }
    scope(on) {
      if (this.cache.scope === on) return;
      this.cache.scope = on;
      this.el.scope.classList.toggle('on', on);
      if (GS.game && GS.game.vm) GS.game.vm.hidden = on;
    }
    hurt(amount, maxHp, angle) {
      this.hurtA = Math.min(0.9, this.hurtA + 0.25 + (amount / maxHp) * 0.8);
      if (angle !== null && angle !== undefined) {
        const d = document.createElement('div');
        d.className = 'dmg-dir';
        d.style.transform = `rotate(${angle}rad)`;
        this.el.dirs.appendChild(d);
        setTimeout(() => d.remove(), 1200);
      }
    }
    death(killer, info, killerWs) {
      this.deathOn = true;
      const d = this.el.death;
      const kn = killer && killer !== GS.game.player ? killer : null;
      d.innerHTML = `<div class="dt">ELIMINATED</div>
        ${kn ? `<div class="by">by <b style="color:${kn.color}">${U.esc(kn.name)}</b> with <b>${U.esc(info.weapon || '')}</b>${info.head ? ' <span class="hs">HEADSHOT</span>' : ''}</div>
        <div class="kstats"><span>${Math.ceil(kn.hp)} / ${kn.maxHp} HP left</span><span>SPD x${kn.speedMul.toFixed(1)}</span><span>DMG x${kn.dmgMul.toFixed(1)}</span></div>` : `<div class="by">${info.weapon === 'Gravity' ? 'Gravity wins this time.' : 'Self-inflicted.'}</div>`}
        <div class="respawn"></div>`;
      d.classList.add('on');
      void killerWs;
    }
    hideDeath() { this.deathOn = false; this.el.death.classList.remove('on'); }
    scoreboard(on, m) {
      this.boardOpen = on;
      this.el.board.classList.toggle('on', on);
      if (on && m) this._renderBoard(m);
    }
    _renderBoard(m) {
      const st = m.standings();
      const p = m.player;
      this.el.board.innerHTML = `<div class="sb-head"><span>${GS.MAPS[m.mapId].name}</span><span>${m.size} PLAYER FFA</span><span>${U.fmtTime(m.timeLeft)}</span></div>
        <table><thead><tr><th>#</th><th>PLAYER</th><th>HP</th><th>SPD</th><th>DMG</th><th>MAIN</th><th>K</th><th>D</th><th>K/D</th></tr></thead><tbody>
        ${st.map((c, i) => `<tr class="${c === p ? 'me' : ''}${c.alive ? '' : ' dead'}"><td>${i + 1}</td><td><i style="background:${c.color}"></i>${U.esc(c.name)}</td><td>${c.maxHp}</td><td>x${c.speedMul.toFixed(1)}</td><td>x${c.dmgMul.toFixed(1)}</td><td>${U.esc(c.weapons.main.def.name)}</td><td>${c.kills}</td><td>${c.deaths}</td><td>${(c.kills / Math.max(1, c.deaths)).toFixed(2)}</td></tr>`).join('')}
        </tbody></table>`;
    }
  }

  // ================================================================== MATCH
  class Match {
    constructor(app, cfg) {
      this.app = app;
      this.cfg = cfg;
      this.size = cfg.size;
      this.mapId = cfg.mapId;
      this.map = cfg.map;
      this.world = this.map.world;
      this.scene = app.scene;
      this.camera = app.camera;
      this.vm = app.vm;
      this.effects = app.effects;
      this.hud = app.hud;
      this.time = 0;
      this.timeScale = 1;
      this.state = 'countdown';
      this.countdown = 3.2;
      this.duration = cfg.duration || 240;
      this.timeLeft = this.duration;
      this.tasks = [];
      this.combatants = [];
      this.bots = [];
      this.firstBlood = false;
      this.aimTarget = null;
      this.shake = 0;
      this.deathCam = null;
      this.onEnd = cfg.onEnd;
      GS.game = this;
    }

    setup() {
      const cfg = this.cfg;
      const p = (this.player = new GS.Player(cfg.playerName || 'YOU'));
      p.setLoadout(cfg.loadout);
      this.combatants.push(p);
      for (const b of cfg.bots) {
        const bot = new GS.Bot(b.name, b.color, cfg.difficulty);
        bot.setLoadout(b.loadout);
        this.scene.add(bot.root);
        this.bots.push(bot);
        this.combatants.push(bot);
      }
      this.vm.onEvent = (e) => { if (e === 'eject' && this.player.alive) this.player.eject(); };
      // initial spawns
      const used = new Set();
      const pts = this.map.spawnPoints;
      const order = U.shuffle(pts.map((_, i) => i));
      let oi = 0;
      for (const c of this.combatants) {
        let pos;
        if (oi < order.length) pos = pts[order[oi++]];
        else pos = this._randomNodePos();
        used.add(pos);
        c.spawn(pos.clone(), Math.random() * Math.PI * 2);
      }
      this.hud.setup(this);
      this.hud.show();
      GS.Audio.setOccluder((pos) => !this.world.los(this.camera.position.x, this.camera.position.y, this.camera.position.z, pos.x, pos.y + 0.5, pos.z));
      GS.Audio.setReverb(this.map.reverb);
      GS.Audio.ambience(this.map.ambience, 0.8);
      GS.Audio.music(null);
    }
    _randomNodePos() {
      const w = this.world;
      const i = w.randomNode((n) => n.y < 1);
      if (i < 0) return this.map.spawnPoints[0];
      const n = w.nav.nodes[i];
      return new V3(n.x, n.y + 0.01, n.z);
    }
    later(delay, fn) { this.tasks.push({ t: this.time + delay, fn }); }

    standings() {
      if (this._st && this._stFrame === this.frame) return this._st;
      this._stFrame = this.frame;
      this._st = this.combatants.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || b.damageDealt - a.damageDealt);
      return this._st;
    }

    pickSpawn(c) {
      const cands = this.map.spawnPoints.slice();
      for (let i = 0; i < 6; i++) cands.push(this._randomNodePos());
      const scored = cands.map((s) => {
        let minD = Infinity;
        for (const o of this.combatants) {
          if (o === c || !o.alive) continue;
          const d = o.pos.distanceTo(s);
          const seen = d < 40 && this.world.los(s.x, s.y + 1.5, s.z, o.pos.x, o.pos.y + 1.5, o.pos.z);
          minD = Math.min(minD, seen ? d * 0.4 : d);
        }
        return { s, score: minD + Math.random() * 8 };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored[Math.floor(Math.random() * Math.min(3, scored.length))].s.clone();
    }
    respawn(c) {
      const p = this.pickSpawn(c);
      // face roughly towards the map centre
      const yaw = Math.atan2(p.x, p.z) + U.rand(-0.6, 0.6);
      c.spawn(p, yaw);
      this.effects.spawnFx(p, c.color);
      if (c.isPlayer) {
        this.hud.hideDeath();
        this.deathCam = null;
        GS.Audio.play('spawn', { bus: 'effects', vol: 0.6 });
      }
    }

    // ---------------------------------------------------------------- events
    onShot(c, origin, def) {
      if (!c.isPlayer) {
        const d = this.camera.position.distanceTo(origin);
        const name = d > 50 ? 'far_shot' : 'shot_' + def.snd;
        GS.Audio.play(name, { pos: origin, vol: d > 50 ? 0.9 : 0.85, bus: 'weapons', ref: 6, maxDist: 160, rev: 0.3 });
      }
      for (const b of this.bots) if (b !== c) b.hearShot(c, origin);
    }
    onDamage(v, a, amount, info) {
      if (v.isPlayer) {
        let ang = null;
        if (a && a !== v) {
          _a.subVectors(a.pos, v.pos);
          const yaw = Math.atan2(-_a.x, -_a.z);
          ang = -(yaw - v.yaw);
        }
        this.hud.hurt(amount, v.maxHp, ang);
        GS.Audio.play('hurt', { bus: 'effects', vol: 0.8 });
        this.shake = Math.min(1, this.shake + 0.35);
      } else if (a) {
        v.onHurt(a);
      }
    }
    onKill(v, a, info) {
      v.alive = false;
      v.deaths++;
      v.respawnT = 3.2;
      v.streak = 0;
      const self = !a || a === v;
      if (!self) {
        a.kills++;
        a.streak++;
        a.bestStreak = Math.max(a.bestStreak, a.streak);
        if (info.head) a.headshots++;
      }
      this.effects.death(v.pos, v.color);
      GS.Audio.play('eliminate', { pos: _a.copy(v.pos).setY(v.pos.y + 1), vol: 0.7, bus: 'effects' });
      const mine = v.isPlayer || (a && a.isPlayer);
      this.hud.feed(self ? null : a, v, info.weapon, info.head, mine);
      if (!this.firstBlood && !self) {
        this.firstBlood = true;
        if (a.isPlayer) { this.hud.streak('FIRST BLOOD'); GS.Audio.speak('First blood'); }
      }
      if (v.isPlayer) {
        this.vm.hidden = true;
        this.hud.scope(false);
        this.hud.death(self ? null : a, info);
        GS.Audio.play('death', { bus: 'effects', vol: 0.8 });
        const eye = new V3(v.pos.x, v.pos.y + 1.6, v.pos.z);
        this.deathCam = { from: eye, killer: self ? null : a, t: 0 };
      } else {
        v.die();
      }
      if (a && a.isPlayer && !self) {
        const s = a.streak;
        const names = { 2: 'DOUBLE KILL', 3: 'TRIPLE KILL', 5: 'RAMPAGE', 7: 'UNSTOPPABLE', 10: 'GODLIKE', 15: 'BEYOND GAMBEL' };
        if (names[s]) { this.hud.streak(names[s]); GS.Audio.play('streak', { bus: 'ui', vol: 0.7 }); GS.Audio.speak(names[s].toLowerCase()); }
        if (info.melee) this.hud.toast(info.backstab ? 'BACKSTAB' : 'KNIFE KILL', 'gold');
        else if (info.head) this.hud.toast('HEADSHOT', 'red');
      }
    }

    // ---------------------------------------------------------------- loop
    update(rdt) {
      this.frame = (this.frame || 0) + 1;
      const dt = Math.min(rdt, 0.05) * this.timeScale;
      this.time += dt;
      const I = GS.Input;
      // scheduled tasks
      for (let i = this.tasks.length - 1; i >= 0; i--) {
        if (this.time >= this.tasks[i].t) { const t = this.tasks[i]; this.tasks.splice(i, 1); t.fn(); }
      }
      // round flow
      if (this.state === 'countdown') {
        const before = Math.ceil(this.countdown);
        this.countdown -= dt;
        const now = Math.ceil(this.countdown);
        if (now !== before && now > 0) { this.hud.center(String(now), 'GET READY', 'count', 0.9); GS.Audio.play('countdown', { bus: 'ui', vol: 0.7 }); }
        if (this.countdown <= 0) {
          this.state = 'live';
          this.hud.center('FIGHT', 'FREE FOR ALL · MOST KILLS WINS', 'go', 1.3);
          GS.Audio.play('go', { bus: 'ui', vol: 0.8 });
          GS.Audio.speak('Fight!');
        }
      } else if (this.state === 'live') {
        this.timeLeft -= dt;
        if (this.timeLeft <= 10 && Math.ceil(this.timeLeft) !== this._lastBeep && this.timeLeft > 0) {
          this._lastBeep = Math.ceil(this.timeLeft);
          GS.Audio.play('countdown', { bus: 'ui', vol: 0.5, rate: 1.3 });
        }
        if (this.timeLeft <= 0) this.end();
      } else if (this.state === 'ending') {
        this.endT -= rdt;
        this.timeScale = U.lerp(this.timeScale, 0.2, 1 - Math.exp(-rdt * 4));
        if (this.endT <= 0) { this.state = 'over'; this.timeScale = 1; if (this.onEnd) this.onEnd(this.results()); return; }
      }
      // respawns
      for (const c of this.combatants) {
        if (c.alive || this.state === 'ending' || this.state === 'over') continue;
        c.respawnT -= dt;
        if (c.respawnT <= 0) this.respawn(c);
      }
      // player + bots
      const p = this.player;
      if (I.pressed('scoreboard')) this.hud.scoreboard(true, this);
      if (I.released('scoreboard')) this.hud.scoreboard(false);
      for (const c of this.combatants) c.updateHitboxes();
      p.update(dt, this.time);
      for (const b of this.bots) b.update(dt, this.time);
      this._updateCamera(dt, rdt);
      this._aimTarget();
      // viewmodel
      const vm = this.vm;
      if (p.alive && !vm.hidden) {
        vm.update(dt, {
          speed01: U.clamp(Math.hypot(p.vel.x, p.vel.z) / 6, 0, 1.5), sprint: p.sprinting, ads: p.ads, grounded: p.body.grounded, crouch: p.crouch > 0.5,
          lookDX: p.lookDX || 0, lookDY: p.lookDY || 0, bobRate: p.bobRate, landImpact: p.landImpact, camQuat: this.camera.quaternion,
        });
        p.landImpact = 0;
      } else if (p.alive) {
        vm.update(dt, { speed01: 0, sprint: false, ads: p.ads, grounded: true, crouch: false, lookDX: 0, lookDY: 0, bobRate: 0, camQuat: this.camera.quaternion });
      }
      this.effects.update(dt, this.camera, this.app.renderer, this.map.builder.emitters);
      this.map.update(this.time, dt, this.camera);
      GS.Mats.update(this.time, dt);
      // audio listener
      this.camera.getWorldDirection(_a);
      _b.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      GS.Audio.setListener(this.camera.position, _a, _b);
      this.hud.update(rdt, this);
    }
    _updateCamera(dt, rdt) {
      const p = this.player, cam = this.camera;
      const s = GS.Save.d.settings.graphics;
      const aspect = cam.aspect;
      const hf = THREE.MathUtils.degToRad(s.fov);
      let vf = 2 * Math.atan(Math.tan(hf / 2) / aspect);
      vf = Math.min(vf, THREE.MathUtils.degToRad(100));
      if (p.alive) {
        const ws = p.ws;
        const zoom = ws.knife ? 1 : U.lerp(1, ws.def.adsZoom, p.adsW);
        vf = 2 * Math.atan(Math.tan(vf / 2) * zoom);
        if (p.sprinting) vf *= 1.04;
        this.shake = Math.max(0, this.shake - rdt * 2.5);
        const sh = this.shake * 0.012;
        cam.position.set(p.pos.x, p.eyeY, p.pos.z);
        _e.set(p.pitch + p.recoil.p + p.punch.p * 0.004 + (Math.random() - 0.5) * sh, p.yaw + p.recoil.y + (Math.random() - 0.5) * sh, 0);
        // subtle step bob on the camera
        const bob = this.vm.bob, amt = this.vm.bobAmt * (1 - p.adsW) * 0.6;
        cam.position.y += -Math.abs(Math.cos(bob)) * 0.025 * amt;
        _e.z = Math.sin(bob) * 0.0035 * amt;
        cam.quaternion.setFromEuler(_e);
      } else if (this.deathCam) {
        const dc = this.deathCam;
        dc.t += rdt;
        const up = U.ease.outCubic(Math.min(1, dc.t / 1.2));
        cam.position.copy(dc.from).y += up * 1.6;
        if (dc.killer && dc.killer.alive) {
          _a.copy(dc.killer.pos).y += 1.4;
          const m = new THREE.Matrix4().lookAt(cam.position, _a, new V3(0, 1, 0));
          _q.setFromRotationMatrix(m);
          cam.quaternion.slerp(_q, 1 - Math.exp(-rdt * 4));
        } else {
          _e.set(-0.5, cam.rotation.y, 0);
        }
      }
      if (Math.abs(cam.fov - THREE.MathUtils.radToDeg(vf)) > 0.01) {
        cam.fov = THREE.MathUtils.radToDeg(vf);
        cam.updateProjectionMatrix();
      }
      cam.updateMatrixWorld();
    }
    _aimTarget() {
      this.aimTarget = null;
      const p = this.player;
      if (!p.alive) return;
      const o = this.camera.position;
      this.camera.getWorldDirection(_a);
      const tr = this._tr || (this._tr = {});
      GS.Combat.trace(o, _a, 90, p, tr);
      if (tr.victim) this.aimTarget = tr.victim;
    }

    end() {
      if (this.state !== 'live') return;
      this.state = 'ending';
      this.endT = 2.0;
      this.hud.center('ROUND OVER', 'TIME', 'end', 2.0);
      this.hud.scope(false);
      GS.Audio.play('round_end', { bus: 'ui', vol: 0.8 });
      GS.Audio.speak('Round over');
      GS.Input.unlock();
    }
    results() {
      const st = this.standings();
      return {
        standings: st.map((c) => ({ name: c.name, color: c.color, kills: c.kills, deaths: c.deaths, headshots: c.headshots, isPlayer: c.isPlayer, hp: c.maxHp, speed: c.speedMul, damage: c.dmgMul, main: c.weapons.main.def.name, bestStreak: c.bestStreak })),
        place: st.indexOf(this.player) + 1,
        size: this.size,
        player: { kills: this.player.kills, deaths: this.player.deaths, headshots: this.player.headshots, bestStreak: this.player.bestStreak },
        mapId: this.mapId,
        duration: this.duration,
      };
    }
    dispose() {
      for (const b of this.bots) this.scene.remove(b.root);
      this.effects.reset();
      this.hud.hide();
      this.vm.hidden = true;
      GS.Audio.ambience(null);
      GS.Audio.setOccluder(null);
      GS.game = null;
    }
  }

  GS.Hud = Hud;
  GS.Match = Match;
})();
