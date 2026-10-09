export const TICK_HZ = 20;
export const TICK_MS = 1000 / TICK_HZ;
export const MIN_CAP = 4;
export const MAX_CAP = 15;
export type RejectReason = 'full' | 'started' | 'version';
export const PROTOCOL = 4;

export interface PlayerInfo { id: number; name: string; ready: boolean; peer: string }
export type Vec3 = [number, number, number];

export interface PlayerState {
  p: Vec3; yaw: number; pitch: number; crouch: boolean; sprint: boolean; moving: boolean;
  held: number; flash: boolean; stamina: number;
}
export interface ItemDef { id: number; model: string; kind: 'prop' | 'loot' | 'glow'; color?: string; mat: string }
export type ItemSnap = [number, number, number, number, number, number, number, number, number];
export interface NoiseEvt { x: number; z: number; vol: number; mat: string; t: number }
export interface MonsterSnap { p: Vec3; yaw: number; mode: string }
export interface CamperSnap { id: number; x: number; y: number; z: number; foundBy: number; rescued: boolean }
export interface GameSnap {
  t: 's'; time: number; night: boolean; players: Record<number, PlayerState & { alive: boolean; inBus: boolean }>;
  items: ItemSnap[]; campers: CamperSnap[]; rescued: number; camperNeed: number;
  monster: MonsterSnap; noise: NoiseEvt[]; collected: number; need: number; over: '' | 'win' | 'lose';
}

export type Msg =
  | { t: 'hello'; name: string; v: number }
  | { t: 'welcome'; id: number; max: number }
  | { t: 'reject'; reason: RejectReason }
  | { t: 'roster'; players: PlayerInfo[]; max: number }
  | { t: 'ready'; ready: boolean }
  | { t: 'start'; seed: number; need: number }
  | { t: 'bye' }
  | { t: 'p'; s: PlayerState }
  | { t: 'act'; a: 'pick' | 'drop' | 'throw' | 'snap' | 'night' | 'bus'; color?: string; force?: number }
  | { t: 'spawn'; def: ItemDef }
  | GameSnap;
