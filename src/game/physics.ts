import { resolveCapsule, type Body3, type Box } from './colliders';

export interface SweepResult {
  movedX: number;
  movedZ: number;
  blockedX: boolean;
  blockedZ: boolean;
}

/**
 * Conservative swept movement for the local character controller.
 *
 * Pattern adapted from the fixed/sub-stepped controller architecture used by
 * open-source Three.js/Cannon projects such as Sketchbook: never trust one large
 * render-frame displacement to pass safely through collision. Split travel into
 * deterministic micro-steps, resolve each axis independently, and preserve wall
 * sliding while preventing thin-wall tunneling on low-FPS/mobile frames.
 */
export function moveCapsuleSwept(
  pos: Body3,
  dx: number,
  dz: number,
  radius: number,
  height: number,
  boxes: Box[],
  half: number,
  maxStep = Math.max(0.08, radius * 0.45),
): SweepResult {
  const ox = pos.x, oz = pos.z;
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(distance / maxStep));
  const sx = dx / steps, sz = dz / steps;
  let blockedX = false, blockedZ = false;

  for (let i = 0; i < steps; i++) {
    const beforeX = pos.x;
    pos.x += sx;
    resolveCapsule(pos, radius, height, boxes, half);
    if (Math.abs((pos.x - beforeX) - sx) > 1e-4) blockedX = true;

    const beforeZ = pos.z;
    pos.z += sz;
    resolveCapsule(pos, radius, height, boxes, half);
    if (Math.abs((pos.z - beforeZ) - sz) > 1e-4) blockedZ = true;
  }

  return { movedX: pos.x - ox, movedZ: pos.z - oz, blockedX, blockedZ };
}
