import * as CANNON from 'cannon-es';
import type { Session } from '../net/session';
import type { CamperSnap, GameSnap, ItemDef, ItemSnap, Msg, PlayerState } from '../net/protocol';
import { resolveCapsule, type Box } from './colliders';
import { DAY_SECONDS, PLAYER, REACH, WORLD_HALF } from './constants';
import { CAMP_PLAN } from './campPlan';
import { followerPlan, steeringVelocity } from './followerSteering';
import { chooseCamperHides } from './camperSpawns';
import { advanceBoardingStage, boardingTarget, type BoardingStage } from './busBoarding';
import { GLOW_MASS, propInfo } from './items';
import type { Layout } from './layout';
import { findPath, navLineClear, type NavPoint } from './navigation';
import { newMonster, stepMonster } from './monster';
import { NoiseBus, VOLUME, impactVolume, stepVolume, type Noise, type NoiseSource } from './noise';
import { terrainHeight, terrainHeightfieldData } from './terrain';
import { flatForward, heldPose as viewHeldPose, releaseVelocity, viewForward } from './viewPhysics';
import { setDoorOpen, type DoorView } from './world';

interface SimPlayer { state: PlayerState; alive: boolean; stepT: number }
interface SimItem {
  def: ItemDef; body: CANNON.Body; mass: number; holder: number; lastHit: number;
  halfX: number; halfY: number; halfZ: number; thrownAt: number;
}
interface SimCamper {
  id: number; x: number; y: number; z: number; vx: number; vz: number;
  foundBy: number; rescued: boolean; boardingStage: BoardingStage; seatIndex: number;
  route: NavPoint[]; routeGoalX: number; routeGoalZ: number; routeAt: number;
}
type ItemSpawnPoint = [x: number, z: number, lift: number];
export interface Sizes { get(model: string): { x: number; y: number; z: number } | undefined }

const CAMPER_NEED = 7;
const CAMPER_BOARD_SPEED = 4.8;
const GUN_FIRE_COOLDOWN = 0.38;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Host-authoritative simulation: props, campers, doors, noise, monster AI, rescue and extraction. */
export class HostSim {
  world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
  items = new Map<number, SimItem>();
  players = new Map<number, SimPlayer>();
  campers = new Map<number, SimCamper>();
  bus = new NoiseBus();
  monster: ReturnType<typeof newMonster>;
  time = 0;
  night = false;
  collected = 0;
  rescued = 0;
  over: '' | 'win' | 'lose' = '';
  private nextId = 1;
  private fresh: Noise[] = [];
  private monsterStunnedUntil = 0;
  private lastGunshotAt = -Infinity;

