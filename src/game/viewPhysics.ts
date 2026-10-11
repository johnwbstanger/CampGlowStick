export interface ViewLike {
  p: [number, number, number];
  yaw: number;
  pitch: number;
  crouch: boolean;
}

export interface HoldPose {
  position: [number, number, number];
  euler: [number, number, number];
}

/** Three.js camera forward for rotation order YXZ, where local forward is -Z. */
export function viewForward(yaw: number, pitch: number): [number, number, number] {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

/** Horizontal camera-forward used for ground navigation and side offsets. */
export function flatForward(yaw: number): [number, number] {
  return [-Math.sin(yaw), -Math.cos(yaw)];
}

/**
 * Stable first-person hold socket. Position follows the camera heading and pitch;
 * orientation follows the view instead of remaining world-north.
 */
export function heldPose(
  view: ViewLike,
  eye: number,
  opts: { forward: number; right: number; down: number },
): HoldPose {
  const [fx, fy, fz] = viewForward(view.yaw, view.pitch);
  const [hfx, hfz] = flatForward(view.yaw);
  const rx = -hfz, rz = hfx;
  return {
    position: [
      view.p[0] + fx * opts.forward + rx * opts.right,
      view.p[1] + eye - opts.down + fy * opts.forward,
      view.p[2] + fz * opts.forward + rz * opts.right,
    ],
    euler: [-view.pitch, view.yaw, 0],
  };
}

/**
 * Camera-directed release velocity. Charge controls impulse, camera pitch controls arc,
 * and mass adds readable heft without making heavy props unusable as distractions.
 */
export function releaseVelocity(
  yaw: number,
  pitch: number,
  charge: number,
  mass: number,
  thrown: boolean,
): [number, number, number] {
  const [fx, fy, fz] = viewForward(yaw, pitch);
  if (!thrown) return [fx * 0.8, Math.min(0.2, fy * 0.35), fz * 0.8];

  const c = Math.max(0, Math.min(1, charge));
  const heft = Math.max(0.68, Math.min(1.15, 1 / Math.sqrt(Math.max(0.75, mass))));
  const speed = (6.5 + c * 12.5) * heft;
  // A small hand-release lift keeps flat throws satisfying while still respecting aim pitch.
  const lift = 0.65 + c * 0.45;
  return [fx * speed, fy * speed + lift, fz * speed];
}
