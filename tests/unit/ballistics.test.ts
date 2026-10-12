import { describe, expect, it } from 'vitest';
import { ballisticLineClear, firstBallisticBlock } from '../../src/game/ballistics';

const wall = { minX: -1, maxX: 1, minY: 0, maxY: 3, minZ: -6, maxZ: -5.5 };

describe('ballistic occlusion', () => {
  it('blocks a shot when a solid wall is before the target', () => {
    const ray = { x: 0, y: 1.6, z: 0, dx: 0, dy: 0, dz: -1 };
    expect(firstBallisticBlock(ray, 20, [wall])).toBeGreaterThan(5);
    expect(firstBallisticBlock(ray, 20, [wall])).toBeLessThan(6);
    expect(ballisticLineClear(ray, 12, [wall])).toBe(false);
  });

  it('allows a shot that passes above or beside the wall', () => {
    expect(ballisticLineClear({ x: 2.2, y: 1.6, z: 0, dx: 0, dy: 0, dz: -1 }, 12, [wall])).toBe(true);
    expect(ballisticLineClear({ x: 0, y: 4, z: 0, dx: 0, dy: 0, dz: -1 }, 12, [wall])).toBe(true);
  });

  it('does not let geometry behind the target invalidate a hit', () => {
    const ray = { x: 0, y: 1.6, z: 0, dx: 0, dy: 0, dz: -1 };
    expect(ballisticLineClear(ray, 4, [wall])).toBe(true);
  });
});
