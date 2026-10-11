import { describe, expect, it } from 'vitest';
import { ONE_STORY_BUNK_CABIN } from '../../src/worldgen/campBlueprint';
import { allowedByMasks, footprintMask, pointInFootprint, semanticScatter } from '../../src/worldgen/placement';
import { ruleFor } from '../../src/worldgen/semanticRules';

describe('blueprint-grounded environment hierarchy', () => {
  it('defines a one-story cabin with interior bunk and camper hide anchors', () => {
    expect(ONE_STORY_BUNK_CABIN.floors).toBe(1);
    const sleeping = ONE_STORY_BUNK_CABIN.rooms.find((r) => r.kind === 'sleeping');
    expect(sleeping).toBeTruthy();
    expect(sleeping!.sockets.filter((s) => s.kind === 'bunk-wall').length).toBeGreaterThanOrEqual(4);
    expect(sleeping!.sockets.some((s) => s.kind.startsWith('hide-'))).toBe(true);
  });

  it('forbids bunks and socks from arbitrary outdoor placement', () => {
    expect(ruleFor('bunk')?.forbiddenOutdoors).toBe(true);
    expect(ruleFor('sock')?.forbiddenOutdoors).toBe(true);
    expect(ruleFor('sock')?.allowedRooms).toEqual(['sleeping']);
  });

  it('uses rotated building footprints as real occupancy, not point-radius guesses', () => {
    const footprint = { cx: 10, cz: -4, w: 8, d: 4, rot: Math.PI / 4 };
    expect(pointInFootprint(10, -4, footprint)).toBe(true);
    expect(pointInFootprint(30, -4, footprint)).toBe(false);
  });

  it('keeps deterministic vegetation out of building exclusion masks', () => {
    const building = { cx: 0, cz: 0, w: 12, d: 8, rot: 0 };
    const masks = [footprintMask(building, 'building', 2)];
    const points = semanticScatter({ seed: 42, width: 40, height: 40, originX: -20, originZ: -20, minDistance: 2, maxDistance: 4, maxCount: 100, masks });
    expect(points.length).toBeGreaterThan(10);
    expect(points.every(([x, z]) => allowedByMasks(x, z, masks))).toBe(true);
  });
});
