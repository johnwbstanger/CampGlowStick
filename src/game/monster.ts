import type { Noise, NoiseBus } from './noise';
import { WORLD_HALF } from './constants';
import { resolveCapsule, type Box } from './colliders';
import { findRoute, navLineClear, type NavPoint } from './navigation';

export type MonsterMode = 'idle' | 'wander' | 'investigate' | 'search' | 'chase';
export interface MonsterState {
  x: number; z: number; yaw: number; mode: MonsterMode; tx: number; tz: number; timer: number; lastNoise: Noise | null;
  route: NavPoint[]; routeIndex: number; repath: number; routeTargetX: number; routeTargetZ: number;
}
export interface Prey { id: number; x: number; z: number; crouch: boolean; alive: boolean }

export const MONSTER = { sight: 13, sightCrouch: 6.5, catchDist: 1.15, wanderSpeed: 1.7, investigateSpeed: 2.9, chaseSpeed: 4.8, radius: 0.48, height: 2.4 };
export const newMonster = (x: number, z: number): MonsterState => ({
  x, z, yaw: 0, mode: 'idle', tx: x, tz: z, timer: 0, lastNoise: null,
  route: [], routeIndex: 0, repath: 0, routeTargetX: x, routeTargetZ: z,
});

function segmentHitsBox(x0: number, z0: number, x1: number, z1: number, b: Box): boolean {
  const dx = x1 - x0, dz = z1 - z0;
  let t0 = 0, t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, x0 - b.minX) && clip(dx, b.maxX - x0) && clip(-dz, z0 - b.minZ) && clip(dz, b.maxZ - z0) && t1 > 0.03 && t0 < 0.97;
}

function hasLineOfSight(m: MonsterState, p: Prey, colliders: Box[]): boolean {
  for (const b of colliders) {
    if (b.maxY < 0.7) continue;
    if (segmentHitsBox(m.x, m.z, p.x, p.z, b)) return false;
  }
  return true;
}

function rawMove(m: MonsterState, tx: number, tz: number, speed: number, dt: number, colliders: Box[]): number {
  const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
  if (d <= 0.01) return d;
  const s = Math.min(d, speed * dt), vx = (dx / d) * s, vz = (dz / d) * s, oldX = m.x, oldZ = m.z;
  const xTry = { x: oldX + vx, y: 0, z: oldZ };
  resolveCapsule(xTry, MONSTER.radius, MONSTER.height, colliders, WORLD_HALF); m.x = xTry.x;
  const zTry = { x: m.x, y: 0, z: oldZ + vz };
  resolveCapsule(zTry, MONSTER.radius, MONSTER.height, colliders, WORLD_HALF); m.x = zTry.x; m.z = zTry.z;
  m.yaw = Math.atan2(m.x - oldX, m.z - oldZ);
  return d;
}

function invalidateRoute(m: MonsterState): void { m.route = []; m.routeIndex = 0; m.repath = 0; }

/** Path toward a target, using direct movement when visible and A* around cabins/buildings otherwise. */
function moveTo(m: MonsterState, tx: number, tz: number, speed: number, dt: number, colliders: Box[]): number {
  const directD = Math.hypot(tx - m.x, tz - m.z);
  if (directD < .05) return directD;
  if (navLineClear({ x: m.x, z: m.z }, { x: tx, z: tz }, colliders, MONSTER.radius)) {
    invalidateRoute(m);
    return rawMove(m, tx, tz, speed, dt, colliders);
  }

  m.repath -= dt;
  const targetChanged = Math.hypot(tx - m.routeTargetX, tz - m.routeTargetZ) > 2.5;
  if (!m.route.length || m.routeIndex >= m.route.length || m.repath <= 0 || targetChanged) {
    m.route = findRoute({ x: m.x, z: m.z }, { x: tx, z: tz }, colliders, MONSTER.radius, 3);
    m.routeIndex = 0; m.repath = m.mode === 'chase' ? .7 : 1.8; m.routeTargetX = tx; m.routeTargetZ = tz;
  }

  const wp = m.route[m.routeIndex];
  if (!wp) return rawMove(m, tx, tz, speed * .7, dt, colliders);
  const wd = rawMove(m, wp.x, wp.z, speed, dt, colliders);
  if (wd < .55) m.routeIndex++;
  return directD;
}

