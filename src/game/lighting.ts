import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { HDRI_FILE, assetUrl } from '../assets/manifest';
import { DAY_SECONDS } from './constants';
import { damp } from './interp';

export function makeFlashlightCookie(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(128, 128, 6, 128, 128, 126);
  g.addColorStop(0, '#fffbea'); g.addColorStop(0.36, '#fff1c7'); g.addColorStop(0.72, '#b9a56e'); g.addColorStop(1, '#000');
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = g; x.beginPath(); x.arc(128, 128, 126, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const SUNSET = { bg: '#F3A080', fog: '#DFA073', sky: '#FFC6A0', ground: '#67573A', hemi: 1.0, sun: 2.45, moon: 0, env: 0.48, fogFar: 205 };
const GOLDEN = { bg: '#C9837B', fog: '#B47B69', sky: '#E7A48D', ground: '#4B4934', hemi: 0.82, sun: 1.55, moon: 0.05, env: 0.34, fogFar: 180 };
const BLUE = { bg: '#655A83', fog: '#70647B', sky: '#8D86AE', ground: '#24352D', hemi: 0.58, sun: 0.44, moon: 0.2, env: 0.17, fogFar: 135 };
const NIGHT = { bg: '#050B1C', fog: '#050B1C', sky: '#1B2A52', ground: '#06140E', hemi: 0.28, sun: 0, moon: 0.6, env: 0.03, fogFar: 82 };

type Stage = typeof SUNSET;
const C = (hex: string) => new THREE.Color(hex);
const nlerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Lighting {
  night = false;
  private targetT = 0;
  private t = 0;
  hemi = new THREE.HemisphereLight();
  sun = new THREE.DirectionalLight('#FFD0A0');
  moon = new THREE.DirectionalLight('#7F93C8');
  flash = new THREE.SpotLight('#FFF4D8', 0, 46, 0.58, 0.42, 1.45);
  private fog = new THREE.Fog('#D99A72', 10, 205);

  constructor(private scene: THREE.Scene, renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    scene.fog = this.fog;
    this.sun.position.set(-75, 14, -42);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -145; sc.right = sc.top = 145; sc.near = 1; sc.far = 260;
    this.sun.shadow.bias = -0.0004;
    this.moon.position.set(35, 44, 28);
    this.flash.map = makeFlashlightCookie();
    this.flash.position.set(0.18, -0.12, 0);
    this.flash.target.position.set(0.18, -0.12, -7);
    camera.add(this.flash, this.flash.target);
    scene.add(this.hemi, this.sun, this.moon, camera);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.apply();
    new RGBELoader().loadAsync(assetUrl(HDRI_FILE)).then((tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromEquirectangular(tex).texture;
      tex.dispose(); pm.dispose(); this.apply();
    }).catch((e) => console.warn('[assets] HDRI failed to load', e instanceof Error ? e.message : e));
  }

  setTime(seconds: number, forcedNight: boolean): void {
    this.night = forcedNight;
    this.targetT = forcedNight ? 1 : THREE.MathUtils.clamp(seconds / DAY_SECONDS, 0, 0.998);
  }

  private setShadows(on: boolean): void { if (this.sun.castShadow !== on) this.sun.castShadow = on; }

  update(dt: number, flashOn: boolean): void {
    this.t += (this.targetT - this.t) * damp(1.45, dt);
    if (Math.abs(this.targetT - this.t) < 0.0015) this.t = this.targetT;
    this.apply();
    this.flash.intensity = flashOn ? 260 : 0;
  }

  private mixStage(a: Stage, b: Stage, t: number): void {
    const u = THREE.MathUtils.smoothstep(t, 0, 1);
    if (!this.scene.background) this.scene.background = new THREE.Color();
    (this.scene.background as THREE.Color).copy(C(a.bg)).lerp(C(b.bg), u);
    this.fog.color.copy(C(a.fog)).lerp(C(b.fog), u);
    this.hemi.color.copy(C(a.sky)).lerp(C(b.sky), u);
    this.hemi.groundColor.copy(C(a.ground)).lerp(C(b.ground), u);
    this.hemi.intensity = nlerp(a.hemi, b.hemi, u);
    this.sun.intensity = nlerp(a.sun, b.sun, u);
    this.moon.intensity = nlerp(a.moon, b.moon, u);
    this.fog.far = nlerp(a.fogFar, b.fogFar, u);
    this.scene.environmentIntensity = nlerp(a.env, b.env, u);
  }

  private apply(): void {
    // Six-minute dusk: long warm arrival, gentle amber fade, extended blue hour, then true night.
    if (this.t < 0.34) this.mixStage(SUNSET, GOLDEN, this.t / 0.34);
    else if (this.t < 0.72) this.mixStage(GOLDEN, BLUE, (this.t - 0.34) / 0.38);
    else this.mixStage(BLUE, NIGHT, (this.t - 0.72) / 0.28);

    const horizon = THREE.MathUtils.clamp(this.t / 0.83, 0, 1);
    this.sun.position.y = nlerp(14, 0.8, horizon);
    this.sun.position.x = nlerp(-75, -96, horizon);
    this.sun.color.copy(C('#FFD8AA')).lerp(C('#FF8870'), Math.min(1, this.t * 1.25));
    this.setShadows(this.t < 0.8);
  }
}