  constructor(
    private net: Session,
    private layout: Layout,
    private colliders: Box[],
    private sizes: Sizes,
    private doors: Map<string, DoorView>,
    defs: ItemDef[],
    spawnById: Map<number, ItemSpawnPoint>,
  ) {
    this.monster = newMonster(layout.monsterStart[0], layout.monsterStart[1]);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.62;
    this.world.defaultContactMaterial.restitution = 0.12;
    this.world.defaultContactMaterial.contactEquationStiffness = 1e7;
    this.world.defaultContactMaterial.contactEquationRelaxation = 4;

    const sampled = terrainHeightfieldData(96);
    const groundShape = new CANNON.Heightfield(sampled.data, { elementSize: sampled.elementSize });
    const ground = new CANNON.Body({ type: CANNON.Body.STATIC });
    ground.addShape(groundShape);
    ground.position.set(-WORLD_HALF, 0, WORLD_HALF);
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(ground);

    const catchPlane = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
    catchPlane.quaternion.setFromEuler(-Math.PI / 2, 0, 0); catchPlane.position.y = -24; this.world.addBody(catchPlane);

    for (const b of colliders) {
      const body = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3((b.maxX - b.minX) / 2, (b.maxY - b.minY) / 2, (b.maxZ - b.minZ) / 2)) });
      body.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2); this.world.addBody(body);
    }
    for (const d of defs) {
      const at = spawnById.get(d.id) ?? [0, 0, 0];
      const sz = d.model === 'directorGun' ? { x: .3, y: .28, z: .72 } : d.kind === 'glow' ? { x: 0.04, y: 0.04, z: 0.2 } : (this.sizes.get(d.model) ?? { x: 0.3, y: 0.3, z: 0.3 });
      const extra = d.model === 'directorGun' ? .82 : 0;
      this.addItem(d, at[0], terrainHeight(at[0], at[1], layout) + Math.max(0.03, sz.y / 2) + 0.03 + extra + at[2], at[1]);
      this.nextId = Math.max(this.nextId, d.id + 1);
    }

    const hides = chooseCamperHides(layout, CAMPER_NEED);
    for (let i = 0; i < CAMPER_NEED; i++) {
      const hide = hides[i];
      const x = hide?.x ?? layout.spawns[0][0], z = hide?.z ?? layout.spawns[0][1];
      this.campers.set(i, {
        id: i, x, y: terrainHeight(x, z, layout), z, vx: 0, vz: 0,
        foundBy: -1, rescued: false, boardingStage: -1, seatIndex: i,
        route: [], routeGoalX: x, routeGoalZ: z, routeAt: -Infinity,
      });
    }
    net.onHostMessage = (from, msg) => this.handle(from, msg);
    for (const p of net.players) this.addPlayer(p.id, layout.spawns[p.id % layout.spawns.length]);
  }

  static makeDefs(layout: Layout): { defs: ItemDef[]; spawnById: Map<number, ItemSpawnPoint> } {
    const spawnById = new Map<number, ItemSpawnPoint>();
    const defs: ItemDef[] = layout.items.map((s, i) => { spawnById.set(i + 1, [s.x, s.z, s.lift ?? 0]); return { id: i + 1, model: s.model, kind: s.kind, mat: propInfo(s.model).mat }; });
    const gunId = defs.length + 1;
    defs.push({ id: gunId, model: 'directorGun', kind: 'prop', mat: 'metal' });
    spawnById.set(gunId, [CAMP_PLAN.gun.x, CAMP_PLAN.gun.z, 0]);
    return { defs, spawnById };
  }

  private addPlayer(id: number, spawn: [number, number]): void {
    this.players.set(id, { alive: true, stepT: 0, state: { p: [spawn[0], terrainHeight(spawn[0], spawn[1], this.layout), spawn[1]], yaw: 0, pitch: 0, crouch: false, sprint: false, moving: false, held: -1, flash: false } });
  }

  private addItem(def: ItemDef, x: number, y: number, z: number): SimItem {
    const mass = def.kind === 'glow' ? GLOW_MASS : propInfo(def.model).mass;
    const sz = def.model === 'directorGun' ? { x: .3, y: .28, z: .72 } : def.kind === 'glow' ? { x: 0.04, y: 0.04, z: 0.2 } : (this.sizes.get(def.model) ?? { x: 0.3, y: 0.3, z: 0.3 });
    const halfX = Math.max(0.02, sz.x / 2), halfY = Math.max(0.02, sz.y / 2), halfZ = Math.max(0.02, sz.z / 2);
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Box(new CANNON.Vec3(halfX, halfY, halfZ)),
      linearDamping: 0.09,
      angularDamping: 0.14,
      sleepSpeedLimit: 0.08,
      sleepTimeLimit: 0.8,
    });
    body.position.set(x, y, z);
    body.quaternion.setFromEuler((Math.random() - .5) * .08, Math.random() * Math.PI * 2, (Math.random() - .5) * .08);
    const it: SimItem = { def, body, mass, holder: -1, lastHit: 0, halfX, halfY, halfZ, thrownAt: -Infinity };
    body.addEventListener('collide', (e: { contact: CANNON.ContactEquation }) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v < 1.2 || this.time - it.lastHit < 0.24) return;
      it.lastHit = this.time;
      const recentlyThrown = this.time - it.thrownAt < 3;
      const source: NoiseSource = recentlyThrown ? 'thrown-impact' : 'impact';
      const vol = impactVolume(v, mass) * (recentlyThrown ? 1.35 : 1);
      this.noise(body.position.x, body.position.z, Math.min(VOLUME.crash, vol), def.mat, source);
    });
    this.world.addBody(body); this.items.set(def.id, it); return it;
  }

  private noise(x: number, z: number, vol: number, mat: string, source?: NoiseSource): void {
    const n: Noise = { x: r2(x), z: r2(z), vol: r2(vol), mat, t: this.time, source };
    this.bus.emit(n); if (mat !== 'step') this.fresh.push(n);
  }

  private inBusZone(x: number, z: number): boolean {
    const ex = this.layout.extraction; return Math.hypot(x - ex.x, z - ex.z) < ex.r * 0.85;
  }

  handle(from: number, msg: Msg): void {
    const pl = this.players.get(from);
    if (msg.t === 'bye') { this.release(from, false); this.players.delete(from); return; }
    if (!pl || this.over) return;
    if (msg.t === 'p') { const keepHeld = pl.state.held; pl.state = { ...msg.s, held: keepHeld }; return; }
    if (msg.t !== 'act') return;
    const held = pl.state.held;
    if (msg.a === 'night' && from === 0) this.night = !this.night;
    else if (msg.a === 'door' && msg.target) this.toggleDoor(pl, msg.target);
    else if (msg.a === 'pick') {
      if (held >= 0) this.release(from, false);
      else if (!this.findCamper(from, pl)) this.pickup(from, pl);
    } else if (msg.a === 'drop') this.release(from, false);
    else if (msg.a === 'throw') this.release(from, true, msg.force ?? 0.35);
    else if (msg.a === 'snap') this.snap(from, pl, msg.color ?? 'green');
    else if (msg.a === 'fire') this.fire(pl);
  }

  private toggleDoor(pl: SimPlayer, id: string): void {
    const door = this.doors.get(id); if (!door) return;
    const dx = door.x - pl.state.p[0], dz = door.z - pl.state.p[2];
    if (Math.hypot(dx, dz) > REACH + 1.25) return;
    setDoorOpen(door, !door.open);
    this.noise(door.x, door.z, 1.25, 'wood', 'interaction');
  }

  private forward(pl: SimPlayer): [number, number] { return flatForward(pl.state.yaw); }

  private fire(pl: SimPlayer): void {
    const gun = pl.state.held >= 0 ? this.items.get(pl.state.held) : undefined;
    if (!gun || gun.def.model !== 'directorGun' || this.time - this.lastGunshotAt < GUN_FIRE_COOLDOWN) return;
    this.lastGunshotAt = this.time;
    const eye = pl.state.crouch ? PLAYER.crouchEye : PLAYER.eye;
    const ox = pl.state.p[0], oy = pl.state.p[1] + eye - 0.08, oz = pl.state.p[2];
    const [fx, fy, fz] = viewForward(pl.state.yaw, pl.state.pitch);
    this.noise(ox, oz, VOLUME.crash, 'metal', 'gunshot');

    // Chest point must follow the sculpted terrain. The old fixed 1.35m world Y made uphill/downhill
    // shots disagree with the visible creature even when the barrel/camera orientation was correct.
    const monsterChestY = terrainHeight(this.monster.x, this.monster.z, this.layout) + 1.35;
    const mdx = this.monster.x - ox, mdy = monsterChestY - oy, mdz = this.monster.z - oz;
    const malong = mdx * fx + mdy * fy + mdz * fz;
    const mx = mdx - fx * malong, my = mdy - fy * malong, mz = mdz - fz * malong;
    const mperp = Math.hypot(mx, my, mz);
    if (malong > 0 && malong < 42 && mperp < Math.max(0.75, malong * 0.028)) {
      this.monsterStunnedUntil = Math.max(this.monsterStunnedUntil, this.time + 7.5);
      this.monster.x += fx * 2.2; this.monster.z += fz * 2.2;
      this.monster.mode = 'search'; this.monster.timer = 2.5;
    }

    let hit: SimItem | undefined, bestAlong = Infinity;
    for (const it of this.items.values()) {
      if (it === gun || it.holder >= 0) continue;
      const dx = it.body.position.x - ox, dy = it.body.position.y - oy, dz = it.body.position.z - oz;
      const along = dx * fx + dy * fy + dz * fz;
      if (along <= 0 || along >= 35 || along >= bestAlong) continue;
      const px = dx - fx * along, py = dy - fy * along, pz = dz - fz * along;
      const hitRadius = Math.max(0.22, Math.min(0.75, Math.hypot(it.halfX, it.halfY, it.halfZ) * 0.7));
      if (Math.hypot(px, py, pz) <= hitRadius) { hit = it; bestAlong = along; }
    }
    if (hit) {
      hit.body.wakeUp();
      hit.body.applyImpulse(new CANNON.Vec3(fx * 7.5, fy * 7.5 + 0.4, fz * 7.5), hit.body.position);
      this.noise(hit.body.position.x, hit.body.position.z, 3.5, hit.def.mat, 'impact');
    }
  }

  private findCamper(id: number, pl: SimPlayer): boolean {
    const [px, , pz] = pl.state.p, [fx, fz] = this.forward(pl);
    let best: SimCamper | null = null, bd = REACH + 0.7;
    for (const c of this.campers.values()) {
      if (c.rescued || c.foundBy >= 0) continue;
      const dx = c.x - px, dz = c.z - pz, d = Math.hypot(dx, dz);
      const facing = (dx * fx + dz * fz) / (d || 1);
      if (d < bd && (d < 1.15 || facing > 0.35)) { best = c; bd = d; }
    }
    if (!best) return false;
    best.foundBy = id; best.vx = best.vz = 0; best.boardingStage = -1; best.route = []; best.routeAt = -Infinity;
    this.noise(best.x, best.z, 0.8, 'step', 'interaction'); return true;
  }

  private pickup(id: number, pl: SimPlayer): void {
    const [px, py, pz] = pl.state.p, [fx, fz] = this.forward(pl);
    let best: SimItem | null = null, bd = REACH;
    for (const it of this.items.values()) {
      if (it.holder >= 0) continue;
      const dx = it.body.position.x - px, dz = it.body.position.z - pz, d = Math.hypot(dx, dz, it.body.position.y - (py + 0.9) * 0.6);
      if (d < bd && (d < 1 || (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1) > 0.45)) { bd = d; best = it; }
    }
    if (best) this.hold(id, pl, best);
  }

  /** Ported from Camp_Snallygaster PhysicalProps: held items stay dynamic and are spring-driven. */
  private hold(id: number, pl: SimPlayer, it: SimItem): void {
    it.holder = id;
    pl.state.held = it.def.id;
    it.body.type = CANNON.Body.DYNAMIC;
    it.body.mass = it.mass;
    it.body.updateMassProperties();
    it.body.allowSleep = false;
    it.body.velocity.setZero();
    it.body.angularVelocity.scale(0.35, it.body.angularVelocity);
    it.body.wakeUp();
    this.noise(it.body.position.x, it.body.position.z, 0.6, it.def.mat === 'glass' ? 'plastic' : it.def.mat, 'interaction');
  }

  private release(id: number, thrown: boolean, force = 0.35): void {
    const pl = this.players.get(id); if (!pl || pl.state.held < 0) return;
    const it = this.items.get(pl.state.held); pl.state.held = -1; if (!it) return;
    it.holder = -1; it.body.type = CANNON.Body.DYNAMIC; it.body.mass = it.mass; it.body.updateMassProperties(); it.body.allowSleep = true; it.body.wakeUp();
    const [vx, vy, vz] = releaseVelocity(pl.state.yaw, pl.state.pitch, force, it.mass, thrown);
    it.body.velocity.set(vx, vy, vz);
    if (thrown) {
      it.thrownAt = this.time;
      const spin = 2.5 + Math.max(0, Math.min(1, force)) * 5.5;
      it.body.angularVelocity.set((Math.random() - .5) * spin, (Math.random() - .5) * spin, (Math.random() - .5) * spin);
      this.noise(pl.state.p[0], pl.state.p[2], VOLUME.throw * 0.35, 'step', 'step');
    } else {
      it.body.angularVelocity.set((Math.random() - .5) * .25, (Math.random() - .5) * .2, (Math.random() - .5) * .25);
    }
  }

  private snap(id: number, pl: SimPlayer, color: string): void {
    const def: ItemDef = { id: this.nextId++, model: 'glowstick', kind: 'glow', color, mat: 'glow' };
    const [fx, fz] = this.forward(pl); const it = this.addItem(def, pl.state.p[0] + fx * 0.6, pl.state.p[1] + 1.2, pl.state.p[2] + fz * 0.6);
    this.net.broadcast({ t: 'spawn', def }); this.noise(pl.state.p[0], pl.state.p[2], 1, 'glow', 'glow'); if (pl.state.held < 0) this.hold(id, pl, it);
  }

  private busPlacement(): { x: number; z: number; rot: number } {
    return this.layout.statics.find((s) => s.name === 'bus') ?? { x: this.layout.extraction.x, z: this.layout.extraction.z, rot: 0 };
  }

  private finishBoarding(c: SimCamper): void {
    if (c.rescued) return;
    const [x, z] = boardingTarget(this.busPlacement(), 2, c.seatIndex);
    c.x = x; c.z = z; c.y = terrainHeight(c.x, c.z, this.layout) + 0.18;
    c.vx = c.vz = 0; c.route = []; c.boardingStage = 2;
    c.rescued = true; c.foundBy = -1; this.rescued++;
    this.noise(c.x, c.z, 0.7, 'step', 'interaction');
  }

  /** Reuses the imported MIT A* core only when direct escort movement is obstructed. */
  private routedCamperTarget(c: SimCamper, goalX: number, goalZ: number): [number, number] {
    const start = { x: c.x, z: c.z }, goal = { x: goalX, z: goalZ };
    if (navLineClear(start, goal, this.colliders, .24)) {
      c.route = []; c.routeGoalX = goalX; c.routeGoalZ = goalZ; return [goalX, goalZ];
    }
    const moved = Math.hypot(goalX - c.routeGoalX, goalZ - c.routeGoalZ) > 3.25;
    if (!c.route.length || moved || this.time - c.routeAt > .8) {
      c.route = findPath(c.x, c.z, goalX, goalZ, this.colliders, .24, 4.5);
      c.routeGoalX = goalX; c.routeGoalZ = goalZ; c.routeAt = this.time;
    }
    while (c.route.length > 1 && Math.hypot(c.route[0].x - c.x, c.route[0].z - c.z) < .72) c.route.shift();
    const waypoint = c.route[0];
    return waypoint ? [waypoint.x, waypoint.z] : [goalX, goalZ];
  }

  private stepCampers(dt: number): void {
    const nextSlot = new Map<number, number>();
    const counts = new Map<number, number>();
    for (const c of this.campers.values()) if (!c.rescued && c.foundBy >= 0) counts.set(c.foundBy, (counts.get(c.foundBy) ?? 0) + 1);

    for (const c of this.campers.values()) {
      if (c.rescued || c.foundBy < 0) continue;
      const pl = this.players.get(c.foundBy);
      if (!pl || !pl.alive) { c.foundBy = -1; c.vx = c.vz = 0; c.boardingStage = -1; c.route = []; continue; }

      const px = pl.state.p[0], pz = pl.state.p[2];
      const camperToPlayer = Math.hypot(px - c.x, pz - c.z);
      let goalX: number, goalZ: number, speed: number, stopRadius = .08;

      if (c.boardingStage >= 0) {
        [goalX, goalZ] = boardingTarget(this.busPlacement(), c.boardingStage, c.seatIndex);
        speed = CAMPER_BOARD_SPEED;
        stopRadius = .34;
      } else {
        const slot = nextSlot.get(c.foundBy) ?? 0;
        nextSlot.set(c.foundBy, slot + 1);
        const plan = followerPlan(slot, counts.get(c.foundBy) ?? 1, camperToPlayer, pl.state.sprint, pl.state.moving);
        const [fx, fz] = this.forward(pl);
        const heading = Math.atan2(fx, fz);
        goalX = px + Math.sin(heading + plan.angle) * plan.radius;
        goalZ = pz + Math.cos(heading + plan.angle) * plan.radius;
        speed = plan.speed;
        stopRadius = plan.stopRadius;
        if (this.inBusZone(px, pz) && camperToPlayer < 6.5) {
          c.boardingStage = 0;
          [goalX, goalZ] = boardingTarget(this.busPlacement(), 0, c.seatIndex);
          speed = CAMPER_BOARD_SPEED;
          stopRadius = .34;
        }
      }

      const goalD = Math.hypot(goalX - c.x, goalZ - c.z);
      if (goalD <= stopRadius) {
        if (c.boardingStage >= 0) {
          const next = advanceBoardingStage(c.boardingStage, goalD);
          if (c.boardingStage === 2 && next === 2) { this.finishBoarding(c); continue; }
          if (next !== c.boardingStage) c.route = [];
          c.boardingStage = next;
        }
        [c.vx, c.vz] = steeringVelocity(0, 0, 0, c.vx, c.vz, dt);
      } else {
        const [tx, tz] = this.routedCamperTarget(c, goalX, goalZ);
        const dx = tx - c.x, dz = tz - c.z;
        [c.vx, c.vz] = steeringVelocity(dx, dz, speed, c.vx, c.vz, dt);
      }

      const tryPos = { x: c.x + c.vx * dt, y: terrainHeight(c.x, c.z, this.layout), z: c.z + c.vz * dt };
      const beforeX = tryPos.x, beforeZ = tryPos.z;
      resolveCapsule(tryPos, 0.22, 1.05, this.colliders, WORLD_HALF);
      if (Math.abs(tryPos.x - beforeX) > 0.03) c.vx *= 0.2;
      if (Math.abs(tryPos.z - beforeZ) > 0.03) c.vz *= 0.2;
      c.x = tryPos.x; c.z = tryPos.z; c.y = terrainHeight(c.x, c.z, this.layout);
    }
  }

  /** Mass-aware spring grab ported from the previous PhysicalProps implementation. */
  private heldPose(pl: SimPlayer, it: SimItem, dt: number): void {
    const s = pl.state;
    const eye = s.crouch ? PLAYER.crouchEye : PLAYER.eye;
    const isGun = it.def.model === 'directorGun';
    const pose = viewHeldPose(s, eye, {
      forward: isGun ? .64 : .58,
      right: isGun ? .20 : .08,
      down: isGun ? .34 : .43,
    });
    const [tx, ty, tz] = pose.position;
    const dx = tx - it.body.position.x, dy = ty - it.body.position.y, dz = tz - it.body.position.z;
    const massFactor = Math.min(1.25, 1.35 / Math.sqrt(Math.max(it.mass, .35)));
    const gain = Math.min(22, (11 + dt * 60) * massFactor);
    it.body.velocity.x += dx * gain * dt;
    it.body.velocity.y += dy * gain * dt;
    it.body.velocity.z += dz * gain * dt;
    const speed = Math.hypot(it.body.velocity.x, it.body.velocity.y, it.body.velocity.z);
    const maxSpeed = 11 * Math.min(1, 1.5 / Math.sqrt(Math.max(it.mass, .5)) + .28);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      it.body.velocity.x *= scale; it.body.velocity.y *= scale; it.body.velocity.z *= scale;
    }
    // Keep first-person orientation readable while translation remains fully dynamic/colliding.
    it.body.quaternion.setFromEuler(pose.euler[0], pose.euler[1], pose.euler[2], 'YXZ');
    it.body.angularVelocity.scale(.9, it.body.angularVelocity);
    it.body.wakeUp();
  }

  step(dt: number): void {
    if (this.over) dt = Math.min(dt, 0.05);
    this.time += dt; if (!this.night && this.time > DAY_SECONDS) this.night = true;
    for (const pl of this.players.values()) {
      const s = pl.state;
      if (pl.alive && (pl.stepT -= dt) <= 0) { const v = stepVolume(s.moving, s.crouch, s.sprint); if (v > 0) this.noise(s.p[0], s.p[2], v, 'step', 'step'); pl.stepT = s.sprint ? 0.3 : 0.5; }
      const it = s.held >= 0 ? this.items.get(s.held) : undefined;
      if (it) this.heldPose(pl, it, dt);
      else if (s.held >= 0) s.held = -1;
    }
    this.stepCampers(dt);

    this.world.step(1 / 60, Math.min(dt, 0.05), 4);
    this.bus.prune(this.time);

    const ex = this.layout.extraction;
    for (const it of [...this.items.values()]) {
      if (it.def.kind !== 'loot' || it.holder >= 0) continue;
      if (Math.hypot(it.body.position.x - ex.x, it.body.position.z - ex.z) < ex.r) { this.world.removeBody(it.body); this.items.delete(it.def.id); this.collected++; this.noise(ex.x, ex.z, 1, 'metal', 'impact'); }
    }

    if (!this.over) {
      const prey = [...this.players.entries()].map(([id, p]) => ({ id, x: p.state.p[0], z: p.state.p[2], crouch: p.state.crouch, alive: p.alive && !this.inBusZone(p.state.p[0], p.state.p[2]) }));
      const monsterActive = this.night && this.time >= this.monsterStunnedUntil;
      const caught = stepMonster(this.monster, dt, this.time, this.bus, prey, monsterActive, Math.random, this.colliders, this.rescued);
      if (caught !== null) { const p = this.players.get(caught); if (p && !this.inBusZone(p.state.p[0], p.state.p[2])) p.alive = false; if (p && !p.alive) this.over = 'lose'; }
      if (!this.over && this.rescued >= CAMPER_NEED && [...this.players.values()].some((p) => p.alive && this.inBusZone(p.state.p[0], p.state.p[2]))) this.over = 'win';
    }
  }

  snapshot(): GameSnap {
    const items: ItemSnap[] = [];
    for (const it of this.items.values()) { const b = it.body, p = b.position, q = b.quaternion; items.push([it.def.id, r2(p.x), r2(p.y), r2(p.z), r2(q.x), r2(q.y), r2(q.z), r2(q.w), it.holder]); }
    const players: GameSnap['players'] = {}; for (const [id, p] of this.players) players[id] = { ...p.state, alive: p.alive };
    const campers: CamperSnap[] = [...this.campers.values()].map((c) => ({ id: c.id, x: r2(c.x), y: r2(c.y), z: r2(c.z), foundBy: c.foundBy, rescued: c.rescued }));
    const doors = [...this.doors.values()].map((d) => ({ id: d.id, open: d.open }));
    const noise = this.fresh; this.fresh = []; const m = this.monster;
    const mode = this.time < this.monsterStunnedUntil ? 'stunned' : m.mode;
    return { t: 's', time: r2(this.time), night: this.night, players, items, campers, doors, rescued: this.rescued, camperNeed: CAMPER_NEED, monster: { p: [r2(m.x), terrainHeight(m.x, m.z, this.layout), r2(m.z)], yaw: r2(m.yaw), mode }, noise, collected: this.collected, need: this.layout.need, over: this.over };
  }

  tick(dt: number): void { this.step(dt); this.net.broadcast(this.snapshot()); }
}
