import type { AssetName } from '../assets/manifest';
import { pickGraffiti } from './graffiti';
import { WORLD_HALF } from './constants';

export interface Placed { name: AssetName; x: number; z: number; rot: number; solid: boolean }
export interface Decal { host: number; side: number; text: string; creepy: boolean }
export interface ItemSpawn { model: AssetName; kind: 'prop' | 'loot'; x: number; z: number }
export interface Road { points: [number, number][]; width: number }
export interface Clearing { x: number; z: number; rx: number; rz: number }
export interface WaterArea { x: number; z: number; rx: number; rz: number; y: number }
export interface Layout {
  statics: Placed[]; trees: Placed[]; decals: Decal[]; items: ItemSpawn[]; spawns: [number, number][];
  roads: Road[]; clearings: Clearing[]; water: WaterArea;
  extraction: { x: number; z: number; r: number }; monsterStart: [number, number]; need: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const CABINS: [number, number][] = [
  [-82, -46], [-64, -56], [-43, -61], [-20, -57],
  [21, -59], [45, -56], [68, -44],
  [-88, 12], [-68, 24], [-46, 31], [-23, 35],
  [18, 36], [43, 31], [67, 22], [86, 8],
];
const faceCentre = (x: number, z: number): number => Math.atan2(-x, -z);
const distToSegment = (px: number, pz: number, ax: number, az: number, bx: number, bz: number): number => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  if (!l2) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
};

