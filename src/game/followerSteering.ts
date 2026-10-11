// Ported from johnwbstanger/Camp_Snallygaster/shared/GameHost.ts.
// Keep the original formation constants/slot math so Camp Glowstick uses the proven Snallygaster escort feel.
// Collision/nav is applied by HostSim after this target is calculated.

export const SNALLY_FOLLOW_DISTANCE = 2.25;
export const SNALLY_FOLLOW_SPEED = 3.4;
export const SNALLY_BOARD_DISTANCE = 5.5;

export interface FollowPlan {
  radius: number;
  angle: number;
  speed: number;
  stopRadius: number;
}

/**
 * Snallygaster rear formation, adapted to HostSim's heading-based target calculation.
 * Original source uses three campers per rank, +/-0.34 rad spread and +0.7m per rank.
 *
 * HostSim's heading is playerYaw + PI, so adding PI here reproduces the original
 * target: player - forward(rearYaw) * radius.
 */
export function followerPlan(
  slot: number,
  _followerCount: number,
  distanceToPlayer: number,
  playerSprint: boolean,
  _playerMoving: boolean,
): FollowPlan {
  const angle = Math.PI + (slot % 3 - 1) * 0.34;
  const ring = Math.floor(slot / 3);
  const radius = SNALLY_FOLLOW_DISTANCE + ring * 0.7;
  const cap = playerSprint ? 5.7 : SNALLY_FOLLOW_SPEED;
  const speed = Math.min(cap, Math.max(0, distanceToPlayer - radius) * 3.2);
  return { radius, angle, speed, stopRadius: 0.08 };
}

/**
 * Direct form of the original Snallygaster target calculation, exported for deterministic tests
 * and later navmesh/crowd integration.
 */
export function snallyFollowerTarget(
  camperIndex: number,
  playerX: number,
  playerZ: number,
  playerYaw: number,
): { x: number; z: number; radius: number } {
  const angle = (camperIndex % 3 - 1) * 0.34;
  const ring = Math.floor(camperIndex / 3);
  const radius = SNALLY_FOLLOW_DISTANCE + ring * 0.7;
  const rearYaw = playerYaw + Math.PI + angle;
  return {
    x: playerX - Math.sin(rearYaw) * radius,
    z: playerZ - Math.cos(rearYaw) * radius,
    radius,
  };
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
