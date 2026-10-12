import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { assetUrl, type AssetName } from '../assets/manifest';
import { getModel, modelMeshes } from '../assets/loader';
import type { Box } from './colliders';
import { attachImportedBuildings } from './environmentBuildings';
import { attachImportedNature } from './environmentNature';
import { WORLD_HALF } from './constants';
import { makeDecalCanvas } from './graffiti';
import { CAMP_PLAN } from './campPlan';
import { LANDMARKS, type LandmarkDef } from './landmarks';
import type { Layout, Placed, Road } from './layout';
import { terrainHeight, terrainSlope } from './terrain';

export interface DoorView { id: string; x: number; z: number; pivot: THREE.Group; collider: Box; closed: Box; open: boolean }
export interface World { group: THREE.Group; colliders: Box[]; sizes: Map<string, THREE.Vector3>; doors: Map<string, DoorView> }

export function setDoorOpen(door: DoorView, open: boolean): void {
  door.open = open;
  door.pivot.rotation.y = open ? -Math.PI * .48 : 0;
  if (open) Object.assign(door.collider, { minX: WORLD_HALF + 500, maxX: WORLD_HALF + 501, minZ: WORLD_HALF + 500, maxZ: WORLD_HALF + 501 });
  else Object.assign(door.collider, door.closed);
}

const touchLike = typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || /iPad|iPhone|Android/i.test(navigator.userAgent));
const v3 = new THREE.Vector3();
export function sizeOf(name: AssetName): THREE.Vector3 { return new THREE.Box3().setFromObject(getModel(name)).getSize(new THREE.Vector3()); }
function pushBox(out: Box[], minX: number, maxX: number, minZ: number, maxZ: number, minY: number, maxY: number): Box { const b = { minX, maxX, minZ, maxZ, minY, maxY }; if (maxX > minX && maxZ > minZ) out.push(b); return b; }
function boxOf(obj: THREE.Object3D, shrink = 0): Box { const b = new THREE.Box3().setFromObject(obj); return { minX: b.min.x + shrink, maxX: b.max.x - shrink, minZ: b.min.z + shrink, maxZ: b.max.z - shrink, minY: b.min.y, maxY: b.max.y }; }

function worldRect(cx: number, cz: number, rot: number, lx0: number, lx1: number, lz0: number, lz1: number, y0: number, y1: number): Box {
  const c = Math.cos(rot), s = Math.sin(rot);
  const pts = [[lx0, lz0], [lx0, lz1], [lx1, lz0], [lx1, lz1]].map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c]);
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs), minY: y0, maxY: y1 };
}
function pushWorldRect(out: Box[], cx: number, cz: number, rot: number, lx0: number, lx1: number, lz0: number, lz1: number, y0: number, y1: number): Box { const b = worldRect(cx, cz, rot, lx0, lx1, lz0, lz1, y0, y1); out.push(b); return b; }
function addRectShell(out: Box[], cx: number, cz: number, rot: number, w: number, d: number, h: number, y: number, doorW = 1.55): void {
  const t = .22;
  pushWorldRect(out, cx, cz, rot, -w / 2, w / 2, -d / 2 - t / 2, -d / 2 + t / 2, y, y + h);
  pushWorldRect(out, cx, cz, rot, -w / 2 - t / 2, -w / 2 + t / 2, -d / 2, d / 2, y, y + h);
  pushWorldRect(out, cx, cz, rot, w / 2 - t / 2, w / 2 + t / 2, -d / 2, d / 2, y, y + h);
  pushWorldRect(out, cx, cz, rot, -w / 2, -doorW / 2, d / 2 - t / 2, d / 2 + t / 2, y, y + h);
  pushWorldRect(out, cx, cz, rot, doorW / 2, w / 2, d / 2 - t / 2, d / 2 + t / 2, y, y + h);
}

