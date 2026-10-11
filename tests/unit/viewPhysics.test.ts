import { describe, expect, it } from 'vitest';
import { heldPose, releaseVelocity, viewForward } from '../../src/game/viewPhysics';

describe('view-relative physics helpers', () => {
  it('points forward along camera yaw', () => {
    const a = viewForward(0, 0);
    expect(a[0]).toBeCloseTo(0, 6);
    expect(a[1]).toBeCloseTo(0, 6);
    expect(a[2]).toBeCloseTo(-1, 6);

    const b = viewForward(Math.PI / 2, 0);
    expect(b[0]).toBeCloseTo(-1, 6);
    expect(b[2]).toBeCloseTo(0, 6);
  });

  it('uses pitch for vertical throw direction', () => {
    const flat = releaseVelocity(0, 0, 0.8, 1, true);
    const up = releaseVelocity(0, 0.65, 0.8, 1, true);
    const down = releaseVelocity(0, -0.65, 0.8, 1, true);
    expect(up[1]).toBeGreaterThan(flat[1] + 5);
    expect(down[1]).toBeLessThan(flat[1] - 4);
  });

  it('makes charged throws stronger and heavy props feel heavier', () => {
    const weak = releaseVelocity(0, 0, 0.15, 1, true);
    const strong = releaseVelocity(0, 0, 1, 1, true);
    const heavy = releaseVelocity(0, 0, 1, 5, true);
    expect(Math.hypot(strong[0], strong[2])).toBeGreaterThan(Math.hypot(weak[0], weak[2]));
    expect(Math.hypot(heavy[0], heavy[2])).toBeLessThan(Math.hypot(strong[0], strong[2]));
  });

  it('moves the held socket with camera pitch and preserves view orientation', () => {
    const low = heldPose({ p: [10, 0, 20], yaw: 0, pitch: -0.5, crouch: false }, 1.62, { forward: 0.7, right: 0.2, down: 0.3 });
    const high = heldPose({ p: [10, 0, 20], yaw: 0, pitch: 0.5, crouch: false }, 1.62, { forward: 0.7, right: 0.2, down: 0.3 });
    expect(high.position[1]).toBeGreaterThan(low.position[1]);
    expect(high.euler).toEqual([-0.5, 0, 0]);
  });
});
