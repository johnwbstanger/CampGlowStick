import type { Noise, NoiseBus } from './noise';
import { WORLD_HALF } from './constants';
import { resolveCapsule, type Box } from './colliders';
import { findRoute, navLineClear, type NavPoint } from './navigation';
import { YukaState, YukaStateMachine } from '../vendor/yukaFSM';

export type MonsterMode = 'idle' | 'wander' | 'listen' | 'investigate' | 'stalk' | 'reacquire' | 'search' | 'chase' | 'attack';
export interface MonsterState {
  x: number; z: number; yaw: number; mode: MonsterMode; tx: number; tz: number; timer: number; lastNoise: Noise | null;
  route: NavPoint[]; routeIndex: number; repath: number; routeTargetX: number; routeTargetZ: number;
  lastSeenX: number; lastSeenZ: number; memory: number; exposed: number;
  fsm: YukaStateMachine<MonsterState>;
}
export interface Prey { id: number; x: number; z: number; crouch: boolean; alive: boolean }

export const MONSTER = {
  sight: 18,
  sightCrouch: 8.5,
  /** 140° total visual cone; sound remains omnidirectional. */
  fovCos: Math.cos(70 * Math.PI / 180),
  /** Very close movement can be noticed even outside the forward cone. */
  closeAwareness: 2.6,
  catchDist: 1.15,
  wanderSpeed: 1.8,
  investigateSpeed: 3.2,
  stalkSpeed: 2.45,
  chaseSpeed: 5.25,
  radius: 0.48,
  height: 2.4,
};

class ModeState extends YukaState<MonsterState> {
  constructor(private readonly mode: MonsterMode) { super(); }
  enter(owner: MonsterState): void { owner.mode = this.mode; }
}

const MODES: MonsterMode[] = ['idle', 'wander', 'listen', 'investigate', 'stalk', 'reacquire', 'search', 'chase', 'attack'];

export const newMonster = (x: number, z: number): MonsterState => {
  const m = {
    x, z, yaw: 0, mode: 'idle' as MonsterMode, tx: x, tz: z, timer: 0, lastNoise: null,
    route: [], routeIndex: 0, repath: 0, routeTargetX: x, routeTargetZ: z,
    lastSeenX: x, lastSeenZ: z, memory: 0, exposed: 0,
    fsm: null as unknown as YukaStateMachine<MonsterState>,
  };
  m.fsm = new YukaStateMachine(m);
  for (const mode of MODES) m.fsm.add(mode, new ModeState(mode));
  m.fsm.changeTo('idle');
  return m;
};

function mode(m: MonsterState, next: MonsterMode): void {
  if (!m.fsm.in(next)) m.fsm.changeTo(next);
}

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

export function inMonsterView(m: MonsterState, p: Prey, distance = Math.hypot(p.x - m.x, p.z - m.z)): boolean {
  if (distance <= MONSTER.closeAwareness) return true;
  if (distance <= 1e-6) return true;
  const dx = (p.x - m.x) / distance, dz = (p.z - m.z) / distance;
  const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw);
  return dx * fx + dz * fz >= MONSTER.fovCos;
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
    m.routeIndex = 0;
    m.repath = m.mode === 'chase' || m.mode === 'reacquire' ? .45 : m.mode === 'stalk' ? 1.0 : 1.6;
    m.routeTargetX = tx; m.routeTargetZ = tz;
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
 * Perception-driven extraction-horror hunter using the imported YUKA FSM transition model.
 * It only visually acquires players inside its forward FOV (or at extremely close range) with clear LOS.
 * Otherwise it reacts to omnidirectional world-noise, last-seen memory and local search targets.
 */