function makeDoor(id: string, cx: number, cz: number, rot: number, _w: number, d: number, y: number, colliders: Box[], doors: Map<string, DoorView>): THREE.Group {
  const doorW = 1.55, root = new THREE.Group(); root.position.set(cx, y, cz); root.rotation.y = rot; root.name = id;
  const pivot = new THREE.Group(); pivot.position.set(-doorW / 2, 0, d / 2 + .045);
  const mat = new THREE.MeshStandardMaterial({ color: '#4d6b62', roughness: .9, metalness: .01 }), trim = new THREE.MeshStandardMaterial({ color: '#d5b16d', roughness: .82, metalness: .02 });
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorW, 2.28, .13, 2, 4, 1), mat); leaf.position.set(doorW / 2, 1.14, 0); leaf.castShadow = leaf.receiveShadow = true;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(doorW * .78, .08, .04), trim); bar.position.set(0, .25, .085); leaf.add(bar);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.055, 10, 8), trim); knob.position.set(doorW * .39, .02, .09); leaf.add(knob); pivot.add(leaf); root.add(pivot);
  const closed = worldRect(cx, cz, rot, -doorW / 2, doorW / 2, d / 2 - .12, d / 2 + .12, y, y + 2.3), collider = { ...closed }; colliders.push(collider);
  const s = Math.sin(rot), c = Math.cos(rot), x = cx + (d / 2) * s, z = cz + (d / 2) * c; doors.set(id, { id, x, z, pivot, collider, closed: { ...closed }, open: false }); return root;
}

function roadDistance(road: Road, x: number, z: number): number { let best = Infinity; for (let i = 1; i < road.points.length; i++) { const [ax, az] = road.points[i - 1], [bx, bz] = road.points[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0; best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t))); } return best; }
function surfaceColor(layout: Layout, x: number, z: number): THREE.Color { const grass = new THREE.Color('#526b3d'), pine = new THREE.Color('#3e5437'), dirt = new THREE.Color('#8a6545'), gravel = new THREE.Color('#81786a'), rock = new THREE.Color('#6c6c61'), sand = new THREE.Color('#9b8962'); if (terrainSlope(x, z) > .42) return rock; const w = layout.water, lakeN = Math.sqrt(((x - w.x) / (w.rx * 1.15)) ** 2 + ((z - w.z) / (w.rz * 1.5)) ** 2); if (lakeN < 1.12) return sand; for (const road of layout.roads) if (roadDistance(road, x, z) < road.width * .56) return road.kind === 'gravel' ? gravel : dirt; return grass.clone().lerp(pine, (Math.sin(x * .071 + z * .037) * .5 + .5) * .38); }

