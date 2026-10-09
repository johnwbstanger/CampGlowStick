import type { AssetName } from '../assets/manifest';
import { pickGraffiti } from './graffiti';
import { WORLD_HALF } from './constants';

export interface Placed { name: AssetName; x: number; z: number; rot: number; solid: boolean }
export interface Decal { host: number; side: number; text: string; creepy: boolean }
export interface ItemSpawn { model: AssetName; kind: 'prop' | 'loot'; x: number; z: number }
export interface Road { points: [number, number][]; width: number }
export interface Clearing { x: number; z: number; rx: number; rz: number }
export interface Layout {
  statics: Placed[]; trees: Placed[]; decals: Decal[]; items: ItemSpawn[]; spawns: [number, number][];
  roads: Road[]; clearings: Clearing[];
  extraction: { x: number; z: number; r: number }; monsterStart: [number, number]; need: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const CABINS: [number, number][] = [[-34, -20], [-18, -27], [19, -28], [36, -19], [-37, 15], [-19, 25], [19, 25], [38, 14]];
const faceCentre = (x: number, z: number): number => Math.atan2(-x, -z);
const distToSegment = (px: number, pz: number, ax: number, az: number, bx: number, bz: number): number => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  if (!l2) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
};

/** Deterministic campground plan. The overlay drives roads, clearings, structures, trees and prop zones. */
export function buildLayout(seed: number, need = 3): Layout {
  const rng = mulberry32(seed);
  const roads: Road[] = [
    { width: 6.5, points: [[-72, 47], [-52, 35], [-31, 23], [-8, 12], [17, 8], [42, 14], [68, 24]] },
    { width: 5.2, points: [[-31, 23], [-35, 0], [-31, -22], [-10, -39], [18, -40], [42, -25], [42, 14]] },
    { width: 4.4, points: [[-8, 12], [-19, 25], [-37, 15]] },
    { width: 4.4, points: [[17, 8], [19, 25], [38, 14]] },
    { width: 4.2, points: [[-10, -39], [-18, -27], [-34, -20]] },
    { width: 4.2, points: [[18, -40], [19, -28], [36, -19]] },
    { width: 4.0, points: [[42, 14], [58, 5], [65, -8]] },
  ];
  const clearings: Clearing[] = [
    { x: 0, z: 6, rx: 16, rz: 13 },
    { x: -26, z: -24, rx: 22, rz: 15 },
    { x: 27, z: -24, rx: 22, rz: 15 },
    { x: -27, z: 20, rx: 23, rz: 15 },
    { x: 28, z: 20, rx: 23, rz: 15 },
    { x: 57, z: 5, rx: 15, rz: 13 },
  ];

  const statics: Placed[] = [];
  const add = (name: AssetName, x: number, z: number, rot: number, solid = true) => statics.push({ name, x, z, rot, solid });
  add('campfire', 0, 6, 0);
  CABINS.forEach(([x, z]) => add('cabin', x, z, faceCentre(x, z)));
  add('shed', -8, -55, 0);
  add('bus', 66, 24, Math.PI / 2);
  add('tent', -8, 21, 0.6); add('tent', 10, 20, -0.5); add('tent', -9, -19, 0.25); add('tent', 9, -18, -0.2);
  add('canoe', 58, 3, 0.4); add('logs', 4, 10, 0.8); add('logs', -5, 2, 2.1);
  add('rock', -54, -4, 1); add('rock', 52, 33, 2); add('boulder', 8, 55, 0.2);
  add('sign', -47, 33, 0.3); add('sign', 43, 14, -0.4); add('sign', -6, -43, 0.1);
  CABINS.slice(0, 4).forEach(([x, z]) => add('bunk', x + (x < 0 ? 3 : -3), z + (z < 0 ? 3 : -3), rng() * 3));

  const keepOut = statics.map((s) => [s.x, s.z] as const);
  const nearRoad = (x: number, z: number): boolean => roads.some((road) => road.points.slice(1).some(([bx, bz], i) => {
    const [ax, az] = road.points[i]; return distToSegment(x, z, ax, az, bx, bz) < road.width * 0.75 + 1.8;
  }));
  const inClearing = (x: number, z: number): boolean => clearings.some((c) => ((x - c.x) / c.rx) ** 2 + ((z - c.z) / c.rz) ** 2 < 1);

  const trees: Placed[] = [];
  const kinds: AssetName[] = ['tree', 'tree2', 'tree3'];
  for (let i = 0; i < 1600 && trees.length < 210; i++) {
    const x = (rng() * 2 - 1) * (WORLD_HALF - 4), z = (rng() * 2 - 1) * (WORLD_HALF - 4);
    if (keepOut.some(([kx, kz]) => Math.hypot(kx - x, kz - z) < 6)) continue;
    if (nearRoad(x, z) || inClearing(x, z)) continue;
    if (Math.hypot(x - 66, z - 24) < 10) continue;
    trees.push({ name: kinds[Math.floor(rng() * kinds.length)], x, z, rot: rng() * Math.PI * 2, solid: true });
  }

  const decals: Decal[] = [];
  CABINS.slice(0, 4).forEach((_, i) => { for (let side = 0; side < 2; side++) { const text = pickGraffiti(rng); decals.push({ host: i, side, text, creepy: text.startsWith('I SAW') || text.startsWith('IT ') || text.startsWith('DON') }); } });
  decals.push({ host: 4, side: 0, text: 'DO NOT EAT THE CHILI', creepy: false });

  const items: ItemSpawn[] = [];
  const lootModels: AssetName[] = ['lantern', 'radio', 'backpack', 'cooler', 'lantern', 'radio', 'backpack', 'cooler'];
  const lootSpots: [number, number][] = [[-32, -18], [-18, -24], [18, -25], [34, -18], [-35, 14], [-18, 22], [18, 22], [36, 13]];
  for (let i = 0; i < Math.max(need + 3, 6); i++) items.push({ model: lootModels[i % lootModels.length], kind: 'loot', x: lootSpots[i % lootSpots.length][0], z: lootSpots[i % lootSpots.length][1] });

  const zone = (cx: number, cz: number, rx: number, rz: number, pool: AssetName[], count: number) => {
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng());
      items.push({ model: pool[Math.floor(rng() * pool.length)], kind: 'prop', x: cx + Math.cos(a) * rx * r, z: cz + Math.sin(a) * rz * r });
    }
  };
  const campPool: AssetName[] = ['mug', 'bottle', 'can', 'bucket', 'lantern', 'radio', 'backpack', 'cooler', 'crate', 'sock'];
  const workPool: AssetName[] = ['crate', 'bucket', 'barrel', 'axe', 'bottle', 'can', 'paddle'];
  CABINS.forEach(([x, z]) => zone(x, z, 6.5, 5, campPool, 5));
  zone(0, 6, 12, 10, ['mug', 'bottle', 'can', 'lantern', 'radio', 'crate', 'bucket'], 18);
  zone(-8, -54, 10, 7, workPool, 16);
  zone(56, 4, 10, 8, ['paddle', 'bucket', 'bottle', 'crate', 'cooler', 'backpack'], 12);
  zone(-8, 20, 9, 7, campPool, 10); zone(8, -19, 9, 7, campPool, 10);

  const spawns: [number, number][] = Array.from({ length: 8 }, (_, i) => [56 + Math.cos((i / 8) * Math.PI * 2) * 4, 22 + Math.sin((i / 8) * Math.PI * 2) * 2]);
  return { statics, trees, decals, items, spawns, roads, clearings, extraction: { x: 66, z: 24, r: 5 }, monsterStart: [-68, -58], need };
}
