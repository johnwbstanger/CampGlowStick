import { describe, expect, it } from 'vitest';
import { MANIFEST } from '../../src/assets/manifest';
import { CABINS } from '../../src/game/campPlan';
import { buildLayout } from '../../src/game/layout';
import { findPath } from '../../src/game/navigation';
import { chooseCamperHides } from '../../src/game/camperSpawns';
import { semanticScatter } from '../../src/worldgen/placement';

describe('imported open-source world stack', () => {
  it('routes around a solid building using the three-pathfinding A* core', () => {
    const wall = [{ minX: -2, maxX: 2, minZ: -4, maxZ: 4, minY: 0, maxY: 3 }];
    const path = findPath(-8, 0, 8, 0, wall, 0.48, 2);
    expect(path.length).toBeGreaterThan(1);
    expect(path.some((p) => Math.abs(p.z) > 4)).toBe(true);
  });

  it('keeps upstream Poisson scatter deterministic behind semantic masks', () => {
    const opts = { seed: 42, width: 30, height: 30, originX: -15, originZ: -15, minDistance: 2, maxDistance: 3.5, maxCount: 60,
      masks: [{ x: 0, z: 0, radius: 6, reason: 'building' as const }] };
    const a = semanticScatter(opts), b = semanticScatter(opts);
    expect(a).toEqual(b);
    expect(a.every(([x, z]) => Math.hypot(x, z) >= 6)).toBe(true);
  });

  it('uses the pinned CC0 one-storey camp building family instead of suburban House1/House2', () => {
    expect(MANIFEST.cabin.file).toContain('openagents/log_cabin.glb');
    expect(MANIFEST.shed.file).toContain('openagents/woodshed.glb');
    expect(MANIFEST.boathouse.file).toContain('openagents/boathouse.glb');
    expect(MANIFEST.trailShelter.file).toContain('openagents/trail_shelter.glb');
    expect(MANIFEST.groundBrush.file).toContain('nature/ground_grass.glb');
  });

  it('parents bunks to sleeping-cabin interiors and keeps private socks out of outdoor world scatter', () => {
    const layout = buildLayout(12345, 3);
    const bunks = layout.statics.filter((s) => s.name === 'bunk');
    expect(CABINS.length).toBeGreaterThan(8);
    expect(bunks.length).toBe(CABINS.length * 4);
    expect(bunks.every((b) => CABINS.some(([x, z]) => Math.hypot(b.x - x, b.z - z) < 3.3))).toBe(true);
    expect(layout.items.some((s) => s.model === 'sock')).toBe(false);
  });

  it('selects a majority of camper hides from real building interiors', () => {
    const hides = chooseCamperHides(buildLayout(98765, 3), 7);
    expect(hides).toHaveLength(7);
    expect(hides.filter((h) => h.kind === 'indoor').length).toBeGreaterThanOrEqual(4);
    expect(hides.some((h) => h.label.includes('UNDER BUNK'))).toBe(true);
    expect(hides.every((h) => h.pose === 'stand' || h.pose === 'crouch')).toBe(true);
  });
});
