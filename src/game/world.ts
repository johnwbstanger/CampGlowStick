import * as THREE from 'three';
import { getModel, modelMeshes } from '../assets/loader';
import type { AssetName } from '../assets/manifest';
import type { Box } from './colliders';
import { WORLD_HALF } from './constants';
import { makeDecalCanvas } from './graffiti';
import type { Layout, Placed } from './layout';
import { terrainHeight } from './terrain';

export interface World { group: THREE.Group; colliders: Box[]; sizes: Map<string, THREE.Vector3> }

function instance(name: AssetName, spots: { x: number; z: number; rot: number; y?: number }[]): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Matrix4(), place = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const { mesh, matrix } of modelMeshes(name)) {
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, spots.length);
    spots.forEach((s, i) => {
      place.compose(new THREE.Vector3(s.x, s.y ?? 0, s.z), q.setFromAxisAngle(up, s.rot), new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m.multiplyMatrices(place, matrix));
    });
    im.castShadow = im.receiveShadow = true; im.frustumCulled = false; g.add(im);
  }
  return g;
}

export function sizeOf(name: AssetName): THREE.Vector3 { return new THREE.Box3().setFromObject(getModel(name)).getSize(new THREE.Vector3()); }
function boxOf(obj: THREE.Object3D, shrink = 0): Box {
  const b = new THREE.Box3().setFromObject(obj);
  return { minX: b.min.x + shrink, maxX: b.max.x - shrink, minZ: b.min.z + shrink, maxZ: b.max.z - shrink, minY: b.min.y, maxY: b.max.y };
}
function pushBox(out: Box[], minX: number, maxX: number, minZ: number, maxZ: number, minY: number, maxY: number) {
  if (maxX > minX && maxZ > minZ) out.push({ minX, maxX, minZ, maxZ, minY, maxY });
}

/** Replace one giant building AABB with perimeter walls and a front-door gap. */
function hollowBuildingColliders(out: Box[], b: Box, rot: number, door = 1.55): void {
  const t = 0.22, h0 = b.minY, h1 = b.maxY;
  const fx = Math.sin(rot), fz = Math.cos(rot);
  if (Math.abs(fz) >= Math.abs(fx)) {
    const frontMax = fz >= 0, zFront = frontMax ? b.maxZ : b.minZ;
    const zBack = frontMax ? b.minZ : b.maxZ;
    pushBox(out, b.minX, b.maxX, zBack - t / 2, zBack + t / 2, h0, h1);
    pushBox(out, b.minX - t / 2, b.minX + t / 2, b.minZ, b.maxZ, h0, h1);
    pushBox(out, b.maxX - t / 2, b.maxX + t / 2, b.minZ, b.maxZ, h0, h1);
    const cx = (b.minX + b.maxX) / 2;
    pushBox(out, b.minX, cx - door / 2, zFront - t / 2, zFront + t / 2, h0, h1);
    pushBox(out, cx + door / 2, b.maxX, zFront - t / 2, zFront + t / 2, h0, h1);
  } else {
    const frontMax = fx >= 0, xFront = frontMax ? b.maxX : b.minX;
    const xBack = frontMax ? b.minX : b.maxX;
    pushBox(out, xBack - t / 2, xBack + t / 2, b.minZ, b.maxZ, h0, h1);
    pushBox(out, b.minX, b.maxX, b.minZ - t / 2, b.minZ + t / 2, h0, h1);
    pushBox(out, b.minX, b.maxX, b.maxZ - t / 2, b.maxZ + t / 2, h0, h1);
    const cz = (b.minZ + b.maxZ) / 2;
    pushBox(out, xFront - t / 2, xFront + t / 2, b.minZ, cz - door / 2, h0, h1);
    pushBox(out, xFront - t / 2, xFront + t / 2, cz + door / 2, b.maxZ, h0, h1);
  }
}

function decal(host: THREE.Object3D, local: THREE.Box3, side: number, text: string, creepy: boolean): THREE.Mesh {
  const size = local.getSize(new THREE.Vector3()), c = local.getCenter(new THREE.Vector3());
  const tex = new THREE.CanvasTexture(makeDecalCanvas(text, creepy)); tex.colorSpace = THREE.SRGBColorSpace;
  const alongX = side % 2 === 0, w = Math.min(alongX ? size.x : size.z, 2.6);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const y = Math.min(Math.max(size.y * 0.4, 1.0), 1.8), off = 0.04;
  if (side === 0) m.position.set(c.x, y, local.max.z + off);
  else if (side === 1) { m.position.set(local.max.x + off, y, c.z); m.rotation.y = Math.PI / 2; }
  else if (side === 2) { m.position.set(c.x, y, local.min.z - off); m.rotation.y = Math.PI; }
  else { m.position.set(local.min.x - off, y, c.z); m.rotation.y = -Math.PI / 2; }
  host.add(m); return m;
}

