/*
 * Adapted from SeloSlav/spline-based-procedural-dirt-road-system
 * src/props/ForestFloorPlacementMask.ts
 * https://github.com/SeloSlav/spline-based-procedural-dirt-road-system
 * MIT License.
 *
 * The upstream system classifies forest-floor candidates against road state and
 * an optional source-tree relationship. Camp Glowstick generalizes the same
 * placement-mask concept to authored camp exclusion zones while keeping the
 * key rule: infrastructure wins over vegetation.
 */

export type PlacementClass =
  | 'OPEN'
  | 'ROAD'
  | 'ROAD_BORDER'
  | 'BUILDING'
  | 'PORCH'
  | 'CAMPSITE'
  | 'FIRE_CLEARANCE'
  | 'BUS'
  | 'WATER';

export interface PlacementZone {
  x: number;
  z: number;
  radius: number;
  kind: Exclude<PlacementClass, 'OPEN'>;
}

export class ForestFloorPlacementMask {
  constructor(private readonly zones: readonly PlacementZone[]) {}

  classify(x: number, z: number): PlacementClass {
    let best: PlacementZone | undefined;
    let bestNorm = Infinity;
    for (const zone of this.zones) {
      const norm = Math.hypot(x - zone.x, z - zone.z) / Math.max(0.001, zone.radius);
      if (norm <= 1 && norm < bestNorm) {
        best = zone;
        bestNorm = norm;
      }
    }
    return best?.kind ?? 'OPEN';
  }

  allowsTree(x: number, z: number): boolean {
    return this.classify(x, z) === 'OPEN';
  }

  allowsGroundCover(x: number, z: number): boolean {
    const c = this.classify(x, z);
    return c === 'OPEN' || c === 'ROAD_BORDER';
  }
}
