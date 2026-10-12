import * as THREE from 'three';
import { buildingModules, fittedBuildingModule, preloadBuildingKit, type BuildingModule, type BuildingModuleCategory } from '../assets/buildingKit';
import { getModel } from '../assets/loader';
import type { LandmarkDef } from './landmarks';
import type { Layout } from './layout';
import { terrainHeight } from './terrain';

const pick = (category: BuildingModuleCategory, salt: number): BuildingModule | undefined => {
  const list = buildingModules(category); return list.length ? list[Math.abs(salt) % list.length] : undefined;
};
const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;

function placeModule(group: THREE.Group, module: BuildingModule | undefined, size: [number, number, number], pos: [number, number, number], rotY = 0): void {
  if (!module) return;
  const o = fittedBuildingModule(module, size[0], size[1], size[2]);
  o.position.set(...pos); o.rotation.y = rotY; group.add(o);
}

function canvasSign(text: string, width: number): THREE.Mesh {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 192;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#315247'; c.fillRect(0, 0, canvas.width, canvas.height);
  c.strokeStyle = '#d49a4b'; c.lineWidth = 13; c.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  c.fillStyle = '#f0dfb6'; c.font = '700 58px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, canvas.width / 2, canvas.height / 2 + 3);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, width * .25), new THREE.MeshStandardMaterial({ map, roughness: .95, metalness: 0 }));
}

function addFurniture(g: THREE.Group, def: LandmarkDef): void {
  const add = (name: Parameters<typeof getModel>[0], x: number, z: number, rot = 0, scale = 1) => {
    const o = getModel(name); o.position.set(x, .035, z); o.rotation.y = rot; o.scale.multiplyScalar(scale); g.add(o);
  };
  if (def.kind === 'dining') {
    for (const z of [-2.5, 0, 2.5]) for (const x of [-4.5, 0, 4.5]) { add('table', x, z, 0, 1.05); add('chair', x - 1.25, z, Math.PI / 2); add('chair', x + 1.25, z, -Math.PI / 2); }
  } else if (def.kind === 'kitchen') {
    add('sink', -3.2, -2.2, 0, 1.1); add('bookshelf', 3.6, -2.3, Math.PI, 1.15); add('crate', 3.2, 2.2); add('barrel', 4.0, 2.0);
  } else if (def.kind === 'director' || def.kind === 'admin') {
    add('table', 0, -.6, 0, 1.1); add('chair', 0, .9, Math.PI); add('bookshelf', -def.w * .36, -1.3, Math.PI / 2); add('radio', 1.2, -.55, 0, .9);
  } else if (def.kind === 'bathhouse') {
    for (const x of [-3, 0, 3]) add('sink', x, -2.2, 0, .95);
  } else if (def.kind === 'arts') {
    add('table', -2.5, -1.2, 0, 1.15); add('table', 2.5, -1.2, 0, 1.15); add('bookshelf', -4.1, 2.3, Math.PI / 2); add('teddy', 2.7, 1.7, .3);
  } else if (def.kind === 'maintenance') {
    add('table', -2.8, -2.6, 0, 1.1); add('bookshelf', 4.0, -2.6, Math.PI); add('barrel', 3.7, 2.5); add('crate', 2.6, 2.5); add('axe', -3.2, -2.2, 0, 1.1);
  }
}

function assemble(def: LandmarkDef, layout: Layout): THREE.Group {
  const g = new THREE.Group(); g.name = `imported-building:${def.kind}`;
  g.position.set(def.x, terrainHeight(def.x, def.z, layout), def.z); g.rotation.y = def.rot;
  const h = def.h, w = def.w, d = def.d, salt = hash(def.kind);
  const wall = pick('wall', salt), window = pick('window', salt + 3), roof = pick('roof', salt + 7), floor = pick('floor', salt + 9), structure = pick('structure', salt + 11), porch = pick('porch', salt + 13), stairs = pick('stairs', salt + 15);
  const t = .22, doorW = 1.55, bay = Math.max(2.1, Math.min(3.6, w / 4));

  placeModule(g, floor, [w, .16, d], [0, .02, 0]);
  const backCount = Math.max(2, Math.round(w / bay));
  for (let i = 0; i < backCount; i++) {
    const bw = w / backCount, x = -w / 2 + bw * (i + .5);
    placeModule(g, i % 2 && window ? window : wall, [bw, h, t], [x, 0, -d / 2], 0);
  }

  // Keep the front-center opening physically and visually empty. world.ts owns the one authoritative
  // interactive door leaf + collider; putting a decorative imported door here created a second closed
  // door that players could see even after the real door opened.
  const sideW = (w - doorW) / 2;
  placeModule(g, window ?? wall, [sideW, h, t], [-(w + doorW) / 4, 0, d / 2], Math.PI);
  placeModule(g, window ?? wall, [sideW, h, t], [(w + doorW) / 4, 0, d / 2], Math.PI);

  const sideCount = Math.max(2, Math.round(d / bay));
  for (const sx of [-1, 1]) for (let i = 0; i < sideCount; i++) {
    const bd = d / sideCount, z = -d / 2 + bd * (i + .5);
    const m = i % 2 === 0 && window ? window : wall;
    placeModule(g, m, [bd, h, t], [sx * w / 2, 0, z], sx < 0 ? -Math.PI / 2 : Math.PI / 2);
  }

  placeModule(g, roof, [w + .85, Math.max(.55, h * .24), d + 1.0], [0, h - .03, 0]);
  if (structure) for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]] as [number, number][]) placeModule(g, structure, [.22, h, .22], [x, 0, z]);

  if (porch) placeModule(g, porch, [Math.min(w * .66, 7), .7, 2.0], [0, 0, d / 2 + 1.05], Math.PI);
  if (stairs) placeModule(g, stairs, [2.0, .65, 1.25], [0, -.02, d / 2 + 2.0], Math.PI);

  // Previous labels could span over half the facade and read like giant billboards. Keep them as small
  // believable camp placards above the entrance instead.
  const signWidth = Math.max(1.45, Math.min(w * .24, 3.25));
  const sign = canvasSign(def.label, signWidth); sign.position.set(0, Math.min(h * .76, 2.45), d / 2 + .18); sign.rotation.y = Math.PI; g.add(sign);
  addFurniture(g, def);
  return g;
}

/** Adds all hero program buildings once the pinned modular kit is ready. */
export async function attachImportedBuildings(group: THREE.Group, layout: Layout, landmarks: readonly LandmarkDef[]): Promise<boolean> {
  await preloadBuildingKit();
  if (!buildingModules('wall').length || !buildingModules('roof').length) return false;
  const buildings = new THREE.Group(); buildings.name = 'imported-camp-buildings';
  for (const def of landmarks) buildings.add(assemble(def, layout));
  group.add(buildings);
  return true;
}
