import * as THREE from 'three';
import { getAnimations, getModel } from '../assets/loader';
import type { AssetName } from '../assets/manifest';

export type ImportedPose = 'idle' | 'walk' | 'run' | 'hide' | 'scared';

/**
 * Lightweight imported camper renderer. The previous SDF/surface-net character builder generated
 * seven unique meshes on the player's main thread at round start; this actor clones preloaded CC0
 * Quaternius skinned meshes instead, sharing geometry/materials and using embedded clips when present.
 */
export class CamperActor {
  readonly root = new THREE.Group();
  private readonly model: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private current = '';
  private t = 0;

  constructor(public id: number) {
    const asset: AssetName = id % 2 ? 'camperFemale' : 'camperMale';
    this.model = getModel(asset);
    this.model.name = `camper-model-${id}`;
    this.root.name = `camper-${id}`;
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of getAnimations(asset)) this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
    this.playBest('idle');
  }

  private findClip(words: string[]): THREE.AnimationAction | undefined {
    for (const [name, action] of this.actions) if (words.some((w) => name.includes(w))) return action;
    return this.actions.values().next().value;
  }

  private playBest(pose: ImportedPose): void {
    const key = pose === 'run' ? 'run' : pose === 'walk' ? 'walk' : pose === 'scared' ? 'scared' : pose === 'hide' ? 'crouch' : 'idle';
    if (key === this.current) return;
    const words = pose === 'run' ? ['run', 'sprint'] : pose === 'walk' ? ['walk'] : pose === 'hide' ? ['crouch', 'hide', 'duck'] : pose === 'scared' ? ['scared', 'fear', 'idle'] : ['idle', 'stand'];
    const next = this.findClip(words);
    if (next) {
      for (const action of this.actions.values()) if (action !== next) action.fadeOut(.12);
      next.reset().fadeIn(.12).play();
    }
    this.current = key;
  }

  update(dt: number, moving: boolean, scared = false, hiding = false): void {
    this.t += dt;
    // Unfound campers stand naturally with arms down unless an explicit cover-specific hiding
    // anchor eventually requests a crouch. This avoids the old universal hands-over-head pose.
    const pose: ImportedPose = hiding ? 'idle' : moving ? (scared ? 'run' : 'walk') : scared ? 'scared' : 'idle';
    this.playBest(pose);
    this.mixer.update(dt);
    // If a source FBX lacks locomotion clips, keep a tiny breathing motion rather than doing costly
    // procedural mesh deformation. Never rotate 180° here; game.ts owns world-facing from velocity.
    if (!this.actions.size && !moving) this.model.position.y = Math.sin(this.t * 1.7) * .006;
    else this.model.position.y = 0;
  }
}
