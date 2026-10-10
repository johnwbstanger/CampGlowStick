import * as THREE from 'three';
import { getModel } from '../assets/loader';
import type { AssetName } from '../assets/manifest';
import type { Layout } from './layout';
import { mulberry32 } from './layout';
import { terrainHeight } from './terrain';
import { LANDMARKS } from './landmarks';
import { poisson2d } from '../vendor/poisson2d';

/** Assets required only for authored camp dressing, not dynamic loot. */
export const CAMP_DECOR_ASSETS: AssetName[] = [
  'table', 'chair', 'bookshelf', 'bedSingle', 'sink', 'teddy',
  'lantern', 'campfire', 'logs', 'crate', 'cooler', 'radio', 'mug', 'can', 'backpack', 'bucket', 'barrel', 'paddle',
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
    const light = new THREE.PointLight('#ffb15a', 9, 6.5, 2);
    light.position.set(x, 1.22, z);
    g.add(light);
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
  const light = new THREE.PointLight('#ff8c36', 42, 12, 2);
  light.position.set(x, 1.0, z);
  g.add(light);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + .35;
    g.add(place('logs', x + Math.cos(a) * 2.35, z + Math.sin(a) * 2.35, a + Math.PI / 2));
  }
  return g;
}

function decorateCabin(g: THREE.Group, x: number, z: number, rot: number, index: number): void {
  // Cabins get small authored porch vignettes instead of a ring of random props.
  const rng = mulberry32(0xC0FFEE + index * 977);
  const front = 3.9;
  const side = index % 2 ? 1 : -1;
  const [cx, cz] = localPoint(x, z, rot, side * 1.55, front);
  g.add(place('chair', cx, cz, rot + Math.PI));
  const [lx, lz] = localPoint(x, z, rot, -side * 1.25, front + .1);
  g.add(place('lantern', lx, lz, rot, .03));
  const light = new THREE.PointLight('#f2b766', 7, 5, 2);
  light.position.set(lx, 1.0, lz);
  g.add(light);
  const [bx, bz] = localPoint(x, z, rot, side * (2.25 + rng() * .35), front - .15);
  g.add(place(index % 3 ? 'cooler' : 'backpack', bx, bz, rot + (rng() - .5) * .25));
  const [tx, tz] = localPoint(x, z, rot, -side * 2.2, front - .3);
  if (index % 4 === 0) g.add(place('teddy', tx, tz, rot + .2));
}

function decorateLandmark(g: THREE.Group, kind: string, x: number, z: number, rot: number): void {
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
  const pts = poisson2d({ width: 12, height: 8, minDistance: 1.65, maxDistance: 2.8, tries: 24, rng });
  const pool: AssetName[] = ['crate', 'cooler', 'bucket', 'barrel', 'backpack'];
  pts.slice(0, 18).forEach(([px, pz], i) => {
    const name = pool[i % pool.length];
    g.add(place(name, cx + px - 6, cz + pz - 4, rng() * Math.PI * 2));
  });
}

/**
 * Lived-in organization pass. All visible furniture/props here are imported GLBs;
 * the only generated geometry left in this module is light itself.
 */
export function buildCampDecor(layout: Layout): THREE.Group {
  const g = new THREE.Group();
  g.name = 'camp-decor-imported';

  layout.statics.filter((s) => s.name === 'cabin').forEach((s, i) => decorateCabin(g, s.x, s.z, s.rot, i));
  LANDMARKS.forEach((b) => decorateLandmark(g, b.kind, b.x, b.z, b.rot));

  for (const [x, z] of [[0, 6], [-55, 26], [50, 27], [-7, 58]] as [number, number][]) g.add(litCampfire(x, z));
  for (const [x, z, r] of [[-9, 8, .15], [8, 8, -.2], [-9, 57, .25], [4, 58, -.25], [80, -10, .4]] as [number, number, number][]) g.add(furnishedTable(x, z, r, true));

  // Maintenance and waterfront get structured yards using a vendored MIT Poisson sampler,
  // so objects feel naturally spaced instead of uniformly random or piled at world origin.
  addStorageYard(g, -101, -42, 0xA11CE);
  addStorageYard(g, 97, -29, 0xB00B5);

  // A few intentional activity props at the lake.
  g.add(place('paddle', 82.8, -6.2, .15));
  g.add(place('paddle', 83.6, -5.4, -.2));
  g.add(place('cooler', 80.7, -7.0, .05));
  g.add(place('bucket', 79.9, -6.3, .3));

  return g;
}
