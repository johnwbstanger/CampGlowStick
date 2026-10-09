import * as THREE from 'three';

const skin = new THREE.MeshStandardMaterial({ color: 0x47433d, roughness: 0.98, metalness: 0 });
const dark = new THREE.MeshStandardMaterial({ color: 0x111513, roughness: 1, metalness: 0 });
const bone = new THREE.MeshStandardMaterial({ color: 0x8b8779, roughness: 0.95, metalness: 0 });
const eye = new THREE.MeshStandardMaterial({ color: 0xe7d9a6, emissive: 0xb8aa72, emissiveIntensity: 2.6, roughness: 0.55 });

function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function joint(parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

/**
 * Tall, gaunt, almost-human camp creature. It avoids the toy/zombie silhouette by using an
 * asymmetrical hunched torso, overlong forearms, narrow legs and a face that reads mostly as a void.
 */
export class CreatureActor {
  root = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private t = 0;
  private mode = 'idle';

  constructor() {
    this.root.name = 'glowstick-creature';
    this.body.position.y = 1.55;
    this.body.rotation.x = -0.20;
    this.root.add(this.body);

    const torso = part(this.body, new THREE.CapsuleGeometry(.24, .95, 7, 16), skin, 0, .15, 0);
    torso.scale.set(.72, 1.0, .58);
    part(this.body, new THREE.SphereGeometry(.27, 16, 12), bone, 0, .58, -.02).scale.set(.78, .42, .58);

    this.head = joint(this.body, 0, .92, -.10);
    const skull = part(this.head, new THREE.SphereGeometry(.22, 18, 13), bone);
    skull.scale.set(.72, 1.12, .72);
    const face = part(this.head, new THREE.SphereGeometry(.17, 16, 10), dark, 0, -.02, .14);
    face.scale.set(.72, .88, .30);
    part(this.head, new THREE.SphereGeometry(.018, 10, 8), eye, -.052, .035, .192);
    part(this.head, new THREE.SphereGeometry(.018, 10, 8), eye, .052, .035, .192);
    const mouth = part(this.head, new THREE.BoxGeometry(.11, .018, .012), dark, 0, -.095, .185);
    mouth.rotation.z = -.08;

    const makeArm = (side: number, root: THREE.Group) => {
      root.position.set(side * .24, .62, -.02); root.rotation.z = side * .12; this.body.add(root);
      const upper = part(root, new THREE.CapsuleGeometry(.055, .58, 6, 12), skin, 0, -.32, 0); upper.rotation.z = side * .04;
      const elbow = joint(root, 0, -.66, 0);
      const fore = part(elbow, new THREE.CapsuleGeometry(.048, .72, 6, 12), bone, 0, -.39, .02); fore.rotation.z = -side * .06;
      const hand = part(elbow, new THREE.SphereGeometry(.09, 12, 9), bone, 0, -.82, .03); hand.scale.set(.72, 1.65, .60);
      for (let i = -1; i <= 1; i++) {
        const finger = part(elbow, new THREE.CapsuleGeometry(.013, .20, 4, 7), bone, i * .034, -.95, .04);
        finger.rotation.z = i * .14;
      }
    };
    makeArm(1, this.armL); makeArm(-1, this.armR);

    const makeLeg = (side: number, root: THREE.Group) => {
      root.position.set(side * .105, 1.48, 0); this.root.add(root);
      part(root, new THREE.CapsuleGeometry(.068, .63, 6, 12), skin, 0, -.34, 0);
      const knee = joint(root, 0, -.7, 0);
      part(knee, new THREE.CapsuleGeometry(.055, .66, 6, 12), bone, 0, -.36, .015);
      const foot = part(knee, new THREE.CapsuleGeometry(.07, .24, 5, 10), dark, 0, -.73, .11);
      foot.rotation.x = Math.PI / 2; foot.scale.z = 1.5;
    };
    makeLeg(1, this.legL); makeLeg(-1, this.legR);

    this.root.scale.set(1.03, 1.08, 1.03);
  }

  play(mode: string): void { this.mode = mode; }

  update(dt: number): void {
    this.t += dt;
    const chase = this.mode === 'sprint' || this.mode === 'chase';
    const moving = this.mode !== 'idle';
    const rate = chase ? 10.5 : moving ? 5.5 : 1.4;
    const stride = Math.sin(this.t * rate);
    const a = chase ? .82 : moving ? .45 : .03;
    this.legL.rotation.x = stride * a; this.legR.rotation.x = -stride * a;
    // Arms lag and swing too far, giving a loose marionette feel.
    this.armL.rotation.x = -stride * a * 1.18 - (chase ? .28 : .08);
    this.armR.rotation.x = stride * a * 1.05 - (chase ? .34 : .05);
    this.armL.rotation.z = .12 + Math.sin(this.t * 2.1) * .045;
    this.armR.rotation.z = -.15 + Math.sin(this.t * 1.7 + 1) * .055;
    this.body.rotation.x = -0.20 - (chase ? .20 : .02) + Math.abs(stride) * (moving ? .035 : .006);
    this.body.rotation.z = Math.sin(this.t * (chase ? 4.5 : 1.2)) * (chase ? .06 : .025);
    this.head.rotation.y = Math.sin(this.t * (chase ? 2.7 : .55)) * (chase ? .10 : .18);
    this.head.rotation.z = Math.sin(this.t * .7) * .07;
    this.root.position.y += 0; // anchor stays host-authoritative; animation never changes network position.
  }
}
