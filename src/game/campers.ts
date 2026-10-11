import * as THREE from 'three';
import type { AssetName } from '../assets/manifest';
import { getAnimations, getModel } from '../assets/loader';
import { createImportedAnimation, ImportedProceduralAnimator, modelHasUsefulClips, playImportedAnimation, updateImportedAnimation, type ImportedAnimationState } from './importedRigAnimation';
import { applyCamperUniform, CAMPER_VARIANTS } from './camperPresentationFix';

const CAMPER_TYPES: AssetName[] = ['camperMale', 'camperFemale', 'camperMaleVariant', 'camperFemaleVariant'];
const bodyType = (id: number): AssetName => CAMPER_TYPES[Math.abs(id * 7 + 3) % CAMPER_TYPES.length];

export class CamperActor {
  root = new THREE.Group();
  private model: THREE.Object3D;
  private anim: ImportedAnimationState;
  private procedural: ImportedProceduralAnimator;
  private useImported: boolean;
  private state = 'idle';
  private last = new THREE.Vector3();
  private bubble: THREE.Sprite;
  private campVariant: (typeof CAMPER_VARIANTS)[number];

  constructor(public id: number) {
    const type = bodyType(id);
    this.model = getModel(type);
    this.root.add(this.model);
    this.root.scale.setScalar(.95);
    this.campVariant = CAMPER_VARIANTS[id % CAMPER_VARIANTS.length];
    applyCamperUniform(this.model, id, this.campVariant);
    const clips = getAnimations(type);
    this.anim = createImportedAnimation(this.model, clips);
    this.useImported = modelHasUsefulClips(this.anim);
    this.procedural = new ImportedProceduralAnimator(this.model);
    this.bubble = this.makeBubble('');
    this.root.add(this.bubble);
    this.last.copy(this.root.position);
    this.play('idle');
  }

  play(name: 'idle' | 'walk' | 'run' | 'panic' | 'carried'): void {
    if (this.state === name) return;
    this.state = name;
    if (this.useImported) {
      const aliases: Record<string, string[]> = {
        idle: ['idle', 'breathing'], walk: ['walk', 'walking'], run: ['run', 'running', 'sprint'],
        panic: ['run', 'running', 'sprint', 'walk'], carried: ['idle', 'sitting', 'sit'],
      };
      playImportedAnimation(this.anim, name, aliases[name]);
    }
  }

  showLine(text: string): void {
    const mat = this.bubble.material as THREE.SpriteMaterial;
    mat.map?.dispose(); mat.map = this.makeTexture(text); mat.needsUpdate = true;
    this.bubble.visible = true;
    window.setTimeout(() => { this.bubble.visible = false; }, 3500);
  }

  update(dt: number, target: THREE.Vector3, rescued: boolean, following: boolean): void {
    const dx = target.x - this.root.position.x, dz = target.z - this.root.position.z, speed = Math.hypot(dx, dz) / Math.max(dt, .001);
    this.root.position.lerp(target, 1 - Math.exp(-dt * 12));
    if (Math.hypot(dx, dz) > .03) this.root.rotation.y = Math.atan2(dx, dz);
    if (rescued) this.play('carried'); else if (speed > 3.9) this.play('run'); else if (speed > .35) this.play('walk'); else this.play(following ? 'panic' : 'idle');
    if (this.useImported) updateImportedAnimation(this.anim, dt);
    else this.procedural.update(this.model, this.state, dt, speed);
    this.last.copy(this.root.position);
  }

  private makeTexture(text: string): THREE.CanvasTexture {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d')!;
    x.fillStyle = '#fff5d8'; x.strokeStyle = '#2f3e34'; x.lineWidth = 7; x.beginPath(); x.roundRect(8, 8, 496, 102, 18); x.fill(); x.stroke();
    x.fillStyle = '#26362f'; x.font = '700 32px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const clipped = text.length > 42 ? `${text.slice(0, 39)}…` : text; x.fillText(clipped, 256, 58);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
  }

  private makeBubble(text: string): THREE.Sprite {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.makeTexture(text), transparent: true, depthTest: false }));
    sprite.position.set(0, 1.75, 0); sprite.scale.set(2.3, .58, 1); sprite.visible = false; return sprite;
  }
}
