import { ForestFloorPlacementMask, type PlacementZone } from '../vendor/forestPlacementMask';
import { semanticScatter } from './placement';

export interface VegetationPoint {
  x: number;
  z: number;
  layer: 'tree' | 'sapling' | 'brush' | 'ground';
  variant: number;
  rot: number;
  scale: number;
}

export interface VegetationEngineOptions {
  seed: number;
  halfExtent: number;
  exclusions: readonly PlacementZone[];
  treeLimit?: number;
  brushLimit?: number;
  groundLimit?: number;
}

const rngFor = (seed: number): (() => number) => {
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
 * Layered deterministic forest generator.
 *
 * Distribution comes from the vendored MIT poisson-disk-sampling engine; land-use
 * rejection comes from the vendored MIT ForestFloorPlacementMask pattern. The camp
 * owns only semantic exclusion inputs and art variants.
 */
export function generateVegetation(options: VegetationEngineOptions): VegetationPoint[] {
  const half = options.halfExtent;
  const size = half * 2;
  const mask = new ForestFloorPlacementMask(options.exclusions);
  const out: VegetationPoint[] = [];

  const layer = (
    seed: number,
    kind: VegetationPoint['layer'],
    minDistance: number,
    maxDistance: number,
    maxCount: number,
    allow: (x: number, z: number) => boolean,
    variants: number,
    minScale: number,
    maxScale: number,
  ) => {
    const rng = rngFor(seed);
    const points = semanticScatter({
      seed,
      width: size,
      height: size,
      originX: -half,
      originZ: -half,
      minDistance,
      maxDistance,
      maxCount,
      accept: allow,
    });
    for (const [x, z] of points) {
      out.push({
        x,
        z,
        layer: kind,
        variant: Math.floor(rng() * variants),
        rot: rng() * Math.PI * 2,
        scale: minScale + (maxScale - minScale) * rng(),
      });
    }
  };

  layer(options.seed ^ 0x16a3, 'tree', 4.1, 7.4, options.treeLimit ?? 500, (x, z) => mask.allowsTree(x, z), 3, .82, 1.22);
  layer(options.seed ^ 0x29bd, 'sapling', 2.6, 4.9, Math.round((options.treeLimit ?? 500) * .45), (x, z) => mask.allowsTree(x, z), 3, .55, .9);
  layer(options.seed ^ 0x45ef, 'brush', 1.45, 3.2, options.brushLimit ?? 700, (x, z) => mask.allowsGroundCover(x, z), 5, .7, 1.2);
  layer(options.seed ^ 0x7b11, 'ground', .72, 1.7, options.groundLimit ?? 1400, (x, z) => mask.allowsGroundCover(x, z), 6, .75, 1.35);

  return out;
}
