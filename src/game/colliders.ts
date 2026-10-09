export interface Box { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number }
export interface Body3 { x: number; y: number; z: number }

/** Push a vertical capsule (circle in XZ + height) out of static AABB colliders. */
export function resolveCapsule(pos: Body3, radius: number, height: number, boxes: Box[], half = Infinity): void {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of boxes) {
      if (pos.y + height <= b.minY || pos.y >= b.maxY) continue;
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2), push = radius - d;
        pos.x += (dx / d) * push; pos.z += (dz / d) * push;
      } else {
        // centre is inside the box: leave through the nearest face
        dx = Math.min(pos.x - b.minX, b.maxX - pos.x); dz = Math.min(pos.z - b.minZ, b.maxZ - pos.z);
        if (dx < dz) pos.x = pos.x - b.minX < b.maxX - pos.x ? b.minX - radius : b.maxX + radius;
        else pos.z = pos.z - b.minZ < b.maxZ - pos.z ? b.minZ - radius : b.maxZ + radius;
      }
    }
  }
  pos.x = Math.max(-half + radius, Math.min(half - radius, pos.x));
  pos.z = Math.max(-half + radius, Math.min(half - radius, pos.z));
}
