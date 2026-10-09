import * as THREE from 'three';
import { resolveCapsule, type Box } from './colliders';
import { PLAYER, STAMINA, WORLD_HALF } from './constants';
import { damp } from './interp';
import { stepStamina } from './stamina';
import type { PlayerState } from '../net/protocol';
import type { Layout } from './layout';
import { isDeepWater, terrainHeight } from './terrain';

const CROUCH_HOLD_MS = 180;
const JUMP_SPEED = 5.4;
const GRAVITY = 15.5;

/** First-person controller: WASD + mouse look, Shift sprint, tap Space to jump, hold Space to crouch. */
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
  private spaceDownAt = 0;
  private jumpVelocity = 0;
  private grounded = true;

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!e.repeat && e.code === 'KeyF') this.flash = !this.flash;
    if (!e.repeat && e.code === 'Space') {
      e.preventDefault();
      this.spaceDownAt = performance.now();
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space') {
      e.preventDefault();
      const heldMs = this.spaceDownAt ? performance.now() - this.spaceDownAt : Infinity;
      if (heldMs < CROUCH_HOLD_MS && this.grounded && this.alive) {
        this.jumpVelocity = JUMP_SPEED;
        this.grounded = false;
      }
      this.spaceDownAt = 0;
    }
    this.keys.delete(e.code);
  };

  private onBlur = (): void => { this.keys.clear(); this.spaceDownAt = 0; this.crouch = false; };
  private onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement !== this.canvas) return;
    this.yaw -= e.movementX * 0.0022;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - e.movementY * 0.0022));
  };

  constructor(private camera: THREE.PerspectiveCamera, private canvas: HTMLElement, private layout: Layout) {
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    addEventListener('blur', this.onBlur);
    addEventListener('mousemove', this.onMouseMove);
  }

  dispose(): void {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    removeEventListener('blur', this.onBlur);
    removeEventListener('mousemove', this.onMouseMove);
    this.keys.clear();
  }

  teleport(x: number, z: number): void {
    this.pos.x = x; this.pos.z = z; this.pos.y = terrainHeight(x, z, this.layout);
    this.jumpVelocity = 0; this.grounded = true;
  }
  pressed(code: string): boolean { return this.keys.has(code); }

  update(dt: number, colliders: Box[], carry: number): void {
    const k = this.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const heldSpaceMs = k.has('Space') && this.spaceDownAt ? performance.now() - this.spaceDownAt : 0;
    this.crouch = this.grounded && heldSpaceMs >= CROUCH_HOLD_MS;
    this.moving = this.alive && (f !== 0 || s !== 0);

    if (this.exhausted && this.stamina > STAMINA.minToSprint) this.exhausted = false;
    this.sprint = this.moving && !this.crouch && this.grounded && k.has('ShiftLeft') && !this.exhausted && this.stamina > 0;
    this.stamina = stepStamina(this.stamina, dt, this.sprint, carry);
    if (this.stamina <= 0) this.exhausted = true;

    const ox = this.pos.x, oz = this.pos.z;
    if (this.moving) {
      const speed = this.crouch ? PLAYER.crouch : this.sprint ? PLAYER.sprint : PLAYER.walk;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw), len = Math.hypot(f, s);
      this.pos.x += ((-sin * f + cos * s) / len) * speed * dt;
      this.pos.z += ((-cos * f - sin * s) / len) * speed * dt;
      if (isDeepWater(this.pos.x, this.pos.z, this.layout)) { this.pos.x = ox; this.pos.z = oz; }
      resolveCapsule(this.pos, PLAYER.radius, this.crouch ? PLAYER.crouchHeight : PLAYER.height, colliders, WORLD_HALF);
    }

    const groundY = terrainHeight(this.pos.x, this.pos.z, this.layout);
    if (this.grounded) this.pos.y = groundY;
    if (!this.grounded || this.jumpVelocity > 0) {
      this.jumpVelocity -= GRAVITY * dt;
      this.pos.y += this.jumpVelocity * dt;
      if (this.pos.y <= groundY) {
        this.pos.y = groundY;
        this.jumpVelocity = 0;
        this.grounded = true;
      }
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
