export interface BusPlacement { x: number; z: number; rot: number }
export type BoardingStage = -1 | 0 | 1 | 2;

// Matches the actual makeBus() shell in world.ts: side-wall opening is local X 0.55..2.25 at local Z=-1.525.
export const BUS_DOOR_LOCAL: [number, number] = [1.40, -2.05];
export const BUS_AISLE_LOCAL: [number, number] = [1.40, -0.05];
export const BUS_SEATS_LOCAL: [number, number][] = [
  [-3.0, .62], [-3.0, -.62], [-1.75, .62], [-1.75, -.62], [-.5, .62], [-.5, -.62], [.78, .62],
];

export function busLocalToWorld(bus: BusPlacement, localX: number, localZ: number): [number, number] {
  const c = Math.cos(bus.rot), s = Math.sin(bus.rot);
  return [bus.x + localX * c + localZ * s, bus.z - localX * s + localZ * c];
}

/**
 * Deliberately route through the visible bus doorway before the aisle and seat.
 * A camper is not rescued until stage 2 reaches the assigned seat.
 */
export function boardingTarget(bus: BusPlacement, stage: BoardingStage, seatIndex: number): [number, number] {
  if (stage <= 0) return busLocalToWorld(bus, ...BUS_DOOR_LOCAL);
  if (stage === 1) return busLocalToWorld(bus, ...BUS_AISLE_LOCAL);
  const seat = BUS_SEATS_LOCAL[Math.max(0, Math.min(BUS_SEATS_LOCAL.length - 1, seatIndex))];
  return busLocalToWorld(bus, ...seat);
}

export function advanceBoardingStage(stage: BoardingStage, distanceToTarget: number): BoardingStage {
  if (distanceToTarget > .34) return stage;
  if (stage < 0) return 0;
  if (stage === 0) return 1;
  if (stage === 1) return 2;
  return 2;
}
