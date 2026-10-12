import type { AssetName } from '../assets/manifest';
import { PoissonDiskSampling2D } from '../vendor/poissonDiskSampling';
import { pickGraffiti } from './graffiti';
import { CABINS, CAMP_CLEARINGS, CAMP_PLAN, CAMP_ROADS } from './campPlan';
import { WORLD_HALF } from './constants';
import { terrainSlope } from './terrain';

export interface Placed { name: AssetName; x: number; z: number; rot: number; solid: boolean; scale?: number }
export interface Decal { host: number; side: number; text: string; creepy: boolean }
/** Dynamic item socket. `lift` is metres above its normal ground-resting center, used for authored stacks. */
export interface ItemSpawn { model: AssetName; kind: 'prop' | 'loot'; x: number; z: number; lift?: number }
export interface Road { points: [number, number][]; width: number; kind?: 'gravel' | 'dirt' | 'foot' }
export interface Clearing { x: number; z: number; rx: number; rz: number; kind?: string }
export interface WaterArea { x: number; z: number; rx: number; rz: number; y: number }
export interface Layout {
  seed: number;
  statics: Placed[]; trees: Placed[]; decals: Decal[]; items: ItemSpawn[]; spawns: [number, number][];
  roads: Road[]; clearings: Clearing[]; water: WaterArea;
  extraction: { x: number; z: number; r: number }; monsterStart: [number, number]; need: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const samplePoisson = (width: number, height: number, minDistance: number, maxDistance: number, tries: number, rng: () => number): [number, number][] =>
  new PoissonDiskSampling2D({ shape: [width, height], minDistance, maxDistance, tries }, rng).fill();

const face = (x: number, z: number, tx = 0, tz = 72): number => Math.atan2(tx - x, tz - z);
const localToWorld = (cx: number, cz: number, rot: number, lx: number, lz: number): [number, number] => {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [cx + lx * c + lz * s, cz - lx * s + lz * c];
};
const distToSegment = (px: number, pz: number, ax: number, az: number, bx: number, bz: number): number => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  if (!l2) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
};

