import * as THREE from 'three';
import { type AssetName, MANIFEST } from '../assets/manifest';
import { getAnimations, getModel } from '../assets/loader';

const CAMP_PALETTE = ['#E3B447', '#2E6B68', '#C15C3D', '#6F7951', '#D8C9A0', '#496E83'];
const TYPES: AssetName[] = ['counselorMale', 'counselorFemale', 'counselorMaleCasual', 'counselorMaleBeach', 'counselorFemaleCasual'];

export const counselorType = (id: number): AssetName => TYPES[Math.abs(id) % TYPES.length];

export function makeCounselor(id: number): { root: THREE.Group; bodyRoot: THREE.Object3D; animations: THREE.AnimationClip[]; type: AssetName } {
  const type = counselorType(id), root = new THREE.Group(), bodyRoot = getModel(type);
  const accent = new THREE.Color(CAMP_PALETTE[Math.abs(id) % CAMP_PALETTE.length]);
  bodyRoot.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = mats.map((m, i) => {
      const cloned = m.clone();
      if ((cloned as THREE.MeshStandardMaterial).isMeshStandardMaterial && i % 3 === 0) {
        const sm = cloned as THREE.MeshStandardMaterial;
        sm.color.lerp(accent, .28); sm.roughness = Math.max(.78, sm.roughness ?? .85); sm.metalness = Math.min(.04, sm.metalness ?? 0);
      }
      return cloned;
    });
  });
  root.add(bodyRoot);
  return { root, bodyRoot, animations: getAnimations(type), type };
}

export const counselorTypesAvailable = (): boolean => TYPES.every((t) => t in MANIFEST);
