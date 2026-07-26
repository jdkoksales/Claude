// Gedeelde geometrie: gebruikt door de viewer én de GLB-exporter, zodat
// beide exact hetzelfde model opleveren.

import * as THREE from 'three';
import { STAND_MM, STICKER_MM } from './art.js';

export const MM = 1 / 50; // 50 mm = 1 scene-unit

export const S = {
  panelW: STAND_MM.panelW * MM,
  panelH: STAND_MM.panelH * MM,
  t: STAND_MM.thickness * MM,
  r: STAND_MM.radius * MM,
  baseD: STAND_MM.baseDepth * MM,
  tilt: THREE.MathUtils.degToRad(STAND_MM.tiltDeg),
};

export const STK = {
  w: STICKER_MM.w * MM,
  h: STICKER_MM.h * MM,
  t: STICKER_MM.thickness * MM,
  r: STICKER_MM.radius * MM,
};

export const BEVEL = 0.006;
export const STAND_H = S.panelH * Math.cos(S.tilt);

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function extrudeRounded(w, h, thickness, radius, uvGenerator) {
  const depth = thickness - BEVEL * 2;
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, radius), {
    depth,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 3,
    curveSegments: 20,
    UVGenerator: uvGenerator,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

// UV's voor een bedrukte plaat: voor- en achterkant delen één atlas
// (linker-/rechterhelft); de achterkant spiegelt horizontaal.
function panelUVGenerator(w, h, thickness) {
  const midZ = (thickness - BEVEL * 2) / 2;
  return {
    generateTopUV(geometry, vertices, ia, ib, ic) {
      const out = [];
      for (const i of [ia, ib, ic]) {
        const x = vertices[i * 3];
        const y = vertices[i * 3 + 1];
        const z = vertices[i * 3 + 2];
        const nx = (x + w / 2) / w;
        const ny = (y + h / 2) / h;
        const u = z > midZ ? nx * 0.5 : 0.5 + (1 - nx) * 0.5;
        out.push(new THREE.Vector2(u, ny));
      }
      return out;
    },
    generateSideWallUV() {
      return [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(1, 0),
        new THREE.Vector2(1, 1),
        new THREE.Vector2(0, 1),
      ];
    },
  };
}

export function createPrintedPlate(w, h, thickness, radius) {
  return extrudeRounded(w, h, thickness, radius, panelUVGenerator(w, h, thickness));
}

// Bouwt het product voor een variant. Retourneert de groep plus
// afmetingsinfo: minY (grondcontact) en height, relatief aan de groep.
export function buildProductMeshes(variant, faceMaterial, rimMaterial) {
  if (variant.kind === 'sticker') {
    const plate = new THREE.Mesh(
      createPrintedPlate(STK.w, STK.h, STK.t, STK.r),
      [faceMaterial, rimMaterial]
    );
    const group = new THREE.Group();
    group.add(plate);
    return { group, panel: plate, minY: -STK.h / 2, height: STK.h, width: STK.w };
  }

  const panel = new THREE.Mesh(
    createPrintedPlate(S.panelW, S.panelH, S.t, S.r),
    [faceMaterial, rimMaterial]
  );
  panel.rotation.x = -S.tilt;
  panel.position.set(
    0,
    (S.panelH / 2) * Math.cos(S.tilt),
    -(S.panelH / 2) * Math.sin(S.tilt)
  );

  const base = new THREE.Mesh(
    extrudeRounded(S.panelW, S.baseD, S.t, S.r),
    rimMaterial
  );
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, -S.t / 2, -S.baseD / 2 + S.r * 0.3);

  const group = new THREE.Group();
  group.add(panel, base);
  return { group, panel, minY: -S.t, height: STAND_H, width: S.panelW };
}
