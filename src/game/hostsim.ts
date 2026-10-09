import * as CANNON from 'cannon-es';
import type { Session } from '../net/session';
import type { GameSnap, ItemDef, ItemSnap, Msg, PlayerState } from '../net/protocol';
import type { Box } from './colliders';
import { DAY_SECONDS, PLAYER, REACH } from './constants';
import { GLOW_MASS, propInfo } from './items';
import type { Layout } from './layout';
import { newMonster, stepMonster } from './monster';
import { NoiseBus, VOLUME, impactVolume, stepVolume, type Noise } from './noise';

interface SimPlayer { state: PlayerState; alive: boolean; stepT: number }
interface SimItem { def: ItemDef; body: CANNON.Body; mass: number; holder: number; lastHit: number }
export interface Sizes { get(model: string): { x: number; y: number; z: number } | undefined }

const MAX_GLOW = 60;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Host-authoritative simulation: props + glowsticks (cannon-es), noise, monster AI, win/lose. Broadcasts a snapshot at 20 Hz. */
export class HostSim {
  world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.8, 0) });
  items = new Map<number, SimItem>();
  players = new Map<number, SimPlayer>();
  bus = new NoiseBus();
  monster: ReturnType<typeof newMonster>;
  time = 0;
  night = false;
  collected = 0;
  over: '' | 'win' | 'lose' = '';
  private nextId = 1;
  private fresh: Noise[] = [];

  constructor(private net: Session, private layout: Layout, private colliders: Box[], private sizes: Sizes, defs: ItemDef[], spawnById: Map<number, [number, number]>) {
    this.monster = newMonster(layout.monsterStart[0], layout.monsterStart[1]);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    const mat = new CANNON.Material('prop');
    this.world.defaultContactMaterial = new CANNON.ContactMaterial(mat, mat, { friction: 0.5, restitution: 0.35 });
    const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(ground);
    for (const b of colliders) {
      const body = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3((b.maxX - b.minX) / 2, (b.maxY - b.minY) / 2, (b.maxZ - b.minZ) / 2)) });
      body.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
      this.world.addBody(body);
    }
    for (const d of defs) { const at = spawnById.get(d.id) ?? [0, 0]; this.addItem(d, at[0], 1.5, at[1]); this.nextId = Math.max(this.nextId, d.id + 1); }
    net.onHostMessage = (from, msg) => this.handle(from, msg);
    for (const p of net.players) this.addPlayer(p.id, layout.spawns[p.id % layout.spawns.length]);
  }

  static makeDefs(layout: Layout): { defs: ItemDef[]; spawnById: Map<number, [number, number]> } {
    const spawnById = new Map<number, [number, number]>();
    const defs = layout.items.map((s, i) => { spawnById.set(i + 1, [s.x, s.z]); return { id: i + 1, model: s.model, kind: s.kind, mat: propInfo(s.model).mat } satisfies ItemDef; });
    return { defs, spawnById };
  }

  private addPlayer(id: number, spawn: [number, number]): void {
    this.players.set(id, { alive: true, stepT: 0, state: { p: [spawn[0], 0, spawn[1]], yaw: 0, pitch: 0, crouch: false, sprint: false, moving: false, held: -1, flash: false, stamina: 100 } });
  }

  private addItem(def: ItemDef, x: number, y: number, z: number): SimItem {
    const mass = def.kind === 'glow' ? GLOW_MASS : propInfo(def.model).mass;
    const sz = def.kind === 'glow' ? { x: 0.04, y: 0.04, z: 0.2 } : (this.sizes.get(def.model) ?? { x: 0.3, y: 0.3, z: 0.3 });
    const body = new CANNON.Body({ mass, shape: new CANNON.Box(new CANNON.Vec3(Math.max(0.02, sz.x / 2), Math.max(0.02, sz.y / 2), Math.max(0.02, sz.z / 2))), linearDamping: 0.1, angularDamping: 0.3, sleepSpeedLimit: 0.2, sleepTimeLimit: 0.6 });
    body.position.set(x, y, z);
    const it: SimItem = { def, body, mass, holder: -1, lastHit: 0 };
    body.addEventListener('collide', (e: { contact: CANNON.ContactEquation }) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v < 1.4 || this.time - it.lastHit < 0.3 || def.kind === 'glow') return;
      it.lastHit = this.time;
      this.noise(body.position.x, body.position.z, impactVolume(v, mass), def.mat);
    });
    this.world.addBody(body);
    this.items.set(def.id, it);
    return it;
  }

  private noise(x: number, z: number, vol: number, mat: string): void {
    const n = { x: r2(x), z: r2(z), vol: r2(vol), mat, t: this.time };
    this.bus.emit(n);
    if (mat !== 'step') this.fresh.push(n);
  }

  handle(from: number, msg: Msg): void {
    const pl = this.players.get(from);
    if (msg.t === 'bye') { this.release(from, false); this.players.delete(from); return; }
    if (!pl || this.over) return;
    if (msg.t === 'p') { const keepHeld = pl.state.held; pl.state = { ...msg.s, held: keepHeld }; return; }
    if (msg.t !== 'act') return;
    const held = pl.state.held;
    if (msg.a === 'night' && from === 0) this.night = !this.night;
    else if (msg.a === 'pick') { if (held >= 0) this.release(from, false); else this.pickup(from, pl); }
    else if (msg.a === 'drop') this.release(from, false);
    else if (msg.a === 'throw') this.release(from, true);
    else if (msg.a === 'snap') this.snap(from, pl, msg.color ?? 'green');
  }

  private forward(pl: SimPlayer): [number, number] { return [-Math.sin(pl.state.yaw), -Math.cos(pl.state.yaw)]; }

  private pickup(id: number, pl: SimPlayer): void {
    const [px, py, pz] = pl.state.p, [fx, fz] = this.forward(pl);
    let best: SimItem | null = null, bd = REACH;
    for (const it of this.items.values()) {
      if (it.holder >= 0) continue;
      const dx = it.body.position.x - px, dz = it.body.position.z - pz, d = Math.hypot(dx, dz, it.body.position.y - (py + 0.9) * 0.6);
      if (d < bd && (d < 1 || (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1) > 0.2)) { bd = d; best = it; }
    }
    if (best) this.hold(id, pl, best);
  }

  private hold(id: number, pl: SimPlayer, it: SimItem): void {
    it.holder = id; pl.state.held = it.def.id;
    it.body.type = CANNON.Body.KINEMATIC; it.body.mass = 0; it.body.updateMassProperties();
    it.body.velocity.setZero(); it.body.angularVelocity.setZero();
    this.noise(it.body.position.x, it.body.position.z, 0.6, it.def.mat === 'glass' ? 'plastic' : it.def.mat);
  }

  private release(id: number, thrown: boolean): void {
    const pl = this.players.get(id);
    if (!pl || pl.state.held < 0) return;
    const it = this.items.get(pl.state.held);
    pl.state.held = -1;
    if (!it) return;
    it.holder = -1;
    it.body.type = CANNON.Body.DYNAMIC; it.body.mass = it.mass; it.body.updateMassProperties(); it.body.wakeUp();
    const [fx, fz] = this.forward(pl), sp = thrown ? 11 : 1.2;
    it.body.velocity.set(fx * sp, thrown ? 3.5 : 0.5, fz * sp);
    if (thrown) { it.body.angularVelocity.set(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3); this.noise(pl.state.p[0], pl.state.p[2], VOLUME.throw, 'step'); }
  }

  private snap(id: number, pl: SimPlayer, color: string): void {
    const glows = [...this.items.values()].filter((i) => i.def.kind === 'glow');
    if (glows.length >= MAX_GLOW) return;
    const def: ItemDef = { id: this.nextId++, model: 'glowstick', kind: 'glow', color, mat: 'glow' };
    const [fx, fz] = this.forward(pl);
    const it = this.addItem(def, pl.state.p[0] + fx * 0.6, 1.2, pl.state.p[2] + fz * 0.6);
    this.net.broadcast({ t: 'spawn', def });
    this.noise(pl.state.p[0], pl.state.p[2], 1, 'glow');
    if (pl.state.held < 0) this.hold(id, pl, it);
  }

  step(dt: number): void {
    if (this.over) dt = Math.min(dt, 0.05);
    this.time += dt;
    if (!this.night && this.time > DAY_SECONDS) this.night = true;
    for (const pl of this.players.values()) {
      const s = pl.state;
      if (pl.alive && (pl.stepT -= dt) <= 0) {
        const v = stepVolume(s.moving, s.crouch, s.sprint);
        if (v > 0) this.noise(s.p[0], s.p[2], v, 'step');
        pl.stepT = s.sprint ? 0.3 : 0.5;
      }
      const it = s.held >= 0 ? this.items.get(s.held) : undefined;
      if (it) {
        const [fx, fz] = this.forward(pl), eye = s.crouch ? PLAYER.crouchEye : PLAYER.eye;
        it.body.position.set(s.p[0] + fx * 0.7, s.p[1] + eye - 0.35, s.p[2] + fz * 0.7);
        it.body.velocity.setZero();
      } else if (s.held >= 0) s.held = -1;
    }
    this.world.step(1 / 60, dt, 3);
    this.bus.prune(this.time);

    const ex = this.layout.extraction;
    for (const it of [...this.items.values()]) {
      if (it.def.kind !== 'loot' || it.holder >= 0) continue;
      if (Math.hypot(it.body.position.x - ex.x, it.body.position.z - ex.z) < ex.r) {
        this.world.removeBody(it.body); this.items.delete(it.def.id); this.collected++;
        this.noise(ex.x, ex.z, 1, 'metal');
      }
    }
    if (!this.over) {
      const prey = [...this.players.entries()].map(([id, p]) => ({ id, x: p.state.p[0], z: p.state.p[2], crouch: p.state.crouch, alive: p.alive }));
      const caught = stepMonster(this.monster, dt, this.time, this.bus, prey, this.night, Math.random, this.colliders);
      if (caught !== null) { const p = this.players.get(caught); if (p) p.alive = false; this.over = 'lose'; }
      else if (this.collected >= this.layout.need && [...this.players.values()].some((p) => p.alive && Math.hypot(p.state.p[0] - ex.x, p.state.p[2] - ex.z) < ex.r)) this.over = 'win';
    }
  }

  snapshot(): GameSnap {
    const items: ItemSnap[] = [];
    for (const it of this.items.values()) {
      const b = it.body, p = b.position, q = b.quaternion;
      items.push([it.def.id, r2(p.x), r2(p.y), r2(p.z), r2(q.x), r2(q.y), r2(q.z), r2(q.w), it.holder]);
    }
    const players: GameSnap['players'] = {};
    for (const [id, p] of this.players) players[id] = { ...p.state, alive: p.alive };
    const noise = this.fresh; this.fresh = [];
    const m = this.monster;
    return { t: 's', time: r2(this.time), night: this.night, players, items, monster: { p: [r2(m.x), 0, r2(m.z)], yaw: r2(m.yaw), mode: m.mode }, noise, collected: this.collected, need: this.layout.need, over: this.over };
  }

  tick(dt: number): void {
    this.step(dt);
    this.net.broadcast(this.snapshot());
  }
}