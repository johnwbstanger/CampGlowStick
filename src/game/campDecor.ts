import * as THREE from 'three';
import { getModel } from '../assets/loader';
import type { AssetName } from '../assets/manifest';
import type { Layout } from './layout';
import { LANDMARKS } from './landmarks';
import { terrainHeight } from './terrain';

type Spot = { name: AssetName; x: number; z: number; rot?: number; scale?: number; y?: number };

function imported(spot: Spot, layout: Layout): THREE.Object3D {
  const o = getModel(spot.name);
  const s = spot.scale ?? 1;
  o.scale.multiplyScalar(s);
  o.position.set(spot.x, terrainHeight(spot.x, spot.z, layout) + (spot.y ?? 0), spot.z);
  o.rotation.y = spot.rot ?? 0;
  o.name = `decor-${spot.name}`;
  o.traverse((n) => {
    if (n instanceof THREE.Mesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  return o;
}

function addWarmLight(parent: THREE.Group, x: number, z: number, y = 1.3, strength = 18, distance = 8): void {
  const light = new THREE.PointLight('#f0a85f', strength, distance, 2);
  light.position.set(x, terrainHeight(x, z) + y, z);
  parent.add(light);
}

function campfire(g: THREE.Group, layout: Layout, x: number, z: number): void {
  g.add(imported({ name: 'campfire', x, z }, layout));
  g.add(imported({ name: 'logs', x: x + 1.25, z: z + .3, rot: .35, scale: .8 }, layout));
  addWarmLight(g, x, z, .8, 34, 11);
}

function lantern(g: THREE.Group, layout: Layout, x: number, z: number, y = .82): void {
  g.add(imported({ name: 'lantern', x, z, y, scale: .72 }, layout));
  addWarmLight(g, x, z, y + .18, 10, 5.5);
}

/**
 * Authored prop cluster: the randomness is only small rotation/offset variation inside a
 * human-designed use zone. Props are never sprayed globally across the camp.
 */
function supplyCluster(g: THREE.Group, layout: Layout, x: number, z: number, rot = 0, variant = 0): void {
  const c = Math.cos(rot), s = Math.sin(rot);
  const local = (name: AssetName, dx: number, dz: number, r = 0, scale = 1) => {
    const wx = x + dx * c - dz * s, wz = z + dx * s + dz * c;
    g.add(imported({ name, x: wx, z: wz, rot: rot + r, scale }, layout));
  };
  local('bigCrate', 0, 0, .05, 1.05);
  local('crate', .68, .08, -.1, .95);
  local('cooler', -.72, .13, .08, 1.0);
  local('bedroll', .15, -.68, .4, .9);
  if (variant % 2 === 0) local('bucket', -.15, .72, -.2, .9);
  else local('barrel', -.18, .82, .1, .72);
  if (variant % 3 === 0) local('bottle', .62, -.62, .22, .92);
}

function cabinLife(g: THREE.Group, layout: Layout): void {
  const cabins = layout.statics.filter((s) => s.name === 'cabin');
  cabins.forEach((cab, i) => {
    // Bed/bunk is centered toward the rear of the structure, leaving the doorway clear.
    const fwdX = Math.sin(cab.rot), fwdZ = Math.cos(cab.rot);
    const rightX = Math.cos(cab.rot), rightZ = -Math.sin(cab.rot);
    const backX = cab.x - fwdX * 1.55, backZ = cab.z - fwdZ * 1.55;
    g.add(imported({ name: 'bunk', x: backX + rightX * 1.25, z: backZ + rightZ * 1.25, rot: cab.rot + Math.PI / 2, scale: .86 }, layout));
    if (i % 2 === 0) g.add(imported({ name: 'bedroll', x: backX - rightX * 1.15, z: backZ - rightZ * 1.15, rot: cab.rot, scale: .85 }, layout));

    // Porch gear reads as something counselors actually left there, not level-editor scatter.
    const porchX = cab.x + fwdX * 3.1, porchZ = cab.z + fwdZ * 3.1;
    g.add(imported({ name: 'cooler', x: porchX + rightX * .7, z: porchZ + rightZ * .7, rot: cab.rot, scale: .9 }, layout));
    if (i % 3 === 0) g.add(imported({ name: 'crate', x: porchX - rightX * .55, z: porchZ - rightZ * .55, rot: cab.rot + .1, scale: .9 }, layout));
    if (i % 2 === 0) lantern(g, layout, porchX, porchZ, .72);
  });
}

function waterfront(g: THREE.Group, layout: Layout): void {
  const w = layout.water;
  const shoreX = w.x - w.rx - 4;
  for (let i = 0; i < 3; i++) {
    g.add(imported({ name: 'canoe', x: shoreX - i * 1.35, z: w.z - 4 + i * 2.0, rot: Math.PI / 2 + i * .05, scale: .92 }, layout));
    g.add(imported({ name: 'paddle', x: shoreX - .6 - i * 1.25, z: w.z - 2.9 + i * 2.0, rot: Math.PI / 2 + .12, scale: 1.0 }, layout));
  }
  supplyCluster(g, layout, shoreX - 3, w.z + 5, -.3, 2);
  g.add(imported({ name: 'sign', x: shoreX - 1.5, z: w.z - 8, rot: Math.PI / 2 }, layout));
}

function activityZones(g: THREE.Group, layout: Layout): void {
  // Dining / central social area: food and radio live together rather than floating in a field.
  const dining: Spot[] = [
    { name: 'bigCrate', x: -8.4, z: 8.7, rot: .15 },
    { name: 'cooler', x: -7.4, z: 8.8, rot: -.08 },
    { name: 'mug', x: -6.8, z: 8.4, rot: .3 },
    { name: 'radio', x: 7.2, z: 8.2, rot: -.2 },
    { name: 'bottle', x: 7.7, z: 8.65 },
  ];
  dining.forEach((p) => g.add(imported(p, layout)));

  // Maintenance / service clusters.
  [[-79, -42, .2], [-40, -56, -.2], [22, -54, .15], [63, -38, -.25], [-98, -39, -.2]].forEach((p, i) =>
    supplyCluster(g, layout, p[0], p[1], p[2], i)
  );

  // Campsite clusters: sleeping gear, supplies and local firewood.
  [[-55, 26, .2], [50, 27, -.2], [-7, 58, .1]].forEach((p, i) => {
    supplyCluster(g, layout, p[0] + 2.1, p[1] + 1.2, p[2], i + 3);
    g.add(imported({ name: 'bedroll', x: p[0] - 2.2, z: p[1] + .8, rot: p[2] + .4 }, layout));
  });
}

/** Asset-first world dressing using shipped CC0 models instead of procedural boxes/cylinders. */
export function buildCampDecor(layout: Layout): THREE.Group {
  const g = new THREE.Group();
  g.name = 'camp-decor-imported';

  cabinLife(g, layout);
  activityZones(g, layout);
  waterfront(g, layout);

  for (const [x, z] of [[0, 6], [-55, 26], [50, 27], [-7, 58]] as [number, number][]) campfire(g, layout, x, z);

  // Warm lantern pools belong at paths/building thresholds; no generic sci-fi streetlights.
  for (const [x, z] of [[-54, 23], [-25, 13], [28, 2], [57, 11], [80, 19], [-43, -63]] as [number, number][]) lantern(g, layout, x, z, .72);
  for (const b of LANDMARKS) lantern(g, layout, b.x, b.z + b.d * .52, .78);

  return g;
}
