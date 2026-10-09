import * as THREE from 'three';
import type { PlayerState } from '../net/protocol';

interface Rig {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

const palettes = [
  { shirt: 0xc8642f, shorts: 0x2f5746, accent: 0xf2d36b, skin: 0xe5b38d, hair: 0x583a29 },
  { shirt: 0xd7a42f, shorts: 0x365d4d, accent: 0xf1efe7, skin: 0xf0c7a4, hair: 0x3d2b22 },
  { shirt: 0x477b68, shorts: 0xb96a32, accent: 0xe8d7ae, skin: 0xc98768, hair: 0x221b19 },
  { shirt: 0x9f4f3b, shorts: 0x304f66, accent: 0xe5c55b, skin: 0xd8a17d, hair: 0x765438 },
  { shirt: 0x5e7d4b, shorts: 0x8a5938, accent: 0xe8c96d, skin: 0x8d5b43, hair: 0x241b17 },
  { shirt: 0xc4763c, shorts: 0x3d6552, accent: 0xf3e7c5, skin: 0xf1c9aa, hair: 0xb06b3f },
];

const materials = new Map<number, THREE.MeshStandardMaterial>();
function matte(color: number): THREE.MeshStandardMaterial {
  let m = materials.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.93, metalness: 0, flatShading: false });
    materials.set(color, m);
  }
  return m;
}

function mesh(g: THREE.BufferGeometry, color: number, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(g, matte(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function group(parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/**
 * Rounded, matte counselor silhouette inspired by the supplied astronaut/scout references:
 * long slim limbs, clean colour blocks, soft materials, and a readable stylised head.
 */
export function buildCounselor(id: number): Rig {
  const p = palettes[id % palettes.length];
  const root = new THREE.Group();
  root.name = `counselor-${id}`;

  const hips = group(root, 0, 0.96, 0);
  const torso = group(hips, 0, 0, 0);
  mesh(new THREE.CapsuleGeometry(0.22, 0.48, 6, 14), p.shirt, torso, 0, 0.28, 0).scale.set(1.0, 1.0, 0.72);
  mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.12, 16), p.shorts, torso, 0, 0.02, 0).scale.z = 0.76;

  // simple camp neckerchief / collar detail
  const neck = mesh(new THREE.CylinderGeometry(0.105, 0.075, 0.08, 12), p.accent, torso, 0, 0.62, 0.01);
  neck.rotation.y = Math.PI / 4;

  const makeArm = (side: number) => {
    const a = group(torso, side * 0.255, 0.53, 0);
    const upper = mesh(new THREE.CapsuleGeometry(0.052, 0.27, 5, 10), p.shirt, a, 0, -0.17, 0);
    upper.rotation.z = side * 0.04;
    mesh(new THREE.CapsuleGeometry(0.043, 0.25, 5, 10), p.skin, a, 0, -0.47, 0);
    mesh(new THREE.SphereGeometry(0.065, 12, 8), p.skin, a, 0, -0.67, 0);
    return a;
  };
  const armL = makeArm(1), armR = makeArm(-1);

  const makeLeg = (side: number) => {
    const l = group(root, side * 0.105, 0.94, 0);
    mesh(new THREE.CapsuleGeometry(0.075, 0.27, 5, 10), p.shorts, l, 0, -0.17, 0);
    mesh(new THREE.CapsuleGeometry(0.06, 0.42, 5, 10), p.skin, l, 0, -0.52, 0);
    const sock = mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.13, 12), 0xf0eee7, l, 0, -0.79, 0);
    sock.rotation.y = Math.PI / 12;
    const shoe = mesh(new THREE.CapsuleGeometry(0.075, 0.13, 4, 10), 0x3a3733, l, 0, -0.91, 0.055);
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.set(1.05, 1.0, 1.35);
    return l;
  };
  const legL = makeLeg(1), legR = makeLeg(-1);

  const head = group(torso, 0, 0.83, 0);
  const face = mesh(new THREE.SphereGeometry(0.205, 18, 12), p.skin, head);
  face.scale.set(0.88, 1.05, 0.84);
  // hair cap + small side mass, kept smooth rather than faceted
  const hair = mesh(new THREE.SphereGeometry(0.215, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.54), p.hair, head, 0, 0.06, -0.01);
  hair.scale.set(0.9, 0.8, 0.9);
  for (const side of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.025, 10, 7), 0x292421, head, side * 0.068, 0.01, 0.173);
  }
  mesh(new THREE.SphereGeometry(0.024, 10, 7), p.skin, head, 0, -0.035, 0.18);
  const mouth = mesh(new THREE.BoxGeometry(0.065, 0.009, 0.008), 0x70453f, head, 0, -0.09, 0.172);
  mouth.rotation.z = 0.02;

  // proportions: tall and slim, clearly larger than future camper NPCs.
  root.scale.set(0.98, 1.04, 0.98);
  return { root, torso, head, armL, armR, legL, legR };
}

export class CounselorActor {
  root: THREE.Group;
  private rig: Rig;
  private t = 0;
  private mode = 'idle';

  constructor(id: number) {
    this.rig = buildCounselor(id);
    this.root = this.rig.root;
  }

  play(name: string): void { this.mode = name; }

  update(dt: number, state?: PlayerState): void {
    this.t += dt;
    const { torso, head, armL, armR, legL, legR } = this.rig;
    const moving = this.mode === 'walk' || this.mode === 'sprint';
    const sprint = this.mode === 'sprint';
    const phase = Math.sin(this.t * (sprint ? 10 : 6));
    const amp = sprint ? 0.85 : 0.5;
    legL.rotation.x = moving ? phase * amp : 0;
    legR.rotation.x = moving ? -phase * amp : 0;
    armL.rotation.x = moving ? -phase * amp * 0.8 : Math.sin(this.t * 1.5) * 0.025;
    armR.rotation.x = moving ? phase * amp * 0.8 : -Math.sin(this.t * 1.5) * 0.025;
    torso.rotation.x = sprint ? 0.12 : 0;
    torso.position.y = moving ? Math.abs(phase) * (sprint ? 0.035 : 0.018) : Math.sin(this.t * 1.7) * 0.006;
    head.rotation.y = moving ? 0 : Math.sin(this.t * 0.55) * 0.08;
    if (state?.crouch) this.root.scale.y = 0.8; else this.root.scale.y = 1;
  }
}
