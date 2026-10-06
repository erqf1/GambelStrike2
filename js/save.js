'use strict';
// GambelStrike 2 — local save system (localStorage)
(function () {
  const KEY = 'gambelstrike2_save_v1';

  function deepMerge(target, src) {
    for (const k in src) {
      const v = src[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) target[k] = {};
        deepMerge(target[k], v);
      } else if (target[k] === undefined) {
        target[k] = Array.isArray(v) ? v.slice() : v;
      }
    }
    return target;
  }

  function defaults() {
    return {
      version: 1,
      tokens: 600,
      dev: false, // sandbox "freetokens" mode
      weapons: ['ar4', 'vector', 'shotgun', 'r9', 'stinger'],
      knives: ['tactical', 'flip'],
      skins: {}, // "itemId:designId" -> count
      equipped: {}, // itemId -> designId
      codes: [],
      settings: JSON.parse(JSON.stringify(GS.DEFAULT_SETTINGS)),
      stats: {
        matches: 0, wins: 0, kills: 0, deaths: 0, headshots: 0, casesOpened: 0,
        knivesFound: 0, bestKills: 0, tokensEarned: 0, playTime: 0,
      },
      shop: { seed: 1, bought: [] },
      lastLobby: 10,
      created: Date.now(),
    };
  }

  const S = (GS.Save = {
    d: null,
    listeners: [],
    load() {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
      let d = null;
      if (raw) {
        try { d = JSON.parse(raw); } catch (e) { d = null; }
      }
      this.d = deepMerge(d || {}, defaults());
      // sanitize
      const valid = (id) => !!GS.WEAPONS[id];
      this.d.weapons = this.d.weapons.filter(valid);
      for (const w of ['ar4', 'r9']) if (!this.d.weapons.includes(w)) this.d.weapons.push(w);
      this.d.knives = this.d.knives.filter((k) => !!GS.KNIVES[k]);
      if (!this.d.knives.length) this.d.knives.push('tactical');
      for (const a in GS.DEFAULT_BINDS) if (!this.d.settings.controls.binds[a]) this.d.settings.controls.binds[a] = GS.DEFAULT_BINDS[a];
      this.save();
      return this.d;
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* ignore */ }
      for (const fn of this.listeners) { try { fn(this.d); } catch (e) { console.error(e); } }
    },
    onChange(fn) { this.listeners.push(fn); },
    reset() {
      this.d = defaults();
      this.save();
    },

    // ---- tokens
    get tokens() { return this.d.tokens; },
    isDev() { return !!this.d.dev; },
    canAfford(n) { return this.d.dev || this.d.tokens >= n; },
    spend(n) {
      if (this.d.dev) return true;
      if (this.d.tokens < n) return false;
      this.d.tokens -= n;
      this.save();
      return true;
    },
    addTokens(n) {
      this.d.tokens += n;
      this.d.stats.tokensEarned += n;
      this.save();
    },
    tokenLabel() { return this.d.dev ? '∞' : GS.U.fmtNum(this.d.tokens); },

    // ---- ownership
    ownsWeapon(id) { return this.d.weapons.includes(id); },
    unlockWeapon(id) {
      if (!this.ownsWeapon(id)) { this.d.weapons.push(id); this.save(); }
    },
    ownedMains() { return GS.MAINS.filter((id) => this.ownsWeapon(id)); },
    ownedSecondaries() { return GS.SECONDARIES.filter((id) => this.ownsWeapon(id)); },
    ownsKnife(id) { return this.d.knives.includes(id); },
    unlockKnife(id) {
      if (!this.ownsKnife(id)) { this.d.knives.push(id); this.save(); return true; }
      return false;
    },
    ownedKnives() { return GS.KNIFE_IDS.filter((id) => this.ownsKnife(id)); },

    // ---- skins
    skinKey(item, design) { return item + ':' + design; },
    skinCount(item, design) {
      if (design === 'default') return 1;
      return this.d.skins[this.skinKey(item, design)] || 0;
    },
    addSkin(item, design) {
      const k = this.skinKey(item, design);
      this.d.skins[k] = (this.d.skins[k] || 0) + 1;
      this.save();
    },
    removeSkin(item, design) {
      const k = this.skinKey(item, design);
      if (!this.d.skins[k]) return false;
      this.d.skins[k]--;
      if (this.d.skins[k] <= 0) {
        delete this.d.skins[k];
        if (this.d.equipped[item] === design) delete this.d.equipped[item];
      }
      this.save();
      return true;
    },
    ownedSkinsFor(item) {
      const out = ['default'];
      for (const k in this.d.skins) {
        const [it, ds] = k.split(':');
        if (it === item && this.d.skins[k] > 0) out.push(ds);
      }
      return out;
    },
    allSkins() {
      const out = [];
      for (const k in this.d.skins) {
        const [item, design] = k.split(':');
        if (this.d.skins[k] > 0) out.push({ item, design, count: this.d.skins[k] });
      }
      return out;
    },
    equipped(item) {
      const d = this.d.equipped[item];
      if (d && this.skinCount(item, d) > 0) return d;
      return 'default';
    },
    equip(item, design) {
      this.d.equipped[item] = design;
      this.save();
    },

    // ---- codes
    redeem(code) {
      code = String(code || '').trim().toLowerCase();
      if (code === 'knife77') {
        let n = 0;
        for (const k of GS.KNIFE_IDS) if (this.unlockKnife(k)) n++;
        if (!this.d.codes.includes(code)) this.d.codes.push(code);
        this.save();
        return { ok: true, kind: 'knives', count: n };
      }
      if (code === 'freetokens') {
        const was = this.d.dev;
        this.d.dev = true;
        if (!this.d.codes.includes(code)) this.d.codes.push(code);
        this.save();
        return { ok: true, kind: 'tokens', already: was };
      }
      return { ok: false };
    },

    // ---- settings helpers
    get settings() { return this.d.settings; },
    bind(action) { return this.d.settings.controls.binds[action]; },
  });
})();
