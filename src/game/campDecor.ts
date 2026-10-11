import * as THREE from 'three';
import { getModel, modelMeshes } from '../assets/loader';
import type { AssetName } from '../assets/manifest';
import type { Layout } from './layout';
import { mulberry32 } from './layout';
import { LANDMARKS } from './landmarks';
import { WORLD_HALF } from './constants';
import { terrainHeight } from './terrain';
import { PoissonDiskSampling2D } from '../vendor/poissonDiskSampling';

/** Assets required only for authored camp dressing, not dynamic loot. */
export const CAMP_DECOR_ASSETS: AssetName[] = [
  'table', 'chair', 'bookshelf', 'bedSingle', 'sink', 'teddy',
  'lantern', 'campfire', 'logs', 'crate', 'cooler', 'radio', 'mug', 'can', 'backpack', 'bucket', 'barrel', 'paddle', 'groundBrush',
];

function place(name: AssetName, x: number, z: number, rot = 0, y = 0): THREE.Object3D {
  const o = getModel(name);
  o.position.set(x, y, z);
  o.rotation.y = rot;
  return o;
}

function localPoint(cx: number, cz: number, rot: number, lx: number, lz: number): [number, number] {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [cx + lx * c + lz * s, cz - lx * s + lz * c];
}

function warmLight(x: number, y: number, z: number, intensity: number, distance: number, color = '#ffb15a'): THREE.PointLight {
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.position.set(x, y, z);
  light.castShadow = false;
  return light;
}

function furnishedTable(x: number, z: number, rot: number, lantern = true): THREE.Group {
  const g = new THREE.Group();
  g.name = 'imported-table-scene';
  g.add(place('table', x, z, rot));
  for (const [lx, lz, r] of [[-1.25, 0, Math.PI / 2], [1.25, 0, -Math.PI / 2], [0, -1.0, 0], [0, 1.0, Math.PI]] as [number, number, number][]) {
    const [px, pz] = localPoint(x, z, rot, lx, lz);
    g.add(place('chair', px, pz, rot + r));
  }
  if (lantern) {
    const l = place('lantern', x + Math.cos(rot) * .3, z - Math.sin(rot) * .3, rot, .88);
    g.add(l);
    g.add(warmLight(x, 1.26, z, 135, 8));
  }
  for (const side of [-1, 1]) {
    const [mx, mz] = localPoint(x, z, rot, side * .48, .15);
    g.add(place(side > 0 ? 'mug' : 'can', mx, mz, rot + side * .2, .9));
  }
  return g;
}

function litCampfire(x: number, z: number, rot = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = 'imported-campfire-scene';
  g.add(place('campfire', x, z, rot));
  g.add(warmLight(x, 1.05, z, 620, 17, '#ff7b2d'));
  g.add(warmLight(x, 2.2, z, 180, 8, '#ffc36c'));
  const ember = new THREE.Mesh(new THREE.SphereGeometry(.23, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff9a38', transparent: true, opacity: .72 }));
  ember.position.set(x, .42, z); ember.scale.set(1.3, .65, 1.3); g.add(ember);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + .35;
    g.add(place('logs', x + Math.cos(a) * 2.35, z + Math.sin(a) * 2.35, a + Math.PI / 2));
  }
  return g;
}

/** Cabin porch dressing only. Sleeping furniture is handled as interior semantic content, never here. */
function decorateCabin(g: THREE.Group, x: number, z: number, rot: number, index: number): void {
  const rng = mulberry32(0xC0FFEE + index * 977);
  const front = 4.25;
  const side = index % 2 ? 1 : -1;
  const [cx, cz] = localPoint(x, z, rot, side * 1.55, front);
  g.add(place('chair', cx, cz, rot + Math.PI));
  const [lx, lz] = localPoint(x, z, rot, -side * 1.25, front + .1);
  g.add(place('lantern', lx, lz, rot, .03));
  g.add(warmLight(lx, 1.12, lz, 120, 7.5, '#f2b766'));
  const [ix, iz] = localPoint(x, z, rot, 0, .45);
  g.add(warmLight(ix, 1.9, iz, 165, 9, '#ffd08a'));
  const [bx, bz] = localPoint(x, z, rot, side * (2.25 + rng() * .35), front - .15);
  g.add(place(index % 3 ? 'cooler' : 'backpack', bx, bz, rot + (rng() - .5) * .25));
}

function decorateLandmark(g: THREE.Group, kind: string, x: number, z: number, rot: number): void {
  const interiorIntensity = kind === 'dining' ? 330 : kind === 'kitchen' ? 265 : 220;
  g.add(warmLight(x, 2.45, z, interiorIntensity, kind === 'dining' ? 15 : 11.5, '#ffd69b'));

  if (kind === 'dining') {
    for (const [lx, lz] of [[-4.2, -1.8], [0, -1.8], [4.2, -1.8], [-4.2, 1.8], [0, 1.8], [4.2, 1.8]] as [number, number][]) {
      const [px, pz] = localPoint(x, z, rot, lx, lz); g.add(furnishedTable(px, pz, rot, false));
    }
  } else if (kind === 'director') {
    const [dx, dz] = localPoint(x, z, rot, 0, -.8); g.add(furnishedTable(dx, dz, rot, true));
    for (const [lx, lz, name] of [[-3.1, 1.5, 'bookshelf'], [3.0, 1.5, 'bookshelf']] as [number, number, AssetName][]) {
      const [px, pz] = localPoint(x, z, rot, lx, lz); g.add(place(name, px, pz, rot + Math.PI));
    }
    const [rx, rz] = localPoint(x, z, rot, .4, -.5); g.add(place('radio', rx, rz, rot, .9));
  } else if (kind === 'bathhouse') {
    for (const lx of [-3.1, 0, 3.1]) { const [px, pz] = localPoint(x, z, rot, lx, 1.9); g.add(place('sink', px, pz, rot + Math.PI)); }
  } else if (kind === 'arts') {
    for (const [lx, lz] of [[-2.7, -1.5], [2.7, -1.5], [-2.7, 1.6], [2.7, 1.6]] as [number, number][]) {
      const [px, pz] = localPoint(x, z, rot, lx, lz); g.add(furnishedTable(px, pz, rot, false));
    }
  } else if (kind === 'kitchen') {
    for (const [lx, lz] of [[-2.8, 1.6], [0, 1.6], [2.8, 1.6]] as [number, number][]) {
      const [px, pz] = localPoint(x, z, rot, lx, lz); g.add(place('table', px, pz, rot));
      g.add(place('crate', px + .5, pz + .25, rot + .2));
    }
  }
}

function addStorageYard(g: THREE.Group, cx: number, cz: number, seed: number): void {
  const rng = mulberry32(seed);
  const pts = new PoissonDiskSampling2D({ shape: [12, 8], minDistance: 1.65, maxDistance: 2.8, tries: 24 }, rng).fill();
  const pool: AssetName[] = ['crate', 'cooler', 'bucket', 'barrel', 'backpack'];
  pts.slice(0, 18).forEach(([px, pz], i) => {
    const name = pool[i % pool.length];
    g.add(place(name, cx + px - 6, cz + pz - 4, rng() * Math.PI * 2));
  });
}

const distToSegment = (px: number, pz: number, ax: number, az: number, bx: number, bz: number): number => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  if (!l2) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
};

