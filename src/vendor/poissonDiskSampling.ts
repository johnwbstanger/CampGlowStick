/*
 * Fixed-density Poisson-disk sampler adapted from kchapelier/poisson-disk-sampling (MIT).
 * Upstream: https://github.com/kchapelier/poisson-disk-sampling
 * Copyright (c) 2015 Kevin Chapelier
 * MIT License; see THIRD_PARTY.md.
 */

export interface PoissonOptions {
  shape: [number, number];
  minDistance: number;
  maxDistance?: number;
  tries?: number;
}

const moore = (range: number, dimensions: number): number[][] => {
  const size = range * 2 + 1, length = Math.pow(size, dimensions) - 1, neighbors: number[][] = new Array(length);
  for (let i = 0; i < length; i++) {
    const neighbor = neighbors[i] = new Array(dimensions);
    let index = i < length / 2 ? i : i + 1;
    for (let dimension = 1; dimension <= dimensions; dimension++) {
      const value = index % Math.pow(size, dimension);
      neighbor[dimension - 1] = value / Math.pow(size, dimension - 1) - range;
      index -= value;
    }
  }
  return neighbors;
};

const neighbourhood2d = (() => {
  const ns = moore(2, 2).filter((n) => {
    let dist = 0;
    for (let d = 0; d < 2; d++) dist += Math.pow(Math.max(0, Math.abs(n[d]) - 1), 2);
    return dist < 2;
  });
  ns.push([0, 0]);
  ns.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
  return ns;
})();

export class PoissonDiskSampling2D {
  private readonly shape: [number, number];
  private readonly minDistance: number;
  private readonly maxDistance: number;
  private readonly maxTries: number;
  private readonly rng: () => number;
  private readonly cellSize: number;
  private readonly squaredMinDistance: number;
  private readonly deltaDistance: number;
  private readonly minDistancePlusEpsilon: number;
  private readonly gridW: number;
  private readonly gridH: number;
  private readonly grid: Int32Array;
  private processList: [number, number][] = [];
  private samplePoints: [number, number][] = [];
  private currentPoint: [number, number] | null = null;

  constructor(options: PoissonOptions, rng: () => number = Math.random) {
    this.shape = options.shape;
    this.minDistance = options.minDistance;
    this.maxDistance = options.maxDistance ?? options.minDistance * 2;
    this.maxTries = Math.ceil(Math.max(1, options.tries ?? 30));
    this.rng = rng;
    const maxShape = Math.max(...this.shape);
    const epsilon = 1e-14 * Math.max(1, (maxShape / 128) | 0);
    this.squaredMinDistance = this.minDistance * this.minDistance;
    this.minDistancePlusEpsilon = this.minDistance + epsilon;
    this.deltaDistance = Math.max(0, this.maxDistance - this.minDistancePlusEpsilon);
    this.cellSize = this.minDistance / Math.sqrt(2);
    this.gridW = Math.ceil(this.shape[0] / this.cellSize);
    this.gridH = Math.ceil(this.shape[1] / this.cellSize);
    this.grid = new Int32Array(this.gridW * this.gridH);
  }

  private directAddPoint(point: [number, number]): [number, number] {
    this.processList.push(point); this.samplePoints.push(point);
    const gx = (point[0] / this.cellSize) | 0, gy = (point[1] / this.cellSize) | 0;
    this.grid[gx + gy * this.gridW] = this.samplePoints.length;
    return point;
  }

  private inNeighbourhood(point: [number, number]): boolean {
    const gx = (point[0] / this.cellSize) | 0, gy = (point[1] / this.cellSize) | 0;
    for (const [ox, oy] of neighbourhood2d) {
      const x = gx + ox, y = gy + oy;
      if (x < 0 || y < 0 || x >= this.gridW || y >= this.gridH) continue;
      const ref = this.grid[x + y * this.gridW];
      if (!ref) continue;
      const p = this.samplePoints[ref - 1], dx = point[0] - p[0], dy = point[1] - p[1];
      if (dx * dx + dy * dy < this.squaredMinDistance) return true;
    }
    return false;
  }

  addRandomPoint(): [number, number] {
    return this.directAddPoint([this.rng() * this.shape[0], this.rng() * this.shape[1]]);
  }

  next(): [number, number] | null {
    while (this.processList.length > 0) {
      if (!this.currentPoint) this.currentPoint = this.processList.shift()!;
      const current = this.currentPoint;
      for (let tries = 0; tries < this.maxTries; tries++) {
        const distance = this.minDistancePlusEpsilon + this.deltaDistance * this.rng();
        const angle = this.rng() * Math.PI * 2;
        const point: [number, number] = [current[0] + Math.cos(angle) * distance, current[1] + Math.sin(angle) * distance];
        if (point[0] < 0 || point[1] < 0 || point[0] >= this.shape[0] || point[1] >= this.shape[1]) continue;
        if (!this.inNeighbourhood(point)) return this.directAddPoint(point);
      }
      this.currentPoint = null;
    }
    return null;
  }

  fill(): [number, number][] {
    if (!this.samplePoints.length) this.addRandomPoint();
    while (this.next()) { /* upstream algorithm intentionally drains process list */ }
    return this.samplePoints;
  }
}
