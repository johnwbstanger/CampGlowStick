export interface FollowPlan {
  radius: number;
  angle: number;
  speed: number;
  stopRadius: number;
}

/**
 * A compact escort formation tuned for first-person co-op: campers stay visibly near the counselor
 * without stacking into the camera or stretching into a long conga line.
 */
export function followerPlan(slot: number, followerCount: number, distanceToPlayer: number, playerSprint: boolean, playerMoving: boolean): FollowPlan {
  const row = Math.floor(slot / 3);
  const col = slot % 3;
  const rowCount = Math.min(3, Math.max(1, followerCount - row * 3));
  const centered = col - (rowCount - 1) / 2;
  const radius = 1.65 + row * 0.55;
  const angle = Math.PI + centered * 0.38;

  const base = !playerMoving ? 2.6 : playerSprint ? 8.0 : 5.0;
  const catchup = distanceToPlayer > 6 ? 9.2 : distanceToPlayer > 4 ? 7.0 : base;
  return { radius, angle, speed: catchup, stopRadius: 0.34 };
}

export function steeringVelocity(dx: number, dz: number, maxSpeed: number, currentVx: number, currentVz: number, dt: number): [number, number] {
  const d = Math.hypot(dx, dz);
  if (d < 1e-5) {
    const k = Math.min(1, dt * 8);
    return [currentVx * (1 - k), currentVz * (1 - k)];
  }
  const desiredVx = dx / d * maxSpeed;
  const desiredVz = dz / d * maxSpeed;
  const responsiveness = Math.min(1, dt * 7.5);
  return [
    currentVx + (desiredVx - currentVx) * responsiveness,
    currentVz + (desiredVz - currentVz) * responsiveness,
  ];
}
