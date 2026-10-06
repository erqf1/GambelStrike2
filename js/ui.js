'use strict';
// GambelStrike 2 — menus: main menu, play setup, shop, cases, inventory, settings, secret codes
(function () {
  const U = GS.U;
  const $ = (s, r = document) => r.querySelector(s);
  const S = () => GS.Save;

  function statBars(def) {
    const shells = def.shellReload ? (def.reloadStart || 0.4) + def.reload * def.mag : def.reload;
    const st = {
      DAMAGE: U.clamp((def.dmg * (def.pellets || 1)) / 1.25, 5, 100),
      'FIRE RATE': U.clamp((def.rpm / 1100) * 100, 5, 100),
      ACCURACY: U.clamp(100 - def.adsSpread * 6000 - def.spread * 400, 8, 100),
      MOBILITY: U.clamp(((def.mobility - 0.75) / 0.35) * 100, 5, 100),
      'RELOAD SPEED': U.clamp(100 - ((shells - 1.2) / 2.0) * 100, 8, 100),
    };
    return Object.entries(st).map(([k, v]) => `<div class="stat"><span>${k}</span><div class="bar"><i style="width:${v.toFixed(0)}%"></i></div><b>${Math.round(v)}</b></div>`).join('');
  }
  function rarityOf(kind, design) { return kind === 'knife' ? 'knife' : (GS.SKINS[design] || GS.SKINS.default).rarity; }
  function skinName(kind, design) { return kind === 'knife' ? (GS.KNIFE_SKINS[design] || GS.KNIFE_SKINS.default).name : (GS.SKINS[design] || GS.SKINS.default).name; }
  function tokenHTML(n) { return `<span class="tok"><i class="tok-ic"></i>${n}</span>`; }

  const UI = (GS.UI = {
    current: null,
    stack: [],
    init() {
      this.$ui = $('#ui');
      this.screens = {};
      for (const el of this.$ui.querySelectorAll('.screen')) this.screens[el.id.replace('scr-', '')] = el;
      // global button feedback
      document.addEventListener('mouseover', (e) => {
        const b = e.target.closest('.btn, .card-sel, .tab, .mcard');
        if (b && b !== this._hov && !b.disabled) { this._hov = b; GS.Audio.ui('ui_hover', 0.5); }
        if (!b) this._hov = null;
      });
      document.addEventListener('mousedown', (e) => {
        const b = e.target.closest('.btn, .card-sel, .tab, .mcard');
        if (b && !b.disabled) GS.Audio.ui('ui_click', 0.7);
      });
      document.addEventListener('mousemove', (e) => {
        const b = e.target.closest('.btn, .mcard, .menu-btn');
        if (!b) return;
        const r = b.getBoundingClientRect();
        b.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        b.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
        b.style.setProperty('--tx', (((e.clientX - r.left) / r.width - 0.5) * 6).toFixed(2) + 'px');
        b.style.setProperty('--ty', (((e.clientY - r.top) / r.height - 0.5) * 4).toFixed(2) + 'px');
      });
      document.addEventListener('mouseout', (e) => {
        const b = e.target.closest && e.target.closest('.btn, .mcard, .menu-btn');
        if (b && !b.contains(e.relatedTarget)) { b.style.setProperty('--tx', '0px'); b.style.setProperty('--ty', '0px'); }
      });
      S().onChange(() => this.refreshTokens());
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && !GS.Input.capture) this.back();
      });
      this.buildMenu();
    },
    show(name, opts = {}) {
      const next = this.screens[name] || null; // unknown name (e.g. 'none') hides every screen
      const prev = this.current && this.screens[this.current];
      if (prev && prev !== next) {
        prev.classList.remove('active');
        prev.classList.add('leaving');
        setTimeout(() => prev.classList.remove('leaving'), 350);
      }
      if (next) next.classList.add('active');
      if (!opts.keep) this.prev = this.current;
      this.current = name;
      if (name !== 'shop' && name !== 'inv' && name !== 'case') GS.Studio.hide();
      this.refreshTokens();
      document.body.dataset.screen = name;
    },
    back() {
      const c = this.current;
      if (this.$modal && this.$modal.classList.contains('on')) { this.closeModal(); return; }
      if (['shop', 'inv', 'play'].includes(c)) { GS.Audio.ui('ui_back'); this.show('menu'); }
      else if (c === 'settings') { GS.Audio.ui('ui_back'); this.show(this.settingsReturn || 'menu'); }
      else if (c === 'case' && !GS.Cases.running) { GS.Studio.hide(); this.show('shop'); this.renderShop(); }
    },
    toast(text, cls = '') {
      const t = document.createElement('div');
      t.className = 'gtoast ' + cls;
      t.innerHTML = text;
      $('#toasts').appendChild(t);
      setTimeout(() => t.classList.add('out'), 2400);
      setTimeout(() => t.remove(), 2900);
    },
    refreshTokens() {
      const v = S().isDev() ? '∞' : U.fmtNum(S().tokens);
      for (const el of document.querySelectorAll('[data-tokens]')) el.textContent = v;
      document.body.classList.toggle('devmode', S().isDev());
    },
    topbar(title, back = true) {
      return `<div class="topbar">
        ${back ? `<button class="btn ghost back" data-back data-sfx>‹ BACK</button>` : '<span></span>'}
        <div class="tb-title">${title}</div>
        <div class="tb-right"><div class="tokens glass"><i class="tok-ic"></i><span data-tokens>0</span><em class="dev-badge">SANDBOX</em></div></div>
      </div>`;
    },
    _wireBack(root) {
      for (const b of root.querySelectorAll('[data-back]')) b.onclick = () => this.back();
    },

    // ================================================================ MAIN MENU
    buildMenu() {
      const el = this.screens.menu;
      el.innerHTML = `
        <div class="menu-left">
          <div class="logo"><div class="logo-a">GAMBEL<span>STRIKE</span></div><div class="logo-b">2</div><div class="logo-tag">SPIN · DROP · FRAG</div></div>
          <nav class="menu-nav">
            <button class="menu-btn primary" data-go="play"><span class="mb-i">▶</span><span class="mb-t">START</span><span class="mb-s">10 / 25 player free-for-all</span></button>
            <button class="menu-btn" data-go="shop"><span class="mb-i">◆</span><span class="mb-t">SHOP</span><span class="mb-s">Weapons · Skins · Cases</span></button>
            <button class="menu-btn" data-go="inv"><span class="mb-i">▣</span><span class="mb-t">INVENTORY</span><span class="mb-s">Equip skins & knives</span></button>
            <button class="menu-btn" data-go="settings"><span class="mb-i">⚙</span><span class="mb-t">SETTINGS</span><span class="mb-s">Graphics · Sound · Controls</span></button>
          </nav>
          <div class="menu-foot">v${GS.VERSION} · offline vs bots · no real money, ever</div>
        </div>
        <div class="menu-right">
          <div class="tokens glass big"><i class="tok-ic"></i><span data-tokens>0</span><em class="dev-badge">SANDBOX</em></div>
          <div class="career glass"></div>
          <div class="arsenal glass"></div>
        </div>`;
      for (const b of el.querySelectorAll('[data-go]')) {
        b.onclick = () => {
          const g = b.dataset.go;
          if (g === 'play') this.openPlay();
          else if (g === 'shop') this.openShop();
          else if (g === 'inv') this.openInv();
          else if (g === 'settings') this.openSettings('menu');
        };
      }
    },
    openMenu() {
      const st = S().d.stats;
      const kd = (st.kills / Math.max(1, st.deaths)).toFixed(2);
      $('.career', this.screens.menu).innerHTML = `<div class="ch">CAREER</div>
        <div class="cgrid">
          <div><b>${st.matches}</b><span>MATCHES</span></div><div><b>${st.wins}</b><span>WINS</span></div>
          <div><b>${st.kills}</b><span>KILLS</span></div><div><b>${kd}</b><span>K/D</span></div>
          <div><b>${st.casesOpened}</b><span>CASES</span></div><div><b>${st.knivesFound}</b><span>KNIVES FOUND</span></div>
          <div><b>${st.bestKills}</b><span>BEST ROUND</span></div><div><b>${st.headshots}</b><span>HEADSHOTS</span></div>
        </div>`;
      const owned = S().d.weapons.length, knives = S().d.knives.length;
      const skins = S().allSkins().reduce((a, s) => a + s.count, 0);
      $('.arsenal', this.screens.menu).innerHTML = `<div class="ch">ARSENAL</div>
        <div class="ars"><span><b>${owned}</b>/${Object.keys(GS.WEAPONS).length} WEAPONS</span><span><b>${knives}</b>/${GS.KNIFE_IDS.length} KNIVES</span><span><b>${skins}</b> SKINS</span></div>
        <div class="ars-icons">${S().ownedKnives().slice(-3).map((k) => `<img src="${GS.Studio.iconURL('knife', k, S().equipped(k))}">`).join('')}</div>`;
      this.show('menu');
      GS.Audio.music('music_menu');
    },

    // ================================================================ PLAY SETUP
    openPlay() {
      const el = this.screens.play;
      const g = S().d.settings.game;
      const last = S().d.lastLobby || 10;
      el.innerHTML = `${this.topbar('START')}
        <div class="play-wrap">
          <div class="mode-cards">
            ${[10, 25].map((n) => `<button class="mcard ${n === last ? 'sel' : ''}" data-size="${n}">
              <div class="mc-n">${n}</div><div class="mc-t">PLAYER FFA</div>
              <div class="mc-d">${n === 10 ? 'Tight and personal. Every player rolls their own roulette — learn who is the 1 HP glass cannon.' : 'Pure chaos. 25 loadouts, 25 sets of stats, two maps built to hold the crowd.'}</div>
              <div class="mc-dots">${'<i></i>'.repeat(n)}</div></button>`).join('')}
          </div>
          <div class="play-opts glass">
            <div class="opt"><span>BOT DIFFICULTY</span><div class="seg" data-k="difficulty">${['easy', 'normal', 'hard'].map((d) => `<button class="${g.difficulty === d ? 'on' : ''}" data-v="${d}">${d.toUpperCase()}</button>`).join('')}</div></div>
            <div class="opt"><span>ROUND LENGTH</span><div class="seg" data-k="roundTime">${[180, 240, 360].map((t) => `<button class="${g.roundTime === t ? 'on' : ''}" data-v="${t}">${t / 60} MIN</button>`).join('')}</div></div>
            <button class="btn primary big go" data-sfx>FIND MATCH ▶</button>
          </div>
        </div>`;
      this._wireBack(el);
      let size = last;
      for (const c of el.querySelectorAll('.mcard')) c.onclick = () => { size = +c.dataset.size; for (const o of el.querySelectorAll('.mcard')) o.classList.toggle('sel', o === c); };
      for (const sg of el.querySelectorAll('.seg')) {
        sg.onclick = (e) => {
          const b = e.target.closest('button');
          if (!b) return;
          const k = sg.dataset.k;
          g[k] = k === 'roundTime' ? +b.dataset.v : b.dataset.v;
          S().save();
          for (const o of sg.children) o.classList.toggle('on', o === b);
        };
      }
      $('.go', el).onclick = () => { S().d.lastLobby = size; S().save(); GS.Flow.startLobby(size); };
      this.show('play');
    },

    // ================================================================ SHOP
    openShop(tab) {
      this.shopTab = tab || this.shopTab || 'weapons';
      this.renderShop();
      this.show('shop');
    },
    renderShop() {
      const el = this.screens.shop;
      el.innerHTML = `${this.topbar('SHOP')}
        <button class="code-btn" title="Code">CODE</button>
        <div class="tabs">${['weapons', 'skins', 'cases'].map((t) => `<button class="tab ${this.shopTab === t ? 'on' : ''}" data-t="${t}">${t.toUpperCase()}</button>`).join('')}</div>
        <div class="shop-body"></div>`;
      this._wireBack(el);
      $('.code-btn', el).onclick = () => this.openCode();
      for (const t of el.querySelectorAll('.tab')) t.onclick = () => { this.shopTab = t.dataset.t; GS.Studio.hide(); this.renderShop(); };
      const body = $('.shop-body', el);
      if (this.shopTab === 'weapons') this._shopWeapons(body);
      else if (this.shopTab === 'skins') this._shopSkins(body);
      else this._shopCases(body);
      this.refreshTokens();
    },
    _shopWeapons(body) {
      const ids = Object.keys(GS.WEAPONS);
      const sel = this.shopSel && GS.WEAPONS[this.shopSel] ? this.shopSel : ids.find((i) => !S().ownsWeapon(i)) || ids[0];
      this.shopSel = sel;
      body.innerHTML = `<div class="split">
        <div class="grid items">${['main', 'secondary'].map((slot) => `<div class="grid-h">${slot === 'main' ? 'MAIN WEAPONS' : 'SECONDARY'}</div>` + ids.filter((i) => GS.WEAPONS[i].slot === slot).map((id) => {
          const d = GS.WEAPONS[id], own = S().ownsWeapon(id);
          return `<button class="card-sel ${id === sel ? 'sel' : ''} ${own ? 'owned' : ''}" data-id="${id}"><img src="${GS.Studio.iconURL('gun', id, S().equipped(id))}"><div class="cs-n">${d.name}</div><div class="cs-c">${d.cls}</div><div class="cs-p">${own ? 'OWNED' : tokenHTML(U.fmtNum(d.price))}</div></button>`;
        }).join('')).join('')}</div>
        <div class="detail glass">
          <div class="stage"></div>
          <div class="d-info"></div>
        </div></div>`;
      const showSel = (id) => {
        this.shopSel = id;
        for (const c of body.querySelectorAll('.card-sel')) c.classList.toggle('sel', c.dataset.id === id);
        const d = GS.WEAPONS[id], own = S().ownsWeapon(id);
        GS.Studio.show($('.stage', body), 'gun', id, S().equipped(id));
        $('.d-info', body).innerHTML = `<div class="d-cls">${d.cls.toUpperCase()} · ${d.slot === 'main' ? 'SLOT 1' : 'SLOT 2'}</div><div class="d-name">${d.name}</div>
          <div class="stats">${statBars(d)}</div>
          <div class="d-meta"><span>${d.dmg}${d.pellets ? '×' + d.pellets : ''} DMG</span><span>${d.rpm} RPM</span><span>${d.mag} MAG</span><span>${d.auto ? 'AUTO' : d.burst ? 'BURST' : 'SEMI'}</span></div>
          ${own ? `<div class="owned-tag">✓ OWNED — appears in your roulette</div>` : `<button class="btn primary big buy" data-sfx>UNLOCK · ${tokenHTML(U.fmtNum(d.price))}</button>`}
          <div class="d-hint">Drag to rotate · scroll to zoom</div>`;
        const b = $('.buy', body);
        if (b) b.onclick = () => {
          if (!S().spend(d.price)) { GS.Audio.ui('ui_error'); this.toast('Not enough tokens', 'red'); return; }
          S().unlockWeapon(id);
          GS.Audio.ui('ui_buy');
          this.toast(`<b>${d.name}</b> unlocked — it can now land on your roulette`, 'gold');
          this._shopWeapons(body);
        };
      };
      for (const c of body.querySelectorAll('.card-sel')) c.onclick = () => showSel(c.dataset.id);
      showSel(sel);
    },
    skinOffers() {
      const sh = S().d.shop;
      const rng = U.rng(sh.seed * 7777 + 13);
      const guns = S().d.weapons.slice().sort();
      const designs = Object.keys(GS.SKINS).filter((d) => d !== 'default');
      const offers = [];
      const tiers = ['common', 'common', 'uncommon', 'uncommon', 'rare', 'rare', 'epic', 'legendary'];
      for (let i = 0; i < 8; i++) {
        const tier = tiers[i];
        const pool = designs.filter((d) => GS.SKINS[d].rarity === tier);
        const design = pool[Math.floor(rng() * pool.length)];
        const item = guns[Math.floor(rng() * guns.length)];
        offers.push({ i, item, design, rarity: tier, price: GS.RARITIES[tier].price });
      }
      return offers;
    },
    _shopSkins(body) {
      const offers = this.skinOffers();
      const bought = S().d.shop.bought || [];
      body.innerHTML = `<div class="skins-head"><div><b>DAILY SKIN OFFERS</b><span>For weapons you own. New offers after every match.</span></div></div>
        <div class="grid offers">${offers.map((o) => {
          const rar = GS.RARITIES[o.rarity];
          const sold = bought.includes(o.i);
          return `<div class="offer ${o.rarity} ${sold ? 'sold' : ''}" style="--rc:${rar.color}">
            <div class="of-r">${rar.name}</div>
            <img src="${GS.Studio.iconURL('gun', o.item, o.design)}">
            <div class="of-w">${GS.WEAPONS[o.item].name}</div><div class="of-n">${GS.SKINS[o.design].name}</div>
            <div class="of-own">${S().skinCount(o.item, o.design) ? 'OWNED ×' + S().skinCount(o.item, o.design) : ''}</div>
            <button class="btn ${sold ? 'ghost' : 'primary'} small" data-i="${o.i}" ${sold ? 'disabled' : ''} data-sfx>${sold ? 'SOLD' : 'BUY · ' + tokenHTML(U.fmtNum(o.price))}</button>
          </div>`;
        }).join('')}</div>`;
      for (const b of body.querySelectorAll('.offer button[data-i]')) {
        b.onclick = () => {
          const o = offers[+b.dataset.i];
          if (!S().spend(o.price)) { GS.Audio.ui('ui_error'); this.toast('Not enough tokens', 'red'); return; }
          S().addSkin(o.item, o.design);
          S().d.shop.bought = (S().d.shop.bought || []).concat(o.i);
          S().save();
          GS.Audio.ui('ui_buy');
          this.toast(`<b>${GS.WEAPONS[o.item].name} | ${GS.SKINS[o.design].name}</b> added to inventory`, 'gold');
          this._shopSkins(body);
        };
      }
    },
    _shopCases(body) {
      const sel = this.caseSel || 'origin';
      this.caseSel = sel;
      const cases = Object.values(GS.CASES);
      body.innerHTML = `<div class="cases-row">${cases.map((c) => {
        const top = c.designs.slice().sort((a, b) => GS.RARITIES[GS.SKINS[b].rarity].order - GS.RARITIES[GS.SKINS[a].rarity].order).slice(0, 3);
        const guns = S().d.weapons;
        return `<button class="case-card ${c.id === sel ? 'sel' : ''}" data-id="${c.id}" style="--cc:${c.color};--ca:${c.accent}">
          <div class="case-art">${top.map((d, i) => `<img style="--i:${i}" src="${GS.Studio.iconURL('gun', guns[(i * 3) % guns.length], d)}">`).join('')}<div class="case-star">★</div></div>
          <div class="case-n">${c.name}</div><div class="case-p">${tokenHTML(c.price)}</div></button>`;
      }).join('')}</div>
      <div class="case-detail glass"></div>`;
      const showCase = (id) => {
        this.caseSel = id;
        for (const c of body.querySelectorAll('.case-card')) c.classList.toggle('sel', c.dataset.id === id);
        const c = GS.CASES[id];
        const cont = GS.Cases.contents(c);
        const guns = S().d.weapons;
        $('.case-detail', body).innerHTML = `
          <div class="cd-top"><div><div class="cd-n">${c.name}</div><div class="cd-d">${c.desc} Skins drop for weapons you own.</div></div>
            <div class="cd-btns"><button class="btn primary big" data-n="1" data-sfx>OPEN 1 · ${tokenHTML(c.price)}</button><button class="btn big" data-n="5" data-sfx>OPEN 5 · ${tokenHTML(c.price * 5)}</button></div></div>
          <div class="cd-odds">${GS.RARITY_ORDER.map((r) => `<span style="--rc:${GS.RARITIES[r].color}"><i></i>${GS.RARITIES[r].name} ${GS.DROP_ODDS[r]}%</span>`).join('')}</div>
          <div class="cd-grid">${cont.map((x, i) => `<div class="cd-it" style="--rc:${GS.RARITIES[x.rarity].color}"><img src="${GS.Studio.iconURL('gun', guns[i % guns.length], x.design)}"><span>${GS.SKINS[x.design].name}</span></div>`).join('')}
            <div class="cd-it knife" style="--rc:${GS.RARITIES.knife.color}"><div class="star">★</div><span>Rare Special Item</span></div></div>
          <div class="cd-note">OPEN 5 costs exactly 5 × OPEN 1 and rolls five independent results with the same odds.</div>`;
        for (const b of body.querySelectorAll('.cd-btns .btn')) {
          b.onclick = () => {
            const n = +b.dataset.n;
            if (!S().canAfford(c.price * n)) { GS.Audio.ui('ui_error'); this.toast('Not enough tokens — win some matches!', 'red'); return; }
            GS.Studio.hide();
            this.show('case');
            const ok = GS.Cases.open(this.screens.case, c.id, n, () => { this.show('shop'); this.renderShop(); });
            if (!ok) this.show('shop');
          };
        }
      };
      for (const c of body.querySelectorAll('.case-card')) c.onclick = () => showCase(c.dataset.id);
      showCase(sel);
    },

    // ================================================================ CODE
    openCode() {
      const m = this.$modal || (this.$modal = $('#modal'));
      m.innerHTML = `<div class="modal-box glass">
        <div class="mb-t">ENTER CODE</div>
        <input class="code-in" maxlength="24" spellcheck="false" autocomplete="off" placeholder="________________">
        <div class="mb-msg"></div>
        <div class="mb-btns"><button class="btn primary redeem" data-sfx>REDEEM</button><button class="btn ghost close" data-sfx>CLOSE</button></div></div>`;
      m.classList.add('on');
      const inp = $('.code-in', m);
      setTimeout(() => inp.focus(), 50);
      inp.oninput = () => GS.Audio.ui('ui_type', 0.6);
      const redeem = () => {
        const code = inp.value.trim().toLowerCase();
        const r = S().redeem(code);
        const msg = $('.mb-msg', m);
        if (!r.ok) {
          msg.textContent = 'INVALID CODE';
          msg.className = 'mb-msg bad';
          const box = $('.modal-box', m);
          box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
          GS.Audio.ui('ui_error');
          return;
        }
        this.closeModal();
        if (r.kind === 'knives') this.unlockAnim('ALL KNIVES UNLOCKED', 'knives');
        else this.unlockAnim(r.already ? 'SANDBOX ALREADY ACTIVE' : '∞ TOKENS', 'tokens');
        this.refreshTokens();
        if (this.current === 'shop') this.renderShop();
      };
      $('.redeem', m).onclick = redeem;
      inp.onkeydown = (e) => { if (e.key === 'Enter') redeem(); e.stopPropagation(); };
      $('.close', m).onclick = () => this.closeModal();
      m.onclick = (e) => { if (e.target === m) this.closeModal(); };
    },
    closeModal() { if (this.$modal) { this.$modal.classList.remove('on'); this.$modal.innerHTML = ''; } },
    unlockAnim(title, kind) {
      const el = $('#unlock-anim');
      let inner = '';
      if (kind === 'knives') {
        inner = `<div class="ua-row">${GS.KNIFE_IDS.map((k, i) => `<img style="--i:${i}" src="${GS.Studio.iconURL('knife', k, S().equipped(k))}">`).join('')}</div>`;
        GS.Audio.play('drop_knife', { bus: 'ui', vol: 1 });
        GS.Audio.speak('All knives unlocked');
      } else {
        inner = `<div class="ua-inf">∞</div><div class="ua-sub">Sandbox / developer mode: unlimited tokens for this local save. Not connected to real money.</div>`;
        GS.Audio.play('drop_epic', { bus: 'ui', vol: 1 });
      }
      el.innerHTML = `<div class="ua-rays"></div><div class="ua-t">${title}</div>${inner}<div class="ua-hint">click to continue</div>`;
      el.className = 'on ' + kind;
      el.onclick = () => { el.className = ''; el.innerHTML = ''; };
      setTimeout(() => { if (el.classList.contains('on')) el.onclick(); }, 5200);
    },

    // ================================================================ INVENTORY
    openInv(tab) {
      this.invTab = tab || this.invTab || 'main';
      this.renderInv();
      this.show('inv');
    },
    renderInv() {
      const el = this.screens.inv;
      el.innerHTML = `${this.topbar('INVENTORY')}
        <div class="tabs">${[['main', 'MAIN'], ['secondary', 'SECONDARY'], ['knives', 'KNIVES'], ['skins', 'SKINS']].map(([t, n]) => `<button class="tab ${this.invTab === t ? 'on' : ''}" data-t="${t}">${n}</button>`).join('')}</div>
        <div class="inv-body"></div>`;
      this._wireBack(el);
      for (const t of el.querySelectorAll('.tab')) t.onclick = () => { this.invTab = t.dataset.t; GS.Studio.hide(); this.renderInv(); };
      const body = $('.inv-body', el);
      if (this.invTab === 'skins') this._invSkins(body);
      else this._invItems(body, this.invTab);
      this.refreshTokens();
    },
    _invItems(body, tab) {
      const isKnife = tab === 'knives';
      const ids = isKnife ? GS.KNIFE_IDS : tab === 'main' ? GS.MAINS : GS.SECONDARIES;
      const owns = (id) => (isKnife ? S().ownsKnife(id) : S().ownsWeapon(id));
      const sorted = ids.slice().sort((a, b) => owns(b) - owns(a));
      let sel = this.invSel && sorted.includes(this.invSel) ? this.invSel : sorted[0];
      body.innerHTML = `<div class="split">
        <div class="grid items">${sorted.map((id) => {
          const own = owns(id);
          const name = isKnife ? GS.KNIVES[id].name : GS.WEAPONS[id].name;
          const design = S().equipped(id);
          return `<button class="card-sel ${own ? 'owned' : 'locked'} ${isKnife ? 'kn' : ''}" data-id="${id}"><img src="${GS.Studio.iconURL(isKnife ? 'knife' : 'gun', id, design)}"><div class="cs-n">${isKnife ? '★ ' : ''}${name}</div><div class="cs-c">${own ? skinName(isKnife ? 'knife' : 'gun', design) : 'LOCKED'}</div></button>`;
        }).join('')}</div>
        <div class="detail glass"><div class="stage"></div><div class="d-info"></div></div></div>`;
      const showSel = (id, design) => {
        sel = id; this.invSel = id;
        for (const c of body.querySelectorAll('.card-sel')) c.classList.toggle('sel', c.dataset.id === id);
        const own = owns(id);
        const kind = isKnife ? 'knife' : 'gun';
        const eq = S().equipped(id);
        const skins = own ? S().ownedSkinsFor(id) : ['default'];
        const cur = design || eq;
        GS.Studio.show($('.stage', body), kind, id, cur);
        const def = isKnife ? GS.KNIVES[id] : GS.WEAPONS[id];
        const rar = GS.RARITIES[rarityOf(kind, cur)];
        $('.d-info', body).innerHTML = `
          <div class="d-cls">${isKnife ? 'KNIFE · SLOT 3' : def.cls.toUpperCase()}</div>
          <div class="d-name">${isKnife ? '★ ' : ''}${def.name}</div>
          <div class="d-skin" style="color:${cur === 'default' && !isKnife ? '#9aa6b5' : rar.color}">${skinName(kind, cur)} <em>${cur === 'default' && !isKnife ? '' : rar.name}</em></div>
          ${isKnife ? `<div class="d-desc">${def.desc}</div>` : `<div class="stats">${statBars(def)}</div>`}
          <div class="sk-h">YOUR SKINS (${skins.length})</div>
          <div class="sk-list">${skins.map((d) => `<button class="sk ${d === cur ? 'sel' : ''} ${d === eq ? 'eq' : ''}" data-d="${d}" style="--rc:${GS.RARITIES[rarityOf(kind, d)].color}"><img src="${GS.Studio.iconURL(kind, id, d)}"><span>${skinName(kind, d)}</span>${d === eq ? '<b>EQUIPPED</b>' : ''}</button>`).join('')}</div>
          ${own ? (cur === eq ? `<div class="owned-tag">✓ EQUIPPED — used automatically when the roulette lands on it</div>` : `<button class="btn primary big equip" data-sfx>EQUIP</button>`) : `<div class="locked-tag">${isKnife ? 'Unlock from a case drop (★) or a secret code.' : 'Unlock this weapon in the shop.'}</div>`}`;
        for (const b of body.querySelectorAll('.sk')) b.onclick = () => showSel(id, b.dataset.d);
        const e = $('.equip', body);
        if (e) e.onclick = () => {
          S().equip(id, cur);
          GS.Audio.ui('ui_equip');
          this.toast(`Equipped <b>${skinName(kind, cur)}</b>`, '');
          this._invItems(body, tab);
        };
      };
      for (const c of body.querySelectorAll('.card-sel')) c.onclick = () => showSel(c.dataset.id);
      showSel(sel);
    },
    _invSkins(body) {
      const list = S().allSkins();
      list.sort((a, b) => {
        const ra = GS.RARITIES[a.item in GS.KNIVES ? 'knife' : GS.SKINS[a.design].rarity].order;
        const rb = GS.RARITIES[b.item in GS.KNIVES ? 'knife' : GS.SKINS[b.design].rarity].order;
        return rb - ra;
      });
      if (!list.length) {
        body.innerHTML = `<div class="empty glass"><b>No skins yet.</b><span>Open cases or buy daily offers in the shop. Every match pays tokens.</span><button class="btn primary" data-sfx>GO TO SHOP</button></div>`;
        $('.btn', body).onclick = () => this.openShop('cases');
        return;
      }
      let sel = 0;
      body.innerHTML = `<div class="split"><div class="grid items skins">${list.map((s, i) => {
        const kind = s.item in GS.KNIVES ? 'knife' : 'gun';
        const rar = GS.RARITIES[rarityOf(kind, s.design)];
        const name = kind === 'knife' ? '★ ' + GS.KNIVES[s.item].name : GS.WEAPONS[s.item].name;
        return `<button class="card-sel skin" data-i="${i}" style="--rc:${rar.color}"><img src="${GS.Studio.iconURL(kind, s.item, s.design)}"><div class="cs-n">${name}</div><div class="cs-c" style="color:${rar.color}">${skinName(kind, s.design)}</div>${s.count > 1 ? `<div class="cnt">×${s.count}</div>` : ''}${S().equipped(s.item) === s.design ? '<div class="eqb">E</div>' : ''}</button>`;
      }).join('')}</div><div class="detail glass"><div class="stage"></div><div class="d-info"></div></div></div>`;
      const showSel = (i) => {
        sel = i;
        const s = list[i];
        for (const c of body.querySelectorAll('.card-sel')) c.classList.toggle('sel', +c.dataset.i === i);
        const kind = s.item in GS.KNIVES ? 'knife' : 'gun';
        const rarKey = rarityOf(kind, s.design);
        const rar = GS.RARITIES[rarKey];
        const usable = kind === 'knife' ? S().ownsKnife(s.item) : S().ownsWeapon(s.item);
        const eq = S().equipped(s.item) === s.design;
        GS.Studio.show($('.stage', body), kind, s.item, s.design);
        $('.d-info', body).innerHTML = `
          <div class="d-cls" style="color:${rar.color}">${rar.name}</div>
          <div class="d-name">${kind === 'knife' ? '★ ' + GS.KNIVES[s.item].name : GS.WEAPONS[s.item].name}</div>
          <div class="d-skin" style="color:${rar.color}">${skinName(kind, s.design)} <em>×${s.count}</em></div>
          <div class="d-desc">Cosmetic only — no gameplay advantage.</div>
          <div class="d-btns">
            ${eq ? `<div class="owned-tag">✓ EQUIPPED</div>` : usable ? `<button class="btn primary equip" data-sfx>EQUIP</button>` : `<div class="locked-tag">Unlock the weapon to use this skin.</div>`}
            <button class="btn ghost scrap" data-sfx>SCRAP · +${tokenHTML(rar.scrap)}</button>
          </div>`;
        const e = $('.equip', body);
        if (e) e.onclick = () => { S().equip(s.item, s.design); GS.Audio.ui('ui_equip'); this._invSkins(body); };
        $('.scrap', body).onclick = () => {
          if (eq && s.count <= 1 && !confirm('This skin is equipped. Scrap it anyway?')) return;
          S().removeSkin(s.item, s.design);
          S().addTokens(rar.scrap);
          GS.Audio.play('coin', { bus: 'ui', vol: 0.8 });
          this.toast(`Scrapped for <b>+${rar.scrap}</b> tokens`, 'gold');
          this._invSkins(body);
        };
      };
      for (const c of body.querySelectorAll('.card-sel')) c.onclick = () => showSel(+c.dataset.i);
      showSel(sel);
    },

    // ================================================================ SETTINGS
    openSettings(ret) {
      this.settingsReturn = ret || 'menu';
      this.setTab = this.setTab || 'graphics';
      this.renderSettings();
      this.show('settings', { keep: true });
    },
    renderSettings() {
      const el = this.screens.settings;
      const s = S().d.settings;
      const sel = (path, opts) => {
        const [grp, key] = path.split('.');
        return `<div class="seg" data-p="${path}">${opts.map(([v, n]) => `<button class="${String(s[grp][key]) === String(v) ? 'on' : ''}" data-v="${v}">${n}</button>`).join('')}</div>`;
      };
      const tog = (path) => { const [g, k] = path.split('.'); return `<label class="toggle"><input type="checkbox" data-p="${path}" ${s[g][k] ? 'checked' : ''}><span></span></label>`; };
      const sld = (path, min, max, step, fmt) => { const [g, k] = path.split('.'); return `<div class="slider"><input type="range" data-p="${path}" min="${min}" max="${max}" step="${step}" value="${s[g][k]}"><output>${fmt(s[g][k])}</output></div>`; };
      const pct = (v) => Math.round(v * 100) + '%';
      const row = (label, ctrl, hint = '') => `<div class="srow"><div class="sl"><b>${label}</b>${hint ? `<span>${hint}</span>` : ''}</div><div class="sc">${ctrl}</div></div>`;
      let body = '';
      if (this.setTab === 'graphics') {
        body = [
          row('Resolution', sel('graphics.resolution', [['native', 'NATIVE'], ['1080', '1080p'], ['900', '900p'], ['720', '720p'], ['540', '540p']]), 'Render resolution'),
          row('Fullscreen', tog('graphics.fullscreen')),
          row('VSync', tog('graphics.vsync'), 'Browsers always sync to the display; off removes the frame cap below.'),
          row('FPS Limit', sel('graphics.fpsLimit', [[0, 'UNLIMITED'], [30, '30'], [60, '60'], [120, '120'], [144, '144']])),
          row('Texture Quality', sel('graphics.texture', [['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH']]), 'Applies on next map load'),
          row('Shadow Quality', sel('graphics.shadows', [['off', 'OFF'], ['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH']])),
          row('Effects Quality', sel('graphics.effects', [['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH']]), 'Bloom & particles'),
          row('Anti-Aliasing', sel('graphics.aa', [['off', 'OFF'], ['fxaa', 'FXAA'], ['msaa', 'MSAA 4×']])),
          row('Field of View', sld('graphics.fov', 80, 120, 1, (v) => v + '°'), 'Horizontal'),
          row('Motion Blur', tog('graphics.motionBlur')),
          row('Damage Numbers', tog('graphics.dmgNumbers')),
          row('Show FPS', tog('graphics.showFps')),
        ].join('');
      } else if (this.setTab === 'sound') {
        body = [
          row('Master Volume', sld('sound.master', 0, 1, 0.01, pct)),
          row('Music', sld('sound.music', 0, 1, 0.01, pct)),
          row('Weapon Sounds', sld('sound.weapons', 0, 1, 0.01, pct)),
          row('Effects', sld('sound.effects', 0, 1, 0.01, pct)),
          row('UI Sounds', sld('sound.ui', 0, 1, 0.01, pct)),
          row('Voice Chat / Announcer', sld('sound.voice', 0, 1, 0.01, pct), 'Offline mode: controls the announcer voice'),
        ].join('');
      } else if (this.setTab === 'controls') {
        const b = s.controls.binds;
        body = [
          row('Mouse Sensitivity', sld('controls.sens', 0.1, 4, 0.05, (v) => (+v).toFixed(2))),
          row('ADS Sensitivity', sld('controls.adsSens', 0.2, 2, 0.05, (v) => (+v).toFixed(2))),
          row('Invert Y', tog('controls.invertY')),
          `<div class="binds">${GS.ACTIONS.map(([a, n]) => `<div class="bind"><span>${n}</span><button class="key" data-a="${a}">${GS.Input.keyName(b[a])}</button></div>`).join('')}</div>`,
          `<div class="bind-foot"><span>Tip: some browsers close the tab on Ctrl+W. Fullscreen (F11 or the setting above) lets the game capture it — or rebind crouch to C.</span><button class="btn ghost small reset-binds" data-sfx>RESET TO DEFAULT</button></div>`,
        ].join('');
      } else {
        body = [
          row('Player Name', `<input class="txt" data-p="game.playerName" maxlength="16" value="${U.esc(s.game.playerName || 'YOU')}">`),
          row('Auto-Spin Roulette', tog('game.autoSpin')),
          row('Crosshair Color', `<div class="swatches" data-p="game.crosshair">${['#00ffd0', '#ffffff', '#ff2fd0', '#ffd23f', '#4fd18b', '#ff3b5c'].map((c) => `<button class="${s.game.crosshair === c ? 'on' : ''}" data-v="${c}" style="background:${c}"></button>`).join('')}</div>`),
          row('Reset Save', `<button class="btn danger small reset-save" data-sfx>RESET EVERYTHING</button>`, 'Deletes tokens, unlocks, skins and stats on this device'),
        ].join('');
      }
      el.innerHTML = `${this.topbar('SETTINGS')}
        <div class="tabs">${['graphics', 'sound', 'controls', 'game'].map((t) => `<button class="tab ${this.setTab === t ? 'on' : ''}" data-t="${t}">${t.toUpperCase()}</button>`).join('')}</div>
        <div class="set-body glass">${body}</div>`;
      this._wireBack(el);
      this.refreshTokens();
      for (const t of el.querySelectorAll('.tab')) t.onclick = () => { this.setTab = t.dataset.t; this.renderSettings(); };
      const apply = (path, v) => {
        const [g, k] = path.split('.');
        s[g][k] = v;
        S().save();
        GS.App.applySettings(path);
      };
      for (const sg of el.querySelectorAll('.seg[data-p]')) sg.onclick = (e) => {
        const b = e.target.closest('button'); if (!b) return;
        let v = b.dataset.v;
        if (!isNaN(+v) && v !== '') v = +v;
        apply(sg.dataset.p, v);
        for (const o of sg.children) o.classList.toggle('on', o === b);
      };
      for (const t of el.querySelectorAll('input[type=checkbox][data-p]')) t.onchange = () => apply(t.dataset.p, t.checked);
      for (const r of el.querySelectorAll('input[type=range][data-p]')) {
        r.oninput = () => {
          const v = +r.value;
          const p = r.dataset.p;
          r.nextElementSibling.textContent = p.startsWith('sound') ? pct(v) : p === 'graphics.fov' ? v + '°' : v.toFixed(2);
          apply(p, v);
        };
      }
      for (const t of el.querySelectorAll('input.txt[data-p]')) t.onchange = () => apply(t.dataset.p, t.value.trim().slice(0, 16) || 'YOU');
      for (const sw of el.querySelectorAll('.swatches')) sw.onclick = (e) => {
        const b = e.target.closest('button'); if (!b) return;
        apply(sw.dataset.p, b.dataset.v);
        for (const o of sw.children) o.classList.toggle('on', o === b);
      };
      for (const k of el.querySelectorAll('.key[data-a]')) {
        k.onclick = () => {
          k.textContent = 'PRESS A KEY…';
          k.classList.add('wait');
          GS.Input.capture = (code) => {
            GS.Input.capture = null;
            if (code !== 'Escape') {
              const binds = s.controls.binds;
              for (const a in binds) if (binds[a] === code && a !== k.dataset.a) binds[a] = binds[k.dataset.a];
              binds[k.dataset.a] = code;
              S().save();
            }
            this.renderSettings();
          };
        };
      }
      const rb = $('.reset-binds', el);
      if (rb) rb.onclick = () => { s.controls.binds = Object.assign({}, GS.DEFAULT_BINDS); S().save(); this.renderSettings(); };
      const rs = $('.reset-save', el);
      if (rs) rs.onclick = () => {
        if (!confirm('Really reset your whole GambelStrike 2 save?')) return;
        S().reset();
        GS.App.applySettings('all');
        this.toast('Save reset', 'red');
        this.renderSettings();
      };
    },
  });
})();
