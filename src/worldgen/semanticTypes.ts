import type { AssetName } from '../assets/manifest';

export type CampDistrictKind =
  | 'arrival'
  | 'administration'
  | 'dining'
  | 'cabin-loop'
  | 'bathhouse'
  | 'program'
  | 'campfire'
  | 'waterfront'
  | 'maintenance'
  | 'tent-camping'
  | 'forest';

export type BuildingKind =
  | 'cabin'
  | 'dining-hall'
  | 'kitchen'
  | 'director-office'
  | 'bathhouse'
  | 'arts-crafts'
  | 'maintenance'
  | 'waterfront-shed';

export type RoomKind =
  | 'sleeping'
  | 'entry'
  | 'counselor-corner'
  | 'storage'
  | 'dining'
  | 'kitchen'
  | 'pantry'
  | 'office'
  | 'washroom'
  | 'shower'
  | 'activity'
  | 'workshop';

export type SocketKind =
  | 'bunk-wall'
  | 'single-bed'
  | 'table-center'
  | 'chair'
  | 'desk'
  | 'shelf'
  | 'counter'
  | 'sink'
  | 'floor-wall'
  | 'wall-hook'
  | 'table-surface'
  | 'shelf-surface'
  | 'bed-top'
  | 'bed-under'
  | 'porch'
  | 'hide-standing'
  | 'hide-crouched'
  | 'hide-under-bed';

export interface Footprint {
  cx: number;
  cz: number;
  w: number;
  d: number;
  rot: number;
  padding?: number;
}

export interface SemanticSocket {
  id: string;
  kind: SocketKind;
  x: number;
  y: number;
  z: number;
  rot: number;
  tags?: string[];
}

export interface RoomTemplate {
  id: string;
  kind: RoomKind;
  local: Footprint;
  sockets: SemanticSocket[];
}

export interface BuildingTemplate {
  id: string;
  kind: BuildingKind;
  asset: AssetName;
  footprint: { w: number; d: number };
  floors: 1;
  rooms: RoomTemplate[];
  tags: string[];
}

export interface BuildingPlacement {
  id: string;
  template: BuildingTemplate;
  x: number;
  z: number;
  rot: number;
}

export interface District {
  id: string;
  kind: CampDistrictKind;
  footprint: Footprint;
}

export interface SemanticAssetRule {
  asset: AssetName;
  allowedRooms?: RoomKind[];
  allowedDistricts?: CampDistrictKind[];
  allowedSockets?: SocketKind[];
  forbiddenOutdoors?: boolean;
  maxPerRoom?: number;
  narrativeRole: string;
}

export interface VegetationMask {
  x: number;
  z: number;
  radius: number;
  reason: 'building' | 'road' | 'path' | 'water' | 'campfire' | 'activity' | 'bus' | 'tent' | 'porch';
}

export interface CampPlan {
  seed: number;
  districts: District[];
  buildings: BuildingPlacement[];
  vegetationMasks: VegetationMask[];
}
