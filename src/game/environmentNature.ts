import * as THREE from 'three';
import { natureMeshParts, natureVariants, preloadNatureMegakit, type LoadedNature, type NatureCategory } from '../assets/natureMegakit';
import { semanticScatter } from '../worldgen/placement';
import type { Layout, Placed } from './layout';
import { mulberry32 } from './layout';
import { WORLD_HALF } from './constants';
import { terrainHeight, terrainSlope } from './terrain';

const touchLike = typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || /iPad|iPhone|Android/i.test(navigator.userAgent));

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  if (l2 <= 1e-8) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
function nearRoad(layout: Layout, x: number, z: number, margin = 0): boolean {
  return layout.roads.some((road) => road.points.slice(1).some(([bx, bz], i) => {
    const [ax, az] = road.points[i];
    return distToSegment(x, z, ax, az, bx, bz) < road.width * .5 + margin;
  }));
}
function inClearing(layout: Layout, x: number, z: number, margin = 0): boolean {
  return layout.clearings.some((c) => ((x - c.x) / (c.rx + margin)) ** 2 + ((z - c.z) / (c.rz + margin)) ** 2 < 1);
}
function inLake(layout: Layout, x: number, z: number, margin = 0): boolean {
  const w = layout.water;
  return ((x - w.x) / (w.rx + margin)) ** 2 + ((z - w.z) / (w.rz + margin)) ** 2 < 1;
}

interface NatureSpot { x: number; z: number; rot: number; scale: number }

function instanceVariant(model: LoadedNature, spots: NatureSpot[]): THREE.Group {
  const group = new THREE.Group();
  const place = new THREE.Matrix4(), final = new THREE.Matrix4();
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3();
  for (const part of natureMeshParts(model)) {
    const im = new THREE.InstancedMesh(part.mesh.geometry, part.mesh.material, spots.length);
    im.name = `qnm:${model.entry.id}`;
    for (let i = 0; i < spots.length; i++) {
      const p = spots[i];
      q.setFromAxisAngle(up, p.rot);
      s.setScalar(p.scale);
      place.compose(new THREE.Vector3(p.x, terrainHeight(p.x, p.z), p.z), q, s);
      im.setMatrixAt(i, final.multiplyMatrices(place, part.matrix));
    }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = !touchLike && model.entry.category === 'tree';
    im.receiveShadow = true;
    im.frustumCulled = true;
    group.add(im);
  }
  return group;
}

function distribute(models: LoadedNature[], spots: NatureSpot[], seed: number): THREE.Group {
  const group = new THREE.Group();
  if (!models.length || !spots.length) return group;
  const rng = mulberry32(seed);
  const buckets = new Map<LoadedNature, NatureSpot[]>();
  for (const model of models) buckets.set(model, []);
  for (const spot of spots) {
    const model = models[Math.floor(rng() * models.length) % models.length];
    buckets.get(model)!.push(spot);
  }
  for (const [model, placements] of buckets) if (placements.length) group.add(instanceVariant(model, placements));
  return group;
}

function makeScatter(layout: Layout, category: NatureCategory, count: number, minDistance: number, seedSalt: number, margin: number): NatureSpot[] {
  const limit = touchLike ? Math.round(count * .58) : count;
  const points = semanticScatter({
    seed: (layout.seed ^ seedSalt) >>> 0,
    width: WORLD_HALF * 2 - 10,
    height: WORLD_HALF * 2 - 10,
    originX: -WORLD_HALF + 5,
    originZ: -WORLD_HALF + 5,
    minDistance,
    maxDistance: minDistance * 1.75,
    maxCount: Math.ceil(limit * 2.2),
    accept: (x, z) => !nearRoad(layout, x, z, margin) && !inClearing(layout, x, z, margin) && !inLake(layout, x, z, category === 'understory' ? 1 : 4) && terrainSlope(x, z) < (category === 'rock' ? .68 : .48),
  });
  const rng = mulberry32((layout.seed + seedSalt) >>> 0);
  return points.slice(0, limit).map(([x, z]) => ({ x, z, rot: rng() * Math.PI * 2, scale: category === 'understory' ? .62 + rng() * .68 : .72 + rng() * .72 }));
}

function canopySpots(trees: Placed[]): NatureSpot[] {
  const count = touchLike ? Math.min(trees.length, 620) : trees.length;
  return trees.slice(0, count).map((t) => ({ x: t.x, z: t.z, rot: t.rot, scale: t.scale ?? 1 }));
}

/**
 * Replaces the old three-tree presentation with the imported CC0 MegaKit while keeping authored
 * canopy anchors/colliders deterministic. Understory/deadwood/rocks are added as separate ecological
 * layers instead of being baked into the gameplay collision list.
 */
export async function attachImportedNature(group: THREE.Group, layout: Layout, legacyCanopy?: THREE.Object3D): Promise<boolean> {
  await preloadNatureMegakit();
  const trees = natureVariants('tree');
  if (!trees.length) return false;

  const layer = new THREE.Group();
  layer.name = 'imported-quaternius-nature';
  layer.add(distribute(trees, canopySpots(layout.trees), layout.seed ^ 0x54a3));

  const understory = natureVariants('understory');
  if (understory.length) layer.add(distribute(understory, makeScatter(layout, 'understory', 1300, 1.45, 0x8a11, .7), layout.seed ^ 0x8a11));

  const rocks = natureVariants('rock');
  if (rocks.length) layer.add(distribute(rocks, makeScatter(layout, 'rock', 180, 5.2, 0x22f1, 2.4), layout.seed ^ 0x22f1));

  const deadwood = natureVariants('deadwood');
  if (deadwood.length) layer.add(distribute(deadwood, makeScatter(layout, 'deadwood', 120, 5.8, 0x19c7, 2.0), layout.seed ^ 0x19c7));

  group.add(layer);
  if (legacyCanopy) legacyCanopy.visible = false;
  return true;
}
