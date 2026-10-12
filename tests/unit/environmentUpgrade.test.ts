import { describe, expect, it } from 'vitest';
import { MANIFEST } from '../../src/assets/manifest';
import { CABINS, CAMP_PLAN } from '../../src/game/campPlan';
import { WORLD_HALF } from '../../src/game/constants';
import { buildLayout } from '../../src/game/layout';
import { findPath } from '../../src/game/navigation';
import { terrainHeight, terrainHeightfieldData, terrainSlope } from '../../src/game/terrain';

describe('imported world-stack replacement', () => {
  it('keeps the authored 360m camp deterministic for a shared multiplayer seed', () => {
    expect(WORLD_HALF).toBe(180);
    const a = buildLayout(855193, 3);
    const b = buildLayout(855193, 3);
    expect(a).toEqual(b);
    expect(a.spawns).toHaveLength(15);
    expect(a.roads.length).toBeGreaterThanOrEqual(10);
    expect(a.clearings.length).toBeGreaterThanOrEqual(8);
    expect(a.trees.length).toBeGreaterThan(600);
    expect(CABINS.length).toBeGreaterThanOrEqual(10);
  });

  it('has real sculpted terrain rather than the old y=0 floor', () => {
    const samples: number[] = [];
    for (let x = -150; x <= 150; x += 30) for (let z = -150; z <= 150; z += 30) {
      const h = terrainHeight(x, z);
      expect(Number.isFinite(h)).toBe(true);
      expect(Number.isFinite(terrainSlope(x, z))).toBe(true);
      samples.push(h);
    }
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(4);
    expect(new Set(samples.map((n) => n.toFixed(2))).size).toBeGreaterThan(20);
  });

  it('feeds Cannon a heightfield sampled from the same terrain function', () => {
    const { data, elementSize } = terrainHeightfieldData(24);
    expect(data).toHaveLength(25);
    expect(data[0]).toHaveLength(25);
    expect(elementSize).toBeCloseTo((WORLD_HALF * 2) / 24);
    // Heightfield local +Y becomes world -Z after the host's -90° X rotation.
    expect(data[0][0]).toBeCloseTo(terrainHeight(-WORLD_HALF, WORLD_HALF), 6);
    expect(data[24][24]).toBeCloseTo(terrainHeight(WORLD_HALF, -WORLD_HALF), 6);
  });

  it('keeps all lobby spawns on finite, walkable land', () => {
    const layout = buildLayout(42, 3);
    for (const [x, z] of layout.spawns) {
      expect(Math.abs(x)).toBeLessThan(WORLD_HALF);
      expect(Math.abs(z)).toBeLessThan(WORLD_HALF);
      expect(Number.isFinite(terrainHeight(x, z))).toBe(true);
      expect(terrainSlope(x, z)).toBeLessThan(0.5);
      const w = layout.water;
      const lake = ((x - w.x) / (w.rx * .86)) ** 2 + ((z - w.z) / (w.rz * .82)) ** 2;
      expect(lake).toBeGreaterThan(1);
    }
  });

  it('routes across the expanded terrain with the imported A* core', () => {
    const [cx, cz] = CABINS[0];
    const path = findPath(cx, cz, CAMP_PLAN.extraction.x, CAMP_PLAN.extraction.z, [], .3, 6);
    expect(path.length).toBeGreaterThan(0);
    const last = path.at(-1)!;
    expect(Math.hypot(last.x - CAMP_PLAN.extraction.x, last.z - CAMP_PLAN.extraction.z)).toBeLessThan(.1);
  });

  it('uses actual imported camp props instead of the old crate/bedroll stand-ins', () => {
    expect(MANIFEST.cooler.file).toContain('cc0-camp-props/cooler.glb');
    expect(MANIFEST.backpack.file).toContain('cc0-camp-props/backpack.glb');
  });

  it('keeps multiple imported counselor and camper bodies available', () => {
    expect(MANIFEST.counselorMaleCasual.file).toContain('camp-characters');
    expect(MANIFEST.counselorFemaleCasual.file).toContain('camp-characters');
    expect(MANIFEST.camperMaleVariant.file).toContain('camp-characters');
    expect(MANIFEST.camperFemaleVariant.file).toContain('camp-characters');
  });
});
