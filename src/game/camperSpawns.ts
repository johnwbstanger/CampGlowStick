import type { Layout } from './layout';
import { mulberry32 } from './layout';
import { LANDMARKS } from './landmarks';

export type CamperHideKind = 'indoor' | 'outdoor';
export type CamperHidePose = 'stand' | 'crouch';
export interface CamperHide { x: number; z: number; kind: CamperHideKind; label: string; pose?: CamperHidePose }

const localToWorld = (x: number, z: number, cx: number, cz: number, rot: number): [number, number] => {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [cx + x * c + z * s, cz - x * s + z * c];
};

/**
 * Hiding candidates are semantic anchors attached to actual rooms/furniture. The default standing
 * pose keeps arms down; only an under-bunk/low-cover anchor asks the presentation layer to crouch.
 */
export function camperHideCandidates(layout: Layout): CamperHide[] {
  const indoor: CamperHide[] = [];
  for (const b of LANDMARKS) {
    const anchors: [number, number, CamperHidePose][] = b.kind === 'dining'
      ? [[-b.w * .34, -b.d * .30, 'stand'], [b.w * .34, b.d * .28, 'stand']]
      : b.kind === 'kitchen'
        ? [[-b.w * .28, .35, 'stand'], [b.w * .28, .35, 'stand']]
        : b.kind === 'director'
          ? [[b.w * .24, -b.d * .24, 'stand'], [-b.w * .22, b.d * .16, 'crouch']]
          : b.kind === 'bathhouse'
            ? [[-b.w * .36, -b.d * .20, 'stand'], [b.w * .36, -b.d * .20, 'stand']]
            : [[-b.w * .28, -b.d * .24, 'stand'], [b.w * .28, b.d * .18, 'crouch']];
    for (const [lx, lz, pose] of anchors) {
      const [x, z] = localToWorld(lx, lz, b.x, b.z, b.rot);
      indoor.push({ x, z, kind: 'indoor', label: b.label, pose });
    }
  }

  const cabins = layout.statics.filter((s) => s.name === 'cabin');
  const bunkAnchors: [number, number][] = [[-2.35, -1.35], [2.35, -1.35], [-2.35, 1.10], [2.35, 1.10]];
  cabins.forEach((c, i) => {
    // Pick a different real bunk socket in each cabin rather than a generic cabin-center coordinate.
    const [lx, lz] = bunkAnchors[i % bunkAnchors.length];
    const [x, z] = localToWorld(lx * .82, lz, c.x, c.z, c.rot);
    indoor.push({ x, z, kind: 'indoor', label: `CABIN ${i + 1} · UNDER BUNK`, pose: 'crouch' });
    // Closet/shelf-side anchor remains standing and gives variation without inventing another room.
    const [sx, sz] = localToWorld(i % 2 ? .75 : -.75, -2.15, c.x, c.z, c.rot);
    indoor.push({ x: sx, z: sz, kind: 'indoor', label: `CABIN ${i + 1} · STORAGE WALL`, pose: 'stand' });
  });

  const outdoor: CamperHide[] = [
    { x: -15, z: 54, kind: 'outdoor', label: 'TENT LOOP', pose: 'stand' },
    { x: 12, z: 64, kind: 'outdoor', label: 'TENT LOOP', pose: 'stand' },
    { x: -91, z: 74, kind: 'outdoor', label: 'WEST CAMPSITE', pose: 'crouch' },
    { x: 101, z: 57, kind: 'outdoor', label: 'EAST CAMPSITE', pose: 'stand' },
    { x: 77, z: -5, kind: 'outdoor', label: 'WATERFRONT', pose: 'crouch' },
    { x: -45, z: 86, kind: 'outdoor', label: 'OUTER TRAIL SHELTER', pose: 'stand' },
    { x: -99, z: -38, kind: 'outdoor', label: 'MAINTENANCE WOODSHED', pose: 'crouch' },
    { x: 95, z: -27, kind: 'outdoor', label: 'SERVICE SHED', pose: 'stand' },
    { x: 8, z: 13, kind: 'outdoor', label: 'FIRE RING', pose: 'stand' },
  ];
  return [...indoor, ...outdoor];
}

function shuffle<T>(values: T[], rng: () => number): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function layoutSeed(layout: Layout): number {
  let h = 0x43414d50;
  for (const item of layout.items.slice(0, 12)) {
    h ^= Math.round(item.x * 100) | 0; h = Math.imul(h, 16777619);
    h ^= Math.round(item.z * 100) | 0; h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seven deterministic hides, always including multiple real building interiors. */
export function chooseCamperHides(layout: Layout, count = 7): CamperHide[] {
  const rng = mulberry32((layoutSeed(layout) ^ 0x47574f53) >>> 0);
  const all = camperHideCandidates(layout);
  const inside = shuffle(all.filter((h) => h.kind === 'indoor'), rng);
  const outside = shuffle(all.filter((h) => h.kind === 'outdoor'), rng);
  const indoorCount = Math.min(Math.max(4, Math.ceil(count * .6)), count, inside.length);
  const result = [...inside.slice(0, indoorCount), ...outside.slice(0, count - indoorCount)];
  return shuffle(result, rng);
}
