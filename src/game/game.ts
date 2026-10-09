import * as THREE from 'three';
import { getModel, preload } from '../assets/loader';
import { MANIFEST, camperName, type AssetName } from '../assets/manifest';
import { growl, playMaterial } from '../audio/synth';
import type { Voice } from '../audio/voice';
import type { GameSnap, ItemDef, Msg } from '../net/protocol';
import { TICK_MS } from '../net/protocol';
import type { Session } from '../net/session';
import { Hud } from '../ui/hud';
import { Actor, RemotePlayer } from './avatars';
import { GLOW_NAMES, REACH } from './constants';
import { makeGlowstick, makeLootHalo } from './glow';
import { HostSim } from './hostsim';
import { damp } from './interp';
import { propInfo } from './items';
import { buildLayout, type Layout } from './layout';
import { Lighting } from './lighting';
import { falloff } from './noise';
import { LocalPlayer } from './player';
import { buildWorld, type World } from './world';

type StartMsg = Extract<Msg, { t: 'start' }>;
interface ItemView { def: ItemDef; obj: THREE.Object3D; target: THREE.Vector3; q: THREE.Quaternion; init: boolean }

declare global { interface Window { __cg?: Record<string, unknown> } }

export const assetsFor = (layout: Layout, playerIds: number[]): AssetName[] => {
  const set = new Set<AssetName>(['ground', 'monster', 'tree', 'tree2', 'tree3']);
  layout.statics.forEach((s) => set.add(s.name));
  layout.items.forEach((s) => set.add(s.model));
  playerIds.forEach((i) => set.add(camperName(i)));
  return [...set].filter((n) => n in MANIFEST);
};

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.05, 320);
  light: Lighting;
  world: World;
  local: LocalPlayer;
  hud = new Hud();
  remotes = new Map<number, RemotePlayer>();
  items = new Map<number, ItemView>();
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

  static async create(root: HTMLElement, net: Session, start: StartMsg, progress: (d: number, t: number) => void): Promise<Game> {
    const layout = buildLayout(start.seed, start.need);
    await preload(assetsFor(layout, net.players.map((p) => p.id)), progress);
    return new Game(root, net, layout);
  }

  private constructor(root: HTMLElement, private net: Session, private layout: Layout) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.className = 'game';
    this.light = new Lighting(this.scene, this.renderer, this.camera);
    this.world = buildWorld(layout);
    this.scene.add(this.world.group);
    this.local = new LocalPlayer(this.camera, this.renderer.domElement);
    const sp = layout.spawns[net.myId % layout.spawns.length];
    this.local.teleport(sp[0], sp[1]);
    for (const p of net.players) if (p.id !== net.myId) this.remotes.set(p.id, new RemotePlayer(p.id, p.name, this.scene));
    this.monster = new Actor('monster');
    this.monster.root.position.set(layout.monsterStart[0], 0, layout.monsterStart[1]);
    this.monster.play('walk');
    this.scene.add(this.monster.root);
    const made = HostSim.makeDefs(layout);
    for (const d of made.defs) this.addItemView(d);

    root.replaceChildren(this.renderer.domElement, this.hud.root);
    this.resize();
    addEventListener('resize', this.resize);
    this.renderer.domElement.addEventListener('click', this.click);
    addEventListener('keydown', this.key);

    if (net.isHost) {
      this.sim = new HostSim(net, layout, this.world.colliders, this.world.sizes, made.defs, made.spawnById);
    }
    this.timers.push(window.setInterval(() => this.netTick(), TICK_MS));
    this.exposeHooks();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private resize = (): void => {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  };

  private click = (): void => {
    if (this.snap?.over) return;
    if (document.pointerLockElement !== this.renderer.domElement) { void this.renderer.domElement.requestPointerLock?.(); return; }
    this.act('throw');
  };

  private key = (e: KeyboardEvent): void => {
    if (e.repeat || this.snap?.over) return;
    if (e.code === 'KeyE') this.act('pick');
    else if (e.code === 'KeyR') this.act('drop');
    else if (e.code === 'KeyG') this.act('snap');
    else if (e.code === 'KeyN') this.act('night');
    else if (/^Digit[1-5]$/.test(e.code)) { this.glow = GLOW_NAMES[Number(e.code.slice(5)) - 1]; this.hud.toast(`Glowstick: ${this.glow}`); }
  };

  act(a: 'pick' | 'drop' | 'throw' | 'snap' | 'night'): void {
    this.net.sendToHost({ t: 'act', a, color: this.glow });
    if (a === 'snap') playMaterial('glow', 5);
  }

  private addItemView(def: ItemDef): void {
    if (this.items.has(def.id)) return;
    const obj = def.kind === 'glow' ? makeGlowstick(def.color ?? 'green') : getModel(def.model as AssetName);
    if (def.kind === 'loot') obj.add(makeLootHalo());
    this.scene.add(obj);
    this.items.set(def.id, { def, obj, target: new THREE.Vector3(), q: new THREE.Quaternion(), init: false });
  }

  handle(msg: Msg): void {
    if (msg.t === 'spawn') this.addItemView(msg.def);
    else if (msg.t === 's') this.applySnap(msg);
  }

  private applySnap(s: GameSnap): void {
    this.snap = s;
    this.light.setTime(s.time, s.night);
    for (const [id, st] of Object.entries(s.players)) {
      const r = this.remotes.get(Number(id));
      if (r) { r.target = st; r.alive = st.alive; }
      else if (Number(id) === this.net.myId && !st.alive) this.local.alive = false;
    }
    const seen = new Set<number>();
    for (const [id, x, y, z, qx, qy, qz, qw] of s.items) {
      seen.add(id);
      const v = this.items.get(id);
      if (!v) continue;
      v.target.set(x, y, z); v.q.set(qx, qy, qz, qw);
      if (!v.init) { v.obj.position.copy(v.target); v.obj.quaternion.copy(v.q); v.init = true; }
    }
    for (const [id, v] of this.items) if (!seen.has(id)) { this.scene.remove(v.obj); this.items.delete(id); }
    const m = s.monster;
    this.monsterTarget.set(m.p[0], 0, m.p[2]);
    this.monster.root.rotation.y = m.yaw;
    if (m.mode === 'chase' && this.monsterMode !== 'chase') growl();
    this.monsterMode = m.mode;
    for (const n of s.noise) {
      const d = Math.hypot(n.x - this.local.pos.x, n.z - this.local.pos.z);
      playMaterial(n.mat, falloff(n.vol, d) * 2);
    }
    if (s.over && !this.overShown) { this.overShown = true; this.hud.showResult(s.over); }
  }

  private held(): { name: string; mass: number } {
    const id = this.snap?.players[this.net.myId]?.held ?? -1;
    const it = this.items.get(id);
    if (!it) return { name: '', mass: 0 };
    return { name: it.def.kind === 'glow' ? `${it.def.color} glowstick` : it.def.model, mass: it.def.kind === 'glow' ? 0.1 : propInfo(it.def.model).mass };
  }

  /** 20 Hz: stream own state to the host; host also steps the authoritative sim and broadcasts. */
  private netTick(): void {
    const now = performance.now(), dt = Math.min(0.1, (now - this.tickLast) / 1000);
    this.tickLast = now;
    if (this.disposed) return;
    this.net.sendToHost({ t: 'p', s: this.local.state(-1) });
    this.sim?.tick(dt);
  }

  private frame(): void {
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now; this.frames++;
    this.fpsT += dt; this.fpsN++;
    if (this.fpsT >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsT); this.fpsT = this.fpsN = 0; }
    const held = this.held();
    this.local.update(dt, this.world.colliders, held.mass);
    this.light.update(dt, this.local.flash && this.local.alive);
    const k = damp(20, dt);
    for (const v of this.items.values()) { v.obj.position.lerp(v.target, k); v.obj.quaternion.slerp(v.q, k); }
    for (const r of this.remotes.values()) r.update(dt);
    if (!this.snap?.over) {
      this.monster.root.position.lerp(this.monsterTarget, damp(8, dt));
      this.monster.play(this.monsterMode === 'idle' ? 'idle' : this.monsterMode === 'chase' ? 'sprint' : 'walk');
      this.monster.update(dt);
    }
    this.voice?.update({ x: this.local.pos.x, y: 1.6, z: this.local.pos.z, yaw: this.local.yaw }, (id) => { const r = this.remotes.get(id); return r ? { x: r.pos.x, y: 1.6, z: r.pos.z } : undefined; });
    this.hud.update({ stamina: this.local.stamina, held: held.name, glow: this.glow, night: this.snap?.night ?? false, time: this.snap?.time ?? 0, collected: this.snap?.collected ?? 0, need: this.layout.need, names: this.net.players.map((p) => p.name), fps: this.fps });
    this.renderer.render(this.scene, this.camera);
  }

  /** Smoke-test hooks (read-only state + a few helpers). */
  private exposeHooks(): void {
    window.__cg = {
      ready: true, myId: this.net.myId, isHost: this.net.isHost, need: this.layout.need,
      frames: () => this.frames,
      reach: REACH,
      teleport: (x: number, z: number) => this.local.teleport(x, z),
      look: (yaw: number) => { this.local.yaw = yaw; },
      act: (a: 'pick' | 'drop' | 'throw' | 'snap' | 'night') => this.act(a),
      setGlow: (c: string) => { this.glow = c; },
      local: () => ({ x: this.local.pos.x, z: this.local.pos.z, stamina: this.local.stamina }),
      remote: (id: number) => { const r = this.remotes.get(id); return r ? { x: r.pos.x, z: r.pos.z, tx: r.target?.p[0], tz: r.target?.p[2] } : null; },
      remoteIds: () => [...this.remotes.keys()],
      glows: () => [...this.items.values()].filter((v) => v.def.kind === 'glow').map((v) => ({ id: v.def.id, color: v.def.color, x: v.target.x, y: v.target.y, z: v.target.z })),
      items: () => [...this.items.values()].map((v) => ({ id: v.def.id, kind: v.def.kind, model: v.def.model, x: v.target.x, y: v.target.y, z: v.target.z })),
      snap: () => this.snap && { night: this.snap.night, over: this.snap.over, collected: this.snap.collected, monster: this.snap.monster, noise: this.snap.noise.length, time: this.snap.time },
      missingModels: () => this.scene.children.filter((c) => c.name.startsWith('placeholder:')).length,
      sample: () => this.sample(),
    };
  }

  /** Render, then count distinct colours on a sparse grid of the WebGL canvas (non-blank check). */
  private sample(): { distinct: number; lit: number } {
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement, c = document.createElement('canvas');
    c.width = 64; c.height = 36;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.drawImage(src, 0, 0, 64, 36);
    const d = x.getImageData(0, 0, 64, 36).data, seen = new Set<number>();
    let lit = 0;
    for (let i = 0; i < d.length; i += 4) { seen.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4); if (d[i] + d[i + 1] + d[i + 2] > 60) lit++; }
    return { distinct: seen.size, lit };
  }

  removeRemote(id: number): void { this.remotes.get(id)?.dispose(this.scene); this.remotes.delete(id); }

  dispose(): void {
    this.disposed = true;
    this.timers.forEach(clearInterval);
    this.renderer.setAnimationLoop(null);
    removeEventListener('resize', this.resize);
    removeEventListener('keydown', this.key);
    this.renderer.domElement.removeEventListener('click', this.click);
    this.local.dispose();
    this.net.onHostMessage = undefined;
    delete window.__cg;
    document.exitPointerLock?.();
    this.renderer.dispose();
  }
}
