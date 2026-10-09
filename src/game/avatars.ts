import * as THREE from 'three';
import { getAnimations, getModel } from '../assets/loader';
import type { AssetName } from '../assets/manifest';
import { CounselorActor } from './counselors';
import { CreatureActor } from './creature';
import { damp, lerpAngle } from './interp';
import type { PlayerState } from '../net/protocol';

function nameTag(text: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(26,58,43,.8)'; x.fillRect(0, 8, 256, 48);
  x.strokeStyle = '#D2B48C'; x.lineWidth = 3; x.strokeRect(2, 10, 252, 44);
  x.fillStyle = '#FFFDD0'; x.font = 'bold 30px "Courier New"'; x.textAlign = 'center'; x.fillText(text, 128, 42);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(1.3, 0.33, 1); s.position.y = 2.05; s.renderOrder = 10;
  return s;
}

/** Animated actor. The monster uses the purpose-built gaunt creature instead of the old goofy zombie asset. */
export class Actor {
  root = new THREE.Group();
  private mixer?: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = '';
  private creature?: CreatureActor;

  constructor(model: AssetName, scale = 1) {
    if (model === 'monster') {
      this.creature = new CreatureActor();
      this.root = this.creature.root;
      this.root.scale.multiplyScalar(scale);
      this.creature.play('idle');
      return;
    }
    const m = getModel(model);
    this.root.add(m);
    this.root.scale.setScalar(scale);
    this.mixer = new THREE.AnimationMixer(m);
    for (const clip of getAnimations(model)) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.play('idle');
  }

  play(name: string): void {
    if (this.creature) { this.creature.play(name); this.current = name; return; }
    if (name === this.current) return;
    const next = this.actions.get(name) ?? this.actions.get('idle');
    if (!next) return;
    const prev = this.actions.get(this.current);
    next.reset().play();
    if (prev && prev !== next) prev.crossFadeTo(next, 0.2, false);
    this.current = name;
  }
  update(dt: number): void { if (this.creature) this.creature.update(dt); else this.mixer?.update(dt); }
}

export class RemotePlayer {
  actor: CounselorActor;
  tag: THREE.Sprite;
  flash: THREE.SpotLight;
  pos = new THREE.Vector3();
  yaw = 0;
  target: PlayerState | null = null;
  alive = true;
  constructor(public id: number, public name: string, scene: THREE.Scene) {
    this.actor = new CounselorActor(id);
    this.tag = nameTag(name);
    this.actor.root.add(this.tag);
    this.flash = new THREE.SpotLight('#FFF1CF', 0, 26, 0.5, 0.5, 1.6);
    this.flash.position.set(0, 1.45, 0);
    this.flash.target.position.set(0, 1.45, 5);
    this.actor.root.add(this.flash, this.flash.target);
    this.actor.root.visible = false;
    scene.add(this.actor.root);
  }
  /** LERP/damp toward the latest 20 Hz network state so remote avatars move smoothly between ticks. */
  update(dt: number): void {
    const t = this.target;
    if (!t) return;
    const k = damp(18, dt);
    if (this.pos.lengthSq() === 0) this.pos.set(...t.p);
    this.pos.x += (t.p[0] - this.pos.x) * k; this.pos.y += (t.p[1] - this.pos.y) * k; this.pos.z += (t.p[2] - this.pos.z) * k;
    this.yaw = lerpAngle(this.yaw, t.yaw, k);
    this.actor.root.position.copy(this.pos);
    this.actor.root.rotation.y = this.yaw + Math.PI;
    this.actor.play(t.moving ? (t.sprint ? 'sprint' : 'walk') : 'idle');
    this.flash.intensity = t.flash ? 60 : 0;
    this.actor.root.visible = this.alive;
    this.actor.update(dt, t);
  }
  dispose(scene: THREE.Scene): void { scene.remove(this.actor.root); }
}
