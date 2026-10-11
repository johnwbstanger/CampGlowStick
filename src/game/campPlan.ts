export type Point2 = readonly [number, number];

/**
 * Canonical authored master plan. All environment systems consume these coordinates instead of
 * duplicating magic numbers. +X east, +Z south, metres, Y supplied by terrainHeight().
 */
export const CAMP_PLAN = {
  entrance: { x: 0, z: 154 },
  bus: { x: 0, z: 108, rot: Math.PI * 0.52 },
  extraction: { x: 2, z: 106, r: 9.5 },
  admin: { x: -22, z: 91, rot: 0.08 },
  director: { x: -31, z: 72, rot: Math.PI * 0.5 },
  bathhouse: { x: 35, z: 78, rot: -0.14 },
  dining: { x: -43, z: 19, rot: 0.05 },
  kitchen: { x: -43, z: 7, rot: 0.05 },
  maintenance: { x: 108, z: 121, rot: -0.22 },
  arts: { x: 40, z: -35, rot: 0.16 },
  recreation: { x: 112, z: -45 },
  campfire: { x: -3, z: -67 },
  lookout: { x: -126, z: -77, rot: -0.32 },
  waterfront: { x: 0, z: -139 },
  boathouse: { x: 34, z: -137, rot: Math.PI * 0.5 },
  canoeRack: { x: -31, z: -128, rot: 0.12 },
  lake: { x: 5, z: -159, rx: 88, rz: 37, y: -3.15 },
  monsterStart: { x: 142, z: -103 },
  gun: { x: -31, z: 72.35 },
} as const;

export const CABIN_CLUSTER_A: Point2[] = [
  [-116, 76], [-99, 88], [-79, 91], [-113, 52], [-92, 61], [-69, 66],
];
export const CABIN_CLUSTER_B: Point2[] = [
  [70, 82], [91, 87], [112, 76], [82, 58], [105, 53],
];
export const CABINS: Point2[] = [...CABIN_CLUSTER_A, ...CABIN_CLUSTER_B];

/** Authored circulation: gravel entrance/loop, packed-dirt main trails and narrow footpaths. */
export const CAMP_ROADS: { kind: 'gravel' | 'dirt' | 'foot'; width: number; points: Point2[] }[] = [
  { kind: 'gravel', width: 7.2, points: [[0, 178], [0, 154], [-2, 132], [-8, 116], [0, 108], [18, 109], [31, 118], [22, 132], [5, 137], [-9, 130], [-8, 116]] },
  { kind: 'gravel', width: 5.8, points: [[0, 108], [-22, 91], [-31, 72], [-39, 48], [-43, 19]] },
  { kind: 'dirt', width: 5.0, points: [[-22, 91], [-55, 90], [-82, 88], [-99, 88], [-116, 76], [-113, 52], [-92, 61], [-69, 66], [-47, 74], [-22, 91]] },
  { kind: 'dirt', width: 5.0, points: [[20, 104], [43, 95], [70, 82], [91, 87], [112, 76], [105, 53], [82, 58], [62, 70], [35, 78], [20, 104]] },
  { kind: 'dirt', width: 5.2, points: [[-43, 19], [-23, -10], [4, -26], [40, -35], [78, -42], [112, -45]] },
  { kind: 'dirt', width: 5.0, points: [[-43, 19], [-27, -20], [-3, -67], [0, -103], [0, -139]] },
  { kind: 'dirt', width: 4.8, points: [[40, -35], [31, -72], [18, -107], [0, -139], [34, -137]] },
  { kind: 'foot', width: 3.2, points: [[-3, -67], [-49, -72], [-88, -75], [-126, -77]] },
  { kind: 'foot', width: 3.0, points: [[-69, 66], [-88, 22], [-88, -28], [-88, -75]] },
  { kind: 'gravel', width: 5.5, points: [[31, 118], [65, 119], [108, 121]] },
  { kind: 'foot', width: 2.8, points: [[0, -139], [-31, -128]] },
];

export const CAMP_CLEARINGS = [
  { x: 0, z: 108, rx: 30, rz: 24, kind: 'arrival' },
  { x: -43, z: 19, rx: 26, rz: 22, kind: 'dining' },
  { x: -94, z: 72, rx: 42, rz: 31, kind: 'cabins' },
  { x: 92, z: 71, rx: 40, rz: 30, kind: 'cabins' },
  { x: 108, z: 121, rx: 25, rz: 20, kind: 'service' },
  { x: 40, z: -35, rx: 25, rz: 20, kind: 'program' },
  { x: 112, z: -45, rx: 32, rz: 26, kind: 'field' },
  { x: -3, z: -67, rx: 18, rz: 16, kind: 'campfire' },
  { x: 0, z: -139, rx: 43, rz: 22, kind: 'waterfront' },
] as const;

/** Building pads intentionally flatten only the immediate footprint, never entire camp districts. */
export const TERRAIN_PADS = [
  { x: CAMP_PLAN.bus.x, z: CAMP_PLAN.bus.z, rx: 19, rz: 14 },
  { x: CAMP_PLAN.admin.x, z: CAMP_PLAN.admin.z, rx: 9, rz: 7 },
  { x: CAMP_PLAN.director.x, z: CAMP_PLAN.director.z, rx: 8, rz: 7 },
  { x: CAMP_PLAN.bathhouse.x, z: CAMP_PLAN.bathhouse.z, rx: 9, rz: 7 },
  { x: CAMP_PLAN.dining.x, z: CAMP_PLAN.dining.z, rx: 14, rz: 10 },
  { x: CAMP_PLAN.kitchen.x, z: CAMP_PLAN.kitchen.z, rx: 10, rz: 8 },
  { x: CAMP_PLAN.maintenance.x, z: CAMP_PLAN.maintenance.z, rx: 11, rz: 9 },
  { x: CAMP_PLAN.arts.x, z: CAMP_PLAN.arts.z, rx: 10, rz: 8 },
  ...CABINS.map(([x, z]) => ({ x, z, rx: 6.2, rz: 4.8 })),
] as const;
