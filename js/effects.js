'use strict';
// GambelStrike 2 — visual effects: GPU point particles, tracers, decals, shells, flashes, damage numbers
(function () {
  const U = GS.U;
  const V3 = THREE.Vector3;
  const tmp = new V3(), tmp2 = new V3();

  class PSys {
    constructor(max, blending, map) {
      this.max = max;
      this.n = 0;
      const F = Float32Array;
      this.p = new F(max * 3); this.v = new F(max * 3); this.c = new F(max * 4);
      this.life = new F(max); this.maxLife = new F(max); this.s0 = new F(max); this.s1 = new F(max);
      this.a0 = new F(max); this.drag = new F(max); this.grav = new F(max);
      this.posAttr = new F(max * 3); this.colAttr = new F(max * 4); this.sizeAttr = new F(max);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.posAttr, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('pcolor', new THREE.BufferAttribute(this.colAttr, 4).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('size', new THREE.BufferAttribute(this.sizeAttr, 1).setUsage(THREE.DynamicDrawUsage));
      g.setDrawRange(0, 0);
      this.geo = g;
      this.mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: map }, uScale: { value: 500 } },
        vertexShader: `uniform float uScale; attribute float size; attribute vec4 pcolor; varying vec4 vC;
          void main(){ vC = pcolor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(256.0, size * uScale / max(0.05, -mv.z)); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform sampler2D map; varying vec4 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb * t.rgb, vC.a * t.a); }`,
        transparent: true, depthWrite: false, blending,
      });
      this.points = new THREE.Points(g, this.mat);
      this.points.frustumCulled = false;
      this.points.renderOrder = blending === THREE.AdditiveBlending ? 6 : 5;
    }
    spawn(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, drag = 1, grav = 0) {
      let i;
      if (this.n < this.max) i = this.n++;
      else i = Math.floor(Math.random() * this.max);
      this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
      this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
      this.life[i] = life; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1;
      this.c[i * 4] = r; this.c[i * 4 + 1] = g; this.c[i * 4 + 2] = b; this.a0[i] = a;
      this.drag[i] = drag; this.grav[i] = grav;
    }
    update(dt) {
      let i = 0;
      while (i < this.n) {
        this.life[i] -= dt;
        if (this.life[i] <= 0) {
          const j = --this.n;
          if (i !== j) this._copy(j, i);
          continue;
        }
        const d = Math.pow(this.drag[i], dt * 60);
        this.v[i * 3] *= d; this.v[i * 3 + 1] = this.v[i * 3 + 1] * d - this.grav[i] * dt; this.v[i * 3 + 2] *= d;
        this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
        const t = 1 - this.life[i] / this.maxLife[i];
        this.posAttr[i * 3] = this.p[i * 3]; this.posAttr[i * 3 + 1] = this.p[i * 3 + 1]; this.posAttr[i * 3 + 2] = this.p[i * 3 + 2];
        this.colAttr[i * 4] = this.c[i * 4]; this.colAttr[i * 4 + 1] = this.c[i * 4 + 1]; this.colAttr[i * 4 + 2] = this.c[i * 4 + 2];
        this.colAttr[i * 4 + 3] = this.a0[i] * (1 - t) * Math.min(1, t * 12 + 0.2);
        this.sizeAttr[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
        i++;
      }
      this.geo.setDrawRange(0, this.n);
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.pcolor.needsUpdate = true;
      this.geo.attributes.size.needsUpdate = true;
    }
    _copy(from, to) {
      for (let k = 0; k < 3; k++) { this.p[to * 3 + k] = this.p[from * 3 + k]; this.v[to * 3 + k] = this.v[from * 3 + k]; this.posAttr[to * 3 + k] = this.posAttr[from * 3 + k]; }
      for (let k = 0; k < 4; k++) { this.c[to * 4 + k] = this.c[from * 4 + k]; this.colAttr[to * 4 + k] = this.colAttr[from * 4 + k]; }
      this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from]; this.s0[to] = this.s0[from]; this.s1[to] = this.s1[from];
      this.a0[to] = this.a0[from]; this.drag[to] = this.drag[from]; this.grav[to] = this.grav[from]; this.sizeAttr[to] = this.sizeAttr[from];
    }
    clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
  }

  const SURF_COL = {
    concrete: [0.55, 0.53, 0.5], asphalt: [0.3, 0.3, 0.32], metal: [0.35, 0.36, 0.4], wood: [0.5, 0.36, 0.22], sand: [0.78, 0.66, 0.48],
  };

  class Effects {
    constructor(scene) {
      this.scene = scene;
      this.quality = 'high';
      this.add = new PSys(2500, THREE.AdditiveBlending, GS.Tex.glow());
      this.alpha = new PSys(900, THREE.NormalBlending, GS.Tex.smoke());
      scene.add(this.add.points, this.alpha.points);
      // tracers
      this.tracers = [];
      const tg = new THREE.BoxGeometry(1, 1, 1);
      tg.translate(0, 0, 0.5);
      for (let i = 0; i < 48; i++) {
        const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.visible = false; m.frustumCulled = false;
        scene.add(m);
        this.tracers.push({ m, t: 0, life: 0 });
      }
      this.ti = 0;
      // decals
      this.decals = [];
      const dg = new THREE.PlaneGeometry(0.13, 0.13);
      const dm = new THREE.MeshBasicMaterial({ map: GS.Tex.bulletHole(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, color: 0x202020 });
      for (let i = 0; i < 160; i++) {
        const m = new THREE.Mesh(dg, dm);
        m.visible = false; m.renderOrder = 2; m.matrixAutoUpdate = false;
        scene.add(m);
        this.decals.push(m);
      }
      this.di = 0;
      // shells
      this.shells = [];
      const sg = new THREE.CylinderGeometry(0.0055, 0.0055, 0.03, 8);
      for (let i = 0; i < 40; i++) {
        const m = new THREE.Mesh(sg, GS.Mats.brass);
        m.visible = false;
        scene.add(m);
        this.shells.push({ m, v: new V3(), w: new V3(), life: 0, bounced: 0, floor: 0, snd: false });
      }
      this.si = 0;
      // world muzzle flashes + lights
      this.flashes = [];
      for (let i = 0; i < 16; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GS.Tex.flash(), color: new THREE.Color(5, 3.6, 2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        s.visible = false;
        scene.add(s);
        this.flashes.push({ s, t: 0 });
      }
      this.fi = 0;
      this.lights = [];
      for (let i = 0; i < 3; i++) {
        const l = new THREE.PointLight(0xffa850, 0, 9, 2);
        scene.add(l);
        this.lights.push({ l, t: 0 });
      }
      this.li = 0;
      this.dmgLayer = document.getElementById('dmg-layer');
      this.nums = [];
      this.emitT = 0;
    }
    setQuality(q) { this.quality = q; }
    get mul() { return this.quality === 'low' ? 0.4 : this.quality === 'medium' ? 0.7 : 1; }
    reset() {
      this.add.clear(); this.alpha.clear();
      for (const t of this.tracers) { t.m.visible = false; t.life = 0; }
      for (const d of this.decals) d.visible = false;
      for (const s of this.shells) { s.m.visible = false; s.life = 0; }
      for (const f of this.flashes) { f.s.visible = false; f.t = 0; }
      for (const l of this.lights) { l.l.intensity = 0; l.t = 0; }
      for (const n of this.nums) n.el.remove();
      this.nums = [];
    }

    tracer(from, to, color) {
      const tr = this.tracers[this.ti++ % this.tracers.length];
      const d = from.distanceTo(to);
      if (d < 0.5) return;
      const m = tr.m;
      m.position.copy(from);
      m.lookAt(to);
      m.scale.set(0.012, 0.012, d);
      if (color) m.material.color.copy(color); else m.material.color.setRGB(4, 3, 1.6);
      m.visible = true;
      tr.life = tr.t = Math.min(0.08, 0.03 + d / 900);
      m.material.opacity = 1;
    }
    muzzle(pos, big) {
      const f = this.flashes[this.fi++ % this.flashes.length];
      f.s.position.copy(pos);
      f.s.scale.setScalar((big ? 0.9 : 0.55) * U.rand(0.8, 1.2));
      f.s.material.rotation = Math.random() * 6.28;
      f.s.visible = true;
      f.t = 0.05;
      const l = this.lights[this.li++ % this.lights.length];
      l.l.position.copy(pos);
      l.l.intensity = big ? 3 : 2;
      l.t = 0.06;
    }
    impact(p, n, surf, opts = {}) {
      const k = this.mul;
      const col = SURF_COL[surf] || SURF_COL.concrete;
      const ns = surf === 'metal' ? 10 : surf === 'sand' ? 2 : 6;
      for (let i = 0; i < Math.ceil(ns * k); i++) {
        const v = tmp.set(n.x + U.rand(-0.8, 0.8), n.y + U.rand(-0.5, 0.9), n.z + U.rand(-0.8, 0.8)).normalize().multiplyScalar(U.rand(2, 7));
        this.add.spawn(p.x, p.y, p.z, v.x, v.y, v.z, U.rand(0.12, 0.35), 0.05, 0.01, 3, 2, 0.9, 1, 0.92, 9);
      }
      const nd = surf === 'sand' ? 5 : 3;
      for (let i = 0; i < Math.ceil(nd * k); i++) {
        const v = tmp.copy(n).multiplyScalar(U.rand(0.4, 1.6)).add(tmp2.set(U.rand(-0.4, 0.4), U.rand(0, 0.5), U.rand(-0.4, 0.4)));
        this.alpha.spawn(p.x + n.x * 0.05, p.y + n.y * 0.05, p.z + n.z * 0.05, v.x, v.y, v.z, U.rand(0.5, 1.1), 0.12, U.rand(0.5, 0.9), col[0], col[1], col[2], 0.55, 0.94, -0.2);
      }
      this.add.spawn(p.x + n.x * 0.02, p.y + n.y * 0.02, p.z + n.z * 0.02, 0, 0, 0, 0.06, 0.25, 0.05, 3, 2.4, 1.6, 1);
      if (opts.decal !== false) this.decal(p, n);
    }
    decal(p, n) {
      const m = this.decals[this.di++ % this.decals.length];
      m.position.copy(p).addScaledVector(n, 0.004);
      tmp.copy(p).add(n);
      m.lookAt(tmp);
      m.rotateZ(Math.random() * 6.28);
      const s = U.rand(0.8, 1.2);
      m.scale.set(s, s, 1);
      m.updateMatrix();
      m.visible = true;
    }
    hit(p, dir, color, head) {
      const k = this.mul;
      const c = new THREE.Color(color);
      const n = Math.ceil((head ? 18 : 9) * k);
      for (let i = 0; i < n; i++) {
        const v = tmp.set(-dir.x + U.rand(-1, 1), -dir.y + U.rand(-0.4, 1.2), -dir.z + U.rand(-1, 1)).normalize().multiplyScalar(U.rand(1.5, head ? 6 : 4));
        this.add.spawn(p.x, p.y, p.z, v.x, v.y, v.z, U.rand(0.2, 0.45), head ? 0.07 : 0.05, 0.01, c.r * 3, c.g * 3, c.b * 3, 1, 0.9, 6);
      }
      this.add.spawn(p.x, p.y, p.z, 0, 0, 0, 0.08, head ? 0.5 : 0.3, 0.1, 3, 3, 3, 1);
    }
    death(p, color) {
      const k = this.mul;
      const c = new THREE.Color(color);
      for (let i = 0; i < Math.ceil(60 * k); i++) {
        const v = tmp.set(U.rand(-1, 1), U.rand(0.2, 1.6), U.rand(-1, 1)).normalize().multiplyScalar(U.rand(1, 5));
        this.add.spawn(p.x + U.rand(-0.25, 0.25), p.y + U.rand(0, 1.7), p.z + U.rand(-0.25, 0.25), v.x, v.y, v.z, U.rand(0.5, 1.1), U.rand(0.06, 0.14), 0.01, c.r * 2.5, c.g * 2.5, c.b * 2.5, 1, 0.93, 2);
      }
      for (let i = 0; i < Math.ceil(10 * k); i++) {
        this.alpha.spawn(p.x + U.rand(-0.3, 0.3), p.y + U.rand(0.3, 1.5), p.z + U.rand(-0.3, 0.3), U.rand(-0.5, 0.5), U.rand(0.3, 1), U.rand(-0.5, 0.5), U.rand(0.8, 1.4), 0.4, 1.4, c.r * 0.5 + 0.2, c.g * 0.5 + 0.2, c.b * 0.5 + 0.2, 0.5, 0.95, -0.3);
      }
      this.add.spawn(p.x, p.y + 1, p.z, 0, 0, 0, 0.18, 2.2, 0.5, c.r * 3, c.g * 3, c.b * 3, 1);
    }
    spawnFx(p, color) {
      const c = new THREE.Color(color);
      for (let i = 0; i < Math.ceil(36 * this.mul); i++) {
        const a = (i / 36) * Math.PI * 2;
        this.add.spawn(p.x + Math.cos(a) * 0.6, p.y + 0.05, p.z + Math.sin(a) * 0.6, 0, U.rand(1.5, 4), 0, U.rand(0.4, 0.8), 0.07, 0.01, c.r * 2.5, c.g * 2.5, c.b * 2.5, 1, 0.95, 0);
      }
    }
    slashHit(p, color) {
      const c = new THREE.Color(color || '#ffffff');
      for (let i = 0; i < 12; i++) {
        const v = tmp.set(U.rand(-1, 1), U.rand(-0.3, 1), U.rand(-1, 1)).normalize().multiplyScalar(U.rand(2, 5));
        this.add.spawn(p.x, p.y, p.z, v.x, v.y, v.z, U.rand(0.15, 0.35), 0.05, 0.01, c.r * 3, c.g * 3, c.b * 3, 1, 0.9, 5);
      }
    }
    shell(pos, vel, playSound) {
      const s = this.shells[this.si++ % this.shells.length];
      s.m.position.copy(pos);
      s.v.copy(vel);
      s.w.set(U.rand(-20, 20), U.rand(-20, 20), U.rand(-20, 20));
      s.life = 1.6; s.bounced = 0; s.snd = playSound;
      s.floor = GS.game && GS.game.world ? GS.game.world.floorAt(pos.x, pos.z, pos.y + 0.05) : 0;
      if (s.floor === -Infinity) s.floor = pos.y - 3;
      s.m.visible = true;
    }
    steam(x, y, z) {
      this.alpha.spawn(x + U.rand(-0.3, 0.3), y, z + U.rand(-0.3, 0.3), U.rand(-0.2, 0.2), U.rand(0.8, 1.6), U.rand(-0.2, 0.2), U.rand(2, 3.2), 0.4, 2.2, 0.75, 0.75, 0.82, 0.2, 0.985, -0.2);
    }
    number(pos, amount, head, kill) {
      if (!this.dmgLayer || !GS.Save.d.settings.graphics.dmgNumbers) return;
      const el = document.createElement('div');
      el.className = 'dmgnum' + (head ? ' head' : '') + (kill ? ' kill' : '');
      el.textContent = Math.round(amount);
      this.dmgLayer.appendChild(el);
      this.nums.push({ el, p: pos.clone().add(tmp.set(U.rand(-0.2, 0.2), 0.2, U.rand(-0.2, 0.2))), t: 0, dx: U.rand(-20, 20) });
      if (this.nums.length > 24) this.nums.shift().el.remove();
    }

    update(dt, camera, renderer, emitters) {
      const h = renderer.domElement.height;
      const sc = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      this.add.mat.uniforms.uScale.value = sc;
      this.alpha.mat.uniforms.uScale.value = sc;
      this.add.update(dt);
      this.alpha.update(dt);
      for (const t of this.tracers) {
        if (!t.m.visible) continue;
        t.t -= dt;
        if (t.t <= 0) t.m.visible = false; else t.m.material.opacity = t.t / t.life;
      }
      for (const f of this.flashes) {
        if (!f.s.visible) continue;
        f.t -= dt;
        if (f.t <= 0) f.s.visible = false;
      }
      for (const l of this.lights) {
        if (l.t > 0) { l.t -= dt; if (l.t <= 0) l.l.intensity = 0; }
      }
      for (const s of this.shells) {
        if (s.life <= 0) continue;
        s.life -= dt;
        if (s.life <= 0) { s.m.visible = false; continue; }
        s.v.y -= 9.8 * dt;
        s.m.position.addScaledVector(s.v, dt);
        s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt; s.m.rotation.z += s.w.z * dt;
        if (s.m.position.y < s.floor + 0.006) {
          s.m.position.y = s.floor + 0.006;
          if (Math.abs(s.v.y) > 0.4) {
            if (s.snd && s.bounced < 2) GS.Audio.play('shell', { pos: s.m.position, vol: 0.35, bus: 'weapons' });
            s.bounced++;
          }
          s.v.y = -s.v.y * 0.35; s.v.x *= 0.6; s.v.z *= 0.6; s.w.multiplyScalar(0.6);
        }
      }
      // map emitters
      if (emitters && emitters.length) {
        this.emitT -= dt;
        if (this.emitT <= 0) {
          this.emitT = 0.12 / this.mul;
          for (const e of emitters) if (e.type === 'steam') this.steam(e.x, e.y, e.z);
        }
      }
      // damage numbers
      if (this.nums.length) {
        const w = renderer.domElement.clientWidth, hh = renderer.domElement.clientHeight;
        for (let i = this.nums.length - 1; i >= 0; i--) {
          const n = this.nums[i];
          n.t += dt;
          if (n.t > 0.9) { n.el.remove(); this.nums.splice(i, 1); continue; }
          tmp.copy(n.p).project(camera);
          if (tmp.z > 1) { n.el.style.opacity = 0; continue; }
          const x = (tmp.x * 0.5 + 0.5) * w + n.dx * n.t, y = (-tmp.y * 0.5 + 0.5) * hh - n.t * 60;
          n.el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%) scale(${1 + Math.max(0, 0.25 - n.t) * 2})`;
          n.el.style.opacity = n.t < 0.6 ? 1 : 1 - (n.t - 0.6) / 0.3;
        }
      }
    }
  }

  GS.Effects = Effects;
})();
