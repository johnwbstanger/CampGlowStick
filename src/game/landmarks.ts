import { CAMP_PLAN } from './campPlan';

export type LandmarkKind = 'admin' | 'dining' | 'director' | 'bathhouse' | 'arts' | 'kitchen' | 'maintenance';

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

/** Named program buildings share the master-plan coordinates used by terrain, roads and AI. */
export const LANDMARKS: LandmarkDef[] = [
  { kind: 'admin', label: 'REGISTRATION', ...CAMP_PLAN.admin, w: 9.5, d: 7.2, h: 3.2 },
  { kind: 'dining', label: 'DINING HALL', ...CAMP_PLAN.dining, w: 17.5, d: 10.5, h: 4.1 },
  { kind: 'kitchen', label: 'KITCHEN / PANTRY', ...CAMP_PLAN.kitchen, w: 11.5, d: 7.5, h: 3.4 },
  { kind: 'director', label: 'CAMP DIRECTOR', ...CAMP_PLAN.director, w: 8.8, d: 6.8, h: 3.2 },
  { kind: 'bathhouse', label: 'BATHHOUSE', ...CAMP_PLAN.bathhouse, w: 11.5, d: 8.0, h: 3.3 },
  { kind: 'arts', label: 'ARTS & CRAFTS', ...CAMP_PLAN.arts, w: 12.5, d: 8.5, h: 3.5 },
  { kind: 'maintenance', label: 'MAINTENANCE', ...CAMP_PLAN.maintenance, w: 12.0, d: 9.0, h: 3.6 },
];