function makeTerrain(layout: Layout): THREE.Group {
  const root = new THREE.Group(); root.name = 'terrain-chunks'; const chunk = 60, segments = touchLike ? 18 : 26, mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .98, metalness: 0 });
  for (let x0 = -WORLD_HALF; x0 < WORLD_HALF; x0 += chunk) for (let z0 = -WORLD_HALF; z0 < WORLD_HALF; z0 += chunk) {
    const geo = new THREE.PlaneGeometry(chunk, chunk, segments, segments); geo.rotateX(-Math.PI / 2); const pos = geo.getAttribute('position') as THREE.BufferAttribute, colors: number[] = []; const cx = x0 + chunk / 2, cz = z0 + chunk / 2;
    for (let i = 0; i < pos.count; i++) { const wx = cx + pos.getX(i), wz = cz + pos.getZ(i); pos.setY(i, terrainHeight(wx, wz, layout)); const c = surfaceColor(layout, wx, wz); colors.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals(); const mesh = new THREE.Mesh(geo, mat); mesh.position.set(cx, 0, cz); mesh.receiveShadow = true; mesh.name = `terrain:${x0}:${z0}`; root.add(mesh);
  }
  return root;
}
function makeRoadRibbon(road: Road, layout: Layout): THREE.Mesh { const positions: number[] = [], indices: number[] = []; let vertex = 0; for (let i = 1; i < road.points.length; i++) { const [ax, az] = road.points[i - 1], [bx, bz] = road.points[i], dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz); if (!len) continue; const steps = Math.max(1, Math.ceil(len / 4)), px = -dz / len * road.width / 2, pz = dx / len * road.width / 2; for (let j = 0; j < steps; j++) { const t0 = j / steps, t1 = (j + 1) / steps, x0 = ax + dx * t0, z0 = az + dz * t0, x1 = ax + dx * t1, z1 = az + dz * t1; const pts: [number, number][] = [[x0 + px, z0 + pz], [x0 - px, z0 - pz], [x1 + px, z1 + pz], [x1 - px, z1 - pz]]; for (const [x, z] of pts) positions.push(x, terrainHeight(x, z, layout) + .035, z); indices.push(vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3); vertex += 4; } } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals(); const color = road.kind === 'gravel' ? '#84786a' : road.kind === 'foot' ? '#74563d' : '#8b6242'; const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1 })); mesh.receiveShadow = true; return mesh; }
function makeRoads(layout: Layout): THREE.Group { const g = new THREE.Group(); g.name = 'authored-roads'; for (const r of layout.roads) g.add(makeRoadRibbon(r, layout)); return g; }
function makeWater(layout: Layout): THREE.Object3D { const normals = new THREE.TextureLoader().load(assetUrl('environment/waternormals.jpg'), (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }); normals.wrapS = normals.wrapT = THREE.RepeatWrapping; const water = new Water(new THREE.CircleGeometry(1, touchLike ? 64 : 128), { textureWidth: touchLike ? 256 : 512, textureHeight: touchLike ? 256 : 512, waterNormals: normals, sunDirection: new THREE.Vector3(-.5, .6, -.3).normalize(), sunColor: 0xffc99a, waterColor: 0x315d68, distortionScale: 2.15, fog: true }); water.rotation.x = -Math.PI / 2; water.scale.set(layout.water.rx, layout.water.rz, 1); water.position.set(layout.water.x, layout.water.y, layout.water.z); water.name = 'three-water-lake'; water.receiveShadow = true; return water; }
function legacyInstance(name: AssetName, spots: Placed[], layout: Layout): THREE.Group { const g = new THREE.Group(), m = new THREE.Matrix4(), place = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0); for (const { mesh, matrix } of modelMeshes(name)) { const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, spots.length); spots.forEach((p, i) => { place.compose(new THREE.Vector3(p.x, terrainHeight(p.x, p.z, layout), p.z), q.setFromAxisAngle(up, p.rot), s.setScalar(p.scale ?? 1)); im.setMatrixAt(i, m.multiplyMatrices(place, matrix)); }); im.castShadow = !touchLike; im.receiveShadow = true; g.add(im); } return g; }
function makeFallbackLandmarks(layout: Layout): THREE.Group { const g = new THREE.Group(); g.name = 'fallback-imported-landmarks'; for (const def of LANDMARKS) { const name: AssetName = def.kind === 'dining' ? 'lodge' : def.kind === 'bathhouse' || def.kind === 'maintenance' || def.kind === 'kitchen' ? 'shed' : 'cabin'; const o = getModel(name), size = new THREE.Box3().setFromObject(o).getSize(v3); o.position.set(def.x, terrainHeight(def.x, def.z, layout), def.z); o.rotation.y = def.rot; o.scale.set(def.w / Math.max(.1, size.x), def.h / Math.max(.1, size.y), def.d / Math.max(.1, size.z)); g.add(o); } return g; }
function makeLandmarkCollision(def: LandmarkDef, layout: Layout, colliders: Box[], doors: Map<string, DoorView>): THREE.Group { const y = terrainHeight(def.x, def.z, layout); addRectShell(colliders, def.x, def.z, def.rot, def.w, def.d, def.h, y); return makeDoor(`door:${def.kind}`, def.x, def.z, def.rot, def.w, def.d, y, colliders, doors); }

function tintBusVisual(visual: THREE.Object3D): void {
  const yellow = new THREE.MeshStandardMaterial({ color: '#e4a827', roughness: .52, metalness: .18 });
  const black = new THREE.MeshStandardMaterial({ color: '#171819', roughness: .72, metalness: .12 });
  const glass = new THREE.MeshStandardMaterial({ color: '#82a9ba', roughness: .16, metalness: .05, transparent: true, opacity: .36, depthWrite: false });
  visual.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const key = `${o.name} ${(o.material as THREE.Material)?.name ?? ''}`.toLowerCase();
    o.material = key.includes('wheel') || key.includes('tire') || key.includes('tyre') ? black : key.includes('window') || key.includes('glass') ? glass : yellow;
    o.castShadow = !touchLike; o.receiveShadow = true;
  });
}

