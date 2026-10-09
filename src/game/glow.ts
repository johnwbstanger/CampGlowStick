import * as THREE from 'three';
import { GLOW_COLORS } from './constants';

let capsule: THREE.CapsuleGeometry | null = null;
let halo: THREE.CanvasTexture | null = null;
const mats = new Map<string, THREE.MeshStandardMaterial>();
const sprites = new Map<string, THREE.SpriteMaterial>();

function haloTexture(): THREE.CanvasTexture {
  if (!halo) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.3, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    halo = new THREE.CanvasTexture(c);
  }
  return halo;
}

/** A snapped glowstick: simple capsule with an emissive material and a soft halo (all materials shared per colour). */
export function makeGlowstick(color: string): THREE.Object3D {
  const hex = GLOW_COLORS[color] ?? GLOW_COLORS.green;
  capsule ??= new THREE.CapsuleGeometry(0.018, 0.14, 4, 8);
  let m = mats.get(color);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 3, roughness: 0.4 }); mats.set(color, m); }
  let sm = sprites.get(color);
  if (!sm) { sm = new THREE.SpriteMaterial({ map: haloTexture(), color: hex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }); sprites.set(color, sm); }
  const g = new THREE.Group();
  const stick = new THREE.Mesh(capsule, m);
  stick.rotation.z = Math.PI / 2;
  const s = new THREE.Sprite(sm);
  s.scale.setScalar(0.9);
  g.add(stick, s);
  return g;
}

/** Faint mustard marker so loot is findable in the dark. */
export function makeLootHalo(): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: '#E09F3E', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
  s.scale.setScalar(1.2); s.position.y = 0.3;
  return s;
}
