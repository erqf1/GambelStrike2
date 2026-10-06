'use strict';
// GambelStrike 2 — item studio: renders weapon/knife icons and live rotatable 3D previews
(function () {
  const U = GS.U;
  const PI = Math.PI;
  const ICON_W = 320, ICON_H = 180;

  function makeScene(renderer) {
    const sc = new THREE.Scene();
    const hemi = new THREE.HemisphereLight(0xdde6ff, 0x221a2a, 0.9);
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-2, 3, 4);
    const rim = new THREE.DirectionalLight(0x88ccff, 1.6); rim.position.set(3, 1, -3);
    const fill = new THREE.DirectionalLight(0xb8c4ff, 0.45); fill.position.set(3, -2, 2);
    sc.add(hemi, key, rim, fill);
    // studio environment for reflections
    const es = new THREE.Scene();
    const g = new THREE.SphereGeometry(10, 32, 16);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; void main(){ vec3 d = normalize(vP); float h = d.y * 0.5 + 0.5;
        vec3 c = mix(vec3(0.03,0.03,0.05), vec3(0.22,0.24,0.32), h);
        c += vec3(1.6) * smoothstep(0.92, 0.97, dot(d, normalize(vec3(-0.4,0.7,0.6))));
        c += vec3(0.4,0.8,1.6) * smoothstep(0.9, 0.98, dot(d, normalize(vec3(0.8,0.2,-0.6))));
        c += vec3(0.7,0.75,0.9) * 0.45 * smoothstep(0.85, 0.98, dot(d, normalize(vec3(0.6,-0.3,0.8))));
        gl_FragColor = vec4(c,1.0); }`,
    });
    es.add(new THREE.Mesh(g, m));
    const pm = new THREE.PMREMGenerator(renderer);
    sc.environment = pm.fromScene(es, 0.02).texture;
    pm.dispose();
    return sc;
  }

  function buildItem(kind, id, design, fit = 1.9) {
    const holder = new THREE.Group();
    const inner = new THREE.Group();
    holder.add(inner);
    let model;
    if (kind === 'knife') {
      model = GS.Models.knife(id, design);
      inner.rotation.set(0.15, -PI / 2, -PI / 2, 'ZYX');
    } else {
      model = GS.Models.gun(id, design);
      inner.rotation.set(0, -PI / 2, 0);
    }
    inner.add(model.root);
    // centre & normalise size
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inner);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    inner.position.sub(c);
    const s = fit / Math.max(size.x, size.y * 1.8, 0.001);
    holder.scale.setScalar(s);
    holder.userData.model = model;
    return holder;
  }

  const St = (GS.Studio = {
    icons: {},
    init() {
      this.iconR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.iconR.setPixelRatio(1);
      this.iconR.setSize(ICON_W, ICON_H, false);
      this.iconR.outputEncoding = THREE.sRGBEncoding;
      this.iconR.toneMapping = THREE.ACESFilmicToneMapping;
      this.iconR.toneMappingExposure = 1.15;
      this.iconScene = makeScene(this.iconR);
      this.iconCam = new THREE.PerspectiveCamera(28, ICON_W / ICON_H, 0.1, 50);
      this.iconCam.position.set(0, 0.12, 3.6);
      this.iconCam.lookAt(0, 0, 0);
      // live preview
      this.pvR = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.pvR.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.pvR.outputEncoding = THREE.sRGBEncoding;
      this.pvR.toneMapping = THREE.ACESFilmicToneMapping;
      this.pvR.toneMappingExposure = 1.15;
      this.pvR.domElement.className = 'studio-canvas';
      this.pvScene = makeScene(this.pvR);
      this.pvCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      this.pvCam.position.set(0, 0.15, 3.4);
      this.pvCam.lookAt(0, 0, 0);
      this.pvHolder = new THREE.Group();
      this.pvScene.add(this.pvHolder);
      // floor glow disc
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), new THREE.MeshBasicMaterial({ map: GS.Tex.glow(), color: new THREE.Color(0.25, 0.6, 1.0), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      disc.rotation.x = -PI / 2; disc.position.y = -0.55;
      this.pvDisc = disc;
      this.pvScene.add(disc);
      this.pv = { yaw: 0.35, pitch: 0.12, vy: 0, drag: false, idle: 0, zoom: 1, item: null, key: '' };
      const el = this.pvR.domElement;
      el.addEventListener('pointerdown', (e) => { this.pv.drag = true; this.pv.lx = e.clientX; this.pv.ly = e.clientY; el.setPointerCapture(e.pointerId); });
      el.addEventListener('pointermove', (e) => {
        if (!this.pv.drag) return;
        const dx = e.clientX - this.pv.lx, dy = e.clientY - this.pv.ly;
        this.pv.lx = e.clientX; this.pv.ly = e.clientY;
        this.pv.yaw += dx * 0.01; this.pv.pitch = U.clamp(this.pv.pitch + dy * 0.008, -0.8, 0.8);
        this.pv.vy = dx * 0.01;
        this.pv.idle = 0;
      });
      el.addEventListener('pointerup', () => { this.pv.drag = false; });
      el.addEventListener('wheel', (e) => { this.pv.zoom = U.clamp(this.pv.zoom + Math.sign(e.deltaY) * 0.08, 0.6, 1.5); e.preventDefault(); }, { passive: false });
    },
    // returns a 2D canvas with the item rendered (cached)
    icon(kind, id, design = 'default') {
      const key = kind + ':' + id + ':' + design;
      if (this.icons[key]) return this.icons[key];
      const item = buildItem(kind, id, design, 2.7);
      item.rotation.set(0.05, 0.25, 0);
      if (kind === 'knife') item.rotation.set(0.1, 0.2, 0.0);
      this.iconScene.add(item);
      this.iconR.render(this.iconScene, this.iconCam);
      const c = document.createElement('canvas');
      c.width = ICON_W; c.height = ICON_H;
      c.getContext('2d').drawImage(this.iconR.domElement, 0, 0);
      this.iconScene.remove(item);
      this.icons[key] = c;
      return c;
    },
    iconURL(kind, id, design) {
      const c = this.icon(kind, id, design);
      if (!c._url) c._url = c.toDataURL('image/png');
      return c._url;
    },
    // live preview
    show(container, kind, id, design) {
      const key = kind + ':' + id + ':' + design;
      if (this.pvR.domElement.parentNode !== container) container.appendChild(this.pvR.domElement);
      this.container = container;
      if (this.pv.key !== key) {
        this.pvHolder.clear();
        const item = buildItem(kind, id, design);
        this.pvHolder.add(item);
        this.pv.key = key;
        this.pv.item = item;
        this.pv.pop = 0;
      }
      this.active = true;
      this.resize();
    },
    hide() {
      this.active = false;
      if (this.pvR.domElement.parentNode) this.pvR.domElement.parentNode.removeChild(this.pvR.domElement);
      this.pv.key = '';
      this.pvHolder.clear();
    },
    resize() {
      if (!this.container) return;
      const r = this.container.getBoundingClientRect();
      const w = Math.max(10, Math.floor(r.width)), h = Math.max(10, Math.floor(r.height));
      if (this._w === w && this._h === h) return;
      this._w = w; this._h = h;
      this.pvR.setSize(w, h, false);
      this.pvR.domElement.style.width = w + 'px';
      this.pvR.domElement.style.height = h + 'px';
      this.pvCam.aspect = w / h;
      this.pvCam.updateProjectionMatrix();
    },
    render(dt) {
      if (!this.active || !this.pvR.domElement.isConnected) return;
      this.resize();
      const p = this.pv;
      p.idle += dt;
      if (!p.drag) {
        p.vy *= Math.exp(-dt * 3);
        p.yaw += p.vy + (p.idle > 1.5 ? dt * 0.5 : 0);
      }
      p.pop = Math.min(1, (p.pop || 0) + dt * 3);
      const s = U.ease.outBack(p.pop);
      this.pvHolder.rotation.set(p.pitch, p.yaw, 0);
      this.pvHolder.scale.setScalar(Math.max(0.01, s));
      this.pvHolder.position.y = Math.sin(performance.now() * 0.0012) * 0.03;
      this.pvCam.position.set(0, 0.15, 3.4 * p.zoom);
      this.pvR.render(this.pvScene, this.pvCam);
    },
  });
})();
