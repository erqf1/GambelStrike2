'use strict';
// GambelStrike 2 — materials and procedural models (weapons, knives, hands, characters)
(function () {
  const U = GS.U;
  const holoTime = { value: 0 };

  // ------------------------------------------------------------------ materials
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = (GS.Mats = {
    env: null,
    animated: [],
    init() {
      this.metal = std({ color: 0x2b2e34, metalness: 0.85, roughness: 0.38 });
      this.metalLight = std({ color: 0x6d727a, metalness: 0.9, roughness: 0.3 });
      this.poly = std({ color: 0x1c1e22, metalness: 0.05, roughness: 0.62 });
      this.rubber = std({ color: 0x141517, metalness: 0.0, roughness: 0.85 });
      // optic glass must stay see-through: aiming happens through it
      this.glass = std({ color: 0x9fc4e0, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide });
      this.metalDS = std({ color: 0x2b2e34, metalness: 0.85, roughness: 0.38, side: THREE.DoubleSide });
      this.dot = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.2) });
      this.dotGreen = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 5, 1.2) });
      this.brass = std({ color: 0xc9a042, metalness: 1, roughness: 0.3 });
      this.wood = std({ color: 0x6b4426, metalness: 0, roughness: 0.6 });
      this.glove = std({ color: 0x3a3f4a, metalness: 0.05, roughness: 0.7 });
      this.gloveAccent = std({ color: 0x00b8c8, metalness: 0.2, roughness: 0.5, emissive: 0x003a40, emissiveIntensity: 0.6 });
      this.sleeve = std({ color: 0x262c38, metalness: 0.0, roughness: 0.95 });
      this.cuff = std({ color: 0x15171b, metalness: 0.1, roughness: 0.7 });
      this.skinCache = {};
      this.bladeCache = {};
      this.handleCache = {};
    },
    // materials never hold an envMap themselves: each scene supplies scene.environment
    // (render-target textures cannot be shared between the game and studio WebGL contexts)
    setEnv(env) { this.env = env; },
    _holo(mat) {
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uHoloTime = holoTime;
        sh.fragmentShader = 'uniform float uHoloTime;\n' + sh.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          {
            vec3 hvd = normalize(vViewPosition);
            float hfr = pow(1.0 - abs(dot(normal, hvd)), 1.4);
            float hh = fract(hfr * 1.3 + vUv.x * 0.7 + vUv.y * 0.35 + uHoloTime * 0.07);
            vec3 hrb = clamp(abs(mod(hh * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
            totalEmissiveRadiance += hrb * (0.18 + hfr * 1.6);
          }`
        );
      };
      mat.customProgramCacheKey = () => 'holo';
    },
    skin(design) {
      if (this.skinCache[design]) return this.skinCache[design];
      const t = GS.Tex.skin(design);
      const m = std({
        map: t.map, metalness: t.metal, roughness: t.rough,
        emissive: t.emissiveMap ? 0xffffff : 0x000000, emissiveMap: t.emissiveMap || null,
        emissiveIntensity: t.emi || 0,
      });
      m.userData.anim = t.anim;
      m.userData.baseEmi = t.emi || 0;
      if (t.anim === 'holo') this._holo(m);
      if (t.anim) this.animated.push(m);
      return (this.skinCache[design] = m);
    },
    blade(design) {
      if (this.bladeCache[design]) return this.bladeCache[design];
      const t = GS.Tex.knife(design);
      const o = { map: t.map, metalness: t.metal, roughness: t.rough };
      if (t.emissiveMap) { o.emissive = 0xffffff; o.emissiveMap = t.emissiveMap; o.emissiveIntensity = t.emi || 1; }
      else if (t.emiCol) { o.emissive = new THREE.Color(t.emiCol); o.emissiveIntensity = t.emi || 0.5; }
      const m = std(o);
      m.userData.anim = t.anim;
      m.userData.baseEmi = o.emissiveIntensity || 0;
      if (t.anim) this.animated.push(m);
      return (this.bladeCache[design] = m);
    },
    handle(design) {
      if (this.handleCache[design]) return this.handleCache[design];
      const t = GS.Tex.knife(design);
      const gold = design === 'golden_edge';
      const m = std({ color: new THREE.Color(t.handle || '#222'), metalness: gold ? 1 : 0.35, roughness: gold ? 0.25 : 0.55 });
      return (this.handleCache[design] = m);
    },
    update(t, dt) {
      holoTime.value = t;
      for (const m of this.animated) {
        const a = m.userData.anim;
        if (a === 'pulse') m.emissiveIntensity = m.userData.baseEmi * (0.75 + 0.35 * Math.sin(t * 2.4));
        else if (a === 'scroll') { if (m.map) m.map.offset.x = (t * 0.06) % 1; }
        else if (a === 'drift') { if (m.map) { m.map.offset.x = (t * 0.01) % 1; m.map.offset.y = (t * 0.007) % 1; } }
        else if (a === 'spin') { if (m.map) { m.map.center.set(0.5, 0.5); m.map.rotation = t * 0.35; } }
        else if (a === 'glitch') { if (m.map && Math.random() < dt * 3) m.map.offset.set(Math.random() * 0.06, 0); else if (m.map && Math.random() < dt * 6) m.map.offset.set(0, 0); }
      }
    },
  });

  // ------------------------------------------------------------------ geometry helpers
  const S_UV = 0.22; // metres per skin repeat
  function bx(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const ox = Math.random(), oy = Math.random();
    for (let f = 0; f < 6; f++) {
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uv.setXY(i, uv.getX(i) * dims[f][0] / S_UV + ox, uv.getY(i) * dims[f][1] / S_UV + oy);
      }
    }
    return g;
  }
  function cy(rt, rb, len, seg = 14, axis = 'z') {
    const g = new THREE.CylinderGeometry(rt, rb, len, seg, 1);
    const uv = g.attributes.uv;
    const circ = Math.PI * 2 * Math.max(rt, rb);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / S_UV, uv.getY(i) * len / S_UV);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    else if (axis === 'x') g.rotateZ(Math.PI / 2);
    return g;
  }
  function remapUV(g) {
    g.computeBoundingBox();
    const bb = g.boundingBox;
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1), (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1));
    }
    return g;
  }
  function blade(shape, thick = 0.0032, bevel = 0.0012) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 2, curveSegments: 14 });
    remapUV(g);
    g.translate(0, 0, -thick / 2);
    g.rotateY(Math.PI / 2); // shape +x -> world -Z (edge forward), extrusion -> X (flat normal)
    g.computeVertexNormals();
    return g;
  }

  // simple builder for part hierarchies
  class Builder {
    constructor(mats) {
      this.root = new THREE.Group();
      this.parts = {};
      this.sockets = {};
      this.mats = mats;
    }
    _mat(m) { return typeof m === 'string' ? this.mats[m] : m; }
    add(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent) {
      const mesh = new THREE.Mesh(geo, this._mat(mat));
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      (parent || this.root).add(mesh);
      return mesh;
    }
    box(mat, w, h, d, x, y, z, rx, ry, rz, parent) { return this.add(bx(w, h, d), mat, x, y, z, rx, ry, rz, parent); }
    cyl(mat, r, len, x, y, z, axis = 'z', seg = 14, parent, r2) { return this.add(cy(r, r2 === undefined ? r : r2, len, seg, axis), mat, x, y, z, 0, 0, 0, parent); }
    group(name, x = 0, y = 0, z = 0, parent) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      (parent || this.root).add(g);
      if (name) this.parts[name] = g;
      return g;
    }
    sock(name, x, y, z, rx = 0, ry = 0, rz = 0, parent) {
      const o = new THREE.Object3D();
      o.position.set(x, y, z);
      o.rotation.set(rx, ry, rz);
      (parent || this.root).add(o);
      this.sockets[name] = o;
      return o;
    }
  }

  // ------------------------------------------------------------------ guns
  // origin = top of pistol grip; -Z forward; +Y up
  const RAIL = (b, len, z, y) => {
    b.box('metal', 0.022, 0.01, len, 0, y, z);
    for (let i = 0; i < Math.floor(len / 0.012); i++) b.box('metal', 0.026, 0.005, 0.005, 0, y + 0.006, z - len / 2 + 0.006 + i * 0.012);
  };
  const GRIP = (b, rx = 0.28, y = -0.062, z = 0.026) => {
    b.box('poly', 0.034, 0.105, 0.048, 0, y, z, -rx);
    b.box('poly', 0.008, 0.012, 0.06, 0, -0.034, -0.03); // trigger guard
    b.box('metal', 0.006, 0.022, 0.006, 0, -0.022, -0.018, 0.3); // trigger
  };
  const REDDOT = (b, y, z, green) => {
    b.box('metal', 0.03, 0.014, 0.05, 0, y - 0.017, z);
    // open-ended housing: the sight line runs straight through the tube
    const tube = new THREE.CylinderGeometry(0.02, 0.02, 0.055, 24, 1, true);
    tube.rotateX(Math.PI / 2);
    b.add(tube, M.metalDS, 0, y + 0.004, z);
    b.add(new THREE.RingGeometry(0.0175, 0.0215, 24), M.metalDS, 0, y + 0.004, z - 0.0275);
    b.add(new THREE.RingGeometry(0.0175, 0.0215, 24), M.metalDS, 0, y + 0.004, z + 0.0275);
    b.add(new THREE.CircleGeometry(0.0176, 24), M.glass, 0, y + 0.004, z - 0.026);
    const dot = b.add(new THREE.SphereGeometry(0.0019, 8, 8), green ? M.dotGreen : M.dot, 0, y + 0.004, z - 0.02);
    dot.renderOrder = 5;
    b.sock('sight', 0, y + 0.004, z + 0.02);
  };
  const HOLO = (b, y, z) => {
    b.box('metal', 0.04, 0.012, 0.06, 0, y - 0.02, z);
    b.box('metal', 0.006, 0.045, 0.05, -0.021, y + 0.004, z);
    b.box('metal', 0.006, 0.045, 0.05, 0.021, y + 0.004, z);
    b.box('metal', 0.048, 0.006, 0.05, 0, y + 0.028, z);
    b.add(new THREE.PlaneGeometry(0.036, 0.036), M.glass, 0, y + 0.006, z - 0.02);
    const ring = b.add(new THREE.RingGeometry(0.0045, 0.0055, 20), M.dot, 0, y + 0.006, z - 0.019);
    ring.renderOrder = 5;
    b.add(new THREE.CircleGeometry(0.0008, 8), M.dot, 0, y + 0.006, z - 0.0185);
    b.sock('sight', 0, y + 0.006, z + 0.03);
  };
  // notch rear sight (two posts) + front post; the sight line runs over the post tops
  // at y = yFront + 0.006 (relative to `parent`)
  const IRONS = (b, yRear, zRear, yFront, zFront, parent) => {
    b.box('metal', 0.007, 0.012, 0.008, -0.0075, yRear, zRear, 0, 0, 0, parent);
    b.box('metal', 0.007, 0.012, 0.008, 0.0075, yRear, zRear, 0, 0, 0, parent);
    b.box('metal', 0.022, 0.004, 0.008, 0, yRear - 0.008, zRear, 0, 0, 0, parent);
    b.box('metal', 0.004, 0.012, 0.006, 0, yFront, zFront, 0, 0, 0, parent);
    b.add(new THREE.SphereGeometry(0.0016, 6, 6), M.dotGreen, 0, yFront + 0.006, zFront, 0, 0, 0, parent);
  };

  const GUNS = {
    ar4(b) {
      b.box('paint', 0.056, 0.07, 0.3, 0, 0.05, -0.1);
      b.box('paint', 0.05, 0.05, 0.22, 0, 0.002, -0.08);
      b.box('metal', 0.004, 0.03, 0.06, 0.03, 0.055, -0.07); // ejection port cover
      GRIP(b);
      b.box('paint', 0.064, 0.068, 0.3, 0, 0.048, -0.4);
      for (let i = 0; i < 5; i++) b.box('metal', 0.066, 0.01, 0.025, 0, 0.03, -0.29 - i * 0.055);
      RAIL(b, 0.52, -0.25, 0.091);
      b.cyl('metal', 0.011, 0.17, 0, 0.05, -0.635);
      b.box('metal', 0.026, 0.03, 0.03, 0, 0.06, -0.57);
      b.cyl('metal', 0.017, 0.055, 0, 0.05, -0.735, 'z', 12);
      b.box('metal', 0.036, 0.006, 0.01, 0, 0.05, -0.73);
      b.cyl('poly', 0.016, 0.13, 0, 0.045, 0.11);
      b.box('paint', 0.045, 0.085, 0.16, 0, 0.03, 0.2);
      b.box('rubber', 0.047, 0.095, 0.018, 0, 0.028, 0.285);
      REDDOT(b, 0.124, -0.08);
      const mag = b.group('mag', 0, -0.03, -0.13);
      b.box('metal', 0.03, 0.08, 0.064, 0, -0.03, 0, 0.08, 0, 0, mag);
      b.box('metal', 0.03, 0.08, 0.064, 0, -0.1, -0.012, 0.28, 0, 0, mag);
      b.box('poly', 0.034, 0.012, 0.07, 0, -0.142, -0.026, 0.3, 0, 0, mag);
      const bolt = b.group('bolt', 0, 0.072, 0.045);
      b.box('metal', 0.045, 0.01, 0.018, 0, 0, 0, 0, 0, 0, bolt);
      b.sock('muzzle', 0, 0.05, -0.77);
      b.sock('eject', 0.032, 0.056, -0.07);
      b.sock('guard', 0, 0.006, -0.4);
      b.sock('magHand', 0, -0.12, -0.15);
      b.sock('boltHand', 0.0, 0.085, 0.05);
      b.userData = { recoilZ: 0.035, len: 0.8 };
    },
    phantom(b) {
      b.box('paint', 0.054, 0.075, 0.34, 0, 0.048, -0.1);
      b.box('paint', 0.046, 0.04, 0.2, 0, 0.002, -0.08);
      GRIP(b, 0.25);
      b.box('paint', 0.06, 0.064, 0.24, 0, 0.046, -0.39);
      b.box('metal', 0.062, 0.006, 0.24, 0, 0.074, -0.39);
      b.cyl('metal', 0.024, 0.24, 0, 0.046, -0.63, 'z', 18);
      for (let i = 0; i < 5; i++) b.cyl('metal', 0.0255, 0.008, 0, 0.046, -0.54 - i * 0.045, 'z', 18);
      b.box('paint', 0.03, 0.09, 0.03, 0, 0.03, 0.09);
      b.box('paint', 0.045, 0.03, 0.17, 0, 0.065, 0.17);
      b.box('paint', 0.045, 0.02, 0.17, 0, -0.0, 0.17, -0.18);
      b.box('rubber', 0.047, 0.095, 0.02, 0, 0.03, 0.26);
      RAIL(b, 0.3, -0.12, 0.09);
      HOLO(b, 0.118, -0.1);
      const mag = b.group('mag', 0, -0.03, -0.12);
      b.box('metal', 0.032, 0.13, 0.06, 0, -0.06, -0.004, 0.14, 0, 0, mag);
      b.box('poly', 0.036, 0.012, 0.066, 0, -0.126, -0.014, 0.14, 0, 0, mag);
      const bolt = b.group('bolt', -0.03, 0.06, -0.05);
      b.box('metal', 0.02, 0.012, 0.012, 0, 0, 0, 0, 0, 0, bolt);
      b.sock('muzzle', 0, 0.046, -0.76);
      b.sock('eject', 0.03, 0.055, -0.08);
      b.sock('guard', 0, 0.006, -0.38);
      b.sock('magHand', 0, -0.11, -0.13);
      b.sock('boltHand', -0.035, 0.07, -0.04);
      b.userData = { recoilZ: 0.04 };
    },
    viper(b) {
      b.box('paint', 0.06, 0.1, 0.55, 0, 0.032, -0.05);
      b.box('poly', 0.064, 0.03, 0.2, 0, -0.005, -0.25);
      b.box('paint', 0.03, 0.06, 0.03, 0, -0.04, 0.2);
      GRIP(b, 0.18);
      b.cyl('metal', 0.012, 0.13, 0, 0.05, -0.39);
      b.cyl('metal', 0.018, 0.04, 0, 0.05, -0.47, 'z', 10);
      b.box('rubber', 0.062, 0.1, 0.02, 0, 0.032, 0.23);
      b.box('metal', 0.03, 0.03, 0.18, 0, 0.098, -0.07);
      REDDOT(b, 0.135, -0.07, true);
      const mag = b.group('mag', 0, -0.02, 0.12);
      b.box('metal', 0.03, 0.12, 0.06, 0, -0.05, 0, 0.18, 0, 0, mag);
      const bolt = b.group('bolt', 0, 0.09, -0.2);
      b.box('metal', 0.018, 0.016, 0.03, 0, 0, 0, 0, 0, 0, bolt);
      b.sock('muzzle', 0, 0.05, -0.5);
      b.sock('eject', 0.032, 0.05, 0.09);
      b.sock('guard', 0, -0.02, -0.24);
      b.sock('magHand', 0, -0.11, 0.13);
      b.sock('boltHand', 0, 0.1, -0.2);
      b.userData = { recoilZ: 0.03 };
    },
    warden(b) {
      b.box('paint', 0.062, 0.085, 0.36, 0, 0.045, -0.1);
      b.box('paint', 0.052, 0.05, 0.2, 0, -0.005, -0.08);
      GRIP(b, 0.25);
      b.box('paint', 0.066, 0.075, 0.28, 0, 0.043, -0.42);
      for (let i = 0; i < 4; i++) b.box('metal', 0.068, 0.02, 0.03, 0, 0.045, -0.32 - i * 0.065);
      b.cyl('metal', 0.013, 0.2, 0, 0.048, -0.66);
      b.cyl('metal', 0.02, 0.07, 0, 0.048, -0.77, 'z', 8);
      b.box('paint', 0.05, 0.1, 0.22, 0, 0.028, 0.19);
      b.box('rubber', 0.052, 0.105, 0.02, 0, 0.026, 0.3);
      b.box('paint', 0.03, 0.03, 0.12, 0, 0.09, 0.15);
      // 1.5x box optic
      b.box('metal', 0.03, 0.016, 0.08, 0, 0.095, -0.1);
      // hollow optic housing (four walls) so the view stays clear
      b.box('metal', 0.048, 0.006, 0.12, 0, 0.144, -0.1);
      b.box('metal', 0.048, 0.006, 0.12, 0, 0.106, -0.1);
      b.box('metal', 0.006, 0.044, 0.12, -0.021, 0.125, -0.1);
      b.box('metal', 0.006, 0.044, 0.12, 0.021, 0.125, -0.1);
      b.add(new THREE.PlaneGeometry(0.038, 0.032), M.glass, 0, 0.126, -0.161);
      b.add(new THREE.PlaneGeometry(0.038, 0.032), M.glass, 0, 0.126, -0.039, 0, Math.PI, 0);
      const ch = b.add(new THREE.PlaneGeometry(0.0007, 0.012), M.dot, 0, 0.122, -0.155); ch.renderOrder = 5;
      b.add(new THREE.PlaneGeometry(0.012, 0.0007), M.dot, 0, 0.126, -0.155).renderOrder = 5;
      b.sock('sight', 0, 0.126, -0.02);
      const mag = b.group('mag', 0, -0.03, -0.12);
      b.box('metal', 0.036, 0.14, 0.07, 0, -0.065, 0, 0.05, 0, 0, mag);
      const bolt = b.group('bolt', 0.036, 0.06, -0.12);
      b.box('metal', 0.014, 0.014, 0.025, 0, 0, 0, 0, 0, 0, bolt);
      b.sock('muzzle', 0, 0.048, -0.81);
      b.sock('eject', 0.033, 0.055, -0.07);
      b.sock('guard', 0, 0.0, -0.42);
      b.sock('magHand', 0, -0.13, -0.13);
      b.sock('boltHand', 0.045, 0.06, -0.11);
      b.userData = { recoilZ: 0.05 };
    },
    vector(b) {
      b.box('paint', 0.052, 0.11, 0.26, 0, 0.025, -0.08);
      b.box('paint', 0.048, 0.05, 0.08, 0, -0.04, -0.17, -0.3);
      b.box('poly', 0.034, 0.1, 0.045, 0, -0.07, 0.025, -0.12);
      b.box('poly', 0.008, 0.012, 0.05, 0, -0.035, -0.03);
      b.box('metal', 0.006, 0.02, 0.006, 0, -0.025, -0.02, 0.3);
      b.cyl('metal', 0.015, 0.08, 0, 0.055, -0.25, 'z', 12);
      b.cyl('metal', 0.011, 0.05, 0, 0.055, -0.31, 'z', 12);
      RAIL(b, 0.22, -0.08, 0.085);
      REDDOT(b, 0.118, -0.06);
      b.box('metal', 0.026, 0.035, 0.16, 0, 0.045, 0.13);
      b.box('rubber', 0.04, 0.1, 0.022, 0, 0.02, 0.215);
      const mag = b.group('mag', 0, -0.06, -0.12);
      b.box('metal', 0.028, 0.17, 0.045, 0, -0.07, 0, 0.0, 0, 0, mag);
      b.box('poly', 0.032, 0.012, 0.05, 0, -0.158, 0, 0, 0, 0, mag);
      const bolt = b.group('bolt', -0.03, 0.06, -0.06);
      b.box('metal', 0.016, 0.014, 0.016, 0, 0, 0, 0, 0, 0, bolt);
      b.sock('muzzle', 0, 0.055, -0.34);
      b.sock('eject', 0.03, 0.05, -0.05);
      b.sock('guard', 0, -0.03, -0.18);
      b.sock('magHand', 0, -0.2, -0.12);
      b.sock('boltHand', -0.035, 0.07, -0.05);
      b.userData = { recoilZ: 0.025 };
    },
    kestrel(b) {
      b.box('paint', 0.05, 0.085, 0.27, 0, 0.04, -0.07);
      GRIP(b, 0.2);
      b.cyl('metal', 0.013, 0.12, 0, 0.05, -0.26);
      b.cyl('metal', 0.019, 0.045, 0, 0.05, -0.32, 'z', 8);
      b.box('poly', 0.03, 0.085, 0.032, 0, -0.035, -0.2);
      IRONS(b, 0.094, 0.04, 0.094, -0.18);
      b.box('metal', 0.018, 0.012, 0.22, 0.015, 0.03, 0.15);
      b.box('metal', 0.018, 0.012, 0.22, -0.015, 0.03, 0.15);
      b.box('rubber', 0.045, 0.08, 0.018, 0, 0.03, 0.26);
      const mag = b.group('mag', 0, -0.03, -0.1);
      b.cyl('metal', 0.06, 0.05, 0, -0.06, 0, 'x', 24, mag);
      b.cyl('paint', 0.062, 0.012, 0, -0.06, 0, 'x', 24, mag);
      b.box('metal', 0.028, 0.04, 0.04, 0, -0.005, 0, 0, 0, 0, mag);
      const bolt = b.group('bolt', 0, 0.09, 0.02);
      b.box('metal', 0.02, 0.01, 0.02, 0, 0, 0, 0, 0, 0, bolt);
      b.sock('sight', 0, 0.1005, 0.06);
      b.sock('muzzle', 0, 0.05, -0.35);
      b.sock('eject', 0.03, 0.05, -0.05);
      b.sock('guard', 0, -0.04, -0.2, -Math.PI / 2, 0, 0);
      b.sock('magHand', 0, -0.13, -0.1);
      b.sock('boltHand', 0, 0.1, 0.02);
      b.userData = { recoilZ: 0.022, vgrip: true, irons: true };
    },
    shotgun(b) {
      b.box('paint', 0.055, 0.075, 0.22, 0, 0.04, -0.08);
      GRIP(b, 0.3);
      b.cyl('metal', 0.0145, 0.56, 0, 0.062, -0.47);
      b.cyl('metal', 0.013, 0.42, 0, 0.028, -0.4);
      b.box('paint', 0.045, 0.08, 0.24, 0, 0.018, 0.17, -0.12);
      b.box('rubber', 0.048, 0.1, 0.024, 0, 0.004, 0.29, -0.12);
      b.box('metal', 0.004, 0.024, 0.008, 0, 0.087, -0.735); // raised front post
      b.add(new THREE.SphereGeometry(0.0022, 8, 8), M.dotGreen, 0, 0.099, -0.735);
      b.box('metal', 0.006, 0.028, 0.012, -0.0075, 0.087, -0.02); // ghost-ring rear posts
      b.box('metal', 0.006, 0.028, 0.012, 0.0075, 0.087, -0.02);
      b.box('metal', 0.022, 0.012, 0.012, 0, 0.079, -0.02);
      const pump = b.group('pump', 0, 0.026, -0.36);
      b.box('poly', 0.058, 0.05, 0.16, 0, 0, 0, 0, 0, 0, pump);
      for (let i = 0; i < 6; i++) b.box('poly', 0.062, 0.054, 0.008, 0, 0, -0.06 + i * 0.024, 0, 0, 0, pump);
      b.sock('sight', 0, 0.099, -0.02);
      b.sock('muzzle', 0, 0.062, -0.76);
      b.sock('eject', 0.03, 0.045, -0.08);
      b.sock('guard', 0, -0.008, -0.36);
      b.sock('magHand', 0, -0.03, -0.12);
      b.sock('boltHand', 0, -0.008, -0.27);
      b.userData = { recoilZ: 0.07, irons: true };
    },
    longbow(b) {
      b.box('paint', 0.05, 0.06, 0.28, 0, 0.04, -0.08);
      GRIP(b, 0.25);
      b.cyl('metal', 0.012, 0.62, 0, 0.045, -0.53, 'z', 14, undefined, 0.015);
      b.cyl('metal', 0.02, 0.075, 0, 0.045, -0.87, 'z', 8);
      b.box('paint', 0.06, 0.06, 0.32, 0, 0.018, -0.36);
      b.box('paint', 0.05, 0.1, 0.3, 0, 0.0, 0.18);
      b.box('paint', 0.046, 0.03, 0.14, 0, 0.065, 0.16);
      b.box('rubber', 0.052, 0.11, 0.024, 0, -0.003, 0.33);
      // scope
      b.box('metal', 0.022, 0.03, 0.025, 0, 0.088, -0.17);
      b.box('metal', 0.022, 0.03, 0.025, 0, 0.088, 0.0);
      b.cyl('metal', 0.02, 0.3, 0, 0.118, -0.08, 'z', 18);
      b.cyl('metal', 0.03, 0.07, 0, 0.118, -0.25, 'z', 18, undefined, 0.02);
      b.cyl('metal', 0.026, 0.05, 0, 0.118, 0.085, 'z', 18, undefined, 0.02);
      b.cyl('metal', 0.008, 0.02, 0, 0.143, -0.08, 'y', 10);
      b.cyl('metal', 0.008, 0.02, 0.025, 0.118, -0.08, 'x', 10);
      b.cyl('glass', 0.028, 0.004, 0, 0.118, -0.286, 'z', 18);
      b.cyl('glass', 0.024, 0.004, 0, 0.118, 0.11, 'z', 18);
      b.sock('sight', 0, 0.118, 0.12);
      const bolt = b.group('bolt', 0.0, 0.055, 0.02);
      b.cyl('metal', 0.012, 0.09, 0, 0, -0.01, 'z', 10, bolt);
      b.cyl('metal', 0.005, 0.055, 0.03, 0, 0.0, 'x', 8, bolt);
      b.add(new THREE.SphereGeometry(0.009, 10, 10), M.metal, 0.058, 0, 0, 0, 0, 0, bolt);
      const mag = b.group('mag', 0, -0.015, -0.1);
      b.box('metal', 0.04, 0.06, 0.085, 0, -0.025, 0, 0, 0, 0, mag);
      b.sock('muzzle', 0, 0.045, -0.92);
      b.sock('eject', 0.03, 0.06, -0.04);
      b.sock('guard', 0, -0.015, -0.36);
      b.sock('magHand', 0, -0.08, -0.1);
      b.sock('boltHand', 0.06, 0.055, 0.02);
      b.userData = { recoilZ: 0.08 };
    },
    // ---- pistols
    r9(b) {
      const slide = b.group('slide', 0, 0.045, -0.06);
      b.box('paint', 0.03, 0.034, 0.19, 0, 0, 0, 0, 0, 0, slide);
      for (let i = 0; i < 5; i++) b.box('metal', 0.032, 0.026, 0.004, 0, 0, 0.07 - i * 0.008, 0, 0, 0, slide);
      IRONS(b, 0.024, 0.085, 0.024, -0.085, slide);
      b.box('poly', 0.028, 0.025, 0.15, 0, 0.016, -0.075);
      b.box('poly', 0.03, 0.105, 0.045, 0, -0.045, 0.012, -0.22);
      b.box('poly', 0.006, 0.008, 0.05, 0, -0.012, -0.055);
      b.box('metal', 0.006, 0.02, 0.006, 0, -0.005, -0.04, 0.3);
      b.cyl('metal', 0.0065, 0.012, 0, 0.05, -0.157, 'z', 10);
      const mag = b.group('mag', 0, -0.05, 0.022);
      b.box('metal', 0.024, 0.1, 0.034, 0, 0.0, 0, -0.22, 0, 0, mag);
      b.box('poly', 0.03, 0.012, 0.046, 0, -0.052, 0.012, -0.22, 0, 0, mag);
      b.sock('sight', 0, 0.0755, 0.06);
      b.sock('muzzle', 0, 0.05, -0.165);
      b.sock('eject', 0.02, 0.058, -0.04);
      b.sock('guard', -0.012, -0.045, 0.02, 0, 0, 0);
      b.sock('magHand', 0, -0.14, 0.05);
      b.sock('boltHand', 0, 0.05, 0.02);
      b.userData = { recoilZ: 0.03, pistol: true };
    },
    nova(b) {
      const slide = b.group('slide', 0, 0.046, -0.065);
      b.box('paint', 0.031, 0.034, 0.2, 0, 0, 0, 0, 0, 0, slide);
      b.box('metal', 0.032, 0.006, 0.18, 0, 0.012, 0, 0, 0, 0, slide);
      const strip = b.add(new THREE.BoxGeometry(0.0322, 0.003, 0.15), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.5, 3) }), 0, -0.004, 0, 0, 0, 0, slide);
      void strip;
      IRONS(b, 0.024, 0.09, 0.024, -0.09, slide);
      b.box('poly', 0.03, 0.026, 0.16, 0, 0.016, -0.08);
      b.box('poly', 0.031, 0.105, 0.046, 0, -0.045, 0.012, -0.2);
      b.box('poly', 0.006, 0.008, 0.05, 0, -0.012, -0.055);
      b.box('metal', 0.006, 0.02, 0.006, 0, -0.005, -0.04, 0.3);
      const mag = b.group('mag', 0, -0.05, 0.022);
      b.box('metal', 0.024, 0.1, 0.034, 0, 0, 0, -0.2, 0, 0, mag);
      b.box('poly', 0.03, 0.012, 0.046, 0, -0.052, 0.012, -0.2, 0, 0, mag);
      b.sock('sight', 0, 0.0765, 0.06);
      b.sock('muzzle', 0, 0.05, -0.175);
      b.sock('eject', 0.02, 0.058, -0.04);
      b.sock('guard', -0.012, -0.045, 0.02);
      b.sock('magHand', 0, -0.14, 0.05);
      b.sock('boltHand', 0, 0.05, 0.02);
      b.userData = { recoilZ: 0.026, pistol: true };
    },
    stinger(b) {
      const slide = b.group('slide', 0, 0.045, -0.06);
      b.box('paint', 0.03, 0.034, 0.19, 0, 0, 0, 0, 0, 0, slide);
      IRONS(b, 0.024, 0.085, 0.024, -0.085, slide);
      b.box('poly', 0.028, 0.025, 0.15, 0, 0.016, -0.075);
      b.box('poly', 0.03, 0.105, 0.045, 0, -0.045, 0.012, -0.22);
      b.box('poly', 0.006, 0.008, 0.05, 0, -0.012, -0.055);
      b.cyl('metal', 0.012, 0.06, 0, 0.05, -0.18, 'z', 10);
      b.box('poly', 0.026, 0.07, 0.03, 0, -0.03, -0.12);
      const mag = b.group('mag', 0, -0.05, 0.022);
      b.box('metal', 0.024, 0.2, 0.034, 0, -0.05, 0, -0.22, 0, 0, mag);
      b.box('poly', 0.03, 0.012, 0.046, 0, -0.152, 0.034, -0.22, 0, 0, mag);
      b.sock('sight', 0, 0.0755, 0.06);
      b.sock('muzzle', 0, 0.05, -0.215);
      b.sock('eject', 0.02, 0.058, -0.04);
      b.sock('guard', 0, -0.035, -0.12, -Math.PI / 2, 0, 0);
      b.sock('magHand', 0, -0.2, 0.07);
      b.sock('boltHand', 0, 0.05, 0.02);
      b.userData = { recoilZ: 0.02, pistol: true, vgrip: true };
    },
    hammer(b) {
      const slide = b.group('slide', 0, 0.05, -0.075);
      b.box('paint', 0.036, 0.042, 0.23, 0, 0, 0, 0, 0, 0, slide);
      for (let i = 0; i < 3; i++) b.box('metal', 0.038, 0.012, 0.018, 0, 0.012, -0.08 + i * 0.026, 0, 0, 0, slide);
      IRONS(b, 0.028, 0.1, 0.028, -0.1, slide);
      b.box('metal', 0.032, 0.028, 0.18, 0, 0.016, -0.085);
      b.box('wood', 0.034, 0.11, 0.05, 0, -0.048, 0.014, -0.2);
      b.box('metal', 0.007, 0.01, 0.055, 0, -0.012, -0.06);
      b.box('metal', 0.006, 0.02, 0.006, 0, -0.005, -0.045, 0.3);
      b.cyl('metal', 0.008, 0.015, 0, 0.055, -0.196, 'z', 10);
      const mag = b.group('mag', 0, -0.05, 0.022);
      b.box('metal', 0.026, 0.1, 0.036, 0, 0, 0, -0.2, 0, 0, mag);
      b.box('metal', 0.032, 0.012, 0.048, 0, -0.052, 0.012, -0.2, 0, 0, mag);
      b.sock('sight', 0, 0.0845, 0.06);
      b.sock('muzzle', 0, 0.055, -0.2);
      b.sock('eject', 0.022, 0.06, -0.05);
      b.sock('guard', -0.012, -0.045, 0.02);
      b.sock('magHand', 0, -0.14, 0.05);
      b.sock('boltHand', 0, 0.05, 0.02);
      b.userData = { recoilZ: 0.045, pistol: true };
    },
    duke(b) {
      b.box('paint', 0.03, 0.045, 0.1, 0, 0.032, -0.03);
      b.cyl('metal', 0.0095, 0.17, 0, 0.05, -0.16);
      b.box('paint', 0.016, 0.014, 0.17, 0, 0.064, -0.16);
      b.box('metal', 0.004, 0.012, 0.01, 0, 0.076, -0.24);
      b.box('metal', 0.016, 0.006, 0.01, 0, 0.068, 0.015);
      b.box('wood', 0.032, 0.1, 0.045, 0, -0.04, 0.03, -0.35);
      b.box('metal', 0.006, 0.008, 0.045, 0, -0.008, -0.03);
      b.box('metal', 0.008, 0.02, 0.012, 0, 0.065, 0.03, -0.4);
      const cylg = b.group('cyl', 0, 0.032, -0.045);
      b.cyl('metal', 0.022, 0.045, 0, 0, 0, 'z', 12, cylg);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        b.cyl('brass', 0.005, 0.047, Math.cos(a) * 0.013, Math.sin(a) * 0.013, 0, 'z', 6, cylg);
      }
      b.group('mag', 0, -0.05, 0.02);
      b.sock('sight', 0, 0.081, 0.05);
      b.sock('muzzle', 0, 0.05, -0.25);
      b.sock('eject', 0.02, 0.04, -0.04);
      b.sock('guard', -0.012, -0.045, 0.02);
      b.sock('magHand', -0.02, -0.0, -0.05);
      b.sock('boltHand', 0, 0.06, 0.03);
      b.userData = { recoilZ: 0.05, pistol: true, revolver: true };
    },
  };

  // ------------------------------------------------------------------ knives
  // origin = grip centre; blade along +Y; edge faces -Z; flat normal = X
  function shapeFrom(pts) {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]);
      else s.lineTo(p[0], p[1]);
    }
    s.closePath();
    return s;
  }
  const KNIVES = {
    tactical(b) {
      b.add(blade(shapeFrom([[0.013, 0], [0.014, 0.1], [0.012, 0.15, -0.004, 0.17], [-0.012, 0.13], [-0.012, 0]])), 'blade', 0, 0.056, 0);
      b.box('metal', 0.014, 0.008, 0.044, 0, 0.052, 0);
      b.cyl('handle', 0.0125, 0.1, 0, 0.0, 0, 'y', 12);
      for (let i = 0; i < 5; i++) b.cyl('rubber', 0.0135, 0.006, 0, -0.035 + i * 0.018, 0, 'y', 12);
      b.cyl('metal', 0.014, 0.012, 0, -0.054, 0, 'y', 12);
      b.sock('tip', 0, 0.226, 0);
    },
    combat(b) {
      b.add(blade(shapeFrom([[0.016, 0], [0.017, 0.12], [0.016, 0.18, 0.0, 0.205], [-0.006, 0.16], [-0.004, 0.15, -0.014, 0.14], [-0.014, 0]])), 'blade', 0, 0.058, 0);
      b.box('metal', 0.016, 0.01, 0.07, 0, 0.053, 0);
      b.box('handle', 0.022, 0.1, 0.03, 0, 0, 0);
      b.cyl('metal', 0.016, 0.014, 0, -0.056, 0, 'y', 10);
      b.sock('tip', 0, 0.26, 0);
    },
    flip(b) {
      b.box('handle', 0.014, 0.11, 0.028, 0, 0, 0);
      b.box('metal', 0.016, 0.105, 0.004, 0, 0, 0.014);
      const piv = b.group('blade', 0, 0.05, -0.006);
      b.add(blade(shapeFrom([[0.012, 0], [0.013, 0.07], [0.012, 0.11, 0.0, 0.13], [-0.012, 0.1], [-0.014, 0.0]])), 'blade', 0, 0.0, 0.006, 0, 0, 0, piv);
      b.cyl('metal', 0.006, 0.02, 0, 0.0, 0.0, 'x', 10, piv);
      b.sock('tip', 0, 0.18, 0);
    },
    talon(b) {
      b.box('handle', 0.014, 0.1, 0.026, 0, 0, 0);
      b.add(new THREE.TorusGeometry(0.013, 0.004, 8, 20), M.metal, 0, -0.064, 0.0, 0, Math.PI / 2, 0);
      const piv = b.group('blade', 0, 0.048, -0.005);
      b.add(blade(shapeFrom([[0.012, 0], [0.03, 0.06, 0.05, 0.13], [0.03, 0.1, 0.0, 0.08], [-0.012, 0.03], [-0.012, 0]])), 'blade', 0, 0, 0.005, 0, 0, 0, piv);
      b.cyl('metal', 0.006, 0.02, 0, 0, 0, 'x', 10, piv);
      b.sock('tip', 0, 0.17, -0.05);
    },
    shadow(b) {
      b.add(blade(shapeFrom([[0.012, 0], [0.012, 0.2], [0.012, 0.215], [-0.004, 0.24], [-0.012, 0.21], [-0.012, 0]]), 0.003, 0.001), 'blade', 0, 0.058, 0);
      const edge = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.4, 4) });
      b.add(new THREE.BoxGeometry(0.0046, 0.19, 0.0016), edge, 0, 0.16, -0.0122);
      b.box('metal', 0.016, 0.006, 0.036, 0, 0.054, 0);
      b.box('handle', 0.02, 0.11, 0.026, 0, 0, 0);
      for (let i = 0; i < 6; i++) b.box('rubber', 0.022, 0.006, 0.028, 0, -0.042 + i * 0.017, 0, 0.4);
      b.sock('tip', 0, 0.3, 0);
    },
    fang(b) {
      const pts = [[0.014, 0], [0.015, 0.09], [0.012, 0.14, -0.004, 0.17]];
      for (let i = 0; i < 6; i++) { pts.push([-0.012, 0.14 - i * 0.018]); pts.push([-0.016, 0.132 - i * 0.018]); }
      pts.push([-0.012, 0]);
      b.add(blade(shapeFrom(pts)), 'blade', 0, 0.056, 0);
      b.box('metal', 0.016, 0.008, 0.05, 0, 0.052, 0);
      b.box('handle', 0.022, 0.1, 0.028, 0, 0, 0);
      for (let i = 0; i < 3; i++) b.cyl('rubber', 0.008, 0.024, 0, 0.03 - i * 0.025, -0.014, 'x', 10);
      b.cyl('metal', 0.015, 0.012, 0, -0.055, 0, 'y', 10);
      b.sock('tip', 0, 0.23, 0);
    },
    butterfly(b) {
      // handle A (safe handle) is fixed in the hand. pin at y = 0.053
      const handleGeo = () => {
        const g = new THREE.BoxGeometry(0.011, 0.105, 0.0105);
        return g;
      };
      b.add(handleGeo(), 'handle', 0, 0, -0.0058);
      for (let i = 0; i < 4; i++) b.box('metal', 0.0115, 0.012, 0.004, 0, -0.035 + i * 0.024, -0.0058);
      const bladePiv = b.group('bfBlade', 0, 0.053, 0);
      b.add(blade(shapeFrom([[0.009, 0], [0.01, 0.08], [0.009, 0.1, 0.0, 0.112], [-0.009, 0.085], [-0.009, 0]]), 0.0028, 0.001), 'blade', 0, 0.004, 0, 0, 0, 0, bladePiv);
      b.cyl('metal', 0.004, 0.016, 0, 0, 0, 'x', 8, bladePiv);
      const hb = b.group('bfHandle', 0, 0, 0, bladePiv);
      b.add(handleGeo(), 'handle', 0, -0.0535, 0.0058, 0, 0, 0, hb);
      for (let i = 0; i < 4; i++) b.box('metal', 0.0115, 0.012, 0.004, 0, -0.087 + i * 0.024, 0.0058, 0, 0, 0, hb);
      b.box('metal', 0.012, 0.012, 0.004, 0, -0.105, 0.002, 0, 0, 0, hb); // latch
      b.sock('tip', 0, 0.115, 0, 0, 0, 0, bladePiv);
    },
    karambit(b) {
      // origin = ring centre (finger ring). handle runs -Y, blade curves forward from the bottom
      b.add(new THREE.TorusGeometry(0.017, 0.0045, 10, 28), 'handle', 0, 0, 0, 0, Math.PI / 2, 0);
      b.box('handle', 0.014, 0.085, 0.024, 0, -0.062, 0.002);
      for (let i = 0; i < 3; i++) b.cyl('metal', 0.0035, 0.016, 0, -0.04 - i * 0.022, 0.002, 'x', 6);
      const sh = shapeFrom([
        [-0.012, 0.0], [-0.012, -0.03, 0.0, -0.065], [0.03, -0.1, 0.072, -0.082],
        [0.05, -0.075], [0.03, -0.068, 0.012, -0.04], [0.012, 0.0],
      ]);
      b.add(blade(sh, 0.003, 0.0012), 'blade', 0, -0.1, 0.0);
      b.sock('tip', 0, -0.182, -0.072);
    },
  };

  // ------------------------------------------------------------------ hands
  function buildHand(left) {
    const g = new THREE.Group();
    const b = new Builder({ glove: M.glove, acc: M.gloveAccent });
    b.root = g;
    // palm & heel
    b.box('glove', 0.024, 0.078, 0.046, 0.025, 0, 0.006);
    b.box('glove', 0.03, 0.072, 0.017, 0.01, -0.002, 0.024);
    b.box('acc', 0.004, 0.06, 0.03, 0.038, 0.004, 0.0);
    const fingers = [];
    const fy = [0.027, 0.009, -0.009, -0.026];
    const fl = [[0.03, 0.03], [0.032, 0.032], [0.03, 0.03], [0.025, 0.026]];
    for (let f = 0; f < 4; f++) {
      const k = new THREE.Group();
      k.position.set(0.024, fy[f], -0.012);
      g.add(k);
      const s1 = new THREE.Mesh(bx(0.017, 0.016, fl[f][0]), M.glove);
      s1.position.z = -fl[f][0] / 2;
      k.add(s1);
      const j = new THREE.Group();
      j.position.z = -fl[f][0];
      k.add(j);
      const s2 = new THREE.Mesh(bx(0.015, 0.015, fl[f][1]), M.glove);
      s2.position.z = -fl[f][1] / 2;
      j.add(s2);
      fingers.push({ k, j });
    }
    // thumb
    const tb = new THREE.Group();
    tb.position.set(0.006, 0.03, 0.02);
    g.add(tb);
    const t1 = new THREE.Mesh(bx(0.018, 0.018, 0.034), M.glove);
    t1.position.z = -0.017; tb.add(t1);
    const tj = new THREE.Group(); tj.position.z = -0.034; tb.add(tj);
    const t2 = new THREE.Mesh(bx(0.016, 0.016, 0.028), M.glove);
    t2.position.z = -0.014; tj.add(t2);
    const wrist = new THREE.Object3D();
    wrist.position.set(0.02, -0.036, 0.024);
    g.add(wrist);
    const hand = {
      group: g, wrist, fingers, thumb: { b: tb, j: tj }, curl: -1, left: !!left,
      setCurl(c, spread = 0) {
        if (Math.abs(c - this.curl) < 0.002 && !spread) return;
        this.curl = c;
        for (let i = 0; i < 4; i++) {
          const f = this.fingers[i];
          f.k.rotation.y = U.lerp(0.12, 0.95, c) + spread * (i - 1.5) * 0.12;
          f.k.rotation.x = spread * (i - 1.5) * 0.06;
          f.j.rotation.y = U.lerp(0.12, 1.3, c);
        }
        this.thumb.b.rotation.set(U.lerp(-0.2, 0.15, c), U.lerp(0.4, 1.25, c), 0);
        this.thumb.j.rotation.y = U.lerp(0.1, 0.6, c);
      },
    };
    hand.setCurl(1);
    if (left) g.scale.x = -1;
    return hand;
  }
  function buildArm() {
    const g = new THREE.Group();
    const fore = new THREE.Mesh(cy(0.05, 0.03, 1, 12, 'z'), M.sleeve);
    fore.geometry.translate(0, 0, 0.5);
    g.add(fore);
    const cuff = new THREE.Mesh(cy(0.034, 0.034, 0.05, 12, 'z'), M.cuff);
    cuff.position.z = 0.03;
    g.add(cuff);
    return { group: g, fore };
  }

  // ------------------------------------------------------------------ characters
  function mergeGeos(list) {
    // list of {geo, matrix}; returns BufferGeometry (non-indexed, pos/normal/uv)
    let total = 0;
    const prepared = list.map(({ geo, matrix }) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.applyMatrix4(matrix);
      total += g.attributes.position.count;
      return g;
    });
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    let o = 0;
    for (const g of prepared) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += g.attributes.position.count;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.computeBoundingSphere();
    return out;
  }
  // flatten a group into one mesh per material (for distant / third-person models)
  function flatten(group) {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const byMat = new Map();
    group.traverse((o) => {
      if (!o.isMesh) return;
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      if (!byMat.has(o.material)) byMat.set(o.material, []);
      byMat.get(o.material).push({ geo: o.geometry, matrix: m });
    });
    const out = new THREE.Group();
    for (const [mat, list] of byMat) {
      const mesh = new THREE.Mesh(mergeGeos(list), mat);
      mesh.castShadow = true;
      out.add(mesh);
    }
    return out;
  }

  const charGeoCache = {};
  function charParts() {
    if (charGeoCache.ok) return charGeoCache;
    const mk = (defs) => mergeGeos(defs.map(([w, h, d, x, y, z, rx = 0]) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(1, 1, 1));
      return { geo: bx(w, h, d), matrix: m };
    }));
    // leg (pivot at hip, extends down)
    charGeoCache.leg = mk([[0.17, 0.46, 0.19, 0, -0.23, 0], [0.15, 0.44, 0.16, 0, -0.66, 0.01], [0.16, 0.11, 0.27, 0, -0.875, -0.04]]);
    charGeoCache.knee = mk([[0.17, 0.1, 0.06, 0, -0.44, -0.09]]);
    charGeoCache.torso = mk([[0.36, 0.2, 0.22, 0, 0.0, 0], [0.42, 0.42, 0.25, 0, 0.3, 0]]);
    charGeoCache.vest = mk([[0.45, 0.32, 0.3, 0, 0.32, 0], [0.3, 0.12, 0.06, 0, 0.2, -0.16], [0.28, 0.3, 0.12, 0, 0.32, 0.19]]);
    charGeoCache.head = mk([[0.22, 0.24, 0.24, 0, 0.12, 0], [0.26, 0.1, 0.27, 0, 0.22, 0.0], [0.08, 0.06, 0.12, 0, 0.0, 0]]);
    charGeoCache.visor = mk([[0.2, 0.06, 0.03, 0, 0.13, -0.125]]);
    charGeoCache.armR = mk([[0.12, 0.3, 0.12, 0, -0.14, 0], [0.1, 0.1, 0.32, 0, -0.27, -0.14]]);
    charGeoCache.armL = mk([[0.11, 0.28, 0.11, 0, -0.12, -0.06, 0.6], [0.1, 0.1, 0.36, 0.05, -0.2, -0.3, 0.1]]);
    charGeoCache.shoulder = mk([[0.16, 0.08, 0.16, 0, 0.0, 0]]);
    charGeoCache.ok = true;
    return charGeoCache;
  }

  GS.Models = {
    M,
    bx, cy, mergeGeos, flatten,
    gunIds: Object.keys(GUNS),
    // build a gun. opts.world -> flattened single meshes for third person
    gun(id, design = 'default', opts = {}) {
      const def = GS.WEAPONS[id];
      const mats = {
        paint: M.skin(design), metal: M.metal, poly: M.poly, rubber: M.rubber, glass: M.glass, wood: M.wood, brass: M.brass,
      };
      const b = new Builder(mats);
      GUNS[def.model](b);
      const info = b.userData || {};
      if (opts.world) {
        const flat = flatten(b.root);
        return { root: flat, sockets: {}, parts: {}, info };
      }
      b.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      return { root: b.root, sockets: b.sockets, parts: b.parts, info };
    },
    knife(id, design = 'default', opts = {}) {
      const mats = { blade: M.blade(design), handle: M.handle(design), metal: M.metal, rubber: M.rubber };
      const b = new Builder(mats);
      KNIVES[id](b);
      if (opts.world) return { root: flatten(b.root), sockets: {}, parts: {} };
      return { root: b.root, sockets: b.sockets, parts: b.parts };
    },
    hand: buildHand,
    arm: buildArm,
    character(color) {
      const P = charParts();
      const c = new THREE.Color(color);
      const body = std({ color: 0x2a2e36, roughness: 0.8, metalness: 0.05 });
      const accent = std({ color: c, roughness: 0.5, metalness: 0.2, emissive: c, emissiveIntensity: 0.08 });
      const dark = std({ color: 0x1a1c20, roughness: 0.7, metalness: 0.2 });
      const visor = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.2) });
      const root = new THREE.Group();
      const hips = new THREE.Group(); hips.position.y = 0.94; root.add(hips);
      const mkLeg = (x) => {
        const g = new THREE.Group(); g.position.set(x, 0, 0); hips.add(g);
        const m = new THREE.Mesh(P.leg, body); m.castShadow = true; g.add(m);
        const k = new THREE.Mesh(P.knee, dark); k.castShadow = false; g.add(k);
        return g;
      };
      const legL = mkLeg(-0.1), legR = mkLeg(0.1);
      const spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine);
      const torso = new THREE.Mesh(P.torso, body); torso.castShadow = true; spine.add(torso);
      const vest = new THREE.Mesh(P.vest, accent); vest.castShadow = true; spine.add(vest);
      const neck = new THREE.Group(); neck.position.y = 0.52; spine.add(neck);
      const head = new THREE.Mesh(P.head, dark); head.castShadow = true; neck.add(head);
      const vis = new THREE.Mesh(P.visor, visor); neck.add(vis);
      const aim = new THREE.Group(); aim.position.y = 0.44; spine.add(aim);
      const armR = new THREE.Mesh(P.armR, body); armR.position.set(0.25, 0, 0); armR.castShadow = true; aim.add(armR);
      const armL = new THREE.Mesh(P.armL, body); armL.position.set(-0.25, 0, 0); armL.castShadow = true; aim.add(armL);
      const shR = new THREE.Mesh(P.shoulder, accent); shR.position.set(0.25, 0.02, 0); aim.add(shR);
      const shL = new THREE.Mesh(P.shoulder, accent); shL.position.set(-0.25, 0.02, 0); aim.add(shL);
      const gunMount = new THREE.Group(); gunMount.position.set(0.12, -0.24, -0.38); aim.add(gunMount);
      return { root, hips, spine, legL, legR, neck, aim, gunMount, mats: [body, accent, dark, visor], accent };
    },
  };
})();
