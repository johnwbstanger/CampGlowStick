import * as THREE from 'three';

const palettes = [
  { shirt: 0xe9b83f, shorts: 0x3d654e, skin: 0xf0c3a0, hair: 0x7a3f2d, accent: 0x294e3d },
  { shirt: 0xd7654d, shorts: 0x365f77, skin: 0xd79c78, hair: 0x3e2a20, accent: 0xf0d774 },
  { shirt: 0x4d8b75, shorts: 0xc27d3c, skin: 0x8f604b, hair: 0x201916, accent: 0xf3e8ca },
  { shirt: 0xd8953f, shorts: 0x5a4f76, skin: 0xf1c8aa, hair: 0xc36a44, accent: 0x365a49 },
  { shirt: 0x5c7fa4, shorts: 0x735034, skin: 0xc98b69, hair: 0x2e211b, accent: 0xefca58 },
  { shirt: 0xc85c72, shorts: 0x3f674e, skin: 0xe5b28d, hair: 0x5b3527, accent: 0xf1dfaa },
  { shirt: 0x7a9a54, shorts: 0xb86636, skin: 0x9c684f, hair: 0x1e1917, accent: 0xf3d56f },
];

function mat(color: number) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0, flatShading: false });
}
function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}

export class CamperActor {
  root = new THREE.Group();
  private leftLeg = new THREE.Group();
  private rightLeg = new THREE.Group();
  private leftArm = new THREE.Group();
  private rightArm = new THREE.Group();
  private t = 0;

  constructor(public id: number) {
    const p = palettes[id % palettes.length];
    const body = new THREE.Group();
    body.position.y = 0.72;
    this.root.add(body);

    const torso = add(body, new THREE.CapsuleGeometry(0.19, 0.33, 6, 14), p.shirt, 0, 0.26, 0);
    torso.scale.z = 0.72;
    add(body, new THREE.CylinderGeometry(0.19, 0.17, 0.11, 14), p.shorts, 0, 0.02, 0).scale.z = 0.72;

    const scarf = add(body, new THREE.TorusGeometry(0.09, 0.018, 6, 16), p.accent, 0, 0.49, 0.02);
    scarf.rotation.x = Math.PI / 2;

    const mkArm = (side: number, group: THREE.Group) => {
      group.position.set(side * 0.215, 0.43, 0); body.add(group);
      add(group, new THREE.CapsuleGeometry(0.043, 0.19, 5, 10), p.shirt, 0, -0.12, 0);
      add(group, new THREE.CapsuleGeometry(0.037, 0.17, 5, 10), p.skin, 0, -0.32, 0);
      add(group, new THREE.SphereGeometry(0.053, 10, 8), p.skin, 0, -0.46, 0);
    };
    mkArm(1, this.leftArm); mkArm(-1, this.rightArm);

    const mkLeg = (side: number, group: THREE.Group) => {
      group.position.set(side * 0.085, 0.71, 0); this.root.add(group);
      add(group, new THREE.CapsuleGeometry(0.06, 0.2, 5, 10), p.shorts, 0, -0.12, 0);
      add(group, new THREE.CapsuleGeometry(0.05, 0.24, 5, 10), p.skin, 0, -0.34, 0);
      const shoe = add(group, new THREE.CapsuleGeometry(0.06, 0.09, 4, 10), 0x3a3733, 0, -0.52, 0.035);
      shoe.rotation.x = Math.PI / 2; shoe.scale.z = 1.35;
    };
    mkLeg(1, this.leftLeg); mkLeg(-1, this.rightLeg);

    const head = new THREE.Group(); head.position.set(0, 0.71, 0); body.add(head);
    const face = add(head, new THREE.SphereGeometry(0.18, 18, 12), p.skin);
    face.scale.set(0.9, 1.02, 0.86);
    const hair = add(head, new THREE.SphereGeometry(0.188, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), p.hair, 0, 0.055, -0.005);
    hair.scale.y = 0.82;
    add(head, new THREE.SphereGeometry(0.022, 9, 7), 0x2a2421, -0.058, 0.01, 0.155);
    add(head, new THREE.SphereGeometry(0.022, 9, 7), 0x2a2421, 0.058, 0.01, 0.155);
    add(head, new THREE.BoxGeometry(0.055, 0.008, 0.008), 0x70453f, 0, -0.075, 0.158);

    this.root.scale.setScalar(0.9 + (id % 3) * 0.035);
    this.root.name = `camper-${id}`;
  }

  update(dt: number, moving: boolean, scared = false): void {
    this.t += dt;
    const phase = Math.sin(this.t * (moving ? 7 : 2));
    const a = moving ? 0.55 : 0.025;
    this.leftLeg.rotation.x = phase * a; this.rightLeg.rotation.x = -phase * a;
    this.leftArm.rotation.x = -phase * a * 0.75; this.rightArm.rotation.x = phase * a * 0.75;
    this.root.rotation.z = scared ? Math.sin(this.t * 10) * 0.025 : 0;
  }
}
