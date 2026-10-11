import type { Box } from './colliders';
import { WORLD_HALF } from './constants';
import { AStar, type AStarNode } from '../vendor/three-pathfinding/AStar';

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

interface GridNode extends AStarNode {
  cx: number;
  cz: number;
}

function buildGridGraph(colliders: Box[], radius: number, cell: number): { graph: GridNode[]; byCell: Map<string, number>; minC: number; maxC: number } {
  const minC = Math.ceil((-WORLD_HALF + radius) / cell);
  const maxC = Math.floor((WORLD_HALF - radius) / cell);
  const graph: GridNode[] = [];
  const byCell = new Map<string, number>();

  for (let cz = minC; cz <= maxC; cz++) {
    for (let cx = minC; cx <= maxC; cx++) {
      const x = cx * cell, z = cz * cell;
      if (blocked(x, z, colliders, radius)) continue;
      const node: GridNode = { cx, cz, centroid: { x, z }, neighbours: [], cost: 1 };
      byCell.set(key(cx, cz), graph.length);
      graph.push(node);
    }
  }

  const dirs = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
  ] as const;

  for (const node of graph) {
    for (const [ox, oz, cost] of dirs) {
      const ni = byCell.get(key(node.cx + ox, node.cz + oz));
      if (ni === undefined) continue;
      if (ox && oz) {
        if (byCell.get(key(node.cx + ox, node.cz)) === undefined || byCell.get(key(node.cx, node.cz + oz)) === undefined) continue;
      }
      graph[ni].cost = Math.min(graph[ni].cost ?? Infinity, cost);
      node.neighbours.push(ni);
    }
  }

  return { graph, byCell, minC, maxC };
}

function nearestNode(graph: GridNode[], x: number, z: number): GridNode | null {
  let best: GridNode | null = null;
  let bestD = Infinity;
  for (const node of graph) {
    const d = (node.centroid.x - x) ** 2 + (node.centroid.z - z) ** 2;
    if (d < bestD) { best = node; bestD = d; }
  }
  return best;
}

/**
 * Grid navigation now delegates A* search/open-set management to the MIT-licensed
 * three-pathfinding implementation rather than maintaining a local hand-rolled A*.
 * The camp-specific layer only builds the walkability graph from current colliders,
 * then smooths the library path with line-of-sight checks.
 */
export function findRoute(start: NavPoint, goal: NavPoint, colliders: Box[], radius: number, cell = 3): NavPoint[] {
  if (navLineClear(start, goal, colliders, radius)) return [goal];

  const { graph } = buildGridGraph(colliders, radius, cell);
  if (!graph.length) return [];
  const startNode = nearestNode(graph, start.x, start.z);
  const goalNode = nearestNode(graph, goal.x, goal.z);
  if (!startNode || !goalNode) return [];

  const pathNodes = AStar.search(graph, startNode, goalNode) as GridNode[];
  if (!pathNodes.length && startNode !== goalNode) return [];

  const raw: NavPoint[] = pathNodes.map((node) => ({ x: node.centroid.x, z: node.centroid.z }));
  raw.push(goal);

  const out: NavPoint[] = [];
  let anchor: NavPoint = start, i = 0;
  while (i < raw.length) {
    let far = i;
    for (let j = raw.length - 1; j >= i; j--) {
      if (navLineClear(anchor, raw[j], colliders, radius)) { far = j; break; }
    }
    out.push(raw[far]);
    anchor = raw[far];
    i = far + 1;
  }
  return out;
}

/** Backward-compatible numeric wrapper used by tests/tools. */
export function findPath(sx: number, sz: number, gx: number, gz: number, colliders: Box[], radius: number, cell = 3): NavPoint[] {
  return findRoute({ x: sx, z: sz }, { x: gx, z: gz }, colliders, radius, cell);
}