/** Large deterministic campground plan. Roads/clearings act as the map overlay and everything else is layered onto it. */
export function buildLayout(seed: number, need = 3): Layout {
  const rng = mulberry32(seed);
  const water: WaterArea = { x: 103, z: -4, rx: 23, rz: 18, y: -1.15 };
  const roads: Road[] = [
    { width: 7.5, points: [[-120, 68], [-98, 52], [-75, 38], [-52, 24], [-27, 13], [0, 6], [28, 2], [55, 10], [82, 20], [108, 32]] },
    { width: 6.0, points: [[-75, 38], [-86, 10], [-82, -18], [-72, -42], [-45, -64], [-15, -72], [18, -71], [51, -60], [75, -40], [82, -8], [82, 20]] },
    { width: 5.2, points: [[-52, 24], [-46, 31], [-68, 24], [-88, 12]] },
    { width: 5.0, points: [[-27, 13], [-23, 35], [-46, 31]] },
    { width: 5.0, points: [[0, 6], [18, 36], [43, 31], [67, 22], [86, 8]] },
    { width: 4.8, points: [[-72, -42], [-64, -56], [-82, -46]] },
    { width: 4.8, points: [[-45, -64], [-43, -61], [-20, -57]] },
    { width: 4.8, points: [[18, -71], [21, -59], [45, -56], [68, -44]] },
    { width: 4.2, points: [[0, 6], [-7, 56], [-23, 82], [-48, 94]] },
    { width: 4.2, points: [[28, 2], [52, -10], [76, -13]] },
  ];

  const clearings: Clearing[] = [
    { x: 0, z: 6, rx: 22, rz: 18 },
    { x: -58, z: -52, rx: 40, rz: 24 },
    { x: 46, z: -55, rx: 42, rz: 25 },
    { x: -57, z: 25, rx: 43, rz: 23 },
    { x: 52, z: 27, rx: 45, rz: 23 },
    { x: -7, z: 57, rx: 22, rz: 17 },
    { x: 83, z: -15, rx: 20, rz: 15 },
    { x: -42, z: 89, rx: 24, rz: 18 },
  ];

  const statics: Placed[] = [];
  const add = (name: AssetName, x: number, z: number, rot: number, solid = true) => statics.push({ name, x, z, rot, solid });

  add('campfire', 0, 6, 0);
  CABINS.forEach(([x, z]) => add('cabin', x, z, faceCentre(x, z)));
  add('shed', -102, -42, 0.25);
  add('shed', 97, -29, -0.4);
  add('bus', 31, 2, Math.PI / 2);

  const tents: [number, number, number][] = [
    [-17, 54, 0.4], [-5, 61, -0.3], [8, 56, 0.7], [15, 67, -0.8],
    [-96, 72, 0.2], [-86, 78, -0.5], [-74, 70, 0.9],
    [91, 57, -0.2], [101, 63, 0.5], [110, 55, -0.7],
    [-11, -24, 0.1], [7, -24, -0.25], [18, -31, 0.5],
  ];
  tents.forEach(([x, z, r]) => add('tent', x, z, r));

  add('canoe', 84, -4, 0.2); add('canoe', 87, 0, 0.1); add('canoe', 89, 4, 0.35);
  add('logs', 4, 11, 0.8); add('logs', -6, 2, 2.1); add('logs', -1, -2, 1.4);
  add('boulder', -115, -2, 0.2); add('boulder', 115, 47, 0.4); add('boulder', -15, 112, 1.2);
  add('rock', -107, -9, 1.0); add('rock', 92, 77, 2.0); add('rock', 36, 108, 0.7); add('rock', -79, 98, 1.8);

  const signs: [number, number, number][] = [
    [-100, 53, 0.3], [-73, 38, -0.2], [-50, 24, 0.1], [-28, 13, 0.2],
    [26, 3, -0.1], [57, 10, -0.3], [82, 20, 0.2], [104, 31, -0.4],
    [-44, -64, 0.1], [51, -60, -0.2], [-8, 55, 0.3], [79, -12, -0.4],
  ];
  signs.forEach(([x, z, r]) => add('sign', x, z, r));

  CABINS.slice(0, 10).forEach(([x, z], i) => add('bunk', x + (i % 2 ? 3 : -3), z + (i % 3 ? 2.5 : -2.5), rng() * Math.PI * 2));

  const keepOut = statics.map((s) => [s.x, s.z] as const);
  const nearRoad = (x: number, z: number): boolean => roads.some((road) => road.points.slice(1).some(([bx, bz], i) => {
    const [ax, az] = road.points[i]; return distToSegment(x, z, ax, az, bx, bz) < road.width * 0.75 + 1.7;
  }));
  const inClearing = (x: number, z: number): boolean => clearings.some((c) => ((x - c.x) / c.rx) ** 2 + ((z - c.z) / c.rz) ** 2 < 1);
  const inLake = (x: number, z: number): boolean => ((x - water.x) / (water.rx + 5)) ** 2 + ((z - water.z) / (water.rz + 5)) ** 2 < 1;

  const trees: Placed[] = [];
  const kinds: AssetName[] = ['tree', 'tree2', 'tree3'];
  for (let i = 0; i < 6500 && trees.length < 500; i++) {
    const x = (rng() * 2 - 1) * (WORLD_HALF - 4), z = (rng() * 2 - 1) * (WORLD_HALF - 4);
    if (keepOut.some(([kx, kz]) => Math.hypot(kx - x, kz - z) < 6)) continue;
    if (nearRoad(x, z) || inClearing(x, z) || inLake(x, z)) continue;
    if (Math.hypot(x - 31, z - 2) < 13) continue;
    trees.push({ name: kinds[Math.floor(rng() * kinds.length)], x, z, rot: rng() * Math.PI * 2, solid: true });
  }

  const decals: Decal[] = [];
  CABINS.slice(0, 8).forEach((_, i) => { for (let side = 0; side < 2; side++) { const text = pickGraffiti(rng); decals.push({ host: i + 1, side, text, creepy: text.startsWith('I SAW') || text.startsWith('IT ') || text.startsWith('DON') }); } });

  const items: ItemSpawn[] = [];
  const lootModels: AssetName[] = ['lantern', 'radio', 'backpack', 'cooler', 'lantern', 'radio', 'backpack', 'cooler'];
  const lootSpots: [number, number][] = CABINS.map(([x, z], i) => [x + (i % 2 ? 2.5 : -2.5), z + (i % 3 ? 2 : -2)]);
  for (let i = 0; i < Math.max(need + 6, 9); i++) items.push({ model: lootModels[i % lootModels.length], kind: 'loot', x: lootSpots[i % lootSpots.length][0], z: lootSpots[i % lootSpots.length][1] });

  const zone = (cx: number, cz: number, rx: number, rz: number, pool: AssetName[], count: number) => {
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng());
      const x = cx + Math.cos(a) * rx * r, z = cz + Math.sin(a) * rz * r;
      if (!inLake(x, z)) items.push({ model: pool[Math.floor(rng() * pool.length)], kind: 'prop', x, z });
    }
  };

  const campPool: AssetName[] = ['mug', 'bottle', 'can', 'bucket', 'lantern', 'radio', 'backpack', 'cooler', 'crate', 'sock'];
  const workPool: AssetName[] = ['crate', 'bucket', 'barrel', 'axe', 'bottle', 'can', 'paddle'];
  const waterfrontPool: AssetName[] = ['paddle', 'bucket', 'bottle', 'crate', 'cooler', 'backpack', 'radio'];

  CABINS.forEach(([x, z], i) => zone(x + (i % 2 ? 2 : -2), z + (i % 3 ? 1 : -1), 7.5, 5.5, campPool, 8));
  zone(0, 6, 17, 13, campPool, 28);
  zone(-101, -42, 14, 10, workPool, 24);
  zone(97, -29, 14, 10, workPool, 22);
  zone(79, -3, 10, 14, waterfrontPool, 22);
  zone(-7, 58, 18, 13, campPool, 22);
  zone(-86, 74, 17, 12, campPool, 18);
  zone(101, 60, 17, 12, campPool, 18);
  zone(-46, 89, 15, 11, ['crate', 'cooler', 'backpack', 'radio', 'lantern', 'mug'], 16);
  zone(28, 2, 11, 8, ['crate', 'cooler', 'backpack', 'radio', 'lantern'], 14);

  const spawns: [number, number][] = Array.from({ length: 15 }, (_, i) => [22 + Math.cos((i / 15) * Math.PI * 2) * 5, 5 + Math.sin((i / 15) * Math.PI * 2) * 3]);
  return { statics, trees, decals, items, spawns, roads, clearings, water, extraction: { x: 28, z: 2, r: 6.5 }, monsterStart: [-118, -104], need };
}
