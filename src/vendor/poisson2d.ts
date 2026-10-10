/*
 * 2D Poisson-disk sampling adapted from Kevin Chapelier's
 * kchapelier/poisson-disk-sampling (MIT License):
 * https://github.com/kchapelier/poisson-disk-sampling
 *
 * The upstream implementation is dimension-agnostic and uses a cached grid.
 * This project keeps the same Bridson-style process but specializes it to 2D,
 * removes package dependencies, and accepts an injected deterministic RNG.
 * Copyright (c) Kevin Chapelier. MIT licensed.
 */

export type Point2 = [number, number];

export interface PoissonOptions {
  width: number;
  height: number;
  minDistance: number;
  maxDistance?: number;
  tries?: number;
  rng?: () => number;
}

/** Human-authored blue-noise sampler used for believable prop spacing inside authored zones. */
export function poisson2d(options: PoissonOptions): Point2[] {
  const rng = options.rng ?? Math.random;
  const min = options.minDistance;
  const max = options.maxDistance ?? min * 2;
  const tries = Math.max(1, Math.ceil(options.tries ?? 30));
  const cell = min / Math.SQRT2;
  const gw = Math.ceil(options.width / cell);
  const gh = Math.ceil(options.height / cell);
  const grid = new Int32Array(gw * gh);
  const active: Point2[] = [];
  const points: Point2[] = [];
  const min2 = min * min;

  const gi = (x: number, y: number) => Math.floor(x / cell) + Math.floor(y / cell) * gw;
  const add = (p: Point2) => {
    points.push(p);
    active.push(p);
    grid[gi(p[0], p[1])] = points.length;
  };
  const fits = (p: Point2) => {
    const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell);
    for (let y = Math.max(0, gy - 2); y <= Math.min(gh - 1, gy + 2); y++) {
      for (let x = Math.max(0, gx - 2); x <= Math.min(gw - 1, gx + 2); x++) {
        const idx = grid[x + y * gw];
        if (!idx) continue;
        const q = points[idx - 1];
        const dx = p[0] - q[0], dy = p[1] - q[1];
        if (dx * dx + dy * dy < min2) return false;
      }
    }
    return true;
  };

  add([rng() * options.width, rng() * options.height]);
  while (active.length) {
    const ai = Math.floor(rng() * active.length);
    const origin = active[ai];
    let placed = false;
    for (let t = 0; t < tries; t++) {
      const a = rng() * Math.PI * 2;
      const d = min + (max - min) * rng();
      const p: Point2 = [origin[0] + Math.cos(a) * d, origin[1] + Math.sin(a) * d];
      if (p[0] < 0 || p[0] >= options.width || p[1] < 0 || p[1] >= options.height || !fits(p)) continue;
      add(p);
      placed = true;
      break;
    }
    if (!placed) active.splice(ai, 1);
  }
  return points;
}
