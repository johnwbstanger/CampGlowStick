import * as THREE from 'three';
import { getModel, preload } from '../assets/loader';
import { MANIFEST, type AssetName } from '../assets/manifest';
import { growl, playMaterial } from '../audio/synth';
import type { Voice } from '../audio/voice';
import type { GameSnap, ItemDef, Msg } from '../net/protocol';
import { TICK_MS } from '../net/protocol';
import type { Session } from '../net/session';
import { CampMap } from '../ui/campMap';
import { Hud } from '../ui/hud';
import { TouchControls } from '../ui/touchControls';
import { Actor, RemotePlayer } from './avatars';
import { CamperActor } from './campers';
import { camperFoundLine, camperName } from './camperDialogue';
import { buildCampDecor } from './campDecor';
import { GLOW_NAMES, REACH } from './constants';
import { makeGlowstick, makeLootHalo } from './glow';
import { makeDirectorGun } from './gun';
import { HostSim } from './hostsim';
import { damp } from './interp';
import { propInfo } from './items';
import { buildLayout, type Layout } from './layout';
import { Lighting } from './lighting';
import { falloff } from './noise';
import { LocalPlayer } from './player';
import { terrainHeight } from './terrain';
import { buildWorld, type World } from './world';

type StartMsg = Extract<Msg, { t: 'start' }>;
interface ItemView { def: ItemDef; obj: THREE.Object3D; target: THREE.Vector3; q: THREE.Quaternion; init: boolean }
interface CamperView { actor: CamperActor; target: THREE.Vector3; lastTarget: THREE.Vector3; rescued: boolean; foundBy: number }

declare global { interface Window { __cg?: Record<string, unknown> } }

/** Imported models used by authored camp-use zones in campDecor.ts. */
const DECOR_ASSETS: AssetName[] = [
  'bunk', 'cooler', 'crate', 'bigCrate', 'bedroll', 'lantern', 'campfire', 'mug', 'can',
  'canoe', 'paddle', 'bucket', 'bottle', 'barrel', 'radio', 'logs', 'sign',
];