/** Complete authored camp geography; randomization is reserved for dressing and forest variation. */
export function buildLayout(seed: number, need = 3): Layout {
  const rng = mulberry32(seed);
  const water: WaterArea = { ...CAMP_PLAN.lake };
  const roads: Road[] = CAMP_ROADS.map((r) => ({ width: r.width, kind: r.kind, points: r.points.map(([x, z]) => [x, z]) as [number, number][] }));
  const clearings: Clearing[] = CAMP_CLEARINGS.map((c) => ({ ...c }));
  const statics: Placed[] = [];
  const add = (name: AssetName, x: number, z: number, rot = 0, solid = true, scale = 1) => statics.push({ name, x, z, rot, solid, scale });

  add('bus', CAMP_PLAN.bus.x, CAMP_PLAN.bus.z, CAMP_PLAN.bus.rot, true);
  add('cabin', CAMP_PLAN.admin.x, CAMP_PLAN.admin.z, CAMP_PLAN.admin.rot, false);
  add('trailShelter', 15, 121, -0.1, false);
  add('sign', CAMP_PLAN.entrance.x - 4.5, CAMP_PLAN.entrance.z, 0, true, 1.35);
  add('sign', CAMP_PLAN.entrance.x + 4.5, CAMP_PLAN.entrance.z, Math.PI, true, 1.35);

  CABINS.forEach(([x, z], i) => {
    const rot = face(x, z) + (rng() - 0.5) * 0.22;
    add('cabin', x, z, rot, false, 0.94 + rng() * 0.10);
    const bunkSockets: [number, number, number][] = [
      [-2.35, -1.35, Math.PI / 2], [2.35, -1.35, -Math.PI / 2],
      [-2.35, 1.10, Math.PI / 2], [2.35, 1.10, -Math.PI / 2],
    ];
    for (const [lx, lz, lr] of bunkSockets) {
      const [bx, bz] = localToWorld(x, z, rot, lx, lz);
      add('bunk', bx, bz, rot + lr, true);
    }
    const [sx, sz] = localToWorld(x, z, rot, 0, -2.15);
    add('bookshelf', sx, sz, rot, true);
    if (i % 2 === 0) {
      const [tx, tz] = localToWorld(x, z, rot, 0, 0.1);
      add('table', tx, tz, rot, true);
    }
    if (i % 3 === 1) {
      const [lx, lz] = localToWorld(x, z, rot, -3.6, 2.6);
      add('logs', lx, lz, rot + 0.3, true);
    }
  });

  add('shed', CAMP_PLAN.maintenance.x, CAMP_PLAN.maintenance.z, CAMP_PLAN.maintenance.rot, false, 1.18);
  add('boathouse', CAMP_PLAN.boathouse.x, CAMP_PLAN.boathouse.z, CAMP_PLAN.boathouse.rot, false, 1.18);
  add('trailShelter', CAMP_PLAN.lookout.x, CAMP_PLAN.lookout.z, CAMP_PLAN.lookout.rot, false, 1.05);
  add('campfire', CAMP_PLAN.campfire.x, CAMP_PLAN.campfire.z, 0, true, 1.15);

  for (let i = 0; i < 6; i++) add('canoe', -34 + i * 2.1, -129 + (i % 2) * 1.7, 0.12 + (i % 2) * 0.05, true, 0.96);
  for (let i = 0; i < 6; i++) add('paddle', -37 + i * 1.15, -124.5, Math.PI / 2 + 0.08 * i, true);
  add('logs', CAMP_PLAN.campfire.x + 6, CAMP_PLAN.campfire.z + 4, .8);
  add('logs', CAMP_PLAN.campfire.x - 7, CAMP_PLAN.campfire.z + 2, 2.1);

  const tents: [number, number, number][] = [[26, -22, .4], [39, -15, -.25], [53, -23, .65], [122, -69, -.4], [133, -57, .5]];
  tents.forEach(([x, z, r]) => add('tent', x, z, r, true));

  const rockSpots: [number, number, number][] = [[-147, 18, 1], [-143, -112, 2], [150, 35, .5], [146, -101, 1.4], [-66, -139, .3], [72, -143, 2.2]];
  rockSpots.forEach(([x, z, r], i) => add(i % 2 ? 'rock' : 'boulder', x, z, r, true, 1.15 + (i % 3) * .18));
  for (const road of roads) {
    for (let i = 1; i < road.points.length - 1; i += Math.max(1, Math.floor(road.points.length / 4))) {
      const [x, z] = road.points[i]; add('sign', x + 2.1, z + 1.5, rng() * Math.PI * 2, true, .92);
    }
  }

  const keepOut = statics.map((s) => [s.x, s.z, s.name] as const);
  const nearRoad = (x: number, z: number, padding = 1.6): boolean => roads.some((road) => road.points.slice(1).some(([bx, bz], i) => {
    const [ax, az] = road.points[i]; return distToSegment(x, z, ax, az, bx, bz) < road.width * 0.55 + padding;
  }));
  const inClearing = (x: number, z: number, margin = 0): boolean => clearings.some((c) => ((x - c.x) / (c.rx + margin)) ** 2 + ((z - c.z) / (c.rz + margin)) ** 2 < 1);
  const inLake = (x: number, z: number): boolean => ((x - water.x) / (water.rx + 3)) ** 2 + ((z - water.z) / (water.rz + 3)) ** 2 < 1;

  const trees: Placed[] = [];
  const legacyKinds: AssetName[] = ['tree', 'tree2', 'tree3'];
  const extent = (WORLD_HALF - 3) * 2;
  const forest = samplePoisson(extent, extent, 3.8, 7.0, 30, rng);
  for (const [px, pz] of forest) {
    if (trees.length >= 980) break;
    const x = px - extent / 2, z = pz - extent / 2;
    if (Math.abs(x) > WORLD_HALF - 5 || Math.abs(z) > WORLD_HALF - 5) continue;
    if (keepOut.some(([kx, kz, name]) => Math.hypot(kx - x, kz - z) < (name === 'cabin' ? 7.5 : name === 'bus' ? 12 : 4.2))) continue;
    if (nearRoad(x, z) || inClearing(x, z, 1.5) || inLake(x, z)) continue;
    if (terrainSlope(x, z) > 0.46) continue;
    trees.push({ name: legacyKinds[Math.floor(rng() * legacyKinds.length)], x, z, rot: rng() * Math.PI * 2, solid: true, scale: 0.78 + rng() * 0.56 });
  }

  const cabinsInStatics = statics.map((s, i) => ({ s, i })).filter(({ s }) => s.name === 'cabin' && !(s.x === CAMP_PLAN.admin.x && s.z === CAMP_PLAN.admin.z));
  const decals: Decal[] = [];
  cabinsInStatics.slice(0, 8).forEach(({ i: host }) => {
    for (let side = 0; side < 2; side++) {
      const text = pickGraffiti(rng);
      decals.push({ host, side, text, creepy: text.startsWith('I SAW') || text.startsWith('IT ') || text.startsWith('DON') });
    }
  });

  const items: ItemSpawn[] = [];
  const lootModels: AssetName[] = ['lantern', 'radio', 'backpack', 'cooler'];
  const cabinStatics = statics.filter((s) => s.name === 'cabin' && !(s.x === CAMP_PLAN.admin.x && s.z === CAMP_PLAN.admin.z));
  const lootSpots: [number, number][] = cabinStatics.map((c, i) => localToWorld(c.x, c.z, c.rot, i % 2 ? 1.15 : -1.15, 2.65));
  for (let i = 0; i < Math.max(need + 8, 11); i++) {
    const [x, z] = lootSpots[i % lootSpots.length];
    items.push({ model: lootModels[i % lootModels.length], kind: 'loot', x, z });
  }

  const scatterZone = (cx: number, cz: number, rx: number, rz: number, pool: AssetName[], count: number, minDistance = 1.5) => {
    const pts = samplePoisson(rx * 2, rz * 2, minDistance, minDistance * 1.9, 26, rng);
    let used = 0;
    for (const [px, pz] of pts) {
      const nx = (px - rx) / rx, nz = (pz - rz) / rz;
      if (nx * nx + nz * nz > 1) continue;
      const x = cx + px - rx, z = cz + pz - rz;
      if (inLake(x, z) || terrainSlope(x, z) > .5) continue;
      if (keepOut.some(([kx, kz, name]) => Math.hypot(kx - x, kz - z) < (name === 'cabin' ? 5.3 : 3.0))) continue;
      items.push({ model: pool[Math.floor(rng() * pool.length)], kind: 'prop', x, z });
      if (++used >= count) break;
    }
  };

  const social: AssetName[] = ['mug', 'bottle', 'can', 'lantern', 'radio', 'backpack', 'cooler', 'crate'];
  const work: AssetName[] = ['crate', 'bucket', 'barrel', 'axe', 'bottle', 'can'];
  const waterfront: AssetName[] = ['paddle', 'bucket', 'bottle', 'crate', 'cooler', 'backpack'];
  scatterZone(0, 108, 25, 20, social, 16);
  scatterZone(-43, 19, 24, 19, social, 20);
  scatterZone(108, 121, 24, 18, work, 24);
  scatterZone(0, -130, 44, 17, waterfront, 18);
  scatterZone(40, -35, 23, 18, social, 14);

  // Deliberately unstable physics stacks. Small horizontal offsets plus the normal randomized body
  // tilt make them stable enough to exist at round start but easy to cascade when a counselor bumps
  // or throws something into them. Every resulting Cannon impact already emits material/noise events.
  const stack = (x: number, z: number, entries: [AssetName, number, number, number][]) => {
    for (const [model, lift, dx, dz] of entries) items.push({ model, kind: 'prop', x: x + dx, z: z + dz, lift });
  };
  stack(105, 116, [['crate', 0, 0, 0], ['crate', .58, .04, -.03], ['bucket', 1.13, -.06, .03], ['can', 1.55, .08, 0]]);
  stack(111, 122, [['barrel', 0, 0, 0], ['crate', .82, .05, 0], ['cooler', 1.39, -.07, .04], ['can', 1.93, .08, -.04]]);
  stack(-42, 16, [['crate', 0, 0, 0], ['cooler', .58, -.05, .02], ['radio', 1.12, .07, -.03], ['mug', 1.45, -.1, .04]]);
  stack(-31, -124, [['cooler', 0, 0, 0], ['crate', .58, .06, .02], ['bucket', 1.13, -.05, -.03], ['bottle', 1.51, .08, .05]]);
  stack(35, -31, [['crate', 0, 0, 0], ['crate', .58, -.05, .04], ['lantern', 1.13, .08, -.03], ['can', 1.58, -.08, .03]]);

  return {
    seed,
    statics,
    trees,
    decals,
    items,
    spawns: [[-4, 111], [3, 115], [7, 108], [-7, 104], [10, 113], [-10, 114], [5, 102], [-4, 100], [13, 106], [-13, 108], [8, 118], [-8, 119], [15, 112], [-15, 112], [0, 119]],
    roads,
    clearings,
    water,
    extraction: { ...CAMP_PLAN.extraction },
    monsterStart: [CAMP_PLAN.monsterStart.x, CAMP_PLAN.monsterStart.z],
    need,
  };
}
