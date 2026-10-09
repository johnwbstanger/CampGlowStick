import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MANIFEST, assetUrl, type AssetName } from './manifest';

export interface Model { object: THREE.Object3D; animations: THREE.AnimationClip[]; missing: boolean }

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Model>();
const stdCache = new Map<THREE.Material, THREE.Material>();

/** Kenney characters ship KHR_materials_unlit; swap to lit so they react to night. */
function relight(m: THREE.Material): THREE.Material {
  if (!(m as THREE.MeshBasicMaterial).isMeshBasicMaterial) return m;
  let s = stdCache.get(m);
  if (!s) {
    const b = m as THREE.MeshBasicMaterial;
    s = new THREE.MeshStandardMaterial({ map: b.map, color: b.color, roughness: 0.9, metalness: 0, transparent: b.transparent, opacity: b.opacity, side: b.side });
    stdCache.set(m, s);
  }
  return s;
}

/** Labelled grey box shown when a GLB cannot be loaded. Never a hand-built stand-in for the real model. */
export function createPlaceholder(name: string): THREE.Object3D {
  console.warn(`[assets] missing GLB "${name}" - showing labelled placeholder`);
  const g = new THREE.Group();
  g.name = `placeholder:${name}`;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true }));
  box.position.y = 0.25;
  g.add(box);
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    if (x) { x.fillStyle = '#C15C3D'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#FFFDD0'; x.font = 'bold 28px monospace'; x.textAlign = 'center'; x.fillText(name, 128, 42); }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }));
    s.position.y = 0.9; s.scale.set(1, 0.25, 1);
    g.add(s);
  }
  return g;
}

/** Scale to the manifest size and put the pivot at bottom-centre. */
function normalise(scene: THREE.Object3D, name: AssetName): THREE.Object3D {
  const def = MANIFEST[name] as { h?: number; w?: number };
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const s = def.h ? def.h / (size.y || 1) : def.w ? def.w / (Math.max(size.x, size.z) || 1) : 1;
  const wrap = new THREE.Group();
  wrap.name = name;
  wrap.add(scene);
  scene.scale.multiplyScalar(s);
  scene.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
  return wrap;
}

export async function loadModel(name: AssetName): Promise<Model> {
  const hit = cache.get(name);
  if (hit) return hit;
  let model: Model;
  try {
    const gltf = await loader.loadAsync(assetUrl(MANIFEST[name].file));
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.material = Array.isArray(m.material) ? m.material.map(relight) : relight(m.material); m.castShadow = m.receiveShadow = true; }
    });
    model = { object: normalise(gltf.scene, name), animations: gltf.animations, missing: false };
  } catch (e) {
    console.warn(`[assets] failed to load ${name}:`, e instanceof Error ? e.message : e);
    model = { object: createPlaceholder(name), animations: [], missing: true };
  }
  cache.set(name, model);
  return model;
}

export async function preload(names: AssetName[], onProgress?: (done: number, total: number) => void): Promise<void> {
  let done = 0;
  await Promise.all(names.map((n) => loadModel(n).then(() => onProgress?.(++done, names.length))));
}

/** A fresh clone (shared geometry + materials) of a preloaded model. */
export function getModel(name: AssetName): THREE.Object3D {
  const m = cache.get(name);
  if (!m) return createPlaceholder(name);
  return clone(m.object);
}
export const getAnimations = (name: AssetName): THREE.AnimationClip[] => cache.get(name)?.animations ?? [];

/** All meshes of a preloaded model with their transform relative to the model root (for InstancedMesh). */
export function modelMeshes(name: AssetName): { mesh: THREE.Mesh; matrix: THREE.Matrix4 }[] {
  const root = cache.get(name)?.object;
  if (!root) return [];
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const out: { mesh: THREE.Mesh; matrix: THREE.Matrix4 }[] = [];
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push({ mesh: o as THREE.Mesh, matrix: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) }); });
  return out;
}
