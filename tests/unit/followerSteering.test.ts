import { describe, expect, it } from 'vitest';
import {
  followerPlan,
  SNALLY_FOLLOW_DISTANCE,
  SNALLY_FOLLOW_SPEED,
  snallyFollowerTarget,
  steeringVelocity,
} from '../../src/game/followerSteering';

describe('Camp Snallygaster camper escort port', () => {
  it('preserves the original 2.25m three-wide first rank and 0.7m rank spacing', () => {
    const a = followerPlan(0, 3, 7, false, true);
    const b = followerPlan(2, 3, 7, false, true);
    const secondRank = followerPlan(3, 4, 7, false, true);
    expect(a.radius).toBeCloseTo(SNALLY_FOLLOW_DISTANCE, 5);
    expect(b.radius).toBeCloseTo(SNALLY_FOLLOW_DISTANCE, 5);
    expect(secondRank.radius).toBeCloseTo(SNALLY_FOLLOW_DISTANCE + 0.7, 5);
    expect(Math.abs(a.angle - b.angle)).toBeCloseTo(0.68, 5);
  });

  it('preserves the Snallygaster d*3.2 catch-up rule capped at 3.4m/s while walking', () => {
    const close = followerPlan(0, 1, SNALLY_FOLLOW_DISTANCE + 0.25, false, true);
    const far = followerPlan(0, 1, 8, false, true);
    expect(close.speed).toBeCloseTo(0.8, 5);
    expect(far.speed).toBeCloseTo(SNALLY_FOLLOW_SPEED, 5);
  });

  it('uses the original rear-yaw target formula', () => {
    const t = snallyFollowerTarget(1, 10, 20, 0);
    expect(t.x).toBeCloseTo(10, 5);
    expect(t.z).toBeCloseTo(22.25, 5);
    const left = snallyFollowerTarget(0, 10, 20, 0);
    const right = snallyFollowerTarget(2, 10, 20, 0);
    expect(left.x).toBeLessThan(10);
    expect(right.x).toBeGreaterThan(10);
  });

  it('accelerates instead of snapping velocity between frames', () => {
    const [vx] = steeringVelocity(10, 0, 8, 0, 0, 1 / 60);
    expect(vx).toBeGreaterThan(0);
    expect(vx).toBeLessThan(8);
  });
});
