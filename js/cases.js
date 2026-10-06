'use strict';
// GambelStrike 2 — case opening: horizontal reel animation, OPEN 1 / OPEN 5, reveal & rewards
(function () {
  const U = GS.U;

  function rollRarity() {
    const keys = GS.RARITY_ORDER;
    return keys[U.weightedIndex(keys.map((k) => GS.DROP_ODDS[k]))];
  }
  function ownedGuns() { return GS.Save.d.weapons.filter((w) => !!GS.WEAPONS[w]); }
  // a real roll for a case (identical odds for every open)
  function roll(caseDef) {
    const rarity = rollRarity();
    if (rarity === 'knife') {
      const knife = U.pick(GS.KNIFE_IDS);
      return { kind: 'knife', item: knife, design: U.pick(GS.KNIFE_SKIN_SETS[knife]), rarity };
    }
    let designs = caseDef.designs.filter((d) => GS.SKINS[d].rarity === rarity);
    if (!designs.length) designs = caseDef.designs;
    return { kind: 'gun', item: U.pick(ownedGuns()), design: U.pick(designs), rarity };
  }
  function itemName(r) {
    if (r.kind === 'knife') return '★ ' + GS.KNIVES[r.item].name + (r.design !== 'default' ? ' | ' + GS.KNIFE_SKINS[r.design].name : '');
    return GS.WEAPONS[r.item].name + ' | ' + GS.SKINS[r.design].name;
  }
  function cardHTML(r, mystery) {
    const rar = GS.RARITIES[r.rarity];
    if (mystery && r.kind === 'knife') {
      return `<div class="cc knife mystery" style="--rc:${rar.color}"><div class="cc-star">★</div><div class="cc-n">RARE SPECIAL ITEM</div></div>`;
    }
    const img = GS.Studio.iconURL(r.kind === 'knife' ? 'knife' : 'gun', r.item, r.design);
    const wn = r.kind === 'knife' ? '★ ' + GS.KNIVES[r.item].name : GS.WEAPONS[r.item].name;
    const sn = r.kind === 'knife' ? GS.KNIFE_SKINS[r.design].name : GS.SKINS[r.design].name;
    return `<div class="cc ${r.rarity}" style="--rc:${rar.color}"><img src="${img}" draggable="false"><div class="cc-w">${U.esc(wn)}</div><div class="cc-n">${U.esc(sn)}</div></div>`;
  }

  const Cases = (GS.Cases = {
    roll, itemName, cardHTML,
    // list of possible items (for the contents grid)
    contents(caseDef) {
      const guns = ownedGuns();
      const out = [];
      for (const d of caseDef.designs) out.push({ design: d, rarity: GS.SKINS[d].rarity, guns });
      out.sort((a, b) => GS.RARITIES[b.rarity].order - GS.RARITIES[a.rarity].order);
      return out;
    },
    // open n cases inside `root`; calls onClose when the player leaves
    open(root, caseId, n, onClose) {
      const c = GS.CASES[caseId];
      const cost = c.price * n;
      if (!GS.Save.spend(cost)) { GS.Audio.ui('ui_error'); return false; }
      const results = [];
      for (let i = 0; i < n; i++) results.push(roll(c));
      // persist immediately (no loss if the tab closes mid-animation)
      for (const r of results) {
        GS.Save.addSkin(r.item, r.design);
        if (r.kind === 'knife') { GS.Save.unlockKnife(r.item); GS.Save.d.stats.knivesFound++; }
      }
      GS.Save.d.stats.casesOpened += n;
      GS.Save.save();
      this.root = root;
      this.results = results;
      this.caseDef = c;
      this.onClose = onClose;
      this.n = n;
      const cardW = n === 1 ? 176 : 132, gap = 8;
      this.stride = cardW + gap;
      const WIN = n === 1 ? 52 : 44;
      this.reels = results.map((r) => {
        const cards = [];
        for (let i = 0; i < WIN + 8; i++) cards.push(i === WIN ? r : roll(c));
        return { cards, win: WIN };
      });
      root.innerHTML = `
        <div class="co ${n === 5 ? 'five' : 'one'}" style="--cw:${cardW}px;--cg:${gap}px;--cc:${c.color}">
          <div class="co-title">${U.esc(c.name)} <span>${n === 5 ? '× 5' : ''}</span></div>
          <div class="co-reels">
            ${this.reels.map((rl, i) => `<div class="co-reel" data-i="${i}"><div class="co-strip">${rl.cards.map((x) => cardHTML(x, true)).join('')}</div><div class="co-marker"></div><div class="co-fade l"></div><div class="co-fade r"></div></div>`).join('')}
          </div>
          <div class="co-flash"></div>
          <div class="co-result"></div>
        </div>`;
      this.$co = root.querySelector('.co');
      const reelEls = root.querySelectorAll('.co-reel');
      this.reels.forEach((rl, i) => {
        rl.el = reelEls[i];
        rl.strip = rl.el.querySelector('.co-strip');
        rl.t = 0;
        rl.dur = (n === 1 ? 6.6 : 5.6) + i * 0.35 + U.rand(-0.15, 0.15);
        rl.offset = U.rand(0.12, 0.88);
        rl.lastIdx = -1;
        rl.done = false;
      });
      this.running = true;
      this.time = 0;
      GS.Audio.play('case_open', { bus: 'ui', vol: 0.8 });
      GS.Audio.duckMusic(0.25);
      requestAnimationFrame(() => {
        this.reels.forEach((rl) => { rl.w = rl.el.clientWidth; });
      });
      return true;
    },
    update(dt) {
      if (!this.running) return;
      this.time += dt;
      let all = true;
      for (const rl of this.reels) {
        if (rl.done) continue;
        all = false;
        if (!rl.w) rl.w = rl.el.clientWidth;
        rl.t = Math.min(rl.dur, rl.t + dt);
        const u = rl.t / rl.dur;
        const e = 1 - Math.pow(1 - u, 4.2);
        const end = rl.win * this.stride + rl.offset * (this.stride - 8) - rl.w / 2;
        const x = end * e;
        rl.strip.style.transform = `translate3d(${-x}px,0,0)`;
        const idx = Math.floor((x + rl.w / 2) / this.stride);
        if (idx !== rl.lastIdx) {
          if (rl.lastIdx >= 0) GS.Audio.tick(1 + (1 - u) * 0.3, this.n === 5 ? 0.35 : 0.6, 'case_tick');
          rl.lastIdx = idx;
        }
        // camera zoom near the end
        if (this.n === 1) this.$co.style.setProperty('--zoom', (1 + U.smoothstep(0.75, 1, u) * 0.07).toFixed(4));
        if (rl.t >= rl.dur) {
          rl.done = true;
          const card = rl.strip.children[rl.win];
          // reveal the real card (knives were masked as mystery cards)
          card.outerHTML = cardHTML(rl.cards[rl.win], false);
          rl.strip.children[rl.win].classList.add('win');
          GS.Audio.play('wheel_stop', { bus: 'ui', vol: 0.5 });
        }
      }
      if (all) {
        this.running = false;
        this._reveal();
      }
    },
    _reveal() {
      const res = this.results;
      const best = res.reduce((a, b) => (GS.RARITIES[b.rarity].order > GS.RARITIES[a.rarity].order ? b : a));
      const ord = GS.RARITIES[best.rarity].order;
      const flash = this.root.querySelector('.co-flash');
      flash.style.setProperty('--fc', GS.RARITIES[best.rarity].color);
      flash.classList.add('on');
      GS.Audio.play('flash', { bus: 'ui', vol: 0.6 });
      if (best.rarity === 'knife') { GS.Audio.play('drop_knife', { bus: 'ui', vol: 1 }); GS.Audio.speak('Knife!'); }
      else if (ord >= 4) GS.Audio.play('drop_epic', { bus: 'ui', vol: 0.9 });
      else if (ord >= 2) GS.Audio.play('drop_rare', { bus: 'ui', vol: 0.8 });
      else GS.Audio.play('drop_common', { bus: 'ui', vol: 0.8 });
      GS.Audio.duckMusic(1, 1.5);
      const out = this.root.querySelector('.co-result');
      const rar = GS.RARITIES[best.rarity];
      setTimeout(() => {
        this.$co.classList.add('revealed');
        if (this.n === 1) {
          const r = res[0];
          out.innerHTML = `
            <div class="cr-one ${r.rarity}" style="--rc:${rar.color}">
              <div class="cr-rays"></div>
              <div class="cr-stage"></div>
              <div class="cr-info">
                <div class="cr-rar">${rar.name}</div>
                <div class="cr-name">${U.esc(itemName(r))}</div>
                <div class="cr-note">Added to your inventory</div>
                <div class="cr-btns">
                  <button class="btn primary" data-act="equip" data-sfx>EQUIP</button>
                  <button class="btn" data-act="again" data-sfx>OPEN ANOTHER</button>
                  <button class="btn ghost" data-act="close" data-sfx>BACK</button>
                </div>
              </div>
            </div>`;
          GS.Studio.show(out.querySelector('.cr-stage'), r.kind === 'knife' ? 'knife' : 'gun', r.item, r.design);
        } else {
          out.innerHTML = `
            <div class="cr-five">
              <div class="cr-grid">${res.map((r, i) => `<div class="cr-card ${r.rarity}${r === best ? ' best' : ''}" style="--rc:${GS.RARITIES[r.rarity].color};--d:${i * 0.09}s">${cardHTML(r, false)}<div class="cr-r">${GS.RARITIES[r.rarity].name}</div><button class="btn small" data-act="equip" data-i="${i}" data-sfx>EQUIP</button></div>`).join('')}</div>
              <div class="cr-btns">
                <button class="btn" data-act="again" data-sfx>OPEN 5 AGAIN</button>
                <button class="btn ghost" data-act="close" data-sfx>BACK</button>
              </div>
            </div>`;
        }
        out.classList.add('on');
        out.onclick = (e) => {
          const b = e.target.closest('[data-act]');
          if (!b) return;
          const act = b.dataset.act;
          if (act === 'equip') {
            const r = res[b.dataset.i ? +b.dataset.i : 0];
            GS.Save.equip(r.item, r.design);
            GS.Audio.ui('ui_equip');
            b.textContent = 'EQUIPPED';
            b.disabled = true;
          } else if (act === 'again') {
            GS.Studio.hide();
            if (!GS.Save.canAfford(this.caseDef.price * this.n)) { GS.UI && GS.UI.toast('Not enough tokens', 'red'); GS.Audio.ui('ui_error'); return; }
            this.open(this.root, this.caseDef.id, this.n, this.onClose);
          } else if (act === 'close') {
            GS.Studio.hide();
            this.root.innerHTML = '';
            if (this.onClose) this.onClose();
          }
        };
      }, 450);
    },
  });
  void Cases;
})();
