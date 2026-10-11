import { describe, expect, it } from 'vitest';
import { buildLayout } from '../../src/game/layout';
import { findPath } from '../../src/game/navigation';
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

  it('does not world-scatter bunks or socks in the live map anymore', () => {
    const layout = buildLayout(12345, 3);
    expect(layout.statics.some((s) => s.name === 'bunk')).toBe(false);
    expect(layout.items.some((s) => s.model === 'sock')).toBe(false);
  });
});
