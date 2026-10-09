import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { HDRI_FILE, assetUrl } from '../assets/manifest';
import { damp } from './interp';

/** Dirty, faded D-cell flashlight lens: bright hot-spot, filament smudge, scratches. Generated in code on purpose. */
export function makeFlashlightCookie(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(128, 128, 8, 128, 128, 126);
  g.addColorStop(0, '#fff6dc'); g.addColorStop(0.45, '#e9d9a8'); g.addColorStop(0.8, '#8a7a55'); g.addColorStop(1, '#000');
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = g; x.beginPath(); x.arc(128, 128, 126, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(40,30,10,.55)'; x.lineWidth = 3; x.beginPath();
  for (let i = 0; i < 6; i++) { x.moveTo(104 + i * 10, 104); x.bezierCurveTo(100 + i * 10, 118, 108 + i * 10, 138, 104 + i * 10, 152); }
  x.stroke();
  x.strokeStyle = 'rgba(20,15,5,.35)'; x.lineWidth = 1;
  for (let i = 0; i < 14; i++) { x.beginPath(); const a = Math.random() * 6.28, r = 20 + Math.random() * 90; x.moveTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); x.lineTo(128 + Math.cos(a + 0.3) * (r + 25), 128 + Math.sin(a + 0.3) * (r + 25)); x.stroke(); }
  x.fillStyle = 'rgba(60,45,20,.25)';
  for (let i = 0; i < 10; i++) { x.beginPath(); x.arc(40 + Math.random() * 176, 40 + Math.random() * 176, 6 + Math.random() * 14, 0, 6.28); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const DAY = { bg: new THREE.Color('#E6BF80'), fog: new THREE.Color('#E0B97C'), hemiSky: new THREE.Color('#FFE2A8'), hemiGround: new THREE.Color('#7a6338'), hemi: 1.0, sun: 2.6, moon: 0, env: 0.55, fogFar: 140 };
const NIGHT = { bg: new THREE.Color('#050B1C'), fog: new THREE.Color('#050B1C'), hemiSky: new THREE.Color('#1B2A52'), hemiGround: new THREE.Color('#06140E'), hemi: 0.35, sun: 0, moon: 0.5, env: 0.03, fogFar: 55 };

export class Lighting {
  night = false;
  private t = 0; // 0 = day, 1 = night
  hemi = new THREE.HemisphereLight();
  sun = new THREE.DirectionalLight('#F5DEB3');
  moon = new THREE.DirectionalLight('#7F93C8');
  flash = new THREE.SpotLight('#FFF1CF', 0, 32, 0.5, 0.45, 1.6);
  private fog = new THREE.Fog('#E0B97C', 10, 140);

  constructor(private scene: THREE.Scene, renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    scene.fog = this.fog;
    this.sun.position.set(-30, 22, -18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -50; sc.right = sc.top = 50; sc.near = 1; sc.far = 120;
    this.sun.shadow.bias = -0.0004;
    this.moon.position.set(20, 30, 25);
    this.flash.map = makeFlashlightCookie();
    this.flash.position.set(0.18, -0.12, 0);
    this.flash.target.position.set(0.18, -0.12, -5);
    camera.add(this.flash, this.flash.target);
    scene.add(this.hemi, this.sun, this.moon, camera);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.apply(1);
    new RGBELoader().loadAsync(assetUrl(HDRI_FILE)).then((tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromEquirectangular(tex).texture;
      tex.dispose(); pm.dispose();
      this.apply(1);
    }).catch((e) => console.warn('[assets] HDRI failed to load', e instanceof Error ? e.message : e));
  }

  setNight(n: boolean): void { this.night = n; }

  /** Shadows are only worth their cost in daylight. */
  private setShadows(on: boolean): void {
    if (this.sun.castShadow === on) return;
    this.sun.castShadow = on;
  }

  update(dt: number, flashOn: boolean): void {
    const target = this.night ? 1 : 0;
    this.t += (target - this.t) * damp(2, dt);
    if (Math.abs(target - this.t) < 0.002) this.t = target;
    this.apply(dt);
    this.flash.intensity = flashOn ? 140 : 0;
  }

  private apply(_dt: number): void {
    const t = this.t, mix = (a: number, b: number) => a + (b - a) * t;
    if (!this.scene.background) this.scene.background = new THREE.Color();
    (this.scene.background as THREE.Color).copy(DAY.bg).lerp(NIGHT.bg, t);
    this.fog.color.copy(DAY.fog).lerp(NIGHT.fog, t); this.fog.far = mix(DAY.fogFar, NIGHT.fogFar);
    this.hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, t); this.hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, t);
    this.hemi.intensity = mix(DAY.hemi, NIGHT.hemi); this.sun.intensity = mix(DAY.sun, NIGHT.sun); this.moon.intensity = mix(DAY.moon, NIGHT.moon);
    this.scene.environmentIntensity = mix(DAY.env, NIGHT.env);
    this.setShadows(t < 0.5);
  }
}
