// Ported from johnwbstanger/Camp_Snallygaster/shared/GameHost.ts.
// Keep the original formation constants/slot math so Camp Glowstick uses the proven Snallygaster escort feel.
// Collision/nav is applied by HostSim after this target is calculated.

export const SNALLY_FOLLOW_DISTANCE = 2.25;
export const SNALLY_FOLLOW_SPEED = 3.4;
export const SNALLY_BOARD_DISTANCE = 5.5;

export interface FollowPlan {
  targetX: number;
  targetZ: number;
  speed: number;
  stopRadius: number;
}

/**
 * Exact Snallygaster-style rear formation: three campers per rank, with successive ranks 0.7m farther back.
 * The original GameHost chooses speed from target error (d * 3.2), capped at 3.4m/s.
 */
export function snallyFollowerPlan(
  camperIndex: number,
  playerX: number,
  playerZ: number,
  playerYaw: number,
  camperX: number,
  camperZ: number,
  playerSprint = false,
): FollowPlan {
  const angle = (camperIndex % 3 - 1) * 0.34;
  const ring = Math.floor(camperIndex / 3);
  const radius = SNALLY_FOLLOW_DISTANCE + ring * 0.7;
  const rearYaw = playerYaw + Math.PI + angle;
  const targetX = playerX - Math.sin(rearYaw) * radius;
  const targetZ = playerZ - Math.cos(rearYaw) * radius;
  const d = Math.hypot(targetX - camperX, targetZ - camperZ);

  // Preserve the original Snallygaster cap, but allow a counselor sprint to pull the group without
  // permanently losing campers. Normal walking behavior remains the original implementation.
  const cap = playerSprint ? 5.7 : SNALLY_FOLLOW_SPEED;
  return { targetX, targetZ, speed: Math.min(cap, d * 3.2), stopRadius: 0.08 };
}

/** Smooth velocity change around the proven target, avoiding frame-dependent position snapping. */
export function steeringVelocity(dx: number, dz: number, maxSpeed: number, currentVx: number, currentVz: number, dt: number): [number, number] {
  const d = Math.hypot(dx, dz);
  if (d < 1e-5 || maxSpeed <= 0) {
    const k = Math.min(1, dt * 10);
    return [currentVx * (1 - k), currentVz * (1 - k)];
  }
  const desiredVx = dx / d * maxSpeed;
  const desiredVz = dz / d * maxSpeed;
  const responsiveness = Math.min(1, dt * 8);
  return [
    currentVx + (desiredVx - currentVx) * responsiveness,
    currentVz + (desiredVz - currentVz) * responsiveness,
  ];
}
