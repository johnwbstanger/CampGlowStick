import * as THREE from 'three';
import { getAnimations, getModel } from '../assets/loader';
import type { AssetName } from '../assets/manifest';

export type Pose = 'idle' | 'walk' | 'run' | 'hide' | 'scared';

export interface CamperSpec {
  id: string;
  name: string;
  blurb: string;
  adult?: boolean;
  female?: boolean;
}

export interface Camper {
  root: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  current: Pose;
  spec: CamperSpec;
}

export const CAMPERS: CamperSpec[] = [
  { id: 'sunshine', name: 'Randy “Sunshine”', blurb: 'Acts brave until the woods answer back.' },
  { id: 'top-bunk', name: 'Tammy “Top Bunk”', blurb: 'Claims the top bunk before anyone else.' , female: true },
  { id: 'bunk-rat', name: 'Mikey “Bunk Rat”', blurb: 'Knows every hiding place in camp.' },
  { id: 'carrot', name: 'Kevin “Carrot”', blurb: 'Always carrying contraband snacks.' },
  { id: 'tube-socks', name: 'Jenny “Tube Socks”', blurb: 'Fast, loud, and impossible to miss.', female: true },
  { id: 'sprinter', name: 'Chip “Sprinter”', blurb: 'Runs first and asks questions later.' },
  { id: 'big-t', name: 'Tony “Big T”', blurb: 'The kid everybody expects to keep calm.' },
];

export const COUNSELORS: CamperSpec[] = [
  { id: 'hank', name: 'Ranger Hank', blurb: 'Senior counselor.', adult: true },
  { id: 'maria', name: 'Maria', blurb: 'Waterfront counselor.', adult: true, female: true },
  { id: 'doc', name: 'Doc', blurb: 'First-aid counselor.', adult: true },
  { id: 'june', name: 'June', blurb: 'Cabin counselor.', adult: true, female: true },
  { id: 'big-al', name: 'Big Al', blurb: 'Maintenance counselor.', adult: true },
  { id: 'tess', name: 'Tess', blurb: 'Activities counselor.', adult: true, female: true },
];

const assetFor = (spec: CamperSpec): AssetName => {
  if (spec.adult) return spec.female ? 'counselorFemale' : 'counselorMale';
  return spec.female ? 'camperFemale' : 'camperMale';
};

const clipWords = (pose: Pose): string[] => {
  if (pose === 'run') return ['run', 'sprint', 'jog'];
  if (pose === 'walk') return ['walk'];
  if (pose === 'hide') return ['crouch', 'duck', 'hide'];
  if (pose === 'scared') return ['scared', 'fear', 'nervous', 'idle'];
  return ['idle', 'stand'];
};

function actionFor(camper: Camper, pose: Pose): THREE.AnimationAction | undefined {
  const words = clipWords(pose);
  for (const [name, action] of camper.actions) if (words.some((w) => name.includes(w))) return action;
  // Some source FBXs contain a single generic take. Use it rather than dropping the rig entirely.
  return camper.actions.values().next().value;
}

/**
 * Production character builder backed by preloaded CC0 Quaternius skinned FBX assets.
 * This deliberately replaces the old runtime SDF/surface-net polygonizer: geometry/materials are
 * loaded once, cloned with SkeletonUtils by the asset loader, and shared across all seven campers.
 */
export function buildCamper(spec: CamperSpec): Camper {
  const asset = assetFor(spec);
  const model = getModel(asset);
  const root = new THREE.Group();
  root.name = spec.adult ? `counselor:${spec.id}` : `camper:${spec.id}`;
  model.name = `${asset}:${spec.id}`;
  root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of getAnimations(asset)) actions.set(clip.name.toLowerCase(), mixer.clipAction(clip));
  const camper: Camper = { root, model, mixer, actions, current: 'idle', spec };
  const idle = actionFor(camper, 'idle');
  idle?.play();
  return camper;
}

export function poseCamper(camper: Camper, pose: Pose, t: number): void {
  if (camper.current !== pose) {
    const next = actionFor(camper, pose);
    if (next) {
      for (const a of camper.actions.values()) if (a !== next) a.fadeOut(.12);
      next.reset().fadeIn(.12).play();
    }
    camper.current = pose;
  }
  camper.mixer.update(1 / 60);
  if (!camper.actions.size) {
    // Cheap fallback motion only. No runtime mesh generation/deformation.
    camper.model.position.y = pose === 'idle' ? Math.sin(t * 1.8) * .006 : 0;
  }
}

export class CamperActor {
  root: THREE.Group;
  private camper: Camper;
  private t = 0;

  constructor(public id: number) {
    this.camper = buildCamper(CAMPERS[id % CAMPERS.length]);
    this.root = this.camper.root;
    this.root.name = `camper-${id}`;
  }

  update(dt: number, moving: boolean, scared = false, hiding = false): void {
    this.t += dt;
    // Default undiscovered state is neutral, arms-down. Cover-specific anchors can opt into hide
    // later; being undiscovered by itself is not an animation instruction.
    const pose: Pose = hiding ? 'idle' : moving ? (scared ? 'run' : 'walk') : scared ? 'scared' : 'idle';
    poseCamper(this.camper, pose, this.t);
    this.camper.mixer.update(Math.max(0, dt - 1 / 60));
  }
}
