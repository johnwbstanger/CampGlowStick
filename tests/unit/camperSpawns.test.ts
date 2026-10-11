import { describe, expect, it } from 'vitest';
import { buildLayout } from '../../src/game/layout';
import { chooseCamperHides } from '../../src/game/camperSpawns';
import { advanceBoardingStage, boardingTarget, BUS_AISLE_LOCAL, BUS_DOOR_LOCAL, BUS_SEATS_LOCAL, busLocalToWorld } from '../../src/game/busBoarding';

describe('camper rescue placement and boarding', () => {
  it('always selects seven hides with multiple real building interiors', () => {
    const hides = chooseCamperHides(buildLayout(12345), 7);
    expect(hides).toHaveLength(7);
    expect(hides.filter((h) => h.kind === 'indoor').length).toBeGreaterThanOrEqual(3);
    expect(hides.some((h) => /DINING|KITCHEN|DIRECTOR|BATHHOUSE|ARTS|CABIN/.test(h.label))).toBe(true);
  });

  it('is deterministic for one world but varies between randomized worlds', () => {
    const a = chooseCamperHides(buildLayout(111), 7).map((h) => `${h.x.toFixed(2)},${h.z.toFixed(2)}`);
    const b = chooseCamperHides(buildLayout(111), 7).map((h) => `${h.x.toFixed(2)},${h.z.toFixed(2)}`);
    const c = chooseCamperHides(buildLayout(222), 7).map((h) => `${h.x.toFixed(2)},${h.z.toFixed(2)}`);
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });

  it('routes campers through the visible bus door, then aisle, then a unique seat', () => {
    const bus = { x: 31, z: 2, rot: Math.PI / 2 };
    const door = boardingTarget(bus, 0, 0);
    const aisle = boardingTarget(bus, 1, 0);
    const seat = boardingTarget(bus, 2, 0);
    expect(door).toEqual(busLocalToWorld(bus, ...BUS_DOOR_LOCAL));
    expect(aisle).toEqual(busLocalToWorld(bus, ...BUS_AISLE_LOCAL));
    expect(seat).toEqual(busLocalToWorld(bus, ...BUS_SEATS_LOCAL[0]));
    expect(door).not.toEqual(aisle);
    expect(aisle).not.toEqual(seat);
  });

  it('does not skip from outside the bus directly to rescued/seat state', () => {
    expect(advanceBoardingStage(0, 2)).toBe(0);
    expect(advanceBoardingStage(0, .2)).toBe(1);
    expect(advanceBoardingStage(1, .2)).toBe(2);
    expect(advanceBoardingStage(2, .2)).toBe(2);
  });
});
