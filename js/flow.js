'use strict';
// GambelStrike 2 — round flow: lobby → 6 roulette spins → loadout → map vote → load → FFA → results → tokens
(function () {
  const U = GS.U;
  const $ = (s, r = document) => r.querySelector(s);
  const S = () => GS.Save;

  const F = (GS.Flow = {
    startLobby(size) {
      this.size = size;
      const names = U.shuffle(GS.BOT_NAMES.slice()).slice(0, size - 1);
      const cols = U.shuffle(GS.BOT_COLORS.slice());
      this.bots = names.map((n, i) => ({ name: n, color: cols[i % cols.length], loadout: GS.Roulette.rollBot(), level: U.randi(3, 120) }));
      const el = GS.UI.screens.lobby;
      const me = S().d.settings.game.playerName || 'YOU';
      el.innerHTML = `<div class="lobby">
        <div class="lb-head"><div class="lb-t">LOBBY</div><div class="lb-s">${size} PLAYER FREE-FOR-ALL · <span class="lb-c">1</span> / ${size}</div></div>
        <div class="lb-grid ${size > 10 ? 'big' : ''}">
          <div class="lb-p me in"><i style="background:#00ffd0"></i><span>${U.esc(me)}</span><em>YOU</em></div>
          ${this.bots.map((b, i) => `<div class="lb-p" data-i="${i}"><i style="background:${b.color}"></i><span>${U.esc(b.name)}</span><em>LVL ${b.level}</em></div>`).join('')}
        </div>
        <div class="lb-status"><div class="spinner"></div><span>Waiting for players…</span></div>
      </div>`;
      GS.UI.show('lobby');
      GS.Audio.music('music_menu');
      const slots = el.querySelectorAll('.lb-p[data-i]');
      let joined = 1;
      const order = U.shuffle([...slots]);
      const step = Math.max(40, 2200 / order.length);
      order.forEach((s, i) => setTimeout(() => {
        s.classList.add('in');
        joined++;
        $('.lb-c', el).textContent = joined;
        GS.Audio.ui('ui_hover', 0.4);
        if (joined === size) {
          $('.lb-status', el).innerHTML = '<span class="ok">ALL PLAYERS READY — EVERYONE SPINS THEIR ROULETTE</span>';
          GS.Audio.play('ui_open', { bus: 'ui' });
          setTimeout(() => this.roulette(), 1100);
        }
      }, 300 + i * step + Math.random() * step * 0.5));
    },

    roulette() {
      GS.UI.show('roulette');
      GS.Roulette.open(GS.UI.screens.roulette, { bots: this.bots }, (res) => this.summary(res));
    },

    summary(res) {
      this.loadout = {
        hp: res.hp, speed: res.speed, damage: res.damage,
        main: res.main, secondary: res.secondary, knife: res.knife,
      };
      const lo = this.loadout;
      const el = GS.UI.screens.summary;
      const sk = (kind, d) => kind === 'knife' ? (GS.KNIFE_SKINS[d] || GS.KNIFE_SKINS.default).name : (GS.SKINS[d] || GS.SKINS.default).name;
      const rc = (kind, d) => kind === 'knife' ? GS.RARITIES.knife.color : GS.RARITIES[(GS.SKINS[d] || GS.SKINS.default).rarity].color;
      const stat = (label, val, cls, i) => `<div class="lo-card stat ${cls}" style="--d:${i * 0.12}s"><div class="lo-l">${label}</div><div class="lo-v">${val}</div></div>`;
      const item = (label, kind, id, d, i) => `<div class="lo-card item" style="--d:${i * 0.12}s;--rc:${rc(kind, d)}"><div class="lo-l">${label}</div><img src="${GS.Studio.iconURL(kind, id, d)}"><div class="lo-n">${kind === 'knife' ? '★ ' + GS.KNIVES[id].name : GS.WEAPONS[id].name}</div><div class="lo-s">${sk(kind, d)}</div></div>`;
      const hpCls = lo.hp <= 15 ? 'bad' : lo.hp >= 175 ? 'good' : '';
      el.innerHTML = `<div class="summary">
        <div class="sm-t">ROUND LOADOUT</div>
        <div class="lo-grid">
          ${stat('HP', lo.hp, hpCls, 0)}
          ${stat('SPEED', 'x' + lo.speed.toFixed(1), lo.speed <= 0.5 ? 'bad' : lo.speed >= 2.2 ? 'good' : '', 1)}
          ${stat('DAMAGE', 'x' + lo.damage.toFixed(1), lo.damage <= 0.7 ? 'bad' : lo.damage >= 2 ? 'good' : '', 2)}
          ${item('MAIN', 'gun', lo.main.id, lo.main.design, 3)}
          ${item('SECONDARY', 'gun', lo.secondary.id, lo.secondary.design, 4)}
          ${item('KNIFE', 'knife', lo.knife.id, lo.knife.design, 5)}
        </div>
        <button class="btn primary big sm-go" data-sfx>CHOOSE YOUR MAP ▶</button>
      </div>`;
      GS.UI.show('summary');
      GS.Audio.play('reveal_big', { bus: 'ui', vol: 0.6 });
      let gone = false;
      const go = () => { if (gone) return; gone = true; this.vote(); };
      $('.sm-go', el).onclick = go;
      setTimeout(() => { if (GS.UI.current === 'summary') go(); }, 7000);
    },

    vote() {
      const el = GS.UI.screens.vote;
      const maps = ['neon', 'desert'];
      const votes = { neon: [], desert: [] };
      let mine = null;
      el.innerHTML = `<div class="vote">
        <div class="vt-t">CHOOSE YOUR MAP</div>
        <div class="vt-s">Every player gets one vote. Most votes wins — ties are decided by the house.</div>
        <div class="vt-maps">${maps.map((m) => `<button class="vt-map" data-m="${m}" style="--mc:${GS.MAPS[m].color}">
            <div class="vt-img" style="background-image:url(${GS.App.mapThumb(m)})"></div>
            <div class="vt-info"><div class="vt-tag">${GS.MAPS[m].tag}</div><div class="vt-n">${GS.MAPS[m].name}</div><div class="vt-d">${GS.MAPS[m].desc}</div></div>
            <div class="vt-bar"><i></i></div><div class="vt-cnt">0</div><div class="vt-dots"></div><div class="vt-you">YOUR VOTE</div>
          </button>`).join('')}</div>
        <div class="vt-timer"><span>10</span></div>
      </div>`;
      GS.UI.show('vote');
      const total = this.size;
      const render = () => {
        for (const m of maps) {
          const card = $(`.vt-map[data-m="${m}"]`, el);
          $('.vt-cnt', card).textContent = votes[m].length;
          $('.vt-bar i', card).style.width = (votes[m].length / total * 100) + '%';
          $('.vt-dots', card).innerHTML = votes[m].map((c) => `<i style="background:${c}"></i>`).join('');
          card.classList.toggle('mine', mine === m);
        }
      };
      for (const b of el.querySelectorAll('.vt-map')) {
        b.onclick = () => {
          if (mine) return;
          mine = b.dataset.m;
          votes[mine].push('#00ffd0');
          GS.Audio.ui('ui_equip');
          el.classList.add('voted');
          render();
          check();
        };
      }
      // bots vote over time
      const timers = [];
      for (const bot of this.bots) {
        timers.push(setTimeout(() => {
          const m = Math.random() < 0.5 ? 'neon' : 'desert';
          votes[m].push(bot.color);
          GS.Audio.tick(1.2, 0.25);
          render();
          check();
        }, 600 + Math.random() * 7800));
      }
      let left = 10;
      const tEl = $('.vt-timer span', el);
      const iv = setInterval(() => {
        left--;
        tEl.textContent = Math.max(0, left);
        if (left <= 3 && left > 0) GS.Audio.play('countdown', { bus: 'ui', vol: 0.4 });
        if (left <= 0) finish();
      }, 1000);
      let finished = false;
      const check = () => {
        if (votes.neon.length + votes.desert.length >= total) setTimeout(finish, 700);
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        clearInterval(iv);
        timers.forEach(clearTimeout);
        const a = votes.neon.length, b = votes.desert.length;
        let win = a > b ? 'neon' : b > a ? 'desert' : null;
        const done = (w) => {
          for (const c of el.querySelectorAll('.vt-map')) c.classList.toggle('win', c.dataset.m === w);
          for (const c of el.querySelectorAll('.vt-map')) c.classList.toggle('lose', c.dataset.m !== w);
          GS.Audio.play('reveal', { bus: 'ui', vol: 0.8 });
          $('.vt-s', el).textContent = (a === b ? 'TIE — THE HOUSE DECIDES: ' : 'WINNER: ') + GS.MAPS[w].name;
          setTimeout(() => this.load(w), 1600);
        };
        if (win) done(win);
        else {
          // tie flip
          win = Math.random() < 0.5 ? 'neon' : 'desert';
          let k = 0;
          const cards = [...el.querySelectorAll('.vt-map')];
          const flip = setInterval(() => {
            cards.forEach((c, i) => c.classList.toggle('flip', i === k % 2));
            GS.Audio.tick(1, 0.6);
            k++;
            if (k > 9 && cards[(k - 1) % 2].dataset.m === win) { clearInterval(flip); cards.forEach((c) => c.classList.remove('flip')); done(win); }
          }, 140);
        }
      };
      render();
    },

    async load(mapId) {
      this.mapId = mapId;
      const el = GS.UI.screens.load;
      const m = GS.MAPS[mapId];
      el.innerHTML = `<div class="load" style="--mc:${m.color};background-image:linear-gradient(180deg,rgba(5,5,12,.55),rgba(5,5,12,.95)),url(${GS.App.mapThumb(mapId)})">
        <div class="ld-tag">${m.tag}</div><div class="ld-n">${m.name}</div>
        <div class="ld-bar"><i></i></div><div class="ld-st">Loading map…</div>
        <div class="ld-tip"><b>TIP</b> ${U.pick(GS.TIPS)}</div></div>`;
      GS.UI.show('load');
      GS.Audio.music(null, 1.5);
      const bar = $('.ld-bar i', el), st = $('.ld-st', el);
      const prog = async (p, text) => { bar.style.width = (p * 100) + '%'; st.textContent = text; await U.nextFrame(); await U.wait(60); };
      await prog(0.15, 'Building ' + m.name + '…');
      await GS.App.prepareMap(mapId);
      await prog(0.45, 'Spawning ' + this.size + ' players…');
      const g = S().d.settings.game;
      const match = new GS.Match(GS.App, {
        size: this.size, mapId, map: GS.App.map, loadout: this.loadout,
        bots: this.bots, difficulty: g.difficulty, duration: g.roundTime || 240,
        playerName: g.playerName || 'YOU',
        onEnd: (r) => this.results(r),
      });
      this.match = match;
      match.setup();
      await prog(0.75, 'Compiling shaders…');
      GS.App.startMatch(match);
      GS.App.compile();
      await prog(1, 'Ready');
      await U.wait(250);
      GS.UI.show('deploy');
      GS.UI.screens.deploy.innerHTML = `<div class="deploy"><div class="dp-n">${m.name}</div><div class="dp-b">CLICK TO DEPLOY</div>
        <div class="dp-h">WASD move · SPACE jump · SHIFT sprint · CTRL crouch · 1/2/3 weapons · R reload · F inspect · TAB scoreboard · ESC pause</div></div>`;
      GS.UI.screens.deploy.onclick = () => this.deploy();
    },
    deploy() {
      GS.Input.lock();
      GS.Audio.unlock();
      GS.UI.screens.deploy.onclick = null;
      GS.UI.show('none');
      GS.App.paused = false;
      GS.Input.active = true;
      if (S().d.settings.graphics.fullscreen) GS.App.enterFullscreen();
    },
    pause() {
      if (!this.match || this.match.state === 'over' || this.match.state === 'ending') return;
      GS.App.paused = true;
      GS.Input.active = false;
      const el = GS.UI.screens.pause;
      el.innerHTML = `<div class="pause glass"><div class="ps-t">PAUSED</div>
        <button class="btn primary big" data-a="resume" data-sfx>RESUME</button>
        <button class="btn big" data-a="settings" data-sfx>SETTINGS</button>
        <button class="btn danger big" data-a="leave" data-sfx>LEAVE MATCH</button>
        <div class="ps-n">Leaving forfeits the round and its token reward.</div></div>`;
      GS.UI.show('pause');
      el.onclick = (e) => {
        const b = e.target.closest('[data-a]');
        if (!b) return;
        if (b.dataset.a === 'resume') this.resume();
        else if (b.dataset.a === 'settings') GS.UI.openSettings('pause');
        else if (b.dataset.a === 'leave') this.leave();
      };
    },
    resume() {
      GS.UI.show('none');
      GS.Input.lock();
      GS.Input.active = true;
      GS.App.paused = false;
    },
    leave() {
      if (this.match) { this.match.dispose(); this.match = null; }
      GS.App.endMatch();
      GS.Input.active = false;
      GS.Input.unlock();
      GS.UI.openMenu();
    },

    results(r) {
      this.lastResults = r;
      GS.Input.active = false;
      GS.Input.unlock();
      const el = GS.UI.screens.results;
      const top = r.standings.slice(0, 3);
      const podium = [1, 0, 2].map((i) => top[i]).filter(Boolean);
      el.innerHTML = `<div class="results">
        <div class="rs-t">MATCH RESULTS</div>
        <div class="rs-s">${GS.MAPS[r.mapId].name} · ${r.size} PLAYER FFA · YOU PLACED <b>#${r.place}</b></div>
        <div class="podium">${podium.map((c) => { const p = r.standings.indexOf(c) + 1; return `<div class="pd p${p} ${c.isPlayer ? 'me' : ''}"><div class="pd-n" style="color:${c.color}">${U.esc(c.name)}</div><div class="pd-k">${c.kills} KILLS</div><div class="pd-b"><span>${p}</span></div></div>`; }).join('')}</div>
        <div class="rs-list glass">${r.standings.map((c, i) => `<div class="rs-row ${c.isPlayer ? 'me' : ''}" style="--d:${Math.min(i, 15) * 0.04}s"><span class="rk">${i + 1}.</span><span class="nm"><i style="background:${c.color}"></i>${U.esc(c.name)}</span><span class="lo">${c.hp} HP · x${c.speed.toFixed(1)} · x${c.damage.toFixed(1)} · ${U.esc(c.main)}</span><span class="kd">${c.kills} <em>KILLS</em></span><span class="dd">${c.deaths} <em>DEATHS</em></span></div>`).join('')}</div>
        <button class="btn primary big rs-go" data-sfx>CONTINUE ▶</button>
      </div>`;
      if (this.match) { this.match.dispose(); this.match = null; }
      GS.App.endMatch(true);
      GS.UI.show('results');
      GS.Audio.music('music_menu');
      if (r.place === 1) { GS.Audio.play('reveal_big', { bus: 'ui' }); GS.Audio.speak('Victory'); }
      $('.rs-go', el).onclick = () => this.rewards(r);
    },

    rewards(r) {
      const won = r.place === 1;
      const rw = GS.rewardFor(r.place, r.size, r.player.kills, r.player.headshots, won);
      const st = S().d.stats;
      st.matches++;
      if (won) st.wins++;
      st.kills += r.player.kills;
      st.deaths += r.player.deaths;
      st.headshots += r.player.headshots;
      st.bestKills = Math.max(st.bestKills, r.player.kills);
      st.playTime += r.duration;
      S().d.shop.seed++;
      S().d.shop.bought = [];
      const before = S().d.tokens;
      S().addTokens(rw.total);
      const el = GS.UI.screens.rewards;
      const line = (l, v, i) => `<div class="rw-l" style="--d:${0.2 + i * 0.25}s"><span>${l}</span><b data-to="${v}">+0</b></div>`;
      el.innerHTML = `<div class="rewards glass">
        <div class="rw-t">TOKEN REWARD</div>
        <div class="rw-place">#${r.place} <span>of ${r.size}</span></div>
        <div class="rw-lines">
          ${line('Placement #' + r.place, rw.placement, 0)}
          ${line(r.player.kills + ' Eliminations × 8', rw.kills, 1)}
          ${line(r.player.headshots + ' Headshots × 3', rw.headshots, 2)}
          ${rw.win ? line('Victory bonus', rw.win, 3) : ''}
        </div>
        <div class="rw-total"><span>TOTAL</span><b class="rw-tv">+0</b></div>
        <div class="rw-bal">BALANCE <i class="tok-ic"></i><b class="rw-bv">${S().isDev() ? '∞' : U.fmtNum(before)}</b></div>
        <div class="rw-btns"><button class="btn primary big" data-a="again" data-sfx>PLAY AGAIN</button><button class="btn big" data-a="shop" data-sfx>SHOP</button><button class="btn ghost big" data-a="menu" data-sfx>MAIN MENU</button></div>
      </div>`;
      GS.UI.show('rewards');
      // count-up animation
      const lines = el.querySelectorAll('.rw-l b');
      lines.forEach((b, i) => {
        const to = +b.dataset.to;
        setTimeout(() => {
          const t0 = performance.now();
          const tick = () => {
            const k = Math.min(1, (performance.now() - t0) / 500);
            b.textContent = '+' + Math.round(to * U.ease.outCubic(k));
            if (k < 1) requestAnimationFrame(tick);
          };
          tick();
          GS.Audio.play('coin', { bus: 'ui', vol: 0.7 });
        }, 200 + i * 250);
      });
      setTimeout(() => {
        const tv = $('.rw-tv', el), bv = $('.rw-bv', el);
        const t0 = performance.now();
        const tick = () => {
          const k = Math.min(1, (performance.now() - t0) / 900);
          const v = Math.round(rw.total * U.ease.outCubic(k));
          tv.textContent = '+' + v;
          if (!S().isDev()) bv.textContent = U.fmtNum(before + v);
          if (k < 1) requestAnimationFrame(tick);
        };
        tick();
        GS.Audio.play('ui_buy', { bus: 'ui', vol: 0.8 });
      }, 300 + lines.length * 250);
      el.onclick = (e) => {
        const b = e.target.closest('[data-a]');
        if (!b) return;
        const a = b.dataset.a;
        GS.App.showMenuScene();
        if (a === 'again') this.startLobby(r.size);
        else if (a === 'shop') GS.UI.openShop('cases');
        else GS.UI.openMenu();
      };
    },
  });
  void F;
})();