function addBusInterior(g: THREE.Group, L: number, W: number, H: number): void {
  const yellow = new THREE.MeshStandardMaterial({ color: '#d99b20', roughness: .68, metalness: .08 });
  const dark = new THREE.MeshStandardMaterial({ color: '#3a3b36', roughness: .84, metalness: .06 });
  const seatMat = new THREE.MeshStandardMaterial({ color: '#335b53', roughness: .9, metalness: .01 });
  const glass = new THREE.MeshStandardMaterial({ color: '#8eb6c7', roughness: .12, transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide });

  // Player feet remain on terrainHeight at the bus. Keep the visual floor nearly flush with that walk plane
  // rather than lifting it 30+ cm above the collision world.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(L - .5, .10, W - .36), dark); floor.position.set(0, .055, 0); floor.receiveShadow = true; g.add(floor);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(L - .55, .11, W - .34), yellow); ceiling.position.set(0, H - .13, 0); ceiling.receiveShadow = true; g.add(ceiling);

  const seat = (x: number, z: number, rot: number) => {
    const root = new THREE.Group(); root.position.set(x, .12, z); root.rotation.y = rot;
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(.7, .16, .58), seatMat); cushion.position.y = .42;
    const back = new THREE.Mesh(new THREE.BoxGeometry(.7, .82, .13), seatMat); back.position.set(0, .86, .24);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(.5, .38, .34), dark); legs.position.y = .19;
    root.add(cushion, back, legs); g.add(root);
  };
  for (const x of [-3.25, -2.05, -.85, .35, 2.75, 3.75]) { seat(x, .83, 0); seat(x, -.83, Math.PI); }

  const windowGeo = new THREE.PlaneGeometry(.86, .78);
  for (const z of [-W / 2 - .012, W / 2 + .012]) for (const x of [-3.55, -2.45, -1.35, -.25, .85, 2.95, 4.0]) {
    if (z < 0 && x > .45 && x < 2.35) continue;
    const w = new THREE.Mesh(windowGeo, glass); w.position.set(x, 1.82, z); w.rotation.y = z < 0 ? 0 : Math.PI; g.add(w);
  }

  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(.86, .10, .42), dark); step.position.set(1.42, .05 + i * .08, -W / 2 + .15 + i * .18); g.add(step);
  }
}

function makeBusDoor(g: THREE.Group, p: Placed, y: number, _L: number, W: number, colliders: Box[], doors: Map<string, DoorView>): void {
  const x0 = .55, x1 = 2.25, doorW = x1 - x0;
  const pivot = new THREE.Group(); pivot.position.set(x0, 0, -W / 2 - .055); pivot.name = 'bus-door-pivot';
  const frame = new THREE.MeshStandardMaterial({ color: '#d99b20', roughness: .62, metalness: .12 });
  const glass = new THREE.MeshStandardMaterial({ color: '#86afbf', roughness: .15, transparent: true, opacity: .36, depthWrite: false });
  const leaf = new THREE.Group();
  const lower = new THREE.Mesh(new THREE.BoxGeometry(doorW, .95, .09), frame); lower.position.set(doorW / 2, .58, 0);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(doorW, .95, .055), glass); upper.position.set(doorW / 2, 1.58, 0);
  leaf.add(lower, upper); pivot.add(leaf); g.add(pivot);
  const closed = worldRect(p.x, p.z, p.rot, x0, x1, -W / 2 - .13, -W / 2 + .13, y, y + 2.2), collider = { ...closed }; colliders.push(collider);
  const lx = (x0 + x1) / 2, lz = -W / 2, c = Math.cos(p.rot), s = Math.sin(p.rot), x = p.x + lx * c + lz * s, z = p.z - lx * s + lz * c;
  doors.set('door:bus', { id: 'door:bus', x, z, pivot, collider, closed: { ...closed }, open: false });
}

function addBusLights(g: THREE.Group, L: number, _W: number): void {
  const lens = new THREE.MeshStandardMaterial({ color: '#fff4c0', emissive: '#ffe7a0', emissiveIntensity: 2.4, roughness: .2 });
  for (const z of [-.88, .88]) {
    const bulb = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .07, 16), lens); bulb.rotation.z = Math.PI / 2; bulb.position.set(L / 2 + .06, .92, z); g.add(bulb);
    const light = new THREE.SpotLight('#fff2c4', touchLike ? 85 : 140, 22, Math.PI / 7, .45, 1.5); light.position.set(L / 2 + .08, .96, z); const target = new THREE.Object3D(); target.position.set(L / 2 + 12, .55, z); g.add(light, target); light.target = target;
  }
}