function groundBrush(layout: Layout): THREE.Group {
  const g = new THREE.Group(); g.name = 'instanced-ground-brush';
  const rng = mulberry32(0xB12A55 ^ layout.need);
  const extent = (WORLD_HALF - 3) * 2;
  const candidates = new PoissonDiskSampling2D({ shape: [extent, extent], minDistance: 1.7, maxDistance: 3.1, tries: 22 }, rng).fill();
  const spots: { x: number; y: number; z: number; rot: number; scale: number }[] = [];
  for (const [px, pz] of candidates) {
    if (spots.length >= 850) break;
    const x = px - extent / 2, z = pz - extent / 2;
    const inLake = ((x - layout.water.x) / (layout.water.rx + 3)) ** 2 + ((z - layout.water.z) / (layout.water.rz + 3)) ** 2 < 1;
    if (inLake) continue;
    if (layout.statics.some((s) => Math.hypot(s.x - x, s.z - z) < (s.name === 'cabin' ? 6.0 : s.name === 'tent' ? 3.3 : 2.4))) continue;
    if (LANDMARKS.some((b) => Math.abs(x - b.x) < b.w / 2 + 2 && Math.abs(z - b.z) < b.d / 2 + 2)) continue;
    if (layout.roads.some((road) => road.points.slice(1).some(([bx, bz], i) => {
      const [ax, az] = road.points[i]; return distToSegment(x, z, ax, az, bx, bz) < road.width * .62 + .9;
    }))) continue;
    if (Math.hypot(x - layout.extraction.x, z - layout.extraction.z) < layout.extraction.r + 3) continue;
    // Maintained camp clearings are sparse; forest edges receive the denser ground layer.
    const deepClearing = layout.clearings.some((c) => ((x - c.x) / (c.rx * .78)) ** 2 + ((z - c.z) / (c.rz * .78)) ** 2 < 1);
    if (deepClearing && rng() < .88) continue;
    spots.push({ x, y: terrainHeight(x, z, layout) + .015, z, rot: rng() * Math.PI * 2, scale: .72 + rng() * .72 });
  }

  const temp = new THREE.Matrix4(), local = new THREE.Matrix4();
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3();
  for (const { mesh, matrix } of modelMeshes('groundBrush')) {
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, spots.length);
    for (let i = 0; i < spots.length; i++) {
      const p = spots[i]; s.set(p.scale, p.scale, p.scale);
      temp.compose(new THREE.Vector3(p.x, p.y, p.z), q.setFromAxisAngle(up, p.rot), s);
      im.setMatrixAt(i, local.multiplyMatrices(temp, matrix));
    }
    im.castShadow = false; im.receiveShadow = true; im.frustumCulled = true;
    im.instanceMatrix.needsUpdate = true; g.add(im);
  }
  return g;
}

export function buildCampDecor(layout: Layout): THREE.Group {
  const g = new THREE.Group();
  g.name = 'camp-decor-imported';

  layout.statics.filter((s) => s.name === 'cabin').forEach((s, i) => decorateCabin(g, s.x, s.z, s.rot, i));
  LANDMARKS.forEach((b) => decorateLandmark(g, b.kind, b.x, b.z, b.rot));

  for (const [x, z] of [[0, 6], [-55, 26], [50, 27], [-7, 58]] as [number, number][]) g.add(litCampfire(x, z));
  for (const [x, z, r] of [[-9, 8, .15], [8, 8, -.2], [-9, 57, .25], [4, 58, -.25], [80, -10, .4]] as [number, number, number][]) g.add(furnishedTable(x, z, r, true));

  addStorageYard(g, -101, -42, 0xA11CE);
  addStorageYard(g, 97, -29, 0xB00B5);

  g.add(place('paddle', 82.8, -6.2, .15));
  g.add(place('paddle', 83.6, -5.4, -.2));
  g.add(place('cooler', 80.7, -7.0, .05));
  g.add(place('bucket', 79.9, -6.3, .3));
  g.add(groundBrush(layout));

  return g;
}