function setTarget(m: MonsterState, x: number, z: number): void {
  if (Math.hypot(m.tx - x, m.tz - z) > 1) invalidateRoute(m);
  m.tx = x; m.tz = z;
}

/**
 * Priority order:
 * 1) visible player -> chase, always wins;
 * 2) if sight is lost, a recent thrown-object impact can pull the monster out of search/investigate;
 * 3) other audible noises;
 * 4) search/wander.
 */
export function stepMonster(m: MonsterState, dt: number, now: number, bus: NoiseBus, prey: Prey[], active: boolean, rng: () => number = Math.random, colliders: Box[] = []): number | null {
  if (!active) { m.mode = 'idle'; invalidateRoute(m); return null; }
  let nearest: Prey | null = null, nd = Infinity;
  for (const p of prey) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - m.x, p.z - m.z);
    if (d < nd) { nd = d; nearest = p; }
  }

  const visible = !!nearest && nd < (nearest.crouch ? MONSTER.sightCrouch : MONSTER.sight) && hasLineOfSight(m, nearest, colliders);
  if (nearest && nd < MONSTER.catchDist && visible) return nearest.id;
  if (nearest && visible) {
    if (m.mode !== 'chase') invalidateRoute(m);
    m.mode = 'chase'; setTarget(m, nearest.x, nearest.z); m.timer = 3.5;
    moveTo(m, nearest.x, nearest.z, MONSTER.chaseSpeed, dt, colliders); return null;
  }

  if (m.mode === 'chase') { m.mode = 'search'; m.timer = 4.5; invalidateRoute(m); }

  const thrown = bus.loudest(now, m.x, m.z, (n) => n.source === 'thrown-impact');
  if (thrown && thrown.noise !== m.lastNoise) {
    m.lastNoise = thrown.noise;
    setTarget(m, thrown.noise.x, thrown.noise.z);
    m.mode = 'investigate'; m.timer = 5;
  } else {
    const heard = bus.loudest(now, m.x, m.z);
    if (heard && heard.noise !== m.lastNoise && (m.mode !== 'investigate' || heard.noise.vol > (m.lastNoise?.vol ?? 0) * 0.8)) {
      m.lastNoise = heard.noise; setTarget(m, heard.noise.x, heard.noise.z); m.mode = 'investigate';
    }
  }

  if (m.mode === 'investigate') {
    if (moveTo(m, m.tx, m.tz, MONSTER.investigateSpeed, dt, colliders) < 1) { m.mode = 'search'; m.timer = 4; invalidateRoute(m); }
  } else if (m.mode === 'search') {
    m.timer -= dt;
    if (m.timer > 0 && Math.hypot(m.tx - m.x, m.tz - m.z) < 1.2) {
      const a = rng() * Math.PI * 2, r = 2.5 + rng() * 5; setTarget(m, m.x + Math.cos(a) * r, m.z + Math.sin(a) * r);
    }
    if (m.timer <= 0) { m.mode = 'wander'; invalidateRoute(m); }
    else moveTo(m, m.tx, m.tz, MONSTER.investigateSpeed * 0.85, dt, colliders);
  } else {
    if (m.mode === 'idle' || Math.hypot(m.tx - m.x, m.tz - m.z) < 1) {
      m.mode = 'wander'; setTarget(m, (rng() * 2 - 1) * (WORLD_HALF - 8), (rng() * 2 - 1) * (WORLD_HALF - 8));
    }
    moveTo(m, m.tx, m.tz, MONSTER.wanderSpeed, dt, colliders);
  }
  return null;
}
