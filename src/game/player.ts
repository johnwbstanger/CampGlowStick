import * as THREE from 'three';
import { resolveCapsule, type Box } from './colliders';
import { PLAYER, STAMINA, WORLD_HALF } from './constants';
import { damp } from './interp';
import { stepStamina } from './stamina';
import type { PlayerState } from '../net/protocol';

/** First-person controller: WASD + mouse look, Shift sprint (stamina), C/Ctrl crouch. */
export class LocalPlayer {
  pos = { x: 0, y: 0, z: 0 };
  yaw = 0;
  pitch = 0;
  stamina = STAMINA.max;
  crouch = false;
  sprint = false;
  moving = false;
  flash = false;
  alive = true;
  private exhausted = false;
  private eye: number = PLAYER.eye;
  private keys = new Set<string>();

  constructor(private camera: THREE.PerspectiveCamera, canvas: HTMLElement) {
    addEventListener('keydown', (e) => { if (!e.repeat && e.code === 'KeyF') this.flash = !this.flash; this.keys.add(e.code); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - e.movementY * 0.0022));
    });
  }

  teleport(x: number, z: number): void { this.pos.x = x; this.pos.z = z; }
  pressed(code: string): boolean { return this.keys.has(code); }

  update(dt: number, colliders: Box[], carry: number): void {
    const k = this.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    this.crouch = k.has('KeyC') || k.has('ControlLeft');
    this.moving = this.alive && (f !== 0 || s !== 0);
    if (this.exhausted && this.stamina > STAMINA.minToSprint) this.exhausted = false;
    this.sprint = this.moving && !this.crouch && k.has('ShiftLeft') && !this.exhausted && this.stamina > 0;
    this.stamina = stepStamina(this.stamina, dt, this.sprint, carry);
    if (this.stamina <= 0) this.exhausted = true;
    if (this.moving) {
      const speed = this.crouch ? PLAYER.crouch : this.sprint ? PLAYER.sprint : PLAYER.walk;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw), len = Math.hypot(f, s);
      // forward = (-sin, -cos); right = (cos, -sin)
      this.pos.x += ((-sin * f + cos * s) / len) * speed * dt;
      this.pos.z += ((-cos * f - sin * s) / len) * speed * dt;
      resolveCapsule(this.pos, PLAYER.radius, this.crouch ? PLAYER.crouchHeight : PLAYER.height, colliders, WORLD_HALF);
    }
    this.eye += ((this.crouch ? PLAYER.crouchEye : PLAYER.eye) - this.eye) * damp(12, dt);
    this.camera.position.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  forward(): [number, number] { return [-Math.sin(this.yaw), -Math.cos(this.yaw)]; }

  state(held: number): PlayerState {
    const r = (n: number) => Math.round(n * 100) / 100;
    return { p: [r(this.pos.x), r(this.pos.y), r(this.pos.z)], yaw: r(this.yaw), pitch: r(this.pitch), crouch: this.crouch, sprint: this.sprint, moving: this.moving, held, flash: this.flash, stamina: Math.round(this.stamina) };
  }
}
