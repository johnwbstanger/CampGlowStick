export type LandmarkKind = 'dining' | 'director' | 'bathhouse' | 'arts' | 'kitchen';

export interface LandmarkDef {
  kind: LandmarkKind;
  label: string;
  x: number;
  z: number;
  rot: number;
  w: number;
  d: number;
  h: number;
}

/**
 * Named buildings are kept separate from imported cabin assets so they can have real interiors,
 * doorway gaps and gameplay-specific furnishings without replacing the environment art family.
 */
export const LANDMARKS: LandmarkDef[] = [
  { kind: 'dining', label: 'DINING HALL', x: -2, z: -20, rot: 0, w: 15, d: 9, h: 3.7 },
  { kind: 'kitchen', label: 'KITCHEN / PANTRY', x: -2, z: -29.5, rot: 0, w: 10, d: 7, h: 3.3 },
  { kind: 'director', label: 'DIRECTOR', x: -27, z: 3, rot: Math.PI / 2, w: 8.5, d: 6.5, h: 3.2 },
  { kind: 'bathhouse', label: 'BATHHOUSE', x: 39, z: 12, rot: -0.12, w: 10.5, d: 7.5, h: 3.2 },
  { kind: 'arts', label: 'ARTS & CRAFTS', x: -18, z: 58, rot: 0.18, w: 11.5, d: 8, h: 3.4 },
];