export function stepMonster(
  m: MonsterState,
  dt: number,
  now: number,
  bus: NoiseBus,
  prey: Prey[],
  active: boolean,
  rng: () => number = Math.random,
  colliders: Box[] = [],
  rescuedCampers = 0,
): number | null {
  if (!active) {
    mode(m, 'idle'); m.timer = 0; m.memory = 0; m.exposed = 0; invalidateRoute(m); m.fsm.update(); return null;
  }

  const aggression = Math.min(1, rescuedCampers / 7);
  const sight = MONSTER.sight + aggression * 5;
  const crouchSight = MONSTER.sightCrouch + aggression * 2.5;
  const chaseSpeed = MONSTER.chaseSpeed + aggression * 1.15;

  let nearest: Prey | null = null, nd = Infinity;
  for (const p of prey) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - m.x, p.z - m.z);
    if (d < nd) { nd = d; nearest = p; }
  }

  const visible = !!nearest && nd < (nearest.crouch ? crouchSight : sight) && inMonsterView(m, nearest, nd) && hasLineOfSight(m, nearest, colliders);
  if (nearest && nd < MONSTER.catchDist && visible) {
    mode(m, 'attack'); m.fsm.update(); return nearest.id;
  }

  if (nearest && visible) {
    m.lastSeenX = nearest.x; m.lastSeenZ = nearest.z;
    m.memory = 5.5 + aggression * 2.5;
    m.exposed += dt;
    const shouldChase = nd < 8.5 || m.exposed > 1.1 || m.mode === 'chase' || aggression > .72;
    if (shouldChase) {
      if (m.mode !== 'chase') invalidateRoute(m);
      mode(m, 'chase'); setTarget(m, nearest.x, nearest.z); m.timer = 3.8;
      moveTo(m, nearest.x, nearest.z, chaseSpeed, dt, colliders);
    } else {
      if (m.mode !== 'stalk') invalidateRoute(m);
      mode(m, 'stalk'); setTarget(m, nearest.x, nearest.z); m.timer = 2.2;
      moveTo(m, nearest.x, nearest.z, MONSTER.stalkSpeed + aggression * .55, dt, colliders);
    }
    m.fsm.update();
    return null;
  }

  m.exposed = Math.max(0, m.exposed - dt * 1.7);
  if (m.memory > 0) {
    m.memory -= dt;
    if (m.mode === 'chase' || m.mode === 'stalk') {
      mode(m, 'reacquire'); m.timer = 1.35; setTarget(m, m.lastSeenX, m.lastSeenZ);
    }
  }

  const gunshot = bus.loudest(now, m.x, m.z, (n) => n.source === 'gunshot');
  if (gunshot && gunshot.noise !== m.lastNoise) {
    m.lastNoise = gunshot.noise; setTarget(m, gunshot.noise.x, gunshot.noise.z);
    mode(m, 'investigate'); m.timer = 7.5;
  } else {
    const thrown = bus.loudest(now, m.x, m.z, (n) => n.source === 'thrown-impact');
    if (thrown && thrown.noise !== m.lastNoise) {
      m.lastNoise = thrown.noise; setTarget(m, thrown.noise.x, thrown.noise.z);
      mode(m, 'investigate'); m.timer = 5.5;
    } else {
      const heard = bus.loudest(now, m.x, m.z);
      if (heard && heard.noise !== m.lastNoise && !['chase', 'stalk', 'reacquire'].includes(m.mode)) {
        m.lastNoise = heard.noise; setTarget(m, heard.noise.x, heard.noise.z);
        mode(m, 'listen'); m.timer = .65;
      }
    }
  }

  if (m.mode === 'listen') {
    m.timer -= dt;
    m.yaw = Math.atan2(m.tx - m.x, m.tz - m.z);
    if (m.timer <= 0) { mode(m, 'investigate'); m.timer = 4.5; }
  } else if (m.mode === 'reacquire') {
    m.timer -= dt;
    const arrived = moveTo(m, m.lastSeenX, m.lastSeenZ, chaseSpeed * .92, dt, colliders) < .9;
    if (arrived || m.timer <= 0) { mode(m, 'search'); m.timer = 5.5 + aggression * 2.5; setTarget(m, m.lastSeenX, m.lastSeenZ); invalidateRoute(m); }
  } else if (m.mode === 'investigate') {
    m.timer -= dt;
    if (moveTo(m, m.tx, m.tz, MONSTER.investigateSpeed + aggression * .65, dt, colliders) < 1 || m.timer <= 0) {
      mode(m, 'search'); m.timer = 5.5 + aggression * 2.5; invalidateRoute(m);
    }
  } else if (m.mode === 'search') {
    m.timer -= dt;
    if (Math.hypot(m.tx - m.x, m.tz - m.z) < 1.2) {
      const a = rng() * Math.PI * 2, r = 2.5 + rng() * (6 + aggression * 4);
      setTarget(m, m.x + Math.cos(a) * r, m.z + Math.sin(a) * r);
    }
    if (m.timer <= 0) { mode(m, 'wander'); invalidateRoute(m); }
    else moveTo(m, m.tx, m.tz, (MONSTER.investigateSpeed + aggression * .45) * 0.88, dt, colliders);
  } else if (m.mode !== 'chase' && m.mode !== 'stalk' && m.mode !== 'attack') {
    if (m.mode === 'idle' || Math.hypot(m.tx - m.x, m.tz - m.z) < 1) {
      mode(m, 'wander');
      setTarget(m, (rng() * 2 - 1) * (WORLD_HALF - 8), (rng() * 2 - 1) * (WORLD_HALF - 8));
    }
    moveTo(m, m.tx, m.tz, MONSTER.wanderSpeed + aggression * .35, dt, colliders);
  }

  m.fsm.update();
  return null;
}
