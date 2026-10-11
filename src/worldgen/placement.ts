import type { Footprint, VegetationMask } from './semanticTypes';
import { PoissonDiskSampling2D } from '../vendor/poissonDiskSampling';

export const pointInFootprint = (x: number, z: number, f: Footprint): boolean => {
  const c = Math.cos(-f.rot), s = Math.sin(-f.rot);
  const dx = x - f.cx, dz = z - f.cz;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const pad = f.padding ?? 0;
  return Math.abs(lx) <= f.w / 2 + pad && Math.abs(lz) <= f.d / 2 + pad;
};

export const footprintMask = (f: Footprint, reason: VegetationMask['reason'], extra = 2): VegetationMask => ({
  x: f.cx,
  z: f.cz,
  radius: Math.hypot(f.w / 2, f.d / 2) + extra,
  reason,
});

export const allowedByMasks = (x: number, z: number, masks: readonly VegetationMask[]): boolean =>
  !masks.some((m) => Math.hypot(x - m.x, z - m.z) < m.radius);

export interface ScatterOptions {
  seed: number;
  width: number;
  height: number;
  originX: number;
  originZ: number;
  minDistance: number;
  maxDistance: number;
  maxCount: number;
  masks?: readonly VegetationMask[];
  accept?: (x: number, z: number) => boolean;
}

const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Uses Kevin Chapelier's MIT Poisson-disk algorithm (vendored/adapted in src/vendor) for the
 * candidate distribution. Camp Glowstick only adds semantic acceptance masks on top of the upstream
 * sampler: the distribution algorithm itself is no longer our home-grown poisson2d implementation.
 */
export function semanticScatter(options: ScatterOptions): [number, number][] {
  const sampler = new PoissonDiskSampling2D({
    shape: [options.width, options.height],
    minDistance: options.minDistance,
    maxDistance: options.maxDistance,
    tries: 28,
  }, mulberry32(options.seed));
  const points = sampler.fill();
  const out: [number, number][] = [];
  for (const [px, pz] of points) {
    const x = options.originX + px;
    const z = options.originZ + pz;
    if (options.masks && !allowedByMasks(x, z, options.masks)) continue;
    if (options.accept && !options.accept(x, z)) continue;
    out.push([x, z]);
    if (out.length >= options.maxCount) break;
  }
  return out;
}