export const assetsFor = (layout: Layout, _playerIds: number[]): AssetName[] => {
  const set = new Set<AssetName>(['monster', 'tree', 'tree2', 'tree3', ...DECOR_ASSETS]);
  layout.statics.forEach((s) => set.add(s.name));
  layout.items.forEach((s) => set.add(s.model));
  return [...set].filter((n) => n in MANIFEST);
};

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.05, 420);
  light: Lighting;
  world: World;
  local: LocalPlayer;
  hud = new Hud();
  campMap: CampMap;
  touch: TouchControls;
  remotes = new Map<number, RemotePlayer>();
  items = new Map<number, ItemView>();
  campers = new Map<number, CamperView>();
  monster: Actor;
  sim?: HostSim;
  voice?: Voice;
  snap: GameSnap | null = null;
  glow = 'green';
  frames = 0;
  private fps = 0;
  private fpsT = 0;
  private fpsN = 0;
  private last = performance.now();
  private tickLast = performance.now();
  private monsterTarget = new THREE.Vector3();
  private monsterMode = 'idle';
  private overShown = false;
  private disposed = false;
  private timers: number[] = [];
  private mouseDownAt = 0;

  static async create(root: HTMLElement, net: Session, start: StartMsg, progress: (d: number, t: number) => void): Promise<Game> {
    const layout = buildLayout(start.seed, start.need);
    await preload(assetsFor(layout, net.players.map((p) => p.id)), progress);
    return new Game(root, net, layout);
  }

  private constructor(root: HTMLElement, private net: Session, private layout: Layout) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.id = 'game';
    root.append(this.renderer.domElement);

    this.light = new Lighting(this.scene, this.renderer, this.camera);
    this.world = buildWorld(layout);
    this.scene.add(this.world.group);
    this.scene.add(buildCampDecor(layout));

    this.local = new LocalPlayer(this.camera, this.renderer.domElement, layout);
    this.local.teleport(layout.arrival.x, layout.arrival.z);
    this.camera.position.y += 1.6;
    this.scene.add(this.camera);

    this.campMap = new CampMap(layout);
    root.append(this.campMap.root);

    this.touch = new TouchControls(this.local, {
      interact: () => this.interact(),
      glow: () => this.throwGlow(),
      map: () => this.campMap.toggle(),
      drop: () => this.dropHeld(),
    });
    root.append(this.touch.root);

    this.monster = new Actor('monster');
    this.scene.add(this.monster.root);

    for (const p of net.players) if (p.id !== net.selfId) this.addRemote(p.id, p.name);
    for (const c of layout.campers) this.addCamper(c.id, c.x, c.z);

    if (net.isHost) this.sim = new HostSim(net, layout);

    this.net.onPlayerJoin = (p) => { if (p.id !== net.selfId) this.addRemote(p.id, p.name); };
    this.net.onPlayerLeave = (id) => { this.remotes.get(id)?.dispose(); this.remotes.delete(id); };
    this.net.onSnap = (s) => this.applySnap(s);
    this.net.onMsg = (m) => this.onMessage(m);

    this.renderer.domElement.addEventListener('click', () => this.interact());
    addEventListener('resize', this.resize);
    addEventListener('keydown', this.keydown);
    this.resize();
    this.loop();
  }

  private addRemote(id: number, name: string): void {
    const a = new RemotePlayer(id, name);
    this.remotes.set(id, a);
    this.scene.add(a.root);
  }

  private addCamper(id: number, x: number, z: number): void {
    const actor = new CamperActor(id);
    actor.root.position.set(x, terrainHeight(x, z, this.layout), z);
    actor.play('hide');
    this.scene.add(actor.root);
    this.campers.set(id, { actor, target: actor.root.position.clone(), lastTarget: actor.root.position.clone(), rescued: false, foundBy: -1 });
  }

  private keydown = (e: KeyboardEvent): void => {
    if (e.code === 'KeyE') this.interact();
    else if (e.code === 'KeyG') this.throwGlow();
    else if (e.code === 'KeyM') this.campMap.toggle();
    else if (e.code === 'KeyR') this.dropHeld();
  };

  private resize = (): void => {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight, false);
  };

  private heldView(): ItemView | undefined {
    if (!this.snap) return undefined;
    return [...this.items.values()].find((v) => v.def.holder === this.net.selfId);
  }

  private held(): { name: string; mass: number } {
    const it = this.heldView();
    if (!it) return { name: '', mass: 0 };
    if (it.def.model === 'directorGun') return { name: `director's emergency gun`, mass: 2.2 };
    const info = propInfo(it.def.model);
    return { name: info?.label ?? it.def.model, mass: info?.mass ?? 1 };
  }

  private interact(): void {
    if (!this.snap || !this.local.alive) return;
    const held = this.heldView();
    if (held?.def.model === 'directorGun') { this.fireGun(); return; }
    if (held) {
      const holdMs = performance.now() - this.mouseDownAt;
      const power = THREE.MathUtils.clamp(4.2 + holdMs / 180, 4.2, 11.5);
      this.throwHeld(power);
      return;
    }
    const nearestCamper = this.nearestCamper();
    if (nearestCamper && nearestCamper.dist <= REACH) {
      this.net.send({ t: 'camperFind', id: nearestCamper.id });
      return;
    }
    const nearest = this.nearestItem();
    if (nearest && nearest.dist <= REACH) this.net.send({ t: 'pick', item: nearest.id });
  }

  private nearestCamper(): { id: number; dist: number } | null {
    let best: { id: number; dist: number } | null = null;
    for (const [id, c] of this.campers) {
      if (c.rescued || c.foundBy >= 0) continue;
      const d = Math.hypot(c.actor.root.position.x - this.local.pos.x, c.actor.root.position.z - this.local.pos.z);
      if (!best || d < best.dist) best = { id, dist: d };
    }
    return best;
  }

  private nearestItem(): { id: number; dist: number } | null {
    let best: { id: number; dist: number } | null = null;
    for (const [id, v] of this.items) {
      if (v.def.holder !== -1) continue;
      const d = Math.hypot(v.obj.position.x - this.local.pos.x, v.obj.position.z - this.local.pos.z);
      if (!best || d < best.dist) best = { id, dist: d };
    }
    return best;
  }

  private throwHeld(power: number): void {
    const held = this.heldView(); if (!held) return;
    const [fx, fz] = this.local.forward();
    this.net.send({ t: 'throw', item: held.def.id, vx: fx * power, vy: Math.min(6.2, power * .32 + 1.2), vz: fz * power });
    playMaterial(held.def.model, .7);
  }

  private dropHeld(): void {
    const held = this.heldView(); if (!held) return;
    const [fx, fz] = this.local.forward();
    this.net.send({ t: 'throw', item: held.def.id, vx: fx * .35, vy: .15, vz: fz * .35 });
  }

  private throwGlow(): void {
    const [fx, fz] = this.local.forward();
    this.net.send({ t: 'glow', color: this.glow, x: this.local.pos.x, y: this.local.pos.y + 1.25, z: this.local.pos.z, vx: fx * 6.7, vy: 2.2, vz: fz * 6.7 });
  }

  private fireGun(): void {
    const [fx, fz] = this.local.forward();
    this.net.send({ t: 'gun', x: this.local.pos.x, y: this.local.pos.y + 1.4, z: this.local.pos.z, dx: fx, dz: fz });
    playMaterial('metal', 1.0);
  }

  private onMessage(m: Msg): void {
    if (m.t === 'camperLine') this.hud.toast(`${camperName(m.id)}: “${m.line}”`);
  }

  private applySnap(s: GameSnap): void {
    this.snap = s;
    const self = s.players.find((p) => p.id === this.net.selfId);
    if (self) this.local.alive = self.alive;

    for (const p of s.players) {
      if (p.id === this.net.selfId) continue;
      let a = this.remotes.get(p.id);
      if (!a) { const name = this.net.players.find((x) => x.id === p.id)?.name ?? `Counselor ${p.id + 1}`; this.addRemote(p.id, name); a = this.remotes.get(p.id); }
      a?.setState(p);
    }

    for (const def of s.items) {
      let v = this.items.get(def.id);
      if (!v) {
        const obj = def.model === 'directorGun' ? makeDirectorGun() : getModel(def.model as AssetName);
        obj.name = `item-${def.id}`;
        this.scene.add(obj);
        v = { def: { ...def }, obj, target: new THREE.Vector3(), q: new THREE.Quaternion(), init: false };
        this.items.set(def.id, v);
      }
      v.def = { ...def };
      v.target.set(def.x, def.y, def.z);
      v.q.set(def.qx, def.qy, def.qz, def.qw);
      if (!v.init) { v.obj.position.copy(v.target); v.obj.quaternion.copy(v.q); v.init = true; }
    }

    for (const c of s.campers ?? []) {
      const v = this.campers.get(c.id); if (!v) continue;
      v.foundBy = c.foundBy; v.rescued = c.rescued;
      v.lastTarget.copy(v.target);
      if (c.rescued) {
        const seat = c.id % 7;
        v.target.set(this.layout.bus.x - 3.6 + (seat % 4) * 1.4, terrainHeight(this.layout.bus.x, this.layout.bus.z, this.layout) + .48, this.layout.bus.z - .55 + Math.floor(seat / 4) * 1.18);
        v.actor.play('sit');
      } else {
        v.target.set(c.x, terrainHeight(c.x, c.z, this.layout), c.z);
        v.actor.play(c.foundBy >= 0 ? 'walk' : 'hide');
      }
    }

    this.monsterTarget.set(s.monster.x, terrainHeight(s.monster.x, s.monster.z, this.layout), s.monster.z);
    this.monsterMode = s.monster.mode;
    if (!this.monster.root.visible) this.monster.root.visible = true;

    if (s.over && !this.overShown) { this.overShown = true; this.campMap.hide(); this.hud.showResult(s.over); }
  }

  private updateItems(dt: number): void {
    for (const v of this.items.values()) {
      if (v.def.holder === this.net.selfId) {
        const local = new THREE.Vector3(.45, -.42, -1.05).applyQuaternion(this.camera.quaternion).add(this.camera.position);
        v.obj.position.lerp(local, damp(18, dt));
        v.obj.quaternion.slerp(this.camera.quaternion, damp(20, dt));
      } else {
        v.obj.position.lerp(v.target, damp(16, dt));
        v.obj.quaternion.slerp(v.q, damp(16, dt));
      }
    }
  }

  private updateCampers(dt: number): void {
    for (const v of this.campers.values()) {
      v.actor.root.position.lerp(v.target, damp(v.rescued ? 12 : 7, dt));
      const dx = v.target.x - v.actor.root.position.x, dz = v.target.z - v.actor.root.position.z;
      if (Math.hypot(dx, dz) > .08) v.actor.root.rotation.y = Math.atan2(dx, dz);
      v.actor.update(dt);
    }
  }

  private updateMonster(dt: number): void {
    this.monster.root.position.lerp(this.monsterTarget, damp(this.monsterMode === 'chase' ? 12 : 7, dt));
    const dx = this.monsterTarget.x - this.monster.root.position.x, dz = this.monsterTarget.z - this.monster.root.position.z;
    if (Math.hypot(dx, dz) > .03) this.monster.root.rotation.y = Math.atan2(dx, dz);
    this.monster.play(this.monsterMode === 'chase' ? 'run' : this.monsterMode === 'idle' ? 'idle' : 'walk');
    this.monster.update(dt);
  }

  private updateHud(): void {
    if (!this.snap) return;
    const rescued = (this.snap.campers ?? []).filter((c) => c.rescued).length;
    const h = this.held();
    const nearestCamper = this.nearestCamper();
    const nearestItem = this.nearestItem();
    let prompt = '';
    if (h.name) prompt = h.name.includes('gun') ? 'Click / E — FIRE' : `Click / E — throw ${h.name} · R place`;
    else if (nearestCamper && nearestCamper.dist <= REACH) prompt = `Click / E — find ${camperName(nearestCamper.id)}`;
    else if (nearestItem && nearestItem.dist <= REACH) prompt = `Click / E — pick up ${propInfo(this.items.get(nearestItem.id)?.def.model ?? '')?.label ?? 'item'}`;
    else if (Math.hypot(this.local.pos.x - this.layout.bus.x, this.local.pos.z - this.layout.bus.z) < 5.5) prompt = 'BUS SAFE ZONE · board through the side door';
    this.hud.update(this.local.stamina, h.mass, h.name, this.glow, this.light.remaining(), rescued, (this.snap.campers ?? []).length, prompt);
  }

  private loop = (now = performance.now()): void => {
    if (this.disposed) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(.05, (now - this.last) / 1000); this.last = now;
    this.local.update(dt, this.world.colliders, this.held().mass);
    this.light.update(dt, this.local.flash, this.camera);
    this.updateItems(dt);
    this.updateCampers(dt);
    this.updateMonster(dt);

    for (const a of this.remotes.values()) a.update(dt);
    this.campMap.update(this.local.pos.x, this.local.pos.z, this.local.yaw, [...this.remotes.entries()].map(([id, a]) => ({ id, name: this.net.players.find((p) => p.id === id)?.name ?? `Counselor ${id + 1}`, x: a.root.position.x, z: a.root.position.z })));

    if (now - this.tickLast >= TICK_MS) {
      this.tickLast = now;
      const held = this.heldView();
      this.net.send({ t: 'player', s: this.local.state(held?.def.id ?? -1) });
      this.sim?.step();
    }

    this.updateHud();
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    this.fpsN++;
    if (now - this.fpsT > 1000) { this.fps = Math.round(this.fpsN * 1000 / Math.max(1, now - this.fpsT)); this.fpsN = 0; this.fpsT = now; }
    window.__cg = { fps: this.fps, campers: this.snap?.campers ?? [], items: this.snap?.items ?? [], players: this.snap?.players ?? [], touchVisible: getComputedStyle(this.touch.root).display !== 'none' };
  };

  dispose(): void {
    this.disposed = true;
    this.local.dispose();
    this.touch.dispose();
    this.campMap.dispose();
    this.voice?.dispose();
    this.hud.dispose();
    removeEventListener('resize', this.resize);
    removeEventListener('keydown', this.keydown);
    this.timers.forEach(clearTimeout);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.scene.clear();
  }
}
