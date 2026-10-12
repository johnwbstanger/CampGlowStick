import type { Box } from './colliders';

export interface Ray3 {
  x: number; y: number; z: number;
  dx: number; dy: number; dz: number;
}

/**
 * Returns the distance to the first solid AABB hit, or Infinity when the ray is clear.
 * Direction is expected to be normalized. A small origin epsilon prevents the shooter's
 * own near-contact geometry from self-blocking the shot.
 */
export function firstBallisticBlock(ray: Ray3, maxDistance: number, boxes: readonly Box[]): number {
  let nearest = Infinity;
  const eps = 0.055;
  const ox = ray.x + ray.dx * eps, oy = ray.y + ray.dy * eps, oz = ray.z + ray.dz * eps;

  for (const b of boxes) {
    let tMin = 0, tMax = maxDistance;
    const axes: [number, number, number, number][] = [
      [ox, ray.dx, b.minX, b.maxX],
      [oy, ray.dy, b.minY, b.maxY],
      [oz, ray.dz, b.minZ, b.maxZ],
    ];
    let hit = true;
    for (const [origin, dir, min, max] of axes) {
      if (Math.abs(dir) < 1e-8) {
        if (origin < min || origin > max) { hit = false; break; }
        continue;
      }
      let a = (min - origin) / dir, c = (max - origin) / dir;
      if (a > c) [a, c] = [c, a];
      tMin = Math.max(tMin, a); tMax = Math.min(tMax, c);
      if (tMin > tMax) { hit = false; break; }
    }
    if (hit && tMax >= 0 && tMin <= maxDistance) nearest = Math.min(nearest, Math.max(0, tMin));
  }
  return nearest;
}

export function ballisticLineClear(ray: Ray3, targetDistance: number, boxes: readonly Box[]): boolean {
  return firstBallisticBlock(ray, targetDistance, boxes) >= targetDistance - 0.08;
}
