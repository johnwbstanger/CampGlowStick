import { describe, expect, it } from 'vitest';
import { followerPlan, steeringVelocity } from '../../src/game/followerSteering';

describe('camper escort steering', () => {
  it('keeps the first row close behind the counselor', () => {
    const a = followerPlan(0, 3, 2, false, true);
    const b = followerPlan(2, 3, 2, false, true);
    expect(a.radius).toBeLessThan(2);
    expect(b.radius).toBeLessThan(2);
    expect(Math.abs(a.angle - b.angle)).toBeLessThan(1);
  });

  it('matches normal movement but catches up when separated', () => {
    const normal = followerPlan(0, 1, 2.5, false, true);
    const sprint = followerPlan(0, 1, 2.5, true, true);
    const far = followerPlan(0, 1, 7, false, true);
    expect(sprint.speed).toBeGreaterThan(normal.speed);
    expect(far.speed).toBeGreaterThan(sprint.speed);
  });

  it('accelerates instead of instantly snapping to full speed', () => {
    const [vx] = steeringVelocity(10, 0, 8, 0, 0, 1 / 60);
    expect(vx).toBeGreaterThan(0);
    expect(vx).toBeLessThan(8);
  });
});
