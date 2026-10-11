import { describe, expect, it } from 'vitest';
import { detectRuntimeProfile, nextPixelRatio } from '../../src/game/runtimeProfile';

describe('runtime profile', () => {
  it('uses a lower fill-rate budget on iPad-like devices', () => {
    const p = detectRuntimeProfile({ maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (Macintosh) Mobile/15E148' } as Navigator);
    expect(p.touchLike).toBe(true);
    expect(p.maxPixelRatio).toBe(1);
    expect(p.antialias).toBe(false);
  });

  it('drops resolution under sustained low fps and can recover', () => {
    const p = { touchLike: true, maxPixelRatio: 1, antialias: false, dynamicResolution: true, minPixelRatio: 0.72 };
    const low = nextPixelRatio(1, 28, p, 2);
    expect(low).toBeLessThan(1);
    const recovered = nextPixelRatio(low, 60, p, 2);
    expect(recovered).toBeGreaterThan(low);
    expect(recovered).toBeLessThanOrEqual(1);
  });
});
