export interface RuntimeProfile {
  touchLike: boolean;
  maxPixelRatio: number;
  antialias: boolean;
  dynamicResolution: boolean;
  minPixelRatio: number;
}

export function detectRuntimeProfile(nav: Pick<Navigator, 'maxTouchPoints' | 'userAgent'> = navigator): RuntimeProfile {
  const ua = nav.userAgent || '';
  const touchLike = nav.maxTouchPoints > 0 || /iPad|iPhone|Android/i.test(ua);
  return touchLike
    ? { touchLike: true, maxPixelRatio: 1, antialias: false, dynamicResolution: true, minPixelRatio: 0.72 }
    : { touchLike: false, maxPixelRatio: 1.35, antialias: true, dynamicResolution: true, minPixelRatio: 0.9 };
}

/**
 * Conservative resolution governor. It reacts slowly so resolution changes are not visible as flicker.
 * Returns the next renderer pixel ratio.
 */
export function nextPixelRatio(current: number, fps: number, profile: RuntimeProfile, deviceRatio = devicePixelRatio): number {
  const max = Math.min(deviceRatio, profile.maxPixelRatio);
  if (!profile.dynamicResolution || fps <= 0) return Math.min(current, max);
  if (fps < 36) return Math.max(profile.minPixelRatio, Math.min(max, current - 0.08));
  if (fps > 56) return Math.min(max, current + 0.04);
  return Math.min(max, Math.max(profile.minPixelRatio, current));
}
