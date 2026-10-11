export interface Box { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number }
export interface Body3 { x: number; y: number; z: number }

const CELL = 10;
interface Index { size: number; cells: Map<string, Box[]> }
const cache = new WeakMap<Box[], Index>();

function spatialIndex(boxes: Box[]): Index {
  const hit = cache.get(boxes);
  if (hit && hit.size === boxes.length) return hit;
  const cells = new Map<string, Box[]>();
  for (const b of boxes) {
    const x0 = Math.floor(b.minX / CELL), x1 = Math.floor(b.maxX / CELL), z0 = Math.floor(b.minZ / CELL), z1 = Math.floor(b.maxZ / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = `${x},${z}`, list = cells.get(k);
      if (list) list.push(b); else cells.set(k, [b]);
    }
  }
  const index = { size: boxes.length, cells }; cache.set(boxes, index); return index;
}

export function queryBoxes(boxes: Box[], x: number, z: number, radius = 1): Box[] {
  if (boxes.length < 80) return boxes;
  const index = spatialIndex(boxes), seen = new Set<Box>(), out: Box[] = [];
  const x0 = Math.floor((x - radius) / CELL), x1 = Math.floor((x + radius) / CELL), z0 = Math.floor((z - radius) / CELL), z1 = Math.floor((z + radius) / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
    for (const b of index.cells.get(`${cx},${cz}`) ?? []) if (!seen.has(b)) { seen.add(b); out.push(b); }
  }
  return out;
}

export function resolveCapsule(pos: Body3, radius: number, height: number, boxes: Box[], half = Infinity): void {
  for (let pass = 0; pass < 2; pass++) {
    const candidates = queryBoxes(boxes, pos.x, pos.z, radius + .5);
    for (const b of candidates) {
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
        dx = Math.min(pos.x - b.minX, b.maxX - pos.x); dz = Math.min(pos.z - b.minZ, b.maxZ - pos.z);
        if (dx < dz) pos.x = pos.x - b.minX < b.maxX - pos.x ? b.minX - radius : b.maxX + radius;
        else pos.z = pos.z - b.minZ < b.maxZ - pos.z ? b.minZ - radius : b.maxZ + radius;
      }
    }
  }
  pos.x = Math.max(-half + radius, Math.min(half - radius, pos.x));
  pos.z = Math.max(-half + radius, Math.min(half - radius, pos.z));
}
