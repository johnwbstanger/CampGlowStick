import * as THREE from 'three';
import type { Layout } from './layout';
import { terrainHeight } from './terrain';
import { LANDMARKS } from './landmarks';

const wood = new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: .96 });
const dark = new THREE.MeshStandardMaterial({ color: '#24282a', roughness: .72 });
const amber = new THREE.MeshStandardMaterial({ color: '#f1a446', emissive: '#f08a2b', emissiveIntensity: 3.5, roughness: .45 });
const stone = new THREE.MeshStandardMaterial({ color: '#6f7169', roughness: 1 });

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = m.receiveShadow = true; return m;
}
function cyl(r: number, h: number, mat: THREE.Material, seg = 12): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.castShadow = m.receiveShadow = true; return m;
}

function picnicTable(x: number, z: number, rot: number, layout: Layout): THREE.Group {
  const g = new THREE.Group(); g.position.set(x, terrainHeight(x, z, layout), z); g.rotation.y = rot;
  const top = box(2.5, .12, .82, wood); top.position.y = .78; g.add(top);
  for (const side of [-1, 1]) {
    const bench = box(2.5, .11, .34, wood); bench.position.set(0, .46, side * .86); g.add(bench);
    for (const x0 of [-.82, .82]) { const leg = box(.12, .68, .12, dark); leg.position.set(x0, .38, side * .48); leg.rotation.z = side * .22; g.add(leg); }
  }
  return g;
}

function crateStack(x: number, z: number, rot: number, layout: Layout): THREE.Group {
  const g = new THREE.Group(); g.position.set(x, terrainHeight(x, z, layout), z); g.rotation.y = rot;
  for (let i = 0; i < 4; i++) {
    const c = box(.65 + (i % 2) * .08, .5, .6, new THREE.MeshStandardMaterial({ color: i % 2 ? '#806044' : '#9a724f', roughness: 1 }));
    c.position.set((i % 2) * .48, .25 + Math.floor(i / 2) * .52, (i % 3) * .18); c.rotation.y = (i % 2 ? .12 : -.08); g.add(c);
  }
  const cooler = box(.78, .46, .5, new THREE.MeshStandardMaterial({ color: '#d8e1d9', roughness: .8 })); cooler.position.set(-.62, .23, .15); g.add(cooler);
  return g;
}

function campfire(x: number, z: number, layout: Layout): THREE.Group {
  const g = new THREE.Group(); const y = terrainHeight(x, z, layout); g.position.set(x, y, z);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, s = cyl(.16, .34, stone, 8); s.rotation.z = Math.PI / 2; s.position.set(Math.cos(a) * .72, .12, Math.sin(a) * .72); s.rotation.y = a; g.add(s);
  }
  for (const r of [-.42, .42]) { const log = cyl(.11, 1.1, wood, 9); log.rotation.z = Math.PI / 2; log.rotation.y = r > 0 ? .65 : -.65; log.position.y = .18; g.add(log); }
  const flame = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 8), amber); flame.scale.set(.8, 1.8, .8); flame.position.y = .45; g.add(flame);
  const light = new THREE.PointLight('#ff9a38', 54, 12, 2); light.position.y = 1.15; g.add(light);
  return g;
}

function streetlight(x: number, z: number, layout: Layout): THREE.Group {
  const g = new THREE.Group(); g.position.set(x, terrainHeight(x, z, layout), z);
  const pole = cyl(.07, 3.6, dark, 10); pole.position.y = 1.8; g.add(pole);
  const arm = box(.75, .07, .07, dark); arm.position.set(.32, 3.47, 0); g.add(arm);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 8), amber); lamp.position.set(.66, 3.3, 0); g.add(lamp);
  const light = new THREE.PointLight('#efad62', 28, 11, 2); light.position.set(.66, 3.15, 0); g.add(light);
  return g;
}

function porchLight(x: number, z: number, y: number, parent: THREE.Group): void {
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.075, 10, 8), amber); bulb.position.set(x, y, z); parent.add(bulb);
  const light = new THREE.PointLight('#f2b766', 15, 7, 2); light.position.set(x, y - .1, z); parent.add(light);
}

function addBusWheels(g: THREE.Group, layout: Layout): void {
  const bus = layout.statics.find((s) => s.name === 'bus'); if (!bus) return;
  const y = terrainHeight(bus.x, bus.z, layout);
  for (const lx of [-3.1, 3.0]) for (const lz of [-1.52, 1.52]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.54, .54, .28, 18), dark);
    wheel.rotation.z = Math.PI / 2;
    // bus is placed at ~90 degrees in layout; local x becomes world z here.
    wheel.position.set(bus.x + lz, y + .52, bus.z + lx); wheel.castShadow = true; g.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .3, 16), new THREE.MeshStandardMaterial({ color: '#888b86', metalness: .35, roughness: .5 }));
    hub.rotation.z = Math.PI / 2; hub.position.copy(wheel.position); g.add(hub);
  }
}

/** Visual organization pass: repeated camp-use zones instead of random scatter. */
export function buildCampDecor(layout: Layout): THREE.Group {
  const g = new THREE.Group(); g.name = 'camp-decor';

  // Social spaces: tables and warm firelight.
  const tables: [number, number, number][] = [[-7, 8, .2], [7, 8, -.2], [-8, 1, -.1], [8, 1, .15], [-11, 57, .3], [3, 58, -.25], [83, -10, .4]];
  for (const t of tables) g.add(picnicTable(t[0], t[1], t[2], layout));
  for (const [x, z] of [[0, 6], [-55, 26], [50, 27], [-7, 58]] as [number, number][]) g.add(campfire(x, z, layout));

  // Organized storage/hiding clusters beside cabins and service buildings.
  const stacks: [number, number, number][] = [[-79, -42, .2], [-40, -56, -.2], [22, -54, .15], [63, -38, -.25], [-65, 27, .3], [-18, 37, -.15], [44, 33, .2], [92, -28, .3], [-98, -39, -.2]];
  for (const s of stacks) g.add(crateStack(s[0], s[1], s[2], layout));

  // A few deliberate path lights, not a suburban grid.
  for (const [x, z] of [[-54, 23], [-25, 13], [28, 2], [57, 11], [80, 19], [-43, -63]] as [number, number][]) g.add(streetlight(x, z, layout));

  // Porch/entry lights outside selected cabins and named buildings.
  for (const s of layout.statics.filter((x) => x.name === 'cabin').filter((_, i) => i % 2 === 0)) porchLight(s.x, terrainHeight(s.x, s.z, layout) + 2.15, s.z, g);
  for (const b of LANDMARKS) porchLight(b.x, terrainHeight(b.x, b.z, layout) + 2.35, b.z + b.d * .52, g);

  addBusWheels(g, layout);
  return g;
}
