// Logical name -> imported environment/prop model (relative to public/assets/). `h` / `w` normalise to metres.
// Player/camper presentation is intentionally NOT sourced here: src/game/campers.ts is the canonical
// handmade SDF character system.
export interface AssetDef { file: string; h?: number; w?: number; format?: 'glb' | 'fbx' }

const k = (file: string, fit: { h?: number; w?: number }): AssetDef => ({ file: `models/${file}.glb`, format: 'glb', ...fit });
const q = (file: string, fit: { h?: number; w?: number }): AssetDef => ({ file: `models/quaternius/${file}.fbx`, format: 'fbx', ...fit });
const oa = (file: string, fit: { h?: number; w?: number }): AssetDef => ({ file: `models/openagents/${file}.glb`, format: 'glb', ...fit });
const cc0 = (file: string, fit: { h?: number; w?: number }): AssetDef => ({ file: `models/cc0-camp-props/${file}.glb`, format: 'glb', ...fit });
const CHARS = 'abcdefgh'.split('');

export const MANIFEST = {
  // Legacy blocky models remain addressable for backwards-compatible tests/debugging only. Gameplay
  // counselors and rescued campers use the handmade SDF actors in src/game/campers.ts.
  ...Object.fromEntries(CHARS.map((c, i) => [`camper${i + 1}`, k(`blocky-characters/character-${c}`, { h: 1.7 })])),
  camperMale: q('Smooth_Male_Casual', { h: 1.28 }),
  camperFemale: q('Smooth_Female_Casual', { h: 1.24 }),
  counselorMale: q('Smooth_Male_Shirt', { h: 1.82 }),
  counselorFemale: q('Smooth_Female_Casual', { h: 1.74 }),

  monster: k('graveyard/character-zombie', { h: 2.2 }),
  cabin: oa('log_cabin', { w: 8.0 }),
  shed: oa('woodshed', { w: 5.0 }),
  boathouse: oa('boathouse', { w: 8.0 }),
  trailShelter: oa('trail_shelter', { w: 5.5 }),
  lodge: q('Building1_Small', { w: 10.0 }),

  bunk: k('furniture/bedBunk', { w: 2.2 }),
  bedSingle: k('furniture/bedSingle', { w: 2.0 }),
  chair: k('furniture/chair', { h: 0.9 }),
  table: k('furniture/table', { w: 1.9 }),
  bookshelf: k('furniture/bookcaseOpen', { h: 1.9 }),
  sink: k('furniture/bathroomSink', { w: 1.1 }),
  teddy: k('furniture/bear', { h: 0.42 }),
  cooler: cc0('cooler', { w: 0.72 }),
  crate: k('survival/box', { w: 0.55 }),
  backpack: cc0('backpack', { h: 0.58 }),
  lantern: k('holiday/lantern', { h: 0.5 }),
  tent: k('nature/tent_detailedClosed', { w: 3.2 }),
  tree: k('nature/tree_pineTallA', { h: 7 }),
  tree2: k('nature/tree_pineTallB', { h: 8.5 }),
  tree3: k('nature/tree_pineDefaultA', { h: 5.5 }),
  groundBrush: k('nature/ground_grass', { w: 1.8 }),
  campfire: k('survival/campfire-pit', { w: 1.5 }),
  mug: k('food/mug', { w: 0.14 }),
  can: k('food/can', { h: 0.16 }),
  canoe: k('nature/canoe', { w: 3.4 }),
  paddle: k('nature/canoe_paddle', { w: 1.4 }),
  bucket: k('survival/bucket', { h: 0.32 }),
  bottle: k('survival/bottle', { h: 0.3 }),
  barrel: k('survival/barrel', { h: 0.8 }),
  radio: k('furniture/radio', { w: 0.32 }),
  sock: k('holiday/sock-red', { h: 0.3 }),
  axe: k('survival/tool-axe', { h: 0.6 }),
  logs: k('nature/log_stack', { w: 1.4 }),
  rock: k('nature/rock_largeA', { w: 2.2 }),
  boulder: k('survival/rock-a', { w: 1.6 }),
  sign: k('survival/signpost', { h: 1.4 }),
  bus: q('SchoolBus', { w: 9.4 }),
  ground: k('nature/ground_grass', { w: 4 }),
} satisfies Record<string, AssetDef>;

export type AssetName = keyof typeof MANIFEST;
export const ALWAYS_PRELOAD: AssetName[] = [
  'table', 'chair', 'bookshelf', 'bedSingle', 'sink', 'teddy',
  'lantern', 'campfire', 'logs', 'crate', 'cooler', 'radio', 'mug', 'can', 'backpack', 'bucket', 'barrel', 'paddle',
  'cabin', 'shed', 'boathouse', 'trailShelter', 'lodge', 'groundBrush',
];
export const HDRI_FILE = 'hdri/venice_sunset_1k.hdr';
export const camperName = (i: number): AssetName => `camper${(i % CHARS.length) + 1}` as AssetName;
export const assetUrl = (rel: string): string => `${import.meta.env.BASE_URL}assets/${rel}`;
