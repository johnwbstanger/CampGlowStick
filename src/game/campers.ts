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
  { id: 'top-bunk', name: 'Tammy “Top Bunk”', blurb: 'Claims the top bunk before anyone else.', female: true },
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

const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
const CAMP_COLORS = ['#E3B447', '#2E6B68', '#C15C3D', '#6F7951', '#D8C9A0', '#496E83'];

const assetFor = (spec: CamperSpec): AssetName => {
  const h = hash(spec.id);
  if (spec.adult) {
    const male: AssetName[] = ['counselorMale', 'counselorMaleCasual', 'counselorMaleBeach'];
    const female: AssetName[] = ['counselorFemale', 'counselorFemaleCasual'];
    const pool = spec.female ? female : male;
    return pool[h % pool.length];
  }
  const male: AssetName[] = ['camperMale', 'camperMaleVariant'];
  const female: AssetName[] = ['camperFemale', 'camperFemaleVariant'];
  const pool = spec.female ? female : male;
  return pool[h % pool.length];
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
  return camper.actions.values().next().value;
}

function tintCampUniform(model: THREE.Object3D, spec: CamperSpec): void {
  const tint = new THREE.Color(CAMP_COLORS[hash(spec.id) % CAMP_COLORS.length]);
  let i = 0;
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const mapped = list.map((mat) => {
      const cloned = mat.clone();
      if ((cloned as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const sm = cloned as THREE.MeshStandardMaterial;
        if ((i++ % 3) === 0) sm.color.lerp(tint, spec.adult ? .28 : .22);
        sm.roughness = Math.max(.78, sm.roughness ?? .85);
        sm.metalness = Math.min(.04, sm.metalness ?? 0);
      }
      return cloned;
    });
    mesh.material = Array.isArray(mesh.material) ? mapped : mapped[0];
  });
}

export function buildCamper(spec: CamperSpec): Camper {
  const asset = assetFor(spec);
  const model = getModel(asset);
  tintCampUniform(model, spec);
  const root = new THREE.Group();
  root.name = spec.adult ? `counselor:${spec.id}` : `camper:${spec.id}`;
  model.name = `${asset}:${spec.id}`;
  root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of getAnimations(asset)) actions.set(clip.name.toLowerCase(), mixer.clipAction(clip));
  const camper: Camper = { root, model, mixer, actions, current: 'idle', spec };
  actionFor(camper, 'idle')?.play();
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
  if (!camper.actions.size) camper.model.position.y = pose === 'idle' ? Math.sin(t * 1.8) * .006 : 0;
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
    const pose: Pose = hiding ? 'idle' : moving ? (scared ? 'run' : 'walk') : scared ? 'scared' : 'idle';
    poseCamper(this.camper, pose, this.t);
    this.camper.mixer.update(Math.max(0, dt - 1 / 60));
  }
}
