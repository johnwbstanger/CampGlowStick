import type { Layout } from './layout';

/**
 * Deterministic low-frequency terrain. This intentionally avoids noisy mountains:
 * Camp Glowstick should read as a maintained summer camp built across rolling ground.
 */
export function terrainHeight(x: number, z: number, layout?: Pick<Layout, 'water'>): number {
  const broad = Math.sin(x * 0.035) * 1.45 + Math.cos(z * 0.03) * 1.15;
  const cross = Math.sin((x + z) * 0.018) * 0.85 + Math.cos((x - z) * 0.022) * 0.55;
  let y = broad + cross;

  // Keep the arrival / central camp relatively level while leaving the larger map rolling.
  const centre = Math.hypot(x, z);
  const flatten = Math.max(0, Math.min(1, (centre - 22) / 48));
  y *= 0.35 + flatten * 0.65;

  // Carve a shallow natural lake basin at the east waterfront.
  if (layout?.water) {
    const w = layout.water;
    const nx = (x - w.x) / w.rx, nz = (z - w.z) / w.rz;
    const d = nx * nx + nz * nz;
    if (d < 1.35) {
      const bowl = Math.max(0, 1 - d / 1.35);
      y -= bowl * 3.4;
    }
  }
  return y;
}

export function isDeepWater(x: number, z: number, layout: Pick<Layout, 'water'>): boolean {
  const w = layout.water;
  if (!w) return false;
  const nx = (x - w.x) / (w.rx * 0.82), nz = (z - w.z) / (w.rz * 0.82);
  return nx * nx + nz * nz < 1;
}
