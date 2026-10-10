import * as THREE from 'three';
import { getAnimations, getModel } from '../assets/loader';
import type { AssetName } from '../assets/manifest';
import type { PlayerState } from '../net/protocol';

function findClip(clips: THREE.AnimationClip[], patterns: RegExp[]): THREE.AnimationClip | undefined {
  return clips.find((clip) => patterns.some((p) => p.test(clip.name)));
}

/**
 * Counselor rendered from a human-authored Quaternius smooth character. The source pack already
 * contains a rig and animation clips; this class only selects/fades the right clip and keeps the
 * multiplayer-facing API used by RemotePlayer.
 */
export class CounselorActor {
  root = new THREE.Group();
  private visual: THREE.Object3D;
  private mixer?: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = '';
  private t = 0;

  constructor(id: number) {
    const model: AssetName = id % 2 ? 'counselorFemale' : 'counselorMale';
    this.visual = getModel(model);
    this.root.add(this.visual);
    this.root.name = `counselor-${id}`;

    const clips = getAnimations(model);
    if (clips.length) {
      this.mixer = new THREE.AnimationMixer(this.visual);
      const idle = findClip(clips, [/idle/i, /stand/i]);
      const walk = findClip(clips, [/walk/i, /walking/i]);
      const sprint = findClip(clips, [/run/i, /running/i, /sprint/i]);
      const crouch = findClip(clips, [/crouch/i, /duck/i]);
      for (const [name, clip] of [['idle', idle], ['walk', walk], ['sprint', sprint], ['crouch', crouch]] as const) {
        if (clip) this.actions.set(name, this.mixer.clipAction(clip));
      }
      this.play('idle');
    }
  }

  play(name: string): void {
    if (name === this.current) return;
    const wanted = this.actions.get(name) ?? this.actions.get(name === 'sprint' ? 'walk' : 'idle');
    const previous = this.actions.get(this.current);
    if (wanted) {
      wanted.reset().fadeIn(0.14).play();
      if (previous && previous !== wanted) previous.fadeOut(0.14);
    }
    this.current = name;
  }

  update(dt: number, state?: PlayerState): void {
    this.t += dt;
    const crouching = !!state?.crouch;
    const requested = crouching ? 'crouch' : this.current;
    if (requested !== this.current && this.actions.has(requested)) this.play(requested);
    this.mixer?.update(dt);

    // Imported rigs are preferred. These tiny transforms are only a graceful fallback for clips the
    // pack does not provide and keep the character from looking frozen in place.
    if (!this.mixer) {
      const moving = this.current === 'walk' || this.current === 'sprint';
      const pace = this.current === 'sprint' ? 10 : 6;
      this.visual.position.y = moving ? Math.abs(Math.sin(this.t * pace)) * 0.025 : Math.sin(this.t * 1.6) * 0.006;
    }
    const targetY = crouching ? 0.82 : 1;
    this.visual.scale.y += (targetY - this.visual.scale.y) * Math.min(1, dt * 10);
  }
}