function makeTerrain(layout: Layout): THREE.Mesh {
  const segments = 128;
  const geo = new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2, segments, segments); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute; const colors: number[] = [];
  const low = new THREE.Color('#45592f'), high = new THREE.Color('#718249'), worn = new THREE.Color('#63713b');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = terrainHeight(x, z, layout); pos.setY(i, y);
    const c = low.clone().lerp(high, THREE.MathUtils.clamp((y + 3) / 8, 0, 1)); if (Math.hypot(x, z) < 25) c.lerp(worn, 0.25); colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })); mesh.receiveShadow = true; mesh.name = 'camp-terrain'; return mesh;
}

function makeWater(layout: Layout): THREE.Mesh {
  const w = layout.water, geo = new THREE.CircleGeometry(1, 96); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhysicalMaterial({ color: '#315d6f', roughness: 0.22, metalness: 0.03, transparent: true, opacity: 0.86, transmission: 0.12, clearcoat: 0.45, clearcoatRoughness: 0.3 });
  const water = new THREE.Mesh(geo, mat); water.scale.set(w.rx, w.rz, 1); water.position.set(w.x, w.y, w.z); water.receiveShadow = true; water.name = 'camp-lake'; return water;
}

function makeRoadOverlay(layout: Layout): THREE.Group {
  const group = new THREE.Group();
  const roadMat = new THREE.MeshStandardMaterial({ color: '#A85F30', roughness: 1, metalness: 0, depthWrite: true });
  const clearingMat = new THREE.MeshStandardMaterial({ color: '#66783E', roughness: 1, metalness: 0 });
  for (const c of layout.clearings) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), clearingMat); disc.rotation.x = -Math.PI / 2; disc.scale.set(c.rx, c.rz, 1); disc.position.set(c.x, terrainHeight(c.x, c.z, layout) + 0.035, c.z); disc.receiveShadow = true; group.add(disc);
  }
  for (const road of layout.roads) {
    for (let i = 1; i < road.points.length; i++) {
      const [ax, az] = road.points[i - 1], [bx, bz] = road.points[i]; const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(road.width, len), roadMat); seg.rotation.x = -Math.PI / 2; seg.rotation.z = -Math.atan2(dz, dx) + Math.PI / 2; seg.position.set(mx, terrainHeight(mx, mz, layout) + 0.055, mz); seg.receiveShadow = true; group.add(seg);
    }
    for (const [x, z] of road.points) { const joint = new THREE.Mesh(new THREE.CircleGeometry(road.width / 2, 24), roadMat); joint.rotation.x = -Math.PI / 2; joint.position.set(x, terrainHeight(x, z, layout) + 0.056, z); group.add(joint); }
  }
  return group;
}

