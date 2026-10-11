import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type BuildingModuleCategory = 'wall' | 'door' | 'window' | 'roof' | 'floor' | 'stairs' | 'structure' | 'fence' | 'porch';
interface CatalogEntry { id: string; file: string; category: BuildingModuleCategory; license: string }
interface Catalog { entries: CatalogEntry[] }
export interface BuildingModule { entry: CatalogEntry; root: THREE.Object3D; size: THREE.Vector3 }

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const models = new Map<string, BuildingModule>();
let ready = false;
const base = () => `${import.meta.env.BASE_URL}assets/`;

function normalize(scene: THREE.Object3D): { root: THREE.Object3D; size: THREE.Vector3 } {
  scene.updateMatrixWorld(true);
  const original = new THREE.Box3().setFromObject(scene);
  const c = original.getCenter(new THREE.Vector3());
  const root = new THREE.Group(); root.add(scene);
  scene.position.set(-c.x, -original.min.y, -c.z);
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = true;
    const materials = Array.isArray(m.material) ? m.material : [m.material];
    for (const material of materials) {
      if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const sm = material as THREE.MeshStandardMaterial;
        sm.roughness = Math.max(.78, sm.roughness ?? .85);
        sm.metalness = Math.min(.06, sm.metalness ?? 0);
      }
    }
  });
  root.updateMatrixWorld(true);
  return { root, size: new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()) };
}

export async function preloadBuildingKit(): Promise<void> {
  if (ready) return;
  try {
    const r = await fetch(`${base()}buildings/quaternius-modular/catalog.json`);
    if (!r.ok) throw new Error(`${r.status} catalog`);
    const catalog = await r.json() as Catalog;
    const quotas: Record<BuildingModuleCategory, number> = { wall: 6, door: 4, window: 5, roof: 6, floor: 3, stairs: 3, structure: 5, fence: 2, porch: 3 };
    const selected: CatalogEntry[] = [];
    for (const category of Object.keys(quotas) as BuildingModuleCategory[]) {
      const candidates = (catalog.entries ?? []).filter((e) => e.category === category);
      const step = Math.max(1, Math.floor(candidates.length / Math.max(1, quotas[category])));
      for (let i = 0; i < candidates.length && selected.filter((e) => e.category === category).length < quotas[category]; i += step) selected.push(candidates[i]);
    }
    await Promise.all(selected.map(async (entry) => {
      try {
        const gltf = await loader.loadAsync(`${base()}${entry.file}`);
        const normalized = normalize(gltf.scene);
        models.set(entry.id, { entry, ...normalized });
      } catch (error) {
        console.warn(`[buildings] failed ${entry.id}`, error instanceof Error ? error.message : error);
      }
    }));
  } catch (error) {
    console.warn('[buildings] imported modular kit unavailable', error instanceof Error ? error.message : error);
  } finally { ready = true; }
}

export function buildingModules(category: BuildingModuleCategory): BuildingModule[] {
  return [...models.values()].filter((m) => m.entry.category === category);
}
export function cloneBuildingModule(module: BuildingModule): THREE.Object3D { return clone(module.root); }

/** Fits authored module detail into a semantic slot without changing gameplay coordinates/collision. */
export function fittedBuildingModule(module: BuildingModule, x: number, y: number, z: number): THREE.Object3D {
  const o = cloneBuildingModule(module);
  const sx = x / Math.max(module.size.x, .01), sy = y / Math.max(module.size.y, .01), sz = z / Math.max(module.size.z, .01);
  o.scale.set(sx, sy, sz);
  return o;
}
