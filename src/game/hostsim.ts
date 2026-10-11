import * as CANNON from 'cannon-es';
import type { Session } from '../net/session';
import type { CamperSnap, GameSnap, ItemDef, ItemSnap, Msg, PlayerState } from '../net/protocol';
import { resolveCapsule, type Box } from './colliders';
import { DAY_SECONDS, PLAYER, REACH, WORLD_HALF } from './constants';
import { GLOW_MASS, propInfo } from './items';
import type { Layout } from './layout';
import { newMonster, stepMonster } from './monster';
import { NoiseBus, VOLUME, impactVolume, stepVolume, type Noise, type NoiseSource } from './noise';
import { terrainHeight } from './terrain';
import { flatForward, heldPose as viewHeldPose, releaseVelocity } from './viewPhysics';
import { setDoorOpen, type DoorView } from './world';

interface SimPlayer { state: PlayerState; alive: boolean; stepT: number }
interface SimItem {
  def: ItemDef; body: CANNON.Body; mass: number; holder: number; lastHit: number;
  halfX: number; halfY: number; halfZ: number; thrownAt: number;
}
interface SimCamper { id: number; x: number; y: number; z: number; foundBy: number; rescued: boolean }
export interface Sizes { get(model: string): { x: number; y: number; z: number } | undefined }

