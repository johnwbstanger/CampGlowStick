import type { Box } from './colliders';
import { queryBoxes } from './colliders';
import { CAMP_PLAN } from './campPlan';
import { WORLD_HALF } from './constants';
import { terrainHeight, terrainSlope } from './terrain';
import { ThreePathfindingAStar, type AStarNode } from '../vendor/threePathfindingAStar';

export interface NavPoint { x: number; z: number }

function inLake(x: number, z: number, radius = 0): boolean {
  const w = CAMP_PLAN.lake;
  return ((x - w.x) / Math.max(1, w.rx - radius)) ** 2 + ((z - w.z) / Math.max(1, w.rz - radius)) ** 2 < 1;
}

function blocked(x: number, z: number, colliders: Box[], radius: number): boolean {
  if (Math.abs(x) > WORLD_HALF - radius || Math.abs(z) > WORLD_HALF - radius) return true;
  if (inLake(x, z, radius + .45) || terrainSlope(x, z) > .49) return true;
  for (const b of queryBoxes(colliders, x, z, radius + 1)) {
    if (b.maxY < terrainHeight(x, z) + .65) continue;
    if (x >= b.minX - radius && x <= b.maxX + radius && z >= b.minZ - radius && z <= b.maxZ + radius) return true;
  }
  return false;
}

export function navLineClear(a: NavPoint, b: NavPoint, colliders: Box[], radius: number): boolean {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(d / .8));
  let previousY = terrainHeight(a.x, a.z);
  for (let i = 1; i < steps; i++) {
    const t = i / steps, x = a.x + dx * t, z = a.z + dz * t;
    if (blocked(x, z, colliders, radius)) return false;
    const y = terrainHeight(x, z);
    if (Math.abs(y - previousY) > .55) return false;
    previousY = y;
  }
  return true;
}

/**
 * Terrain-aware adapter around the vendored MIT three-pathfinding/javascript-astar core. The mature
 * upstream search implementation owns A*; Camp Glowstick only supplies a deterministic walkability
 * graph generated from the authored world, then string-pulls the result against real colliders.
 */
export function findRoute(start: NavPoint, goal: NavPoint, colliders: Box[], radius: number, cell = 3): NavPoint[] {
  if (navLineClear(start, goal, colliders, radius)) return [goal];

  const minC = Math.ceil((-WORLD_HALF + radius) / cell), maxC = Math.floor((WORLD_HALF - radius) / cell);
  const toCell = (v: number) => Math.max(minC, Math.min(maxC, Math.round(v / cell)));
  const sx = toCell(start.x), sz = toCell(start.z), gx = toCell(goal.x), gz = toCell(goal.z);
  const nodes: AStarNode[] = [], index = new Map<string, number>();
  const key = (x: number, z: number) => `${x},${z}`;

  for (let z = minC; z <= maxC; z++) for (let x = minC; x <= maxC; x++) {
    const wx = x * cell, wz = z * cell;
    if (blocked(wx, wz, colliders, radius)) continue;
    index.set(key(x, z), nodes.length);
    nodes.push({ centroid: { x: wx, y: terrainHeight(wx, wz), z: wz }, neighbours: [], cost: 1 });
  }

  const dirs = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]] as const;
  for (const [gridKey, i] of index) {
    const [x, z] = gridKey.split(',').map(Number), node = nodes[i];
    for (const [ox, oz, cost] of dirs) {
      const ni = index.get(key(x + ox, z + oz)); if (ni === undefined) continue;
      if (ox && oz && (index.get(key(x + ox, z)) === undefined || index.get(key(x, z + oz)) === undefined)) continue;
      const dh = Math.abs(nodes[ni].centroid.y - node.centroid.y);
      if (dh > cell * .52) continue;
      node.neighbours.push(ni);
      nodes[ni].cost = Math.min(nodes[ni].cost ?? cost, cost * (1 + dh * .12));
    }
  }

  const nearestNode = (cx: number, cz: number): AStarNode | undefined => {
    const exact = index.get(key(cx, cz)); if (exact !== undefined) return nodes[exact];
    let best: AStarNode | undefined, bestD = Infinity; const wx = cx * cell, wz = cz * cell;
    for (const n of nodes) { const d = (n.centroid.x - wx) ** 2 + (n.centroid.z - wz) ** 2; if (d < bestD) { bestD = d; best = n; } }
    return best;
  };

  const startNode = nearestNode(sx, sz), endNode = nearestNode(gx, gz); if (!startNode || !endNode) return [];
  const pathNodes = ThreePathfindingAStar.search(nodes, startNode, endNode); if (!pathNodes.length) return [];
  const raw: NavPoint[] = pathNodes.map((n) => ({ x: n.centroid.x, z: n.centroid.z })); raw.push(goal);

  const out: NavPoint[] = []; let anchor = start, i = 0;
  while (i < raw.length) {
    let far = i;
    for (let j = raw.length - 1; j >= i; j--) if (navLineClear(anchor, raw[j], colliders, radius)) { far = j; break; }
    out.push(raw[far]); anchor = raw[far]; i = far + 1;
  }
  return out;
}

export function findPath(sx: number, sz: number, gx: number, gz: number, colliders: Box[], radius: number, cell = 3): NavPoint[] {
  return findRoute({ x: sx, z: sz }, { x: gx, z: gz }, colliders, radius, cell);
}
