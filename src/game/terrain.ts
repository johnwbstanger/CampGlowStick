import type { Layout } from './layout';

/**
 * Camp Glowstick is a structured summer camp, not a terrain demo. Keep the playable
 * campground on one reliable grade so roads, imported buildings, furniture, props,
 * player capsules and AI all agree on the same floor. Elevation can return later as
 * authored meshes around the perimeter; it should never be produced by noisy vertex math.
 */
export function terrainHeight(_x: number, _z: number, _layout?: Pick<Layout, 'water'>): number {
  return 0;
}

/** Deep-water boundary remains explicit even though the surrounding camp is flat. */
export function isDeepWater(x: number, z: number, layout: Pick<Layout, 'water'>): boolean {
  const w = layout.water;
  if (!w) return false;
  const nx = (x - w.x) / (w.rx * 0.82), nz = (z - w.z) / (w.rz * 0.82);
  return nx * nx + nz * nz < 1;
}
