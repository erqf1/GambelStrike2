'use strict';
// GambelStrike 2 — application core: renderer, post-processing, menu scene, main loop, settings
(function () {
  const U = GS.U;
  const $ = (s) => document.querySelector(s);

  const FinalShader = {
    uniforms: {
      tDiffuse: { value: null }, exposure: { value: 1.0 }, tint: { value: new THREE.Vector3(1, 1, 1) },
      contrast: { value: 1.05 }, sat: { value: 1.08 }, vignette: { value: 0.4 }, blur: { value: new THREE.Vector2() }, time: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure; uniform vec3 tint; uniform float contrast; uniform float sat; uniform float vignette; uniform vec2 blur; uniform float time; varying vec2 vUv;
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec3 col = texture2D(tDiffuse, vUv).rgb;
        if (dot(blur, blur) > 1e-7) {
          vec3 acc = col;
          for (int i = 1; i < 7; i++) { float t = float(i) / 6.0 - 0.5; acc += texture2D(tDiffuse, vUv + blur * t).rgb; }
          col = acc / 7.0;
        }
        col = aces(col * exposure);
        col = pow(col, vec3(1.0 / 2.2));
        col *= tint;
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(l), col, sat);
        col = (col - 0.5) * contrast + 0.5;
        vec2 d = vUv - 0.5;
        col *= mix(1.0, smoothstep(0.95, 0.25, length(d) * 1.25), vignette);
        col += (hash(vUv * 731.0 + time) - 0.5) * 0.018;
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }`,
  };

  const App = (GS.App = {
    mode: 'boot',
    paused: true,
    maps: {},
    thumbs: {},
    async boot() {
      GS.Save.load();
      const canvas = $('#gl');
      try {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
      } catch (e) {
        $('#boot-status').textContent = 'WebGL is not available in this browser.';
        return;
      }
      THREE.ColorManagement.legacyMode = false;
      const r = this.renderer;
      r.outputEncoding = THREE.sRGBEncoding;
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 900);
      this.camera.rotation.order = 'YXZ';
      GS.Tex.setQuality(GS.Save.d.settings.graphics.texture);
      GS.Mats.init();
      this.vm = new GS.ViewModel();
      this.vm.hidden = true;
      this.effects = new GS.Effects(this.scene);
      this.hud = new GS.Hud();
      GS.Input.init(canvas);
      GS.Input.onLockChange = (locked, failed) => {
        if (failed) { GS.UI.toast('Mouse lock unavailable here — hold the mouse inside the window to aim', 'red'); return; }
        if (!locked && this.match && !this.paused && GS.UI.current === 'none') GS.Flow.pause();
      };
      GS.Studio.init();
      GS.UI.init();
      GS.UI.show('boot');
      window.addEventListener('resize', () => this.resize());
      // Ctrl is crouch: guard against Ctrl+W closing the tab mid-match
      window.addEventListener('beforeunload', (e) => {
        if (this.match && this.mode === 'match') { e.preventDefault(); e.returnValue = ''; }
      });
      this.resize();
      this.last = performance.now();
      const tick = (t) => { requestAnimationFrame(tick); this.loop(t); };
      requestAnimationFrame(tick);
      // ---- loading
      const bar = $('#boot-bar'), st = $('#boot-status');
      const prog = async (p, text) => { bar.style.width = (p * 100).toFixed(0) + '%'; st.textContent = text; await U.nextFrame(); };
      await prog(0.05, 'Synthesising sound bank…');
      GS.Audio.init();
      try { await GS.Audio.build((p) => { bar.style.width = (5 + p * 45).toFixed(0) + '%'; }); } catch (e) { console.warn('audio build failed', e); }
      await prog(0.5, 'Building Neon District…');
      this.maps.neon = GS.Maps.build('neon', r, true);
      await prog(0.68, 'Building Desert Facility…');
      this.maps.desert = GS.Maps.build('desert', r, true);
      await prog(0.82, 'Rendering previews…');
      this.setupPost();
      this.applySettings('all');
      for (const id of ['desert', 'neon']) { this.prepareMap(id); this.mapThumb(id); }
      await prog(0.9, 'Warming up shaders…');
      this.compile();
      for (const k of GS.Save.ownedKnives()) GS.Studio.icon('knife', k, GS.Save.equipped(k));
      await prog(1, 'Ready');
      this.mode = 'menu';
      this.menuT = Math.random() * 100;
      $('#boot').classList.add('ready');
      const start = () => {
        window.removeEventListener('pointerdown', start);
        window.removeEventListener('keydown', start);
        GS.Audio.unlock();
        $('#boot').classList.add('gone');
        setTimeout(() => $('#boot').remove(), 800);
        GS.UI.openMenu();
      };
      window.addEventListener('pointerdown', start);
      window.addEventListener('keydown', start);
    },

    // ---------------------------------------------------------------- post-processing
    setupPost() {
      const r = this.renderer;
      const s = GS.Save.d.settings.graphics;
      const ok = THREE.EffectComposer && THREE.RenderPass && THREE.ShaderPass && THREE.UnrealBloomPass;
      if (this.composer) { this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose(); this.composer = null; }
      if (!ok) {
        console.warn('post-processing unavailable, using direct rendering');
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.0;
        return;
      }
      r.toneMapping = THREE.NoToneMapping;
      const pr = r.getPixelRatio();
      const w = Math.floor(window.innerWidth * pr), h = Math.floor(window.innerHeight * pr);
      const msaa = s.aa === 'msaa' && r.capabilities.isWebGL2 ? 4 : 0;
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: msaa });
      const c = new THREE.EffectComposer(r, rt);
      c.setPixelRatio(pr);
      c.setSize(window.innerWidth, window.innerHeight);
      this.rp = new THREE.RenderPass(this.scene, this.camera);
      this.vmp = new THREE.RenderPass(this.vm.scene, this.vm.camera);
      this.vmp.clear = false;
      this.vmp.clearDepth = true;
      this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.8, 0.5, 0.75);
      this.final = new THREE.ShaderPass(FinalShader);
      this.fxaa = THREE.FXAAShader ? new THREE.ShaderPass(THREE.FXAAShader) : null;
      c.addPass(this.rp);
      c.addPass(this.vmp);
      c.addPass(this.bloom);
      c.addPass(this.final);
      if (this.fxaa) c.addPass(this.fxaa);
      this.composer = c;
      this._postFlags();
      this.resize();
      if (this.map) this._applyMapLook(this.map);
    },
    _postFlags() {
      const s = GS.Save.d.settings.graphics;
      if (!this.composer) return;
      this.bloom.enabled = s.effects !== 'low';
      if (this.fxaa) this.fxaa.enabled = s.aa === 'fxaa';
      // make sure the last enabled pass renders to screen
      const passes = this.composer.passes;
      let last = null;
      for (const p of passes) { p.renderToScreen = false; if (p.enabled) last = p; }
      if (last) last.renderToScreen = true;
    },

    resize() {
      const r = this.renderer;
      if (!r) return;
      const s = GS.Save.d.settings.graphics;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let pr = dpr;
      if (s.resolution !== 'native') pr = Math.min(dpr, (+s.resolution) / Math.max(1, window.innerHeight));
      pr = Math.max(0.35, pr);
      const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
      r.setPixelRatio(pr);
      r.setSize(W, H, false);
      const aspect = W / H;
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      this.vm.resize(aspect);
      if (this.composer) {
        this.composer.setPixelRatio(pr);
        this.composer.setSize(window.innerWidth, window.innerHeight);
        this.bloom.setSize(window.innerWidth * pr / 2, window.innerHeight * pr / 2);
        if (this.fxaa) this.fxaa.material.uniforms.resolution.value.set(1 / (window.innerWidth * pr), 1 / (window.innerHeight * pr));
      }
      if (GS.Roulette.wheel) GS.Roulette.wheel.resize();
    },

    // ---------------------------------------------------------------- maps
    prepareMap(id) {
      const m = this.maps[id] || (this.maps[id] = GS.Maps.build(id, this.renderer, true));
      if (this.map && this.map !== m) this.scene.remove(this.map.group);
      this.map = m;
      if (!m.group.parent) this.scene.add(m.group);
      this.scene.fog = m.fog;
      this.scene.background = m.background;
      this.scene.environment = m.env;
      GS.Mats.setEnv(m.env);
      this.vm.setLighting({ sky: m.vm.sky, ground: m.vm.ground, hemi: m.vm.hemi, sun: m.vm.sun, sunI: m.vm.sunI, sunDir: m.vm.sunDir, env: m.env });
      this.applyShadows();
      this._applyMapLook(m);
      const path = m.menuPath.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      this.menuCurve = new THREE.CatmullRomCurve3(path, true, 'centripetal');
      return m;
    },
    _applyMapLook(m) {
      if (!this.composer) return;
      const q = GS.Save.d.settings.graphics.effects;
      this.bloom.strength = m.bloom.strength * (q === 'medium' ? 0.8 : 1);
      this.bloom.radius = m.bloom.radius;
      this.bloom.threshold = m.bloom.threshold;
      const u = this.final.uniforms;
      u.tint.value.set(m.grade.tint[0], m.grade.tint[1], m.grade.tint[2]);
      u.contrast.value = m.grade.contrast;
      u.sat.value = m.grade.sat;
      u.vignette.value = m.grade.vignette;
      u.exposure.value = m.grade.exposure || 1;
    },
    applyShadows() {
      const s = GS.Save.d.settings.graphics.shadows;
      const r = this.renderer;
      const on = s !== 'off';
      r.shadowMap.enabled = on;
      for (const id in this.maps) {
        const sun = this.maps[id].sun;
        sun.castShadow = on;
        const size = s === 'low' ? 1024 : s === 'high' ? 4096 : 2048;
        if (sun.shadow.mapSize.x !== size) {
          sun.shadow.mapSize.set(size, size);
          if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
        }
      }
    },
    mapThumb(id) {
      if (this.thumbs[id]) return this.thumbs[id];
      const prev = this.map;
      const m = this.prepareMap(id);
      const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 900);
      cam.position.fromArray(m.thumb.pos);
      cam.lookAt(new THREE.Vector3().fromArray(m.thumb.look));
      m.update(1, 0.016, cam);
      this._render(cam, false);
      const c = document.createElement('canvas');
      c.width = 640; c.height = 360;
      const src = this.renderer.domElement;
      if (!src.width || !src.height) { if (prev && prev !== m) this.prepareMap(prev.id); return ''; }
      const sa = src.width / src.height;
      let sw = src.width, sh = src.height, sx = 0, sy = 0;
      if (sa > 16 / 9) { sw = sh * 16 / 9; sx = (src.width - sw) / 2; } else { sh = sw * 9 / 16; sy = (src.height - sh) / 2; }
      c.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, 640, 360);
      this.thumbs[id] = c.toDataURL('image/jpeg', 0.85);
      if (prev && prev !== m) this.prepareMap(prev.id);
      return this.thumbs[id];
    },
    compile() {
      try {
        this.renderer.compile(this.scene, this.camera);
        // pre-build the player's viewmodel items
        if (this.match) {
          const p = this.match.player;
          for (const slot of ['main', 'secondary', 'knife']) {
            const m = this.vm._model(p.item(slot));
            this.vm.scene.add(m.root);
            this.renderer.compile(this.vm.scene, this.vm.camera);
            this.vm.scene.remove(m.root);
          }
          this.vm.equip(p.item(p.slot), true);
        }
      } catch (e) { console.warn(e); }
    },

    // ---------------------------------------------------------------- match lifecycle
    startMatch(match) {
      this.match = match;
      this.mode = 'match';
      this.paused = true;
      this.vm.hidden = false;
    },
    endMatch(keepScene) {
      this.match = null;
      this.mode = 'menu';
      this.paused = true;
      this.vm.hidden = true;
      this.camera.fov = 60;
      this.camera.updateProjectionMatrix();
      this.blurPrev = null;
      void keepScene;
    },
    showMenuScene() { this.mode = 'menu'; },
    enterFullscreen() {
      const el = document.documentElement;
      if (document.fullscreenElement) return;
      const p = el.requestFullscreen ? el.requestFullscreen() : null;
      if (p && p.then) p.then(() => { try { navigator.keyboard && navigator.keyboard.lock && navigator.keyboard.lock(); } catch (e) { /* optional */ } }).catch(() => {});
    },

    applySettings(path) {
      const all = path === 'all';
      const s = GS.Save.d.settings;
      if (all || path.startsWith('sound')) GS.Audio.applyVolumes();
      if (all || path === 'graphics.resolution') this.resize();
      if (path === 'graphics.fullscreen') {
        if (s.graphics.fullscreen) this.enterFullscreen();
        else if (document.fullscreenElement) document.exitFullscreen();
      }
      if (all || path === 'graphics.shadows') this.applyShadows();
      if (all || path === 'graphics.effects') {
        this.effects.setQuality(s.graphics.effects);
        this._postFlags();
        if (this.map) this._applyMapLook(this.map);
      }
      if (path === 'graphics.aa') this.setupPost();
      if (all || path === 'graphics.aa') this._postFlags();
      if (path === 'graphics.texture') GS.UI.toast('Texture quality applies fully after reloading the game', '');
      if (all || path === 'graphics.showFps') { const f = $('#fps'); if (f) f.style.display = s.graphics.showFps ? '' : 'none'; }
      if (path === 'game.crosshair') { const c = $('#crosshair'); if (c) c.style.setProperty('--cc', s.game.crosshair); }
    },

    // ---------------------------------------------------------------- loop
    loop(t) {
      const g = GS.Save.d && GS.Save.d.settings.graphics;
      const limit = g ? (g.vsync && !g.fpsLimit ? 0 : g.fpsLimit) : 0;
      if (limit > 0 && t - this.last < 1000 / limit - 1.5) return;
      const dt = Math.min(0.1, Math.max(0.0001, (t - this.last) / 1000));
      this.last = t;
      this.time = (this.time || 0) + dt;
      if (this.final) this.final.uniforms.time.value = this.time % 100;
      try {
        if (this.mode === 'match' && this.match) {
          if (!this.paused) this.match.update(dt);
          else this.hud.update(0, this.match);
          this._motionBlur(dt);
          this._render(this.camera, !this.vm.hidden && this.match.player.alive);
        } else if (this.mode === 'menu' && this.map) {
          this.menuT += dt;
          const cv = this.menuCurve;
          const u = (this.menuT * 0.008) % 1;
          const p = cv.getPointAt(u), q = cv.getPointAt((u + 0.012) % 1);
          this.camera.position.copy(p);
          this.camera.lookAt(q.x, q.y - 1.2, q.z);
          if (this.camera.fov !== 60) { this.camera.fov = 60; this.camera.updateProjectionMatrix(); }
          this.map.update(this.time, dt, this.camera);
          GS.Mats.update(this.time, dt);
          this.effects.update(dt, this.camera, this.renderer, this.map.builder.emitters);
          if (this.final) this.final.uniforms.blur.value.set(0, 0);
          this._render(this.camera, false);
        }
        if (GS.Roulette.running) GS.Roulette.update(dt);
        if (GS.Cases.running) GS.Cases.update(dt);
        if (GS.Studio.active) { GS.Mats.update(this.time, dt); GS.Studio.render(dt); }
      } catch (e) {
        console.error(e);
      }
      GS.Input.endFrame();
    },
    _motionBlur(dt) {
      if (!this.final) return;
      const on = GS.Save.d.settings.graphics.motionBlur && !this.paused;
      const q = this.camera.quaternion;
      if (!on || !this.blurPrev) {
        this.final.uniforms.blur.value.set(0, 0);
        this.blurPrev = q.clone();
        return;
      }
      const e1 = new THREE.Euler().setFromQuaternion(q, 'YXZ'), e0 = new THREE.Euler().setFromQuaternion(this.blurPrev, 'YXZ');
      const dy = U.wrapAngle(e1.y - e0.y), dp = e1.x - e0.x;
      const k = 0.5 / Math.max(dt * 60, 0.5);
      this.final.uniforms.blur.value.set(U.clamp(-dy * k, -0.03, 0.03), U.clamp(dp * k, -0.03, 0.03));
      this.blurPrev.copy(q);
    },
    _render(cam, withVM) {
      const r = this.renderer;
      if (this.composer) {
        this.rp.camera = cam;
        this.vmp.enabled = !!withVM;
        this._postFlags();
        this.composer.render();
      } else {
        r.autoClear = true;
        r.render(this.scene, cam);
        if (withVM) {
          r.autoClear = false;
          r.clearDepth();
          r.render(this.vm.scene, this.vm.camera);
          r.autoClear = true;
        }
      }
    },
  });

  window.addEventListener('DOMContentLoaded', () => {
    App.boot().catch((e) => {
      console.error(e);
      const st = document.getElementById('boot-status');
      if (st) st.textContent = 'Error while loading: ' + e.message;
    });
  });
})();
