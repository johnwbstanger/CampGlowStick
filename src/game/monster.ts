import type { Noise, NoiseBus } from './noise';
import { WORLD_HALF } from './constants';

export type MonsterMode = 'idle' | 'wander' | 'investigate' | 'search' | 'chase';
export interface MonsterState { x: number; z: number; yaw: number; mode: MonsterMode; tx: number; tz: number; timer: number; lastNoise: Noise | null }
export interface Prey { id: number; x: number; z: number; crouch: boolean; alive: boolean }

export const MONSTER = { sight: 8, sightCrouch: 4, catchDist: 1.1, wanderSpeed: 1.6, investigateSpeed: 2.6, chaseSpeed: 4.0 };
export const newMonster = (x: number, z: number): MonsterState => ({ x, z, yaw: 0, mode: 'idle', tx: x, tz: z, timer: 0, lastNoise: null });

function moveTo(m: MonsterState, tx: number, tz: number, speed: number, dt: number): number {
  const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
  if (d > 0.01) {
    const s = Math.min(d, speed * dt);
    m.x += (dx / d) * s; m.z += (dz / d) * s; m.yaw = Math.atan2(dx, dz);
  }
  return d;
}

/** Stub AI: hears the loudest recent noise (distance falloff only) and investigates; chases anything it sees. Returns the caught player id. */
export function stepMonster(m: MonsterState, dt: number, now: number, bus: NoiseBus, prey: Prey[], active: boolean, rng: () => number = Math.random): number | null {
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
    moveTo(m, nearest.x, nearest.z, MONSTER.chaseSpeed, dt);
    return null;
  }
  const heard = bus.loudest(now, m.x, m.z);
  if (heard && heard.noise !== m.lastNoise && (m.mode !== 'investigate' || heard.noise.vol > (m.lastNoise?.vol ?? 0) * 0.8)) {
    m.lastNoise = heard.noise; m.tx = heard.noise.x; m.tz = heard.noise.z; m.mode = 'investigate';
  }
  if (m.mode === 'chase') { m.mode = 'search'; m.timer = 2.5; }
  if (m.mode === 'investigate') {
    if (moveTo(m, m.tx, m.tz, MONSTER.investigateSpeed, dt) < 1) { m.mode = 'search'; m.timer = 3; }
  } else if (m.mode === 'search') {
    m.timer -= dt;
    if (m.timer <= 0) m.mode = 'wander';
  } else {
    if (m.mode === 'idle' || Math.hypot(m.tx - m.x, m.tz - m.z) < 1) {
      m.mode = 'wander';
      m.tx = (rng() * 2 - 1) * (WORLD_HALF - 8); m.tz = (rng() * 2 - 1) * (WORLD_HALF - 8);
    }
    moveTo(m, m.tx, m.tz, MONSTER.wanderSpeed, dt);
  }
  return null;
}
