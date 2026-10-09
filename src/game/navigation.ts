import type { Box } from './colliders';
import { WORLD_HALF } from './constants';

export interface NavPoint { x: number; z: number }

const key = (x: number, z: number) => `${x},${z}`;

function blocked(x: number, z: number, colliders: Box[], radius: number): boolean {
  if (Math.abs(x) > WORLD_HALF - radius || Math.abs(z) > WORLD_HALF - radius) return true;
  for (const b of colliders) {
    if (b.maxY < 0.65) continue;
    if (x >= b.minX - radius && x <= b.maxX + radius && z >= b.minZ - radius && z <= b.maxZ + radius) return true;
  }
  return false;
}

export function navLineClear(a: NavPoint, b: NavPoint, colliders: Box[], radius: number): boolean {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(d / 0.8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocked(a.x + dx * t, a.z + dz * t, colliders, radius)) return false;
  }
  return true;
}

export function findRoute(start: NavPoint, goal: NavPoint, colliders: Box[], radius: number, cell = 3): NavPoint[] {
  if (navLineClear(start, goal, colliders, radius)) return [goal];

  const toCell = (v: number) => Math.round(v / cell);
  const sx = toCell(start.x), sz = toCell(start.z), gx = toCell(goal.x), gz = toCell(goal.z);
  const minC = Math.ceil((-WORLD_HALF + radius) / cell), maxC = Math.floor((WORLD_HALF - radius) / cell);
  const open: { x: number; z: number; f: number }[] = [{ x: sx, z: sz, f: 0 }];
  const came = new Map<string, string>();
  const gScore = new Map<string, number>([[key(sx, sz), 0]]);
  const closed = new Set<string>();
  const coords = new Map<string, [number, number]>([[key(sx, sz), [sx, sz]]]);
  const heuristic = (x: number, z: number) => Math.hypot(gx - x, gz - z);
  const dirs = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
  ] as const;

  let found = '';
  for (let expanded = 0; open.length && expanded < 6500; expanded++) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const cur = open.splice(best, 1)[0], ck = key(cur.x, cur.z);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (Math.abs(cur.x - gx) <= 1 && Math.abs(cur.z - gz) <= 1) { found = ck; break; }

    for (const [ox, oz, cost] of dirs) {
      const nx = cur.x + ox, nz = cur.z + oz;
      if (nx < minC || nx > maxC || nz < minC || nz > maxC) continue;
      const wx = nx * cell, wz = nz * cell;
      if (blocked(wx, wz, colliders, radius)) continue;
      if (ox && oz && (blocked((cur.x + ox) * cell, cur.z * cell, colliders, radius) || blocked(cur.x * cell, (cur.z + oz) * cell, colliders, radius))) continue;
      const nk = key(nx, nz), tentative = (gScore.get(ck) ?? Infinity) + cost;
      if (tentative >= (gScore.get(nk) ?? Infinity)) continue;
      came.set(nk, ck); coords.set(nk, [nx, nz]); gScore.set(nk, tentative);
      open.push({ x: nx, z: nz, f: tentative + heuristic(nx, nz) });
    }
  }
  if (!found) return [];

  const cells: [number, number][] = [];
  let k = found;
  while (k !== key(sx, sz)) {
    const p = coords.get(k); if (!p) break;
    cells.push(p); const prev = came.get(k); if (!prev) break; k = prev;
  }
  cells.reverse();
  const raw: NavPoint[] = cells.map(([x, z]) => ({ x: x * cell, z: z * cell }));
  raw.push(goal);

  const out: NavPoint[] = [];
  let anchor: NavPoint = start, i = 0;
  while (i < raw.length) {
    let far = i;
    for (let j = raw.length - 1; j >= i; j--) {
      if (navLineClear(anchor, raw[j], colliders, radius)) { far = j; break; }
    }
    out.push(raw[far]); anchor = raw[far]; i = far + 1;
  }
  return out;
}

/** Backward-compatible numeric wrapper used by older tests/tools. */
export function findPath(sx: number, sz: number, gx: number, gz: number, colliders: Box[], radius: number, cell = 3): NavPoint[] {
  return findRoute({ x: sx, z: sz }, { x: gx, z: gz }, colliders, radius, cell);
}
