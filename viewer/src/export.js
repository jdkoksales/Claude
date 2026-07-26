// Exportpagina: per variant een GLB (Shopify 3D-viewer + AR) en
// hoge-resolutie renders. Headless aangestuurd via window.exportVariant /
// window.renderVariant.

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildAtlas, VARIANTS } from './art.js';
import { buildProductMeshes } from './geometry.js';

function makeMaterials(key) {
  const v = VARIANTS[key];
  const colorTex = new THREE.CanvasTexture(buildAtlas(v, 'color'));
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.flipY = true;
  const ormTex = new THREE.CanvasTexture(buildAtlas(v, 'orm'));

  const face = new THREE.MeshPhysicalMaterial({
    map: colorTex,
    roughnessMap: ormTex,
    metalnessMap: ormTex,
    roughness: 1,
    metalness: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  const rim = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(v.rim),
    roughness: 0.18,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  return { face, rim };
}

/* ---------- GLB ---------- */

window.exportVariant = (key) =>
  new Promise((resolve, reject) => {
    const v = VARIANTS[key];
    const { face, rim } = makeMaterials(key);
    const product = buildProductMeshes(v, face, rim);
    // Grondcontact op y=0 en in meters (glTF-conventie): 1 unit = 50 mm.
    const root = new THREE.Group();
    root.name = 'TapKaarten-' + key;
    product.group.position.y = -product.minY;
    root.add(product.group);
    root.scale.setScalar(0.05);
    root.updateMatrixWorld(true);

    new GLTFExporter().parse(
      root,
      (buffer) => {
        const bytes = new Uint8Array(buffer);
        let bin = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        resolve(btoa(bin));
      },
      reject,
      { binary: true }
    );
  });

/* ---------- Renders ---------- */

let R = null;
let ENV = null;
function renderer() {
  if (R) return R;
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1);
  R.toneMapping = THREE.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.05;
  document.body.appendChild(R.domElement);
  return R;
}

function studioEnv(r) {
  if (ENV) return ENV;
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
  const pmrem = new THREE.PMREMGenerator(r);
  ENV = pmrem.fromScene(env, 0.03).texture;
  pmrem.dispose();
  return ENV;
}

function shadowTexture() {
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

// yawDeg: 0 = frontaal. Levert een PNG-dataURL met studioachtergrond.
window.renderVariant = (key, yawDeg, size) => {
  const r = renderer();
  r.setSize(size, size, false);

  const v = VARIANTS[key];
  const scene = new THREE.Scene();
  scene.environment = studioEnv(r);
  scene.background = new THREE.Color(0xf1f2f5);

  const { face, rim } = makeMaterials(key);
  const product = buildProductMeshes(v, face, rim);
  const centerY = product.minY + product.height / 2;
  product.group.position.y = -centerY;
  const pivot = new THREE.Group();
  pivot.add(product.group);
  pivot.rotation.y = (yawDeg * Math.PI) / 180;
  scene.add(pivot);

  const depth = v.kind === 'sticker' ? 0.3 : 1.0;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = product.minY - centerY + 0.004;
  const cos = Math.abs(Math.cos(pivot.rotation.y));
  const sin = Math.abs(Math.sin(pivot.rotation.y));
  shadow.scale.set(
    (product.width * cos + depth * sin) * 1.75,
    (product.width * sin + depth * cos) * 1.75,
    1
  );
  scene.add(shadow);

  const key1 = new THREE.DirectionalLight(0xffffff, 1.1);
  key1.position.set(2.4, 4.2, 3.4);
  scene.add(key1);
  const rim1 = new THREE.DirectionalLight(0xbfd6ff, 0.4);
  rim1.position.set(-3, 1.5, -2.5);
  scene.add(rim1);

  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const spread = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
  const dist = Math.max(
    (product.height * 1.5) / spread,
    (product.width * 1.7) / spread,
    3.4
  );
  cam.position.set(0, product.height * 0.2, dist);
  cam.lookAt(0, product.height * 0.01, 0);
  cam.updateProjectionMatrix();

  r.render(scene, cam);
  return r.domElement.toDataURL('image/png');
};

window.EXPORT_VARIANTS = Object.keys(VARIANTS);
window.EXPORT_READY = true;
