import * as THREE from 'three';
import { buildAtlas, paintCustomArt, VARIANTS } from './art.js';
import { S, STK, buildProductMeshes } from './geometry.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* Studio-omgeving voor realistische reflecties (geen HDR-bestand)     */
/* ------------------------------------------------------------------ */

function createStudioEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(12, 8, 12),
      new THREE.MeshBasicMaterial({ color: 0x3d434c, side: THREE.BackSide })
    )
  );
  const panel = (w, h, color, intensity, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }));
    m.material.color.multiplyScalar(intensity);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    env.add(m);
  };
  panel(9, 7, 0xffffff, 8, [0, 3.9, 0], [Math.PI / 2, 0, 0]);
  panel(9, 7, 0xf3f6ff, 2.6, [0, 0.3, 5.9], [0, 0, 0]);
  panel(6, 6, 0xbcd4ff, 2.2, [-5.9, 0.4, 0], [0, Math.PI / 2, 0]);
  panel(6, 6, 0xffd9b0, 2.8, [5.9, 0.2, 0], [0, -Math.PI / 2, 0]);
  panel(0.9, 7, 0xffffff, 10, [-1.7, 1.4, -3.2], [0, 0.5, 0.5]);
  panel(6, 6, 0x171b22, 1, [0, -3.9, 0], [-Math.PI / 2, 0, 0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, 0.03);
  pmrem.dispose();
  env.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  return target.texture;
}

function createShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.26)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Viewer                                                              */
/* ------------------------------------------------------------------ */

class ProductViewer {
  constructor(container) {
    this.container = container;
    this.variantKey = 'google-wit';
    this.customArt = { front: null, back: null };

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.environment = createStudioEnvironment(this.renderer);
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.buildLighting();
    this.buildProduct();

    this.rot = { x: 0.02, y: -0.42 };
    this.vel = { x: 0, y: 0 };
    this.pointerTilt = { x: 0, y: 0 };
    this.dragging = false;
    this.snapTarget = null;
    this.idleSince = performance.now();
    this.t0 = performance.now();
    this.visible = true;

    this.bindPointer();
    this.bindResize();
    this.bindVisibility();
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /* ---------- opbouw ---------- */

  buildProduct() {
    const v = VARIANTS[this.variantKey];

    // Oude meshes en texturen opruimen bij een variantwissel.
    if (this.product) {
      this.pivot.remove(this.product.group);
      this.product.group.traverse((o) => o.geometry && o.geometry.dispose());
      this.colorTex.dispose();
      this.ormTex.dispose();
      this.faceMaterial.dispose();
      this.rimMaterial.dispose();
    }

    this.colorCanvas = buildAtlas(v, 'color');
    this.ormCanvas = buildAtlas(v, 'orm');

    this.colorTex = new THREE.CanvasTexture(this.colorCanvas);
    this.colorTex.colorSpace = THREE.SRGBColorSpace;
    this.colorTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.ormTex = new THREE.CanvasTexture(this.ormCanvas);
    this.ormTex.anisotropy = this.colorTex.anisotropy;

    this.faceMaterial = new THREE.MeshPhysicalMaterial({
      map: this.colorTex,
      roughnessMap: this.ormTex,
      metalnessMap: this.ormTex,
      roughness: 1,
      metalness: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.2,
    });
    this.rimMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(v.rim),
      roughness: 0.18,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.2,
    });

    this.product = buildProductMeshes(v, this.faceMaterial, this.rimMaterial);
    // Verticaal centreren rond de oorsprong.
    const centerY = this.product.minY + this.product.height / 2;
    this.product.group.position.y = -centerY;
    this.pivot.add(this.product.group);

