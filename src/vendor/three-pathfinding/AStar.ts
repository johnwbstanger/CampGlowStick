/*
 * Typed adaptation of donmccurdy/three-pathfinding src/AStar.js
 * https://github.com/donmccurdy/three-pathfinding
 * MIT License.
 *
 * Camp Glowstick preserves the library's A* search semantics and heap usage,
 * while typing the node shape used by the camp navigation grid.
 */
import { BinaryHeap } from './BinaryHeap';

export interface AStarCentroid { x: number; y?: number; z: number }
export interface AStarNode {
  neighbours: number[];
  centroid: AStarCentroid;
  cost?: number;
  f?: number;
  g?: number;
  h?: number;
  visited?: boolean;
  closed?: boolean;
  parent?: AStarNode | null;
}

const distSq = (a: AStarCentroid, b: AStarCentroid): number => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const dy = (a.y ?? 0) - (b.y ?? 0);
  return dx * dx + dy * dy + dz * dz;
};

export class AStar {
  static init(graph: AStarNode[]): void {
    for (const node of graph) {
      node.f = 0;
      node.g = 0;
      node.h = 0;
      node.cost = node.cost ?? 1;
      node.visited = false;
      node.closed = false;
      node.parent = null;
    }
  }

  static cleanUp(graph: AStarNode[]): void {
    for (const node of graph) {
      delete node.f;
      delete node.g;
      delete node.h;
      delete node.visited;
      delete node.closed;
      delete node.parent;
    }
  }

  static search(graph: AStarNode[], start: AStarNode, end: AStarNode): AStarNode[] {
    this.init(graph);
    const openHeap = new BinaryHeap<AStarNode>((node) => node.f ?? Infinity);
    openHeap.push(start);

    while (openHeap.size() > 0) {
      const currentNode = openHeap.pop();
      if (!currentNode) break;

      if (currentNode === end) {
        let curr: AStarNode | null | undefined = currentNode;
        const ret: AStarNode[] = [];
        while (curr?.parent) {
          ret.push(curr);
          curr = curr.parent;
        }
        this.cleanUp(graph);
        return ret.reverse();
      }

      currentNode.closed = true;
      for (const index of currentNode.neighbours) {
        const neighbour = graph[index];
        if (!neighbour || neighbour.closed) continue;

        const gScore = (currentNode.g ?? 0) + (neighbour.cost ?? 1);
        const beenVisited = neighbour.visited === true;
        if (!beenVisited || gScore < (neighbour.g ?? Infinity)) {
          neighbour.visited = true;
          neighbour.parent = currentNode;
          neighbour.h = neighbour.h || distSq(neighbour.centroid, end.centroid);
          neighbour.g = gScore;
          neighbour.f = neighbour.g + neighbour.h;
          if (!beenVisited) openHeap.push(neighbour);
          else openHeap.rescoreElement(neighbour);
        }
      }
    }

    this.cleanUp(graph);
    return [];
  }
}
