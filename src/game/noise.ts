export type Material = 'metal' | 'plastic' | 'enamel' | 'glass' | 'wood' | 'can' | 'cloth' | 'step' | 'glow';
export type NoiseSource = 'step' | 'impact' | 'thrown-impact' | 'glow' | 'interaction';
export interface Noise { x: number; z: number; vol: number; mat: string; t: number; source?: NoiseSource }

export const NOISE_TTL = 8;
export const HEAR_THRESHOLD = 0.35;
export const VOLUME = { crouch: 0.5, walk: 2, sprint: 5, throw: 3, crash: 8 };

export const falloff = (vol: number, dist: number): number => vol / (1 + (dist / 4) ** 2);

export function stepVolume(moving: boolean, crouch: boolean, sprint: boolean): number {
  if (!moving) return 0;
  return sprint ? VOLUME.sprint : crouch ? VOLUME.crouch : VOLUME.walk;
}

export const impactVolume = (speed: number, mass: number): number => Math.min(VOLUME.crash, speed * (0.6 + mass * 0.15));

export class NoiseBus {
  events: Noise[] = [];
  emit(n: Noise): void { this.events.push(n); }
  prune(now: number): void { this.events = this.events.filter((e) => now - e.t < NOISE_TTL); }

  /** Loudest recent noise as heard from (x,z). Optional predicate lets AI prioritize meaningful sound classes. */
  loudest(now: number, x: number, z: number, accept: (n: Noise) => boolean = () => true): { noise: Noise; heard: number } | null {
    let best: { noise: Noise; heard: number } | null = null;
    for (const n of this.events) {
      if (!accept(n)) continue;
      const age = now - n.t;
      if (age >= NOISE_TTL) continue;
      const heard = falloff(n.vol, Math.hypot(n.x - x, n.z - z)) * (1 - age / NOISE_TTL);
      if (heard >= HEAR_THRESHOLD && (!best || heard > best.heard)) best = { noise: n, heard };
    }
    return best;
  }
}
