import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type NatureCategory = 'tree' | 'understory' | 'rock' | 'deadwood' | 'nature';
export interface NatureCatalogEntry {
  id: string;
  file: string;
  category: NatureCategory;
  license: string;
  collider: string;
}
interface NatureCatalog { entries: NatureCatalogEntry[] }
export interface LoadedNature { entry: NatureCatalogEntry; root: THREE.Object3D; size: THREE.Vector3 }
export interface NatureMeshPart { mesh: THREE.Mesh; matrix: THREE.Matrix4 }

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const loaded = new Map<string, LoadedNature>();
let catalog: NatureCatalogEntry[] = [];
let ready = false;
const base = () => `${import.meta.env.BASE_URL}assets/`;

function standardise(root: THREE.Object3D): { root: THREE.Object3D; size: THREE.Vector3 } {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z, 0.001);
  const scale = largest > 40 ? 10 / largest : largest < 0.08 ? 1 / largest : 1;
  const wrap = new THREE.Group();
  wrap.add(root);
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(root);
  const c = scaled.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= scaled.min.y;
  wrap.updateMatrixWorld(true);
  wrap.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const sm = m as THREE.MeshStandardMaterial;
        sm.roughness = Math.max(0.76, sm.roughness ?? 0.85);
        sm.metalness = Math.min(0.05, sm.metalness ?? 0);
      }
    }
  });
  return { root: wrap, size: new THREE.Box3().setFromObject(wrap).getSize(new THREE.Vector3()) };
}

/**
 * Loads a curated cross-section of the imported CC0 MegaKit. The importer catalogs the complete
 * free pack; runtime samples variants so initial browser downloads stay bounded.
 */
export async function preloadNatureMegakit(): Promise<void> {
  if (ready) return;
  try {
    const response = await fetch(`${base()}nature/quaternius-megakit/catalog.json`);
    if (!response.ok) throw new Error(`${response.status} catalog`);
    const data = await response.json() as NatureCatalog;
    catalog = data.entries ?? [];
    const quota: Record<NatureCategory, number> = { tree: 10, understory: 10, rock: 6, deadwood: 4, nature: 3 };
    const selected: NatureCatalogEntry[] = [];
    for (const category of Object.keys(quota) as NatureCategory[]) {
      const candidates = catalog.filter((e) => e.category === category);
      if (!candidates.length) continue;
      const step = Math.max(1, Math.floor(candidates.length / quota[category]));
      for (let i = 0; i < candidates.length && selected.filter((e) => e.category === category).length < quota[category]; i += step) selected.push(candidates[i]);
    }
    await Promise.all(selected.map(async (entry) => {
      try {
        const gltf = await loader.loadAsync(`${base()}${entry.file}`);
        const { root, size } = standardise(gltf.scene);
        loaded.set(entry.id, { entry, root, size });
      } catch (error) {
        console.warn(`[nature] failed ${entry.id}`, error instanceof Error ? error.message : error);
      }
    }));
  } catch (error) {
    console.warn('[nature] Quaternius MegaKit unavailable; legacy vegetation fallback remains active', error instanceof Error ? error.message : error);
  } finally {
    ready = true;
  }
}

export function natureVariants(category: NatureCategory): LoadedNature[] {
  return [...loaded.values()].filter((m) => m.entry.category === category);
}

export function natureMeshParts(model: LoadedNature): NatureMeshPart[] {
  model.root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(model.root.matrixWorld).invert();
  const parts: NatureMeshPart[] = [];
  model.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    parts.push({ mesh, matrix: new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld) });
  });
  return parts;
}

export function natureClone(model: LoadedNature): THREE.Object3D { return clone(model.root); }
export function natureCatalogSize(): number { return catalog.length; }
