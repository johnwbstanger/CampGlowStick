import { STAMINA } from './constants';

/** drain = baseRate * (1 + carryWeight / maxWeightCap) */
export const drainRate = (base: number, carryWeight: number, maxWeightCap: number): number => base * (1 + carryWeight / maxWeightCap);

export function stepStamina(stamina: number, dt: number, sprinting: boolean, carryWeight: number): number {
  const next = sprinting ? stamina - drainRate(STAMINA.baseDrain, carryWeight, STAMINA.maxWeightCap) * dt : stamina + STAMINA.regen * dt;
  return Math.min(STAMINA.max, Math.max(0, next));
}
