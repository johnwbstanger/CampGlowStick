/*
 * Adapted directly from donmccurdy/three-pathfinding src/BinaryHeap.js
 * https://github.com/donmccurdy/three-pathfinding
 * Based on javascript-astar by Brian Grinstead.
 * MIT License.
 */

export class BinaryHeap<T> {
  private content: T[] = [];

  constructor(private readonly scoreFunction: (element: T) => number) {}

  push(element: T): void {
    this.content.push(element);
    this.sinkDown(this.content.length - 1);
  }

  pop(): T | undefined {
    const result = this.content[0];
    const end = this.content.pop();
    if (this.content.length > 0 && end !== undefined) {
      this.content[0] = end;
      this.bubbleUp(0);
    }
    return result;
  }

  size(): number { return this.content.length; }

  rescoreElement(node: T): void {
    const i = this.content.indexOf(node);
    if (i >= 0) this.sinkDown(i);
  }

  private sinkDown(n: number): void {
    const element = this.content[n];
    while (n > 0) {
      const parentN = ((n + 1) >> 1) - 1;
      const parent = this.content[parentN];
      if (this.scoreFunction(element) < this.scoreFunction(parent)) {
        this.content[parentN] = element;
        this.content[n] = parent;
        n = parentN;
      } else break;
    }
  }

  private bubbleUp(n: number): void {
    const length = this.content.length;
    const element = this.content[n];
    const elemScore = this.scoreFunction(element);
    while (true) {
      const child2N = (n + 1) << 1;
      const child1N = child2N - 1;
      let swap: number | null = null;
      let child1Score = Infinity;

      if (child1N < length) {
        const child1 = this.content[child1N];
        child1Score = this.scoreFunction(child1);
        if (child1Score < elemScore) swap = child1N;
      }

      if (child2N < length) {
        const child2 = this.content[child2N];
        const child2Score = this.scoreFunction(child2);
        if (child2Score < (swap === null ? elemScore : child1Score)) swap = child2N;
      }

      if (swap === null) break;
      this.content[n] = this.content[swap];
      this.content[swap] = element;
      n = swap;
    }
  }
}
