import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ALWAYS_PRELOAD, MANIFEST, assetUrl, type AssetName } from './manifest';

export interface Model { object: THREE.Object3D; animations: THREE.AnimationClip[]; missing: boolean }

const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const fbxLoader = new FBXLoader();
const cache = new Map<string, Model>();
const stdCache = new Map<THREE.Material, THREE.Material>();

/** Convert imported materials to the smooth matte finish used throughout Camp Glowstick. */
function relight(m: THREE.Material): THREE.Material {
  let s = stdCache.get(m);
  if (s) return s;

  if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
    const standard = m as THREE.MeshStandardMaterial;
    standard.roughness = Math.max(0.78, standard.roughness ?? 0.9);
    standard.metalness = Math.min(0.08, standard.metalness ?? 0);
    return standard;
  }

  const src = m as THREE.Material & {
    color?: THREE.Color;
    map?: THREE.Texture | null;
    alphaMap?: THREE.Texture | null;
    transparent?: boolean;
    opacity?: number;
    side?: THREE.Side;
    vertexColors?: boolean;
  };
  s = new THREE.MeshStandardMaterial({
    map: src.map ?? null,
    alphaMap: src.alphaMap ?? null,
    color: src.color?.clone() ?? new THREE.Color(0xffffff),
    roughness: 0.9,
    metalness: 0,
    transparent: src.transparent ?? false,
    opacity: src.opacity ?? 1,
    side: src.side ?? THREE.FrontSide,
    vertexColors: src.vertexColors ?? false,
  });
  stdCache.set(m, s);
  return s;
}

/** Labelled wireframe box shown when an imported model cannot be loaded. */
export function createPlaceholder(name: string): THREE.Object3D {
  console.warn(`[assets] missing model "${name}" - showing labelled placeholder`);
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
  scene.updateMatrixWorld(true);
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

function polish(scene: THREE.Object3D): void {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.material = Array.isArray(m.material) ? m.material.map(relight) : relight(m.material);
    m.castShadow = true;
    m.receiveShadow = true;
    if (m.geometry?.attributes?.normal == null) m.geometry.computeVertexNormals();
  });
}

export async function loadModel(name: AssetName): Promise<Model> {
  const hit = cache.get(name);
  if (hit) return hit;
  let model: Model;
  try {
    const def = MANIFEST[name];
    if (def.format === 'fbx') {
      const scene = await fbxLoader.loadAsync(assetUrl(def.file));
      polish(scene);
      model = { object: normalise(scene, name), animations: scene.animations ?? [], missing: false };
    } else {
      const gltf = await gltfLoader.loadAsync(assetUrl(def.file));
      polish(gltf.scene);
      model = { object: normalise(gltf.scene, name), animations: gltf.animations, missing: false };
    }
  } catch (e) {
    console.warn(`[assets] failed to load ${name}:`, e instanceof Error ? e.message : e);
    model = { object: createPlaceholder(name), animations: [], missing: true };
  }
  cache.set(name, model);
  return model;
}

export async function preload(names: AssetName[], onProgress?: (done: number, total: number) => void): Promise<void> {
  const all = [...new Set<AssetName>([...names, ...ALWAYS_PRELOAD])];
  let done = 0;
  await Promise.all(all.map((n) => loadModel(n).then(() => onProgress?.(++done, all.length))));
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
