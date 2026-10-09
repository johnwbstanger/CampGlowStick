import type { AssetName } from '../assets/manifest';
import { pickGraffiti } from './graffiti';
import { WORLD_HALF } from './constants';

export interface Placed { name: AssetName; x: number; z: number; rot: number; solid: boolean }
export interface Decal { host: number; side: number; text: string; creepy: boolean }
export interface ItemSpawn { model: AssetName; kind: 'prop' | 'loot'; x: number; z: number }
export interface Layout {
  statics: Placed[]; trees: Placed[]; decals: Decal[]; items: ItemSpawn[]; spawns: [number, number][];
  extraction: { x: number; z: number; r: number }; monsterStart: [number, number]; need: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const CABINS: [number, number][] = [[-17, -12], [17, -15], [-18, 15], [16, 16]];
const faceCentre = (x: number, z: number): number => Math.atan2(-x, -z);

/** Deterministic camp layout: every client builds the identical world from the host's seed. */
export function buildLayout(seed: number, need = 3): Layout {
  const rng = mulberry32(seed);
  const statics: Placed[] = [];
  const add = (name: AssetName, x: number, z: number, rot: number, solid = true) => statics.push({ name, x, z, rot, solid });
  add('campfire', 0, 0, 0);
  CABINS.forEach(([x, z]) => add('cabin', x, z, faceCentre(x, z)));
  add('shed', 0, -31, 0);
  add('bus', 33, 2, Math.PI / 2);
  add('tent', -8, 11, 0.6); add('tent', 10, -10, -0.5);
  add('canoe', -30, 26, 0.4); add('logs', 4, 4, 0.8); add('logs', -5, -6, 2.1);
  add('rock', -26, -4, 1); add('rock', 24, 22, 2); add('boulder', 6, 30, 0.2);
  add('sign', 5, 8, 0.3); add('sign', -4, 18, -0.4);
  CABINS.slice(0, 2).forEach(([x, z]) => add('bunk', x * 0.55, z * 0.55 + (z < 0 ? 4 : -4), rng() * 3));

  const keepOut = statics.map((s) => [s.x, s.z] as const);
  const trees: Placed[] = [];
  const kinds: AssetName[] = ['tree', 'tree2', 'tree3'];
  for (let i = 0; i < 400 && trees.length < 90; i++) {
    const a = rng() * Math.PI * 2, r = 12 + rng() * (WORLD_HALF - 14);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (keepOut.some(([kx, kz]) => Math.hypot(kx - x, kz - z) < 6)) continue;
    if (Math.hypot(x - 33, z - 2) < 9) continue;
    trees.push({ name: kinds[Math.floor(rng() * 3)], x, z, rot: rng() * 6.28, solid: true });
  }

  const decals: Decal[] = [];
  CABINS.forEach((_, i) => { for (let side = 0; side < 2; side++) { const text = pickGraffiti(rng); decals.push({ host: i, side, text, creepy: text.startsWith('I SAW') || text.startsWith('IT ') || text.startsWith('DON') }); } });
  decals.push({ host: 4, side: 0, text: 'DO NOT EAT THE CHILI', creepy: false });

  const items: ItemSpawn[] = [];
  const lootModels: AssetName[] = ['lantern', 'radio', 'backpack', 'cooler', 'lantern', 'radio'];
  const lootSpots: [number, number][] = [[-12, -12], [13, -13], [-13, 12], [12, 13], [3, -27], [-4, -27]];
  for (let i = 0; i < Math.max(need + 2, 5); i++) items.push({ model: lootModels[i % 6], kind: 'loot', x: lootSpots[i % 6][0], z: lootSpots[i % 6][1] });
  const props: AssetName[] = ['bucket', 'bottle', 'can', 'mug', 'barrel', 'paddle', 'crate', 'sock', 'axe', 'bottle', 'can', 'bucket', 'mug', 'radio'];
  props.forEach((model, i) => { const a = (i / props.length) * Math.PI * 2 + rng(), r = 5 + rng() * 9; items.push({ model, kind: 'prop', x: Math.cos(a) * r, z: Math.sin(a) * r }); });

  const spawns: [number, number][] = Array.from({ length: 8 }, (_, i) => [Math.cos((i / 8) * 6.283) * 3, 7 + Math.sin((i / 8) * 6.283) * 1.5]);
  return { statics, trees, decals, items, spawns, extraction: { x: 28, z: 2, r: 4 }, monsterStart: [-36, -30], need };
}
