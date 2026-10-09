import type { AssetName } from '../assets/manifest';
import type { Material } from './noise';

export interface PropInfo { mass: number; mat: Material }
export const PROPS: Partial<Record<AssetName, PropInfo>> = {
  bucket: { mass: 2, mat: 'metal' }, bottle: { mass: 0.5, mat: 'glass' }, can: { mass: 0.3, mat: 'can' }, mug: { mass: 0.3, mat: 'enamel' },
  barrel: { mass: 6, mat: 'wood' }, paddle: { mass: 1.5, mat: 'wood' }, crate: { mass: 3, mat: 'wood' }, sock: { mass: 0.1, mat: 'cloth' },
  axe: { mass: 2, mat: 'metal' }, radio: { mass: 1, mat: 'plastic' }, lantern: { mass: 1.2, mat: 'metal' }, backpack: { mass: 3, mat: 'cloth' }, cooler: { mass: 5, mat: 'plastic' },
};
export const GLOW_MASS = 0.1;
export const propInfo = (model: string): PropInfo => PROPS[model as AssetName] ?? { mass: 1, mat: 'plastic' };
