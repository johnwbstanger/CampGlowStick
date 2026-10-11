/*
 * Adapted from donmccurdy/three-pathfinding (MIT), itself using javascript-astar.
 * Upstream: https://github.com/donmccurdy/three-pathfinding
 * Copyright (c) 2017 Don McCurdy
 * MIT License; see THIRD_PARTY.md.
 */

export interface AStarCentroid { x: number; y: number; z: number }
export interface AStarNode {
  centroid: AStarCentroid;
  neighbours: number[];
  f?: number; g?: number; h?: number; cost?: number;
  visited?: boolean; closed?: boolean; parent?: AStarNode | null;
}

class BinaryHeap<T> {
  private content: T[] = [];
  constructor(private scoreFunction: (node: T) => number) {}
  push(element: T): void { this.content.push(element); this.sinkDown(this.content.length - 1); }
  pop(): T {
    const result = this.content[0];
    const end = this.content.pop()!;
    if (this.content.length > 0) { this.content[0] = end; this.bubbleUp(0); }
    return result;
  }
  size(): number { return this.content.length; }
  rescoreElement(node: T): void { this.sinkDown(this.content.indexOf(node)); }
  private sinkDown(n: number): void {
    const element = this.content[n];
    while (n > 0) {
      const parentN = ((n + 1) >> 1) - 1, parent = this.content[parentN];
      if (this.scoreFunction(element) < this.scoreFunction(parent)) {
        this.content[parentN] = element; this.content[n] = parent; n = parentN;
      } else break;
    }
  }
  private bubbleUp(n: number): void {
    const length = this.content.length, element = this.content[n], elemScore = this.scoreFunction(element);
    while (true) {
      const child2N = (n + 1) << 1, child1N = child2N - 1;
      let swap: number | null = null, child1Score = Infinity;
      if (child1N < length) {
        child1Score = this.scoreFunction(this.content[child1N]);
        if (child1Score < elemScore) swap = child1N;
      }
      if (child2N < length) {
        const child2Score = this.scoreFunction(this.content[child2N]);
        if (child2Score < (swap === null ? elemScore : child1Score)) swap = child2N;
      }
      if (swap === null) break;
      this.content[n] = this.content[swap]; this.content[swap] = element; n = swap;
    }
  }
}

export class ThreePathfindingAStar {
  private static init(graph: AStarNode[]): void {
    for (const node of graph) {
      node.f = 0; node.g = 0; node.h = 0; node.cost = node.cost ?? 1;
      node.visited = false; node.closed = false; node.parent = null;
    }
  }
  private static heuristic(a: AStarCentroid, b: AStarCentroid): number {
    // The upstream navmesh uses squared distance because its polygon-edge costs are geometric.
    // Glowstick's adapter graph uses per-cell movement costs; Euclidean distance is admissible here
    // and avoids the squared heuristic over-weighting long routes around buildings.
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  }
  static search(graph: AStarNode[], start: AStarNode, end: AStarNode): AStarNode[] {
    this.init(graph);
    const open = new BinaryHeap<AStarNode>((node) => node.f ?? Infinity);
    open.push(start);
    while (open.size() > 0) {
      const current = open.pop();
      if (current === end) {
        let curr: AStarNode | null | undefined = current;
        const path: AStarNode[] = [];
        while (curr?.parent) { path.push(curr); curr = curr.parent; }
        return path.reverse();
      }
      current.closed = true;
      for (const ni of current.neighbours) {
        const neighbour = graph[ni];
        if (neighbour.closed) continue;
        const gScore = (current.g ?? 0) + (neighbour.cost ?? 1);
        const visited = !!neighbour.visited;
        if (!visited || gScore < (neighbour.g ?? Infinity)) {
          neighbour.visited = true; neighbour.parent = current;
          neighbour.h = neighbour.h || this.heuristic(neighbour.centroid, end.centroid);
          neighbour.g = gScore; neighbour.f = neighbour.g + neighbour.h;
          if (!visited) open.push(neighbour); else open.rescoreElement(neighbour);
        }
      }
    }
    return [];
  }
}
