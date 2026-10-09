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

interface SimPlayer { state: PlayerState; alive: boolean; stepT: number }
interface SimItem { def: ItemDef; body: CANNON.Body; mass: number; holder: number; lastHit: number; halfY: number; thrownAt: number }
interface SimCamper { id: number; x: number; y: number; z: number; foundBy: number; rescued: boolean }
export interface Sizes { get(model: string): { x: number; y: number; z: number } | undefined }

const MAX_GLOW = 60;
const CAMPER_NEED = 7;
const CAMPER_HIDES: [number, number][] = [
  [-78, -43], [-42, -58], [19, -55], [65, -39], [-67, 21], [-20, 32], [42, 28],
  [82, 7], [-8, 58], [-88, 76], [97, 59], [-101, -39], [78, -7], [-45, 88],
];
const BUS_SEATS: [number, number][] = [
  [-2.7, .72], [-2.7, -.55], [-1.3, .72], [-1.3, -.55], [.2, .72], [.2, -.55], [1.65, .72],
];
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Host-authoritative simulation: props, campers, noise, monster AI, rescue and extraction. */
export class HostSim {
  world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.8, 0) });
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

  constructor(private net: Session, private layout: Layout, private colliders: Box[], private sizes: Sizes, defs: ItemDef[], spawnById: Map<number, [number, number]>) {
    this.monster = newMonster(layout.monsterStart[0], layout.monsterStart[1]);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    const mat = new CANNON.Material('prop');
    this.world.defaultContactMaterial = new CANNON.ContactMaterial(mat, mat, { friction: 0.58, restitution: 0.28 });
    const catchPlane = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
    catchPlane.quaternion.setFromEuler(-Math.PI / 2, 0, 0); catchPlane.position.y = -7; this.world.addBody(catchPlane);
    for (const b of colliders) {
      const body = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3((b.maxX - b.minX) / 2, (b.maxY - b.minY) / 2, (b.maxZ - b.minZ) / 2)) });
      body.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2); this.world.addBody(body);
    }
    for (const d of defs) {
      const at = spawnById.get(d.id) ?? [0, 0];
      const sz = d.kind === 'glow' ? { x: 0.04, y: 0.04, z: 0.2 } : (this.sizes.get(d.model) ?? { x: 0.3, y: 0.3, z: 0.3 });
      this.addItem(d, at[0], terrainHeight(at[0], at[1], layout) + Math.max(0.03, sz.y / 2) + 0.03, at[1]);
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
    const defs = layout.items.map((s, i) => { spawnById.set(i + 1, [s.x, s.z]); return { id: i + 1, model: s.model, kind: s.kind, mat: propInfo(s.model).mat } satisfies ItemDef; });
    return { defs, spawnById };
  }

  private addPlayer(id: number, spawn: [number, number]): void {
    this.players.set(id, { alive: true, stepT: 0, state: { p: [spawn[0], terrainHeight(spawn[0], spawn[1], this.layout), spawn[1]], yaw: 0, pitch: 0, crouch: false, sprint: false, moving: false, held: -1, flash: false, stamina: 100 } });
  }

  private addItem(def: ItemDef, x: number, y: number, z: number): SimItem {
    const mass = def.kind === 'glow' ? GLOW_MASS : propInfo(def.model).mass;
    const sz = def.kind === 'glow' ? { x: 0.04, y: 0.04, z: 0.2 } : (this.sizes.get(def.model) ?? { x: 0.3, y: 0.3, z: 0.3 });
    const halfY = Math.max(0.02, sz.y / 2);
    const body = new CANNON.Body({ mass, shape: new CANNON.Box(new CANNON.Vec3(Math.max(0.02, sz.x / 2), halfY, Math.max(0.02, sz.z / 2))), linearDamping: 0.13, angularDamping: 0.38, sleepSpeedLimit: 0.18, sleepTimeLimit: 0.45 });
    body.position.set(x, y, z);
    const it: SimItem = { def, body, mass, holder: -1, lastHit: 0, halfY, thrownAt: -Infinity };
    body.addEventListener('collide', (e: { contact: CANNON.ContactEquation }) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v < 1.4 || this.time - it.lastHit < 0.3) return;
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
    else if (msg.a === 'pick') {
      if (held >= 0) this.release(from, false);
      else if (!this.findCamper(from, pl)) this.pickup(from, pl);
    } else if (msg.a === 'drop') this.release(from, false);
    else if (msg.a === 'throw') this.release(from, true, msg.force ?? 0.35);
    else if (msg.a === 'snap') this.snap(from, pl, msg.color ?? 'green');
  }

  private forward(pl: SimPlayer): [number, number] { return [-Math.sin(pl.state.yaw), -Math.cos(pl.state.yaw)]; }

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
    const [fx, fz] = this.forward(pl), charge = Math.max(0, Math.min(1, force)), sp = thrown ? 7 + charge * 10 : 1.0;
    it.body.velocity.set(fx * sp, thrown ? 2.2 + charge * 4.2 : 0.35, fz * sp);
    if (thrown) {
      it.thrownAt = this.time;
      it.body.angularVelocity.set(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
      this.noise(pl.state.p[0], pl.state.p[2], VOLUME.throw * 0.35, 'step', 'step');
    }
  }

  private snap(id: number, pl: SimPlayer, color: string): void {
    if ([...this.items.values()].filter((i) => i.def.kind === 'glow').length >= MAX_GLOW) return;
    const def: ItemDef = { id: this.nextId++, model: 'glowstick', kind: 'glow', color, mat: 'glow' };
    const [fx, fz] = this.forward(pl); const it = this.addItem(def, pl.state.p[0] + fx * 0.6, pl.state.p[1] + 1.2, pl.state.p[2] + fz * 0.6);
    this.net.broadcast({ t: 'spawn', def }); this.noise(pl.state.p[0], pl.state.p[2], 1, 'glow', 'glow'); if (pl.state.held < 0) this.hold(id, pl, it);
  }

  private seatCamper(c: SimCamper): void {
    const ex = this.layout.extraction, seat = BUS_SEATS[Math.min(this.rescued, BUS_SEATS.length - 1)];
    c.x = ex.x + seat[0]; c.z = ex.z + seat[1]; c.y = terrainHeight(c.x, c.z, this.layout) + 0.18;
    c.rescued = true; c.foundBy = -1; this.rescued++;
    this.noise(c.x, c.z, 0.7, 'step', 'interaction');
  }

  private stepCampers(dt: number): void {
    for (const c of this.campers.values()) {
      if (c.rescued || c.foundBy < 0) continue;
      const pl = this.players.get(c.foundBy);
      if (!pl || !pl.alive) { c.foundBy = -1; continue; }
      const [fx, fz] = this.forward(pl);
      const tx = pl.state.p[0] - fx * 1.45, tz = pl.state.p[2] - fz * 1.45;
      const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
      if (d > 0.15) {
        const s = Math.min(d, 4.2 * dt);
        const tryPos = { x: c.x + dx / d * s, y: terrainHeight(c.x, c.z, this.layout), z: c.z + dz / d * s };
        // Child-sized obstacle resolution stops rescued campers walking straight through cabin walls.
        resolveCapsule(tryPos, 0.24, 1.15, this.colliders, WORLD_HALF);
        c.x = tryPos.x; c.z = tryPos.z;
      }
      c.y = terrainHeight(c.x, c.z, this.layout);
      if (this.inBusZone(c.x, c.z)) this.seatCamper(c);
    }
  }

  step(dt: number): void {
    if (this.over) dt = Math.min(dt, 0.05);
    this.time += dt; if (!this.night && this.time > DAY_SECONDS) this.night = true;
    for (const pl of this.players.values()) {
      const s = pl.state;
      if (pl.alive && (pl.stepT -= dt) <= 0) { const v = stepVolume(s.moving, s.crouch, s.sprint); if (v > 0) this.noise(s.p[0], s.p[2], v, 'step', 'step'); pl.stepT = s.sprint ? 0.3 : 0.5; }
      const it = s.held >= 0 ? this.items.get(s.held) : undefined;
      if (it) { const [fx, fz] = this.forward(pl), eye = s.crouch ? PLAYER.crouchEye : PLAYER.eye; it.body.position.set(s.p[0] + fx * 0.7, s.p[1] + eye - 0.35, s.p[2] + fz * 0.7); it.body.velocity.setZero(); }
      else if (s.held >= 0) s.held = -1;
    }
    this.stepCampers(dt);

    this.world.step(1 / 60, dt, 3);
    for (const it of this.items.values()) {
      if (it.holder >= 0) continue;
      const floorY = terrainHeight(it.body.position.x, it.body.position.z, this.layout) + it.halfY;
      if (it.body.position.y < floorY && it.body.velocity.y <= 0) {
        it.body.position.y = floorY; it.body.velocity.y = Math.max(0, -it.body.velocity.y * 0.12); it.body.velocity.x *= 0.84; it.body.velocity.z *= 0.84;
        if (Math.abs(it.body.velocity.x) + Math.abs(it.body.velocity.z) < 0.08) it.body.sleep();
      }
    }
    this.bus.prune(this.time);

    const ex = this.layout.extraction;
    for (const it of [...this.items.values()]) {
      if (it.def.kind !== 'loot' || it.holder >= 0) continue;
      if (Math.hypot(it.body.position.x - ex.x, it.body.position.z - ex.z) < ex.r) { this.world.removeBody(it.body); this.items.delete(it.def.id); this.collected++; this.noise(ex.x, ex.z, 1, 'metal', 'impact'); }
    }

    if (!this.over) {
      const prey = [...this.players.entries()].map(([id, p]) => ({ id, x: p.state.p[0], z: p.state.p[2], crouch: p.state.crouch, alive: p.alive && !this.inBusZone(p.state.p[0], p.state.p[2]) }));
      const caught = stepMonster(this.monster, dt, this.time, this.bus, prey, this.night, Math.random, this.colliders);
      if (caught !== null) { const p = this.players.get(caught); if (p && !this.inBusZone(p.state.p[0], p.state.p[2])) p.alive = false; if (p && !p.alive) this.over = 'lose'; }
      if (!this.over && this.rescued >= CAMPER_NEED && [...this.players.values()].some((p) => p.alive && this.inBusZone(p.state.p[0], p.state.p[2]))) this.over = 'win';
    }
  }

  snapshot(): GameSnap {
    const items: ItemSnap[] = [];
    for (const it of this.items.values()) { const b = it.body, p = b.position, q = b.quaternion; items.push([it.def.id, r2(p.x), r2(p.y), r2(p.z), r2(q.x), r2(q.y), r2(q.z), r2(q.w), it.holder]); }
    const players: GameSnap['players'] = {}; for (const [id, p] of this.players) players[id] = { ...p.state, alive: p.alive };
    const campers: CamperSnap[] = [...this.campers.values()].map((c) => ({ id: c.id, x: r2(c.x), y: r2(c.y), z: r2(c.z), foundBy: c.foundBy, rescued: c.rescued }));
    const noise = this.fresh; this.fresh = []; const m = this.monster;
    return { t: 's', time: r2(this.time), night: this.night, players, items, campers, rescued: this.rescued, camperNeed: CAMPER_NEED, monster: { p: [r2(m.x), 0, r2(m.z)], yaw: r2(m.yaw), mode: m.mode }, noise, collected: this.collected, need: this.layout.need, over: this.over };
  }

  tick(dt: number): void { this.step(dt); this.net.broadcast(this.snapshot()); }
}
