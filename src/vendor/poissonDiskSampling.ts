/*
 * Vendored typed adaptation of kchapelier/poisson-disk-sampling fixed-density engine.
 * Upstream: https://github.com/kchapelier/poisson-disk-sampling
 * Copyright (c) Kevin Chapelier. MIT License.
 *
 * This keeps the upstream public API shape used by the fixed-density implementation:
 *   new PoissonDiskSampling({ shape, minDistance, maxDistance, tries }, rng).fill()
 * The original package is dimension-agnostic; Camp Glowstick uses the 2D path only.
 */

export type PDSPoint = [number, number];

export interface PoissonDiskSamplingOptions {
  shape: [number, number];
  minDistance: number;
  maxDistance?: number;
  tries?: number;
}

const squaredEuclideanDistance = (a: PDSPoint, b: PDSPoint): number => {
  const dx = a[0] - b[0], dy = a[1] - b[1];
  return dx * dx + dy * dy;
};

/** Equivalent 2D Moore neighbourhood used by the upstream fixed-density engine. */
const neighbourhood = (() => {
  const out: [number, number][] = [];
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
    const dist = Math.max(0, Math.abs(x) - 1) ** 2 + Math.max(0, Math.abs(y) - 1) ** 2;
    if (dist < 2) out.push([x, y]);
  }
  out.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
  return out;
})();

export class PoissonDiskSampling {
  readonly shape: [number, number];
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly maxTries: number;
  readonly squaredMinDistance: number;
  readonly minDistancePlusEpsilon: number;
  readonly deltaDistance: number;
  readonly cellSize: number;
  private readonly rng: () => number;
  private readonly gridShape: [number, number];
  private readonly stride: [number, number];
  private readonly grid: Uint32Array;
  private currentPoint: PDSPoint | null = null;
  private readonly processList: PDSPoint[] = [];
  private samplePoints: PDSPoint[] = [];

  constructor(options: PoissonDiskSamplingOptions, rng: () => number = Math.random) {
    this.shape = options.shape;
    this.minDistance = options.minDistance;
    this.maxDistance = options.maxDistance || options.minDistance * 2;
    this.maxTries = Math.ceil(Math.max(1, options.tries || 30));
    this.rng = rng;

    const maxShape = Math.max(...this.shape);
    const floatPrecisionMitigation = Math.max(1, (maxShape / 128) | 0);
    const epsilonDistance = 1e-14 * floatPrecisionMitigation;
    this.squaredMinDistance = this.minDistance * this.minDistance;
    this.minDistancePlusEpsilon = this.minDistance + epsilonDistance;
    this.deltaDistance = Math.max(0, this.maxDistance - this.minDistancePlusEpsilon);
    this.cellSize = this.minDistance / Math.sqrt(2);

    this.gridShape = [
      Math.ceil(this.shape[0] / this.cellSize),
      Math.ceil(this.shape[1] / this.cellSize),
    ];
    this.stride = [this.gridShape[1], 1];
    this.grid = new Uint32Array(this.gridShape[0] * this.gridShape[1]);
  }

  addRandomPoint(): PDSPoint {
    return this.directAddPoint([this.rng() * this.shape[0], this.rng() * this.shape[1]]);
  }

  addPoint(point: PDSPoint): PDSPoint | null {
    const valid = point[0] >= 0 && point[0] < this.shape[0] && point[1] >= 0 && point[1] < this.shape[1];
    return valid ? this.directAddPoint(point) : null;
  }

  private directAddPoint(point: PDSPoint): PDSPoint {
    this.processList.push(point);
    this.samplePoints.push(point);
    const gx = (point[0] / this.cellSize) | 0;
    const gy = (point[1] / this.cellSize) | 0;
    this.grid[gx * this.stride[0] + gy] = this.samplePoints.length;
    return point;
  }

  private inNeighbourhood(point: PDSPoint): boolean {
    const gx = (point[0] / this.cellSize) | 0;
    const gy = (point[1] / this.cellSize) | 0;
    for (const [ox, oy] of neighbourhood) {
      const x = gx + ox, y = gy + oy;
      if (x < 0 || y < 0 || x >= this.gridShape[0] || y >= this.gridShape[1]) continue;
      const ref = this.grid[x * this.stride[0] + y];
      if (!ref) continue;
      if (squaredEuclideanDistance(point, this.samplePoints[ref - 1]) < this.squaredMinDistance) return true;
    }
    return false;
  }

  next(): PDSPoint | null {
    while (this.processList.length > 0) {
      if (this.currentPoint === null) this.currentPoint = this.processList.shift() ?? null;
      if (!this.currentPoint) return null;
      const currentPoint = this.currentPoint;

      let tries = 0;
      for (; tries < this.maxTries; tries++) {
        const distance = this.minDistancePlusEpsilon + this.deltaDistance * this.rng();
        const angle = this.rng() * Math.PI * 2;
        const newPoint: PDSPoint = [
          currentPoint[0] + Math.cos(angle) * distance,
          currentPoint[1] + Math.sin(angle) * distance,
        ];
        const inShape = newPoint[0] >= 0 && newPoint[0] < this.shape[0] && newPoint[1] >= 0 && newPoint[1] < this.shape[1];
        if (inShape && !this.inNeighbourhood(newPoint)) return this.directAddPoint(newPoint);
      }
      if (tries === this.maxTries) this.currentPoint = null;
    }
    return null;
  }

  fill(): PDSPoint[] {
    if (this.samplePoints.length === 0) this.addRandomPoint();
    while (this.next()) { /* upstream blocking fill contract */ }
    return this.samplePoints;
  }

  getAllPoints(): PDSPoint[] { return this.samplePoints; }

  reset(): void {
    this.grid.fill(0);
    this.samplePoints = [];
    this.currentPoint = null;
    this.processList.length = 0;
  }
}
