import type { Layout } from './layout';

/**
 * Camp Glowstick is a structured summer camp first and a terrain demo second.
 * Keep the playable ground deliberately flat so buildings, roads, props, campers,
 * physics bodies and touch movement all share one trustworthy floor plane.
 *
 * Height variation can return later as authored mesh features around the lake or
 * map perimeter; it should not be generated underneath gameplay-critical spaces.
 */
export function terrainHeight(_x: number, _z: number, _layout?: Pick<Layout, 'water'>): number {
  return 0;
}

export function isDeepWater(x: number, z: number, layout: Pick<Layout, 'water'>): boolean {
  const w = layout.water;
  if (!w) return false;
  const nx = (x - w.x) / (w.rx * 0.82), nz = (z - w.z) / (w.rz * 0.82);
  return nx * nx + nz * nz < 1;
}
