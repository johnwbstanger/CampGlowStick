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
 * Browser games commonly become unstable when a single long frame attempts one
 * large collision move. Split the requested motion into short deterministic
 * substeps instead, resolve each axis separately, and keep sliding along walls.
 * This mirrors the fixed/sub-stepped controller pattern used by mature open-source
 * Three.js physics projects without coupling the player to dynamic prop bodies.
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
