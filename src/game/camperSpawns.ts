import type { Layout } from './layout';
import { mulberry32 } from './layout';
import { LANDMARKS } from './landmarks';

export type CamperHideKind = 'indoor' | 'outdoor';
export interface CamperHide { x: number; z: number; kind: CamperHideKind; label: string }

const localToWorld = (x: number, z: number, cx: number, cz: number, rot: number): [number, number] => {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [cx + x * c + z * s, cz - x * s + z * c];
};

/**
 * Authored hiding anchors keep campers in believable, reachable places instead of arbitrary world coordinates.
 * Interior anchors deliberately avoid the doorway centre and known large furnishing rows.
 */
export function camperHideCandidates(layout: Layout): CamperHide[] {
  const indoor: CamperHide[] = [];
  for (const b of LANDMARKS) {
    const offsets: [number, number][] = b.kind === 'dining'
      ? [[-b.w * .34, -b.d * .30], [b.w * .34, b.d * .28]]
      : b.kind === 'kitchen'
        ? [[-b.w * .28, .35], [b.w * .28, .35]]
        : b.kind === 'director'
          ? [[b.w * .24, -b.d * .24], [-b.w * .22, b.d * .16]]
          : b.kind === 'bathhouse'
            ? [[-b.w * .36, -b.d * .20], [b.w * .36, -b.d * .20]]
            : [[-b.w * .28, -b.d * .24], [b.w * .28, b.d * .18]];
    for (const [lx, lz] of offsets) {
      const [x, z] = localToWorld(lx, lz, b.x, b.z, b.rot);
      indoor.push({ x, z, kind: 'indoor', label: b.label });
    }
  }

  const cabins = layout.statics.filter((s) => s.name === 'cabin');
  cabins.forEach((c, i) => {
    const [x, z] = localToWorld(i % 2 ? 1.2 : -1.2, i % 3 ? -.8 : .9, c.x, c.z, c.rot);
    indoor.push({ x, z, kind: 'indoor', label: `CABIN ${i + 1}` });
  });

  const outdoor: CamperHide[] = [
    { x: -15, z: 54, kind: 'outdoor', label: 'TENT LOOP' },
    { x: 12, z: 64, kind: 'outdoor', label: 'TENT LOOP' },
    { x: -91, z: 74, kind: 'outdoor', label: 'WEST CAMPSITE' },
    { x: 101, z: 57, kind: 'outdoor', label: 'EAST CAMPSITE' },
    { x: 77, z: -5, kind: 'outdoor', label: 'WATERFRONT' },
    { x: -45, z: 86, kind: 'outdoor', label: 'OUTER TRAIL' },
    { x: -99, z: -38, kind: 'outdoor', label: 'MAINTENANCE' },
    { x: 95, z: -27, kind: 'outdoor', label: 'SERVICE SHED' },
    { x: 8, z: 13, kind: 'outdoor', label: 'FIRE RING' },
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
  // buildLayout already uses the round seed to vary deterministic prop positions. Hash a handful of those
  // positions so hide selection varies with the same round without adding a network/protocol field.
  let h = 0x43414d50;
  for (const item of layout.items.slice(0, 12)) {
    h ^= Math.round(item.x * 100) | 0;
    h = Math.imul(h, 16777619);
    h ^= Math.round(item.z * 100) | 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seven deterministic hides, always including multiple real building interiors. */
export function chooseCamperHides(layout: Layout, count = 7): CamperHide[] {
  const rng = mulberry32((layoutSeed(layout) ^ 0x47574f53) >>> 0);
  const all = camperHideCandidates(layout);
  const inside = shuffle(all.filter((h) => h.kind === 'indoor'), rng);
  const outside = shuffle(all.filter((h) => h.kind === 'outdoor'), rng);
  const indoorCount = Math.min(Math.max(3, Math.ceil(count * .5)), count, inside.length);
  const result = [...inside.slice(0, indoorCount), ...outside.slice(0, count - indoorCount)];
  return shuffle(result, rng);
}