    this.floorY = this.product.minY - centerY;
    if (this.shadow) this.shadow.position.y = this.floorY + 0.004;
    this.buildTapPulse(v);
    this.resize();
  }

  buildLighting() {
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2.4, 4.2, 3.4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfd6ff, 0.4);
    rim.position.set(-3, 1.5, -2.5);
    this.scene.add(rim);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: createShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.75,
      })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);
  }

  buildTapPulse(v) {
    if (this.pulse) this.pulse.parent.remove(this.pulse);
    const isSticker = v.kind === 'sticker';
    const w = isSticker ? STK.w : S.panelW;
    const h = isSticker ? STK.h : S.panelH;
    const t = isSticker ? STK.t : S.t;
    this.pulse = new THREE.Group();
    this.pulse.position.set(
      (v.tapSpot.u - 0.5) * w,
      (v.tapSpot.v - 0.5) * h,
      t / 2 + 0.006
    );
    this.rings = [];
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.0, 72),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      mesh.scale.setScalar(0.001);
      mesh.userData.t = -1;
      mesh.userData.delay = i * 0.16;
      this.pulse.add(mesh);
      this.rings.push(mesh);
    }
    this.product.panel.add(this.pulse);
  }

  /* ---------- interactie ---------- */

  bindPointer() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    let last = null;
    let moved = 0;

    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.dragging = true;
      this.snapTarget = null;
      last = { x: e.clientX, y: e.clientY };
      moved = 0;
      this.container.classList.add('is-grabbing');
    });

    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      this.pointerTilt.y = ((e.clientX - rect.left) / rect.width - 0.5) * 0.2;
      this.pointerTilt.x = ((e.clientY - rect.top) / rect.height - 0.5) * 0.08;
      if (!this.dragging || !last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      this.rot.y += dx * 0.008;
      this.rot.x = THREE.MathUtils.clamp(this.rot.x + dy * 0.005, -0.24, 0.42);
      this.vel.y = dx * 0.008;
      this.vel.x = dy * 0.005;
      last = { x: e.clientX, y: e.clientY };
      this.idleSince = performance.now();
    });

    const end = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.container.classList.remove('is-grabbing');
      this.idleSince = performance.now();
      if (moved < 6) this.flip();
      last = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', () => {
      this.pointerTilt.x = 0;
      this.pointerTilt.y = 0;
    });
  }

  bindResize() {
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);
  }

  bindVisibility() {
    this.io = new IntersectionObserver(([entry]) => (this.visible = entry.isIntersecting), {
      threshold: 0.01,
    });
    this.io.observe(this.container);
    document.addEventListener('visibilitychange', () => {
      this.visible = !document.hidden;
    });
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h || !this.product) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const spread = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const distH = (this.product.height * 1.62) / spread;
    const distW = (this.product.width * 1.85) / (spread * this.camera.aspect);
    this.camera.position.set(0, this.product.height * 0.2, Math.max(distH, distW, 3.4));
    this.camera.lookAt(0, this.product.height * 0.02, 0);
    this.camera.updateProjectionMatrix();
  }

  /* ---------- acties ---------- */

  flip() {
    this.snapTarget = { y: this.rot.y + Math.PI, x: 0.02 };
    this.vel.x = 0;
    this.vel.y = 0;
    this.idleSince = performance.now();
    this.tap();
  }

  tap() {
    const now = (performance.now() - this.t0) / 1000;
    for (const ring of this.rings) ring.userData.t = now + ring.userData.delay;
  }

  setVariant(key) {
    this.variantKey = key;
    this.customArt = { front: null, back: null };
    this.buildProduct();
  }

  facingSide() {
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
      this.product.panel.getWorldQuaternion(new THREE.Quaternion())
    );
    return normal.dot(this.camera.position) >= 0 ? 'front' : 'back';
  }

  applyCustomArt(side, image, store = true) {
    const v = VARIANTS[this.variantKey];
    if (store) this.customArt[side] = image;
    paintCustomArt(this.colorCanvas, v, side, image);
    const oc = this.ormCanvas.getContext('2d');
    oc.fillStyle = 'rgb(0,40,0)';
    oc.fillRect(side === 'front' ? 0 : this.ormCanvas.width / 2, 0, this.ormCanvas.width / 2, this.ormCanvas.height);
    this.colorTex.needsUpdate = true;
    this.ormTex.needsUpdate = true;
  }

  resetArt() {
    this.customArt = { front: null, back: null };
    const v = VARIANTS[this.variantKey];
    const color = buildAtlas(v, 'color');
    const orm = buildAtlas(v, 'orm');
    this.colorCanvas.getContext('2d').drawImage(color, 0, 0);
    this.ormCanvas.getContext('2d').drawImage(orm, 0, 0);
    this.colorTex.needsUpdate = true;
    this.ormTex.needsUpdate = true;
  }

  /* ---------- animatielus ---------- */

  frame() {
    if (!this.visible || !this.product) return;
    const t = (performance.now() - this.t0) / 1000;
    const idle = performance.now() - this.idleSince > 2200;

    if (this.snapTarget) {
      this.rot.y += (this.snapTarget.y - this.rot.y) * 0.14;
      this.rot.x += (this.snapTarget.x - this.rot.x) * 0.12;
      if (Math.abs(this.snapTarget.y - this.rot.y) < 0.002) {
        this.rot.y = this.snapTarget.y;
        this.snapTarget = null;
      }
    } else if (!this.dragging) {
      this.rot.y += this.vel.y;
      this.rot.x = THREE.MathUtils.clamp(this.rot.x + this.vel.x, -0.24, 0.42);
      this.vel.y *= 0.94;
      this.vel.x *= 0.9;
      if (idle && !reducedMotion) {
        this.vel.y += (0.0032 - this.vel.y) * 0.02;
        this.rot.x += (0.02 - this.rot.x) * 0.02;
      }
    }

    this.pivot.rotation.y = this.rot.y + this.pointerTilt.y;
    this.pivot.rotation.x = this.rot.x + this.pointerTilt.x;

    const depth = VARIANTS[this.variantKey].kind === 'sticker' ? STK.t * 8 : S.baseD;
    const yaw = this.pivot.rotation.y;
    const cos = Math.abs(Math.cos(yaw));
    const sin = Math.abs(Math.sin(yaw));
    this.shadow.position.y = this.floorY + 0.004;
    this.shadow.scale.set(
      (this.product.width * cos + depth * sin) * 1.75,
      (this.product.width * sin + depth * cos) * 1.75,
      1
    );
    this.shadow.material.opacity = 0.62 - Math.max(0, this.pivot.rotation.x) * 0.5;

    for (const ring of this.rings) {
      const start = ring.userData.t;
      if (start < 0) continue;
      const age = t - start;
      if (age < 0) continue;
      const p = age / 1.5;
      if (p >= 1) {
        ring.userData.t = -1;
        ring.material.opacity = 0;
        continue;
      }
      const eased = 1 - Math.pow(1 - p, 2.6);
      ring.scale.setScalar(0.015 + eased * 0.36);
      ring.material.opacity = (1 - p) * 0.5;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

/* ------------------------------------------------------------------ */
/* UI-koppeling                                                        */
/* ------------------------------------------------------------------ */

function boot() {
  const stage = document.getElementById('stage');
  const fallback = document.getElementById('fallback');

  let viewer;
  try {
    viewer = new ProductViewer(stage);
  } catch (err) {
    console.error(err);
    stage.hidden = true;
    fallback.hidden = false;
    return;
  }

  const swatches = document.getElementById('swatches');
  const title = document.getElementById('variant-name');
  if (title) title.textContent = VARIANTS[viewer.variantKey].label;
  Object.entries(VARIANTS).forEach(([key, v]) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (key === viewer.variantKey ? ' is-active' : '');
    b.type = 'button';
    b.title = v.label;
    b.setAttribute('aria-label', v.label);
    b.style.setProperty('--swatch', v.swatch);
    b.addEventListener('click', () => {
      viewer.setVariant(key);
      swatches.querySelectorAll('.swatch').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
      if (title) title.textContent = v.label;
    });
    swatches.appendChild(b);
  });

  document.getElementById('btn-flip').addEventListener('click', () => viewer.flip());
  document.getElementById('btn-tap').addEventListener('click', () => viewer.tap());
  document.getElementById('btn-reset').addEventListener('click', () => viewer.resetArt());

  const fileInput = document.getElementById('file');
  document.getElementById('btn-art').addEventListener('click', () => fileInput.click());

  const loadImage = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      viewer.applyCustomArt(viewer.facingSide(), img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  fileInput.addEventListener('change', (e) => loadImage(e.target.files[0]));

  const dropZone = document.getElementById('viewer');
  ['dragenter', 'dragover'].forEach((ev) =>
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.add('is-dropping');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === 'dragleave' && dropZone.contains(e.relatedTarget)) return;
      dropZone.classList.remove('is-dropping');
    })
  );
  dropZone.addEventListener('drop', (e) => loadImage(e.dataTransfer.files[0]));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') viewer.flip();
    if (e.key === 't' || e.key === 'T') viewer.tap();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
