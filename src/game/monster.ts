import type { Noise, NoiseBus } from './noise';
import { WORLD_HALF } from './constants';
import { resolveCapsule, type Box } from './colliders';

export type MonsterMode = 'idle' | 'wander' | 'investigate' | 'search' | 'chase';
export interface MonsterState { x: number; z: number; yaw: number; mode: MonsterMode; tx: number; tz: number; timer: number; lastNoise: Noise | null }
export interface Prey { id: number; x: number; z: number; crouch: boolean; alive: boolean }

export const MONSTER = { sight: 8, sightCrouch: 4, catchDist: 1.1, wanderSpeed: 1.6, investigateSpeed: 2.6, chaseSpeed: 4.0, radius: 0.48, height: 2.0 };
export const newMonster = (x: number, z: number): MonsterState => ({ x, z, yaw: 0, mode: 'idle', tx: x, tz: z, timer: 0, lastNoise: null });

function moveTo(m: MonsterState, tx: number, tz: number, speed: number, dt: number, colliders: Box[]): number {
  const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
  if (d <= 0.01) return d;

  const s = Math.min(d, speed * dt);
  const vx = (dx / d) * s, vz = (dz / d) * s;
  const oldX = m.x, oldZ = m.z;

  // Resolve X and Z separately. This makes the creature slide along walls instead of
  // tunneling through cabins, sheds, trees and other solid environment objects.
  const xTry = { x: oldX + vx, y: 0, z: oldZ };
  resolveCapsule(xTry, MONSTER.radius, MONSTER.height, colliders, WORLD_HALF);
  m.x = xTry.x;

  const zTry = { x: m.x, y: 0, z: oldZ + vz };
  resolveCapsule(zTry, MONSTER.radius, MONSTER.height, colliders, WORLD_HALF);
  m.x = zTry.x; m.z = zTry.z;

  // If a direct route is blocked, bias the next target a little sideways so the
  // simple AI does not stand forever pushing into the same wall.
  const moved = Math.hypot(m.x - oldX, m.z - oldZ);
  if (moved < s * 0.15 && d > 1.5) {
    const side = Math.sin((m.x + m.z) * 2.173) >= 0 ? 1 : -1;
    m.tx = m.x + (-dz / d) * side * 3.5;
    m.tz = m.z + (dx / d) * side * 3.5;
  }
  m.yaw = Math.atan2(m.x - oldX, m.z - oldZ);
  return d;
}

/** Hears recent noise, investigates it, and chases visible players while respecting solid map collision. */
export function stepMonster(m: MonsterState, dt: number, now: number, bus: NoiseBus, prey: Prey[], active: boolean, rng: () => number = Math.random, colliders: Box[] = []): number | null {
  if (!active) { m.mode = 'idle'; return null; }
  let nearest: Prey | null = null, nd = Infinity;
  for (const p of prey) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - m.x, p.z - m.z);
    if (d < nd) { nd = d; nearest = p; }
  }
  if (nearest && nd < MONSTER.catchDist) return nearest.id;
  if (nearest && nd < (nearest.crouch ? MONSTER.sightCrouch : MONSTER.sight)) {
    m.mode = 'chase';
    moveTo(m, nearest.x, nearest.z, MONSTER.chaseSpeed, dt, colliders);
    return null;
  }
  const heard = bus.loudest(now, m.x, m.z);
  if (heard && heard.noise !== m.lastNoise && (m.mode !== 'investigate' || heard.noise.vol > (m.lastNoise?.vol ?? 0) * 0.8)) {
    m.lastNoise = heard.noise; m.tx = heard.noise.x; m.tz = heard.noise.z; m.mode = 'investigate';
  }
  if (m.mode === 'chase') { m.mode = 'search'; m.timer = 2.5; }
  if (m.mode === 'investigate') {
    if (moveTo(m, m.tx, m.tz, MONSTER.investigateSpeed, dt, colliders) < 1) { m.mode = 'search'; m.timer = 3; }
  } else if (m.mode === 'search') {
    m.timer -= dt;
    if (m.timer <= 0) m.mode = 'wander';
  } else {
    if (m.mode === 'idle' || Math.hypot(m.tx - m.x, m.tz - m.z) < 1) {
      m.mode = 'wander';
      m.tx = (rng() * 2 - 1) * (WORLD_HALF - 8); m.tz = (rng() * 2 - 1) * (WORLD_HALF - 8);
    }
    moveTo(m, m.tx, m.tz, MONSTER.wanderSpeed, dt, colliders);
  }
  return null;
}
