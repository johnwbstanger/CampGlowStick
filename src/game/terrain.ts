import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import type { Layout } from './layout';
import { CAMP_PLAN, TERRAIN_PADS } from './campPlan';
import { WORLD_HALF } from './constants';

const noise = new ImprovedNoise();
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const gaussian = (x: number, z: number, cx: number, cz: number, sx: number, sz: number): number => {
  const dx = (x - cx) / sx, dz = (z - cz) / sz;
  return Math.exp(-(dx * dx + dz * dz) * 0.5);
};

/** Broad terrain before local building-pad flattening. Deterministic on every peer. */
function rawHeight(x: number, z: number): number {
  // Long rolling forms establish readable topology; fine noise only breaks the perfect CG plane.
  const macro = noise.noise(x * 0.0065 + 11.7, 0.31, z * 0.0065 - 7.4) * 2.4;
  const mid = noise.noise(x * 0.017 - 23.2, 1.7, z * 0.017 + 4.1) * 0.7;
  const micro = noise.noise(x * 0.052 + 2.8, 4.2, z * 0.052 - 5.6) * 0.16;

  // West cabin ridge, eastern drainage swale and a gentle high entrance shoulder.
  const westRidge = gaussian(x, z, -94, 70, 62, 46) * 3.1;
  const northShoulder = gaussian(x, z, 18, 132, 95, 48) * 1.25;
  const eastSwale = gaussian(x, z, 82, 45, 42, 76) * -1.45;
  const campfireDip = gaussian(x, z, -4, -69, 34, 30) * -0.55;

  // The lake is a genuine basin rather than a blue disc on top of grass. A broader shelf creates
  // beach/wetland transition; the inner basin stays below the fixed water surface.
  const lakeShelf = gaussian(x, z, CAMP_PLAN.lake.x, CAMP_PLAN.lake.z, CAMP_PLAN.lake.rx * 1.18, CAMP_PLAN.lake.rz * 1.5) * -2.4;
  const lakeBasin = gaussian(x, z, CAMP_PLAN.lake.x, CAMP_PLAN.lake.z, CAMP_PLAN.lake.rx * 0.72, CAMP_PLAN.lake.rz * 0.72) * -4.7;

  // A subtle perimeter lift prevents the map edge from reading as a cut sheet from common sightlines.
  const edge = Math.max(Math.abs(x), Math.abs(z)) / WORLD_HALF;
  const edgeLift = smooth((edge - 0.72) / 0.28) * 2.0;
  return macro + mid + micro + westRidge + northShoulder + eastSwale + campfireDip + lakeShelf + lakeBasin + edgeLift;
}

function flattenPads(x: number, z: number, h: number): number {
  let out = h;
  for (const pad of TERRAIN_PADS) {
    const dx = (x - pad.x) / pad.rx, dz = (z - pad.z) / pad.rz;
    const d = Math.hypot(dx, dz);
    if (d >= 1.22) continue;
    const target = rawHeight(pad.x, pad.z);
    // Fully flat through 70% of each pad, then feather into the surrounding slope.
    const blend = 1 - smooth((d - 0.7) / 0.52);
    out += (target - out) * blend;
  }
  return out;
}

/**
 * Shared source of truth for rendering, player grounding, AI, spawn placement and Cannon heightfield.
 * Keeping this function pure is what lets imported environment art replace the old flat world without
 * desynchronising host and clients.
 */
export function terrainHeight(x: number, z: number, _layout?: Pick<Layout, 'water'>): number {
  return flattenPads(x, z, rawHeight(x, z));
}

export function terrainSlope(x: number, z: number): number {
  const e = 0.75;
  const dx = (terrainHeight(x + e, z) - terrainHeight(x - e, z)) / (e * 2);
  const dz = (terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (e * 2);
  return Math.atan(Math.hypot(dx, dz));
}

/** Cannon Heightfield data sampled from exactly the same function as the visual terrain. */
export function terrainHeightfieldData(segments = 96): { data: number[][]; elementSize: number } {
  const size = WORLD_HALF * 2;
  const elementSize = size / segments;
  const data: number[][] = [];
  for (let ix = 0; ix <= segments; ix++) {
    const column: number[] = [];
    const x = -WORLD_HALF + ix * elementSize;
    for (let iz = 0; iz <= segments; iz++) {
      const z = -WORLD_HALF + iz * elementSize;
      column.push(terrainHeight(x, z));
    }
    data.push(column);
  }
  return { data, elementSize };
}

export function isDeepWater(x: number, z: number, layout: Pick<Layout, 'water'>): boolean {
  const w = layout.water;
  if (!w) return false;
  const nx = (x - w.x) / (w.rx * 0.86), nz = (z - w.z) / (w.rz * 0.82);
  return nx * nx + nz * nz < 1;
}
