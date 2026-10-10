import { describe, expect, it } from 'vitest';
import { ALWAYS_PRELOAD, MANIFEST } from '../../src/assets/manifest';
import { terrainHeight } from '../../src/game/terrain';
import { mulberry32 } from '../../src/game/layout';
import { poisson2d } from '../../src/vendor/poisson2d';

describe('lived-in camp asset pass', () => {
  it('registers the imported Furniture Kit props used by authored camp scenes', () => {
    for (const name of ['table', 'chair', 'bookshelf', 'bedSingle', 'sink', 'teddy'] as const) {
      expect(MANIFEST).toHaveProperty(name);
      expect(ALWAYS_PRELOAD).toContain(name);
      expect(MANIFEST[name].file).toMatch(/^models\/furniture\//);
    }
  });

  it('keeps the gameplay floor flat so structures and physics share one stable ground plane', () => {
    for (const [x, z] of [[0, 0], [110, 70], [-95, -42], [37, -81], [103, -4]]) {
      expect(terrainHeight(x, z)).toBe(0);
    }
  });

  it('uses deterministic blue-noise spacing for prop yards', () => {
    const make = () => poisson2d({ width: 12, height: 8, minDistance: 1.65, maxDistance: 2.8, tries: 24, rng: mulberry32(12345) });
    const a = make(), b = make();
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(8);
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
      expect(Math.hypot(a[i][0] - a[j][0], a[i][1] - a[j][1])).toBeGreaterThanOrEqual(1.6499);
    }
  });
});
