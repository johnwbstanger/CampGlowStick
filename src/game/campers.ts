import * as THREE from 'three';
import { getAnimations, getModel } from '../assets/loader';
import type { AssetName } from '../assets/manifest';

function clipBy(clips: THREE.AnimationClip[], words: RegExp[]): THREE.AnimationClip | undefined {
  return clips.find((c) => words.some((w) => w.test(c.name)));
}

/**
 * Camper NPC rendered from a human-authored Quaternius smooth character asset.
 * The source FBX animation names vary between packs, so we match common clip names and
 * gracefully fall back to subtle root motion when a specific animation is unavailable.
 */
export class CamperActor {
  root = new THREE.Group();
  private visual = new THREE.Group();
  private mixer?: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = '';
  private t = 0;
  private baseScale = 1;

  constructor(public id: number) {
    const model: AssetName = id % 2 ? 'camperFemale' : 'camperMale';
    this.visual = getModel(model) as THREE.Group;
    this.root.add(this.visual);
    this.root.name = `camper-${id}`;
    this.baseScale = 0.96 + (id % 3) * 0.025;
    this.root.scale.setScalar(this.baseScale);

    const clips = getAnimations(model);
    if (clips.length) {
      this.mixer = new THREE.AnimationMixer(this.visual);
      const idle = clipBy(clips, [/idle/i, /stand/i]);
      const walk = clipBy(clips, [/walk/i, /walking/i]);
      const run = clipBy(clips, [/run/i, /running/i]);
      const crouch = clipBy(clips, [/crouch/i, /sit/i, /duck/i]);
      for (const [name, clip] of [['idle', idle], ['walk', walk], ['run', run], ['crouch', crouch]] as const) {
        if (clip) this.actions.set(name, this.mixer.clipAction(clip));
      }
      this.play('idle');
    }
  }

  private play(name: string): void {
    if (name === this.current) return;
    const next = this.actions.get(name) ?? this.actions.get(name === 'run' ? 'walk' : 'idle');
    const prev = this.actions.get(this.current);
    if (next) {
      next.reset().fadeIn(0.12).play();
      if (prev && prev !== next) prev.fadeOut(0.12);
    }
    this.current = name;
  }

  update(dt: number, moving: boolean, scared = false, hiding = false): void {
    this.t += dt;
    this.play(hiding ? 'crouch' : moving ? (scared ? 'run' : 'walk') : 'idle');
    this.mixer?.update(dt);

    // Hiding should read immediately even if this particular FBX does not contain a crouch clip.
    const targetY = hiding ? 0.72 : 1;
    const targetTilt = hiding ? 0.22 : 0;
    const k = Math.min(1, dt * 9);
    this.visual.scale.y += (targetY - this.visual.scale.y) * k;
    this.visual.rotation.x += (targetTilt - this.visual.rotation.x) * k;

    if (!this.mixer) {
      const pace = moving ? (scared ? 10 : 7) : 1.8;
      const bob = moving ? Math.abs(Math.sin(this.t * pace)) * 0.028 : Math.sin(this.t * pace) * 0.006;
      this.visual.position.y = bob;
    }
    this.root.rotation.z = scared && !hiding ? Math.sin(this.t * 9) * 0.018 : 0;
  }
}