function makeBus(p: Placed, layout: Layout, colliders: Box[], doors: Map<string, DoorView>): THREE.Group {
  const g = new THREE.Group(), y = terrainHeight(p.x, p.z, layout), L = 9.4, W = 3.05, H = 2.8, t = .18; g.position.set(p.x, y, p.z); g.rotation.y = p.rot; g.name = 'usable-school-bus';
  const visual = getModel('bus'); visual.name = 'quaternius-school-bus'; tintBusVisual(visual); g.add(visual);
  addBusInterior(g, L, W, H); addBusLights(g, L, W); makeBusDoor(g, p, y, L, W, colliders, doors);

  // Collider shell deliberately leaves the passenger-door opening on the near side.
  pushWorldRect(colliders, p.x, p.z, p.rot, -L / 2, L / 2, W / 2 - t, W / 2 + t, y, y + H);
  pushWorldRect(colliders, p.x, p.z, p.rot, -L / 2 - t, -L / 2 + t, -W / 2, W / 2, y, y + H);
  pushWorldRect(colliders, p.x, p.z, p.rot, L / 2 - t, L / 2 + t, -W / 2, W / 2, y, y + H);
  pushWorldRect(colliders, p.x, p.z, p.rot, -L / 2, .55, -W / 2 - t, -W / 2 + t, y, y + H);
  pushWorldRect(colliders, p.x, p.z, p.rot, 2.25, L / 2, -W / 2 - t, -W / 2 + t, y, y + H);

  // Seat collision: keep a full center aisle clear while preventing counselors from ghosting through rows.
  for (const sx of [-3.25, -2.05, -.85, .35, 2.75, 3.75]) {
    for (const sz of [-.83, .83]) pushWorldRect(colliders, p.x, p.z, p.rot, sx - .36, sx + .36, sz - .32, sz + .32, y + .08, y + 1.35);
  }
  return g;
}

function decal(host: THREE.Object3D, local: THREE.Box3, side: number, text: string, creepy: boolean): THREE.Mesh { const size = local.getSize(new THREE.Vector3()), c = local.getCenter(new THREE.Vector3()), tex = new THREE.CanvasTexture(makeDecalCanvas(text, creepy)); tex.colorSpace = THREE.SRGBColorSpace; const alongX = side % 2 === 0, w = Math.min(alongX ? size.x : size.z, 2.6), m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })); const y = Math.min(Math.max(size.y * .4, 1), 1.8), off = .04; if (side === 0) m.position.set(c.x, y, local.max.z + off); else if (side === 1) { m.position.set(local.max.x + off, y, c.z); m.rotation.y = Math.PI / 2; } else if (side === 2) { m.position.set(c.x, y, local.min.z - off); m.rotation.y = Math.PI; } else { m.position.set(local.min.x - off, y, c.z); m.rotation.y = -Math.PI / 2; } host.add(m); return m; }

function addStaticBuildingColliders(world: THREE.Group, p: Placed, o: THREE.Object3D, layout: Layout, colliders: Box[], doors: Map<string, DoorView>, index: number): void {
  if (p.name === 'cabin' || p.name === 'shed' || p.name === 'boathouse') {
    const size = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()), y = terrainHeight(p.x, p.z, layout), w = size.x, d = size.z, h = Math.max(2.5, size.y); addRectShell(colliders, p.x, p.z, p.rot, w, d, h, y, 1.4);
    if (p.name === 'cabin') {
      world.add(makeDoor(`door:cabin:${index}`, p.x, p.z, p.rot, w, d, y, colliders, doors));
    }
  } else if (p.name === 'trailShelter') {
    const b = boxOf(o), post = .28; for (const x of [b.minX, b.maxX]) for (const z of [b.minZ, b.maxZ]) pushBox(colliders, x - post, x + post, z - post, z + post, b.minY, b.maxY);
  }
}

function nearestCabinFloor(layout: Layout, p: Placed): number | null {
  if (!['bunk', 'bookshelf', 'table'].includes(p.name)) return null;
  let best: Placed | null = null, d = Infinity;
  for (const c of layout.statics) {
    if (c.name !== 'cabin' || (c.x === CAMP_PLAN.admin.x && c.z === CAMP_PLAN.admin.z)) continue;
    const cd = Math.hypot(c.x - p.x, c.z - p.z);
    if (cd < d) { d = cd; best = c; }
  }
  return best && d < 5.2 ? terrainHeight(best.x, best.z, layout) + .035 : null;
}