const CAMPER_NEED = 7;
const CAMPER_HIDES: [number, number][] = [
  [-78, -43], [-42, -58], [19, -55], [65, -39], [-67, 21], [-20, 32], [42, 28],
  [82, 7], [-8, 58], [-88, 76], [97, 59], [-101, -39], [78, -7], [-45, 88],
];
const BUS_SEATS: [number, number][] = [
  [-3.0, .62], [-3.0, -.62], [-1.75, .62], [-1.75, -.62], [-.5, .62], [-.5, -.62], [.78, .62],
];
const CAMPER_FOLLOW_SPEED = 5.4;
const CAMPER_CATCHUP_SPEED = 7.3;
const CAMPER_BOARD_SPEED = 4.4;
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
    spawnById: Map<number, [number, number]>,
  ) {
    this.monster = newMonster(layout.monsterStart[0], layout.monsterStart[1]);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.62;
    this.world.defaultContactMaterial.restitution = 0.12;
    this.world.defaultContactMaterial.contactEquationStiffness = 1e7;
    this.world.defaultContactMaterial.contactEquationRelaxation = 4;

    // The playable camp is intentionally flat. Let the physics engine own the floor contact instead
    // of teleporting props upward after every step; this is what makes stacks, tipping and rolling coherent.
    const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    ground.position.y = 0;
    this.world.addBody(ground);

    // Safety catch is far below gameplay and should never participate during a healthy simulation.
    const catchPlane = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
    catchPlane.quaternion.setFromEuler(-Math.PI / 2, 0, 0); catchPlane.position.y = -20; this.world.addBody(catchPlane);

    for (const b of colliders) {
      const body = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3((b.maxX - b.minX) / 2, (b.maxY - b.minY) / 2, (b.maxZ - b.minZ) / 2)) });
      body.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2); this.world.addBody(body);
    }
    for (const d of defs) {
      const at = spawnById.get(d.id) ?? [0, 0];
      const sz = d.model === 'directorGun' ? { x: .3, y: .28, z: .72 } : d.kind === 'glow' ? { x: 0.04, y: 0.04, z: 0.2 } : (this.sizes.get(d.model) ?? { x: 0.3, y: 0.3, z: 0.3 });
      const extra = d.model === 'directorGun' ? .82 : 0;
      this.addItem(d, at[0], terrainHeight(at[0], at[1], layout) + Math.max(0.03, sz.y / 2) + 0.03 + extra, at[1]);
      this.nextId = Math.max(this.nextId, d.id + 1);
    }
    for (let i = 0; i < CAMPER_NEED; i++) {
      const [x, z] = CAMPER_HIDES[(i * 2 + (layout.need % 3)) % CAMPER_HIDES.length];
      this.campers.set(i, { id: i, x, y: terrainHeight(x, z, layout), z, foundBy: -1, rescued: false });
    }
    net.onHostMessage = (from, msg) => this.handle(from, msg);
    for (const p of net.players) this.addPlayer(p.id, layout.spawns[p.id % layout.spawns.length]);
  }

  static makeDefs(layout: Layout): { defs: ItemDef[]; spawnById: Map<number, [number, number]> } {
    const spawnById = new Map<number, [number, number]>();
    const defs: ItemDef[] = layout.items.map((s, i) => { spawnById.set(i + 1, [s.x, s.z]); return { id: i + 1, model: s.model, kind: s.kind, mat: propInfo(s.model).mat }; });
    const gunId = defs.length + 1;
    defs.push({ id: gunId, model: 'directorGun', kind: 'prop', mat: 'metal' });
    spawnById.set(gunId, [-27, 3.35]);
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
    const it = pl.state.held >= 0 ? this.items.get(pl.state.held) : undefined;
    if (!it || it.def.model !== 'directorGun' || this.time - this.lastGunshotAt < GUN_FIRE_COOLDOWN) return;
    this.lastGunshotAt = this.time;
    const [fx, fz] = this.forward(pl), px = pl.state.p[0], pz = pl.state.p[2];
    this.noise(px, pz, VOLUME.crash, 'metal', 'gunshot');
    const dx = this.monster.x - px, dz = this.monster.z - pz;
    const along = dx * fx + dz * fz;
    const perp = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < 42 && perp < Math.max(1.0, along * 0.035)) {
      this.monsterStunnedUntil = Math.max(this.monsterStunnedUntil, this.time + 7.5);
      this.monster.x += fx * 2.2; this.monster.z += fz * 2.2;
      this.monster.mode = 'search'; this.monster.timer = 2.5;
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
    best.foundBy = id; this.noise(best.x, best.z, 0.8, 'step', 'interaction'); return true;
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

  private hold(id: number, pl: SimPlayer, it: SimItem): void {
    it.holder = id; pl.state.held = it.def.id; it.body.type = CANNON.Body.KINEMATIC; it.body.mass = 0; it.body.updateMassProperties();
    it.body.velocity.setZero(); it.body.angularVelocity.setZero(); this.noise(it.body.position.x, it.body.position.z, 0.6, it.def.mat === 'glass' ? 'plastic' : it.def.mat, 'interaction');
  }

  private release(id: number, thrown: boolean, force = 0.35): void {
    const pl = this.players.get(id); if (!pl || pl.state.held < 0) return;
    const it = this.items.get(pl.state.held); pl.state.held = -1; if (!it) return;
    it.holder = -1; it.body.type = CANNON.Body.DYNAMIC; it.body.mass = it.mass; it.body.updateMassProperties(); it.body.wakeUp();
    const [vx, vy, vz] = releaseVelocity(pl.state.yaw, pl.state.pitch, force, it.mass, thrown);
    it.body.velocity.set(vx, vy, vz);
    if (thrown) {
      it.thrownAt = this.time;
      // Spin follows release energy, but no random teleport/settling corrections are applied after release.
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

  private seatCamper(c: SimCamper): void {
    if (c.rescued) return;
    const bus = this.busPlacement();
    const seat = BUS_SEATS[Math.min(this.rescued, BUS_SEATS.length - 1)];
    const cos = Math.cos(bus.rot), sin = Math.sin(bus.rot);
    c.x = bus.x + seat[0] * cos + seat[1] * sin;
    c.z = bus.z - seat[0] * sin + seat[1] * cos;
    c.y = terrainHeight(c.x, c.z, this.layout) + 0.18;
    c.rescued = true; c.foundBy = -1; this.rescued++;
    this.noise(c.x, c.z, 0.7, 'step', 'interaction');
  }

  /** Camp Snallygaster-style loose-arc follower motion with physical catch-up and bus boarding. */
  private stepCampers(dt: number): void {
    const nextSlot = new Map<number, number>();
    for (const c of this.campers.values()) {
      if (c.rescued || c.foundBy < 0) continue;
      const pl = this.players.get(c.foundBy);
      if (!pl || !pl.alive) { c.foundBy = -1; continue; }

      const px = pl.state.p[0], pz = pl.state.p[2];
      const slot = nextSlot.get(c.foundBy) ?? 0;
      nextSlot.set(c.foundBy, slot + 1);
      const followersForPlayer = [...this.campers.values()].filter((x) => !x.rescued && x.foundBy === c.foundBy).length;
      const angle = Math.PI + (slot - (followersForPlayer - 1) / 2) * 0.42;
      const radius = 2.0 + Math.floor(slot / 3) * 0.7;
      const [fx, fz] = this.forward(pl);
      const heading = Math.atan2(fx, fz);
      let tx = px + Math.sin(heading + angle) * radius;
      let tz = pz + Math.cos(heading + angle) * radius;

      if (this.inBusZone(px, pz)) {
        const bus = this.busPlacement();
        tx = bus.x; tz = bus.z;
      }

      const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
      const camperToPlayer = Math.hypot(px - c.x, pz - c.z);
      let speed = this.inBusZone(px, pz) ? CAMPER_BOARD_SPEED : CAMPER_FOLLOW_SPEED;
      if (camperToPlayer > 5.5) speed = CAMPER_CATCHUP_SPEED;
      if (camperToPlayer > 10) speed = 8.8;

      if (d > .06) {
        const step = Math.min(d, speed * dt);
        const tryPos = { x: c.x + dx / d * step, y: terrainHeight(c.x, c.z, this.layout), z: c.z + dz / d * step };
        resolveCapsule(tryPos, 0.22, 1.05, this.colliders, WORLD_HALF);
        c.x = tryPos.x; c.z = tryPos.z;
      }
      c.y = terrainHeight(c.x, c.z, this.layout);
      if (this.inBusZone(c.x, c.z)) this.seatCamper(c);
    }
  }

  private heldPose(pl: SimPlayer, it: SimItem): void {
    const s = pl.state;
    const eye = s.crouch ? PLAYER.crouchEye : PLAYER.eye;
    const isGun = it.def.model === 'directorGun';
    const pose = viewHeldPose(s, eye, {
      forward: isGun ? .64 : .58,
      right: isGun ? .20 : .08,
      down: isGun ? .34 : .43,
    });
    it.body.position.set(...pose.position);
    it.body.quaternion.setFromEuler(pose.euler[0], pose.euler[1], pose.euler[2], 'YXZ');
    it.body.velocity.setZero(); it.body.angularVelocity.setZero();
  }

  step(dt: number): void {
    if (this.over) dt = Math.min(dt, 0.05);
    this.time += dt; if (!this.night && this.time > DAY_SECONDS) this.night = true;
    for (const pl of this.players.values()) {
      const s = pl.state;
      if (pl.alive && (pl.stepT -= dt) <= 0) { const v = stepVolume(s.moving, s.crouch, s.sprint); if (v > 0) this.noise(s.p[0], s.p[2], v, 'step', 'step'); pl.stepT = s.sprint ? 0.3 : 0.5; }
      const it = s.held >= 0 ? this.items.get(s.held) : undefined;
      if (it) this.heldPose(pl, it);
      else if (s.held >= 0) s.held = -1;
    }
    this.stepCampers(dt);

    // Fixed-step rigid body integration: ground, props and thrown objects now resolve through the
    // engine's contact solver instead of the old per-item Y clamp that made everything look scripted.
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
    return { t: 's', time: r2(this.time), night: this.night, players, items, campers, doors, rescued: this.rescued, camperNeed: CAMPER_NEED, monster: { p: [r2(m.x), 0, r2(m.z)], yaw: r2(m.yaw), mode }, noise, collected: this.collected, need: this.layout.need, over: this.over };
  }

  tick(dt: number): void { this.step(dt); this.net.broadcast(this.snapshot()); }
}