/** Full-size enterable camp bus shell. Imported van placeholder is intentionally replaced here. */
function makeBus(p: Placed, layout: Layout, colliders: Box[]): THREE.Group {
  const g = new THREE.Group(), y = terrainHeight(p.x, p.z, layout), L = 9.2, W = 3.25, H = 2.65, t = 0.16;
  g.position.set(p.x, y, p.z);
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#D78B2F', roughness: 0.78, metalness: 0.04 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#EFE1B6', roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: '#26333A', roughness: 0.55 });
  const panel = (w: number, h: number, d: number, x: number, yy: number, z: number, mat = bodyMat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, yy, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  panel(L, 0.16, W, 0, 0.08, 0, dark); panel(L, 0.16, W, 0, H, 0, trimMat);
  panel(L, H, t, 0, H / 2, W / 2, bodyMat);
  // Door-side wall split around a 1.3m opening near the front.
  panel(5.4, H, t, -1.9, H / 2, -W / 2, bodyMat); panel(1.4, H, t, 3.9, H / 2, -W / 2, bodyMat);
  panel(t, H, W, -L / 2, H / 2, 0, bodyMat); panel(t, H, W, L / 2, H / 2, 0, bodyMat);
  for (let x = -3.1; x <= 2.6; x += 1.45) { panel(0.68, 0.48, 0.86, x, 0.48, 0.82, trimMat); panel(0.68, 0.48, 0.86, x, 0.48, -0.35, trimMat); }
  for (let x = -3.2; x <= 2.8; x += 1.5) { const w1 = panel(0.82, 0.62, 0.035, x, 1.72, W / 2 + 0.01, dark); w1.material = dark; const w2 = panel(0.82, 0.62, 0.035, x, 1.72, -W / 2 - 0.01, dark); w2.material = dark; }
  // Interior colliders, with the side door gap left open.
  const bx0 = p.x - L / 2, bx1 = p.x + L / 2, bz0 = p.z - W / 2, bz1 = p.z + W / 2;
  pushBox(colliders, bx0, bx1, bz1 - t, bz1 + t, y, y + H);
  pushBox(colliders, bx0 - t, bx0 + t, bz0, bz1, y, y + H); pushBox(colliders, bx1 - t, bx1 + t, bz0, bz1, y, y + H);
  pushBox(colliders, bx0, p.x + 0.8, bz0 - t, bz0 + t, y, y + H); pushBox(colliders, p.x + 2.15, bx1, bz0 - t, bz0 + t, y, y + H);
  return g;
}

export function buildWorld(layout: Layout): World {
  const group = new THREE.Group(); const colliders: Box[] = []; const sizes = new Map<string, THREE.Vector3>();
  group.add(makeTerrain(layout), makeRoadOverlay(layout), makeWater(layout));

  const hosts: THREE.Object3D[] = [], hostBoxes: THREE.Box3[] = [];
  const place = (p: Placed) => {
    if (p.name === 'bus') {
      const bus = makeBus(p, layout, colliders); group.add(bus); hosts.push(bus); hostBoxes.push(new THREE.Box3().setFromObject(bus)); return;
    }
    const o = getModel(p.name), local = new THREE.Box3().setFromObject(o); o.position.set(p.x, terrainHeight(p.x, p.z, layout), p.z); o.rotation.y = p.rot; group.add(o); o.updateMatrixWorld(true);
    if (p.solid) {
      const b = boxOf(o, p.name === 'campfire' ? 0.2 : 0.05);
      if (p.name === 'cabin' || p.name === 'shed') hollowBuildingColliders(colliders, b, p.rot, p.name === 'cabin' ? 1.6 : 1.25);
      else colliders.push(b);
    }
    hosts.push(o); hostBoxes.push(local);
  };
  layout.statics.forEach(place);

  const elevatedTrees = layout.trees.map((t) => ({ ...t, y: terrainHeight(t.x, t.z, layout) }));
  group.add(instance('tree', elevatedTrees.filter((t) => t.name === 'tree'))); group.add(instance('tree2', elevatedTrees.filter((t) => t.name === 'tree2'))); group.add(instance('tree3', elevatedTrees.filter((t) => t.name === 'tree3')));
  for (const t of elevatedTrees) colliders.push({ minX: t.x - 0.35, maxX: t.x + 0.35, minZ: t.z - 0.35, maxZ: t.z + 0.35, minY: t.y, maxY: t.y + 7 });

  for (const d of layout.decals) { const host = hosts[d.host], box = hostBoxes[d.host]; if (host && box) decal(host, box, d.side, d.text, d.creepy); }

  const tex = document.createElement('canvas'); tex.width = 256; tex.height = 128; const x = tex.getContext('2d')!;
  x.fillStyle = '#E09F3E'; x.globalAlpha = 0.55; x.fillRect(0, 0, 256, 128); x.globalAlpha = 1; x.strokeStyle = '#FFFDD0'; x.lineWidth = 6; x.strokeRect(6, 6, 244, 116); x.fillStyle = '#1A3A2B'; x.font = 'bold 40px "Courier New"'; x.textAlign = 'center'; x.fillText('BUS SAFE', 128, 78);
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(layout.extraction.r * 2, layout.extraction.r), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(tex), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(layout.extraction.x, terrainHeight(layout.extraction.x, layout.extraction.z, layout) + 0.08, layout.extraction.z); group.add(mark);

  for (const s of layout.items) if (!sizes.has(s.model)) sizes.set(s.model, sizeOf(s.model));
  return { group, colliders, sizes };
}