function makeExtraction(layout: Layout): THREE.Mesh { const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256; const c = canvas.getContext('2d')!; c.fillStyle = '#E09F3E'; c.globalAlpha = .5; c.fillRect(0, 0, 512, 256); c.globalAlpha = 1; c.strokeStyle = '#FFFDD0'; c.lineWidth = 10; c.strokeRect(12, 12, 488, 232); c.fillStyle = '#17392e'; c.font = 'bold 72px Georgia'; c.textAlign = 'center'; c.fillText('BUS SAFE', 256, 150); const m = new THREE.Mesh(new THREE.PlaneGeometry(layout.extraction.r * 2, layout.extraction.r), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(layout.extraction.x, terrainHeight(layout.extraction.x, layout.extraction.z, layout) + .065, layout.extraction.z); return m; }
function addColliderDebug(group: THREE.Group, colliders: Box[]): void { if (new URLSearchParams(location.search).get('debug') !== 'colliders') return; const dbg = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: .42, depthTest: false }); dbg.name = 'collider-debug'; for (const b of colliders) { const w = b.maxX - b.minX, h = b.maxY - b.minY, d = b.maxZ - b.minZ; if (w > 50 || d > 50) continue; const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2); dbg.add(m); } group.add(dbg); }

export function buildWorld(layout: Layout): World {
  const group = new THREE.Group(); group.name = 'camp-glowstick-world'; const colliders: Box[] = [], sizes = new Map<string, THREE.Vector3>(), doors = new Map<string, DoorView>(); group.add(makeTerrain(layout), makeRoads(layout), makeWater(layout));
  const fallbackLandmarks = makeFallbackLandmarks(layout); group.add(fallbackLandmarks); for (const def of LANDMARKS) group.add(makeLandmarkCollision(def, layout, colliders, doors)); void attachImportedBuildings(group, layout, LANDMARKS).then((ok) => { if (ok) fallbackLandmarks.visible = false; });
  const hosts: THREE.Object3D[] = [], hostBoxes: THREE.Box3[] = [];
  layout.statics.forEach((p, index) => {
    if (p.name === 'bus') { const bus = makeBus(p, layout, colliders, doors); group.add(bus); hosts.push(bus); hostBoxes.push(new THREE.Box3().setFromObject(bus)); return; }
    const o = getModel(p.name); const cabinFloor = nearestCabinFloor(layout, p); o.position.set(p.x, cabinFloor ?? terrainHeight(p.x, p.z, layout), p.z); o.rotation.y = p.rot; if (p.scale) o.scale.multiplyScalar(p.scale); group.add(o); o.updateMatrixWorld(true);
    if (p.name === 'cabin' || p.name === 'shed' || p.name === 'boathouse' || p.name === 'trailShelter') addStaticBuildingColliders(group, p, o, layout, colliders, doors, index); else if (p.solid) colliders.push(boxOf(o, p.name === 'campfire' ? .18 : .04)); hosts.push(o); hostBoxes.push(new THREE.Box3().setFromObject(o));
  });
  const legacyCanopy = new THREE.Group(); legacyCanopy.name = 'legacy-canopy-fallback'; for (const name of ['tree', 'tree2', 'tree3'] as AssetName[]) legacyCanopy.add(legacyInstance(name, layout.trees.filter((t) => t.name === name), layout)); group.add(legacyCanopy);
  for (const t of layout.trees) { const y = terrainHeight(t.x, t.z, layout), radius = .31 * (t.scale ?? 1); colliders.push({ minX: t.x - radius, maxX: t.x + radius, minZ: t.z - radius, maxZ: t.z + radius, minY: y, maxY: y + 9 * (t.scale ?? 1) }); } void attachImportedNature(group, layout, legacyCanopy);
  for (const d of layout.decals) { const host = hosts[d.host], box = hostBoxes[d.host]; if (host && box) decal(host, box, d.side, d.text, d.creepy); }
  group.add(makeExtraction(layout)); for (const s of layout.items) if (!sizes.has(s.model)) sizes.set(s.model, sizeOf(s.model)); addColliderDebug(group, colliders); return { group, colliders, sizes, doors };
}
