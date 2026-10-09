import * as THREE from 'three';
import { getModel, modelMeshes } from '../assets/loader';
import type { AssetName } from '../assets/manifest';
import type { Box } from './colliders';
import { WORLD_HALF } from './constants';
import { makeDecalCanvas } from './graffiti';
import type { Layout, Placed } from './layout';

export interface World { group: THREE.Group; colliders: Box[]; sizes: Map<string, THREE.Vector3> }

/** One InstancedMesh per mesh of the imported model (cheap: trees and ground tiles are a handful of draw calls). */
function instance(name: AssetName, spots: { x: number; z: number; rot: number; y?: number }[]): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Matrix4(), place = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const { mesh, matrix } of modelMeshes(name)) {
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, spots.length);
    spots.forEach((s, i) => {
      place.compose(new THREE.Vector3(s.x, s.y ?? 0, s.z), q.setFromAxisAngle(up, s.rot), new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m.multiplyMatrices(place, matrix));
    });
    im.castShadow = im.receiveShadow = true;
    im.frustumCulled = false;
    g.add(im);
  }
  return g;
}

export function sizeOf(name: AssetName): THREE.Vector3 {
  return new THREE.Box3().setFromObject(getModel(name)).getSize(new THREE.Vector3());
}

function boxOf(obj: THREE.Object3D, shrink = 0): Box {
  const b = new THREE.Box3().setFromObject(obj);
  return { minX: b.min.x + shrink, maxX: b.max.x - shrink, minZ: b.min.z + shrink, maxZ: b.max.z - shrink, minY: b.min.y, maxY: b.max.y };
}

function decal(host: THREE.Object3D, local: THREE.Box3, side: number, text: string, creepy: boolean): THREE.Mesh {
  const size = local.getSize(new THREE.Vector3()), c = local.getCenter(new THREE.Vector3());
  const tex = new THREE.CanvasTexture(makeDecalCanvas(text, creepy));
  tex.colorSpace = THREE.SRGBColorSpace;
  const alongX = side % 2 === 0, w = Math.min(alongX ? size.x : size.z, 2.6);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const y = Math.min(Math.max(size.y * 0.4, 1.0), 1.8);
  const off = 0.04;
  if (side === 0) m.position.set(c.x, y, local.max.z + off);
  else if (side === 1) { m.position.set(local.max.x + off, y, c.z); m.rotation.y = Math.PI / 2; }
  else if (side === 2) { m.position.set(c.x, y, local.min.z - off); m.rotation.y = Math.PI; }
  else { m.position.set(local.min.x - off, y, c.z); m.rotation.y = -Math.PI / 2; }
  host.add(m);
  return m;
}

export function buildWorld(layout: Layout): World {
  const group = new THREE.Group();
  const colliders: Box[] = [];
  const sizes = new Map<string, THREE.Vector3>();

  const tile = 4, n = Math.ceil((WORLD_HALF * 2) / tile) + 1, spots = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) spots.push({ x: -WORLD_HALF + i * tile, z: -WORLD_HALF + j * tile, rot: 0 });
  const ground = instance('ground', spots);
  ground.traverse((o) => { (o as THREE.Mesh).castShadow = false; });
  group.add(ground);

  const hosts: THREE.Object3D[] = [], hostBoxes: THREE.Box3[] = [];
  const place = (p: Placed) => {
    const o = getModel(p.name);
    const local = new THREE.Box3().setFromObject(o);
    o.position.set(p.x, 0, p.z); o.rotation.y = p.rot;
    group.add(o); o.updateMatrixWorld(true);
    if (p.solid) colliders.push(boxOf(o, p.name === 'campfire' ? 0.2 : 0.05));
    hosts.push(o); hostBoxes.push(local);
  };
  layout.statics.forEach(place);
  group.add(instance('tree', layout.trees.filter((t) => t.name === 'tree')));
  group.add(instance('tree2', layout.trees.filter((t) => t.name === 'tree2')));
  group.add(instance('tree3', layout.trees.filter((t) => t.name === 'tree3')));
  for (const t of layout.trees) colliders.push({ minX: t.x - 0.35, maxX: t.x + 0.35, minZ: t.z - 0.35, maxZ: t.z + 0.35, minY: 0, maxY: 6 });

  // decals are attached to cabins (statics 1..4) and the shed (static 5)
  for (const d of layout.decals) {
    const idx = d.host < 4 ? 1 + d.host : 5;
    decal(hosts[idx], hostBoxes[idx], d.side, d.text, d.creepy);
  }

  const tex = document.createElement('canvas');
  tex.width = 256; tex.height = 128;
  const x = tex.getContext('2d')!;
  x.fillStyle = '#E09F3E'; x.globalAlpha = 0.55; x.fillRect(0, 0, 256, 128);
  x.globalAlpha = 1; x.strokeStyle = '#FFFDD0'; x.lineWidth = 6; x.strokeRect(6, 6, 244, 116);
  x.fillStyle = '#1A3A2B'; x.font = 'bold 40px "Courier New"'; x.textAlign = 'center'; x.fillText('EXTRACT', 128, 78);
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(layout.extraction.r * 2, layout.extraction.r), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(tex), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(layout.extraction.x, 0.03, layout.extraction.z);
  group.add(mark);

  for (const s of layout.items) if (!sizes.has(s.model)) sizes.set(s.model, sizeOf(s.model));
  return { group, colliders, sizes };
}
