export const TICK_HZ = 20;
export const TICK_MS = 1000 / TICK_HZ;
export const MIN_CAP = 4;
export const MAX_CAP = 15;
export type RejectReason = 'full' | 'started' | 'version';
export const PROTOCOL = 2;

export interface PlayerInfo { id: number; name: string; ready: boolean; peer: string }
export type Vec3 = [number, number, number];

/** Per-player state a client streams to the host at 20 Hz. */
export interface PlayerState {
  p: Vec3; yaw: number; pitch: number; crouch: boolean; sprint: boolean; moving: boolean;
  held: number; flash: boolean; stamina: number;
}
export interface ItemDef { id: number; model: string; kind: 'prop' | 'loot' | 'glow'; color?: string; mat: string }
/** id, x,y,z, qx,qy,qz,qw, holder(-1 = none) */
export type ItemSnap = [number, number, number, number, number, number, number, number, number];
export interface NoiseEvt { x: number; z: number; vol: number; mat: string; t: number }
export interface MonsterSnap { p: Vec3; yaw: number; mode: string }
export interface GameSnap {
  t: 's'; time: number; night: boolean; players: Record<number, PlayerState & { alive: boolean }>;
  items: ItemSnap[]; monster: MonsterSnap; noise: NoiseEvt[]; collected: number; need: number; over: '' | 'win' | 'lose';
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
  | { t: 'act'; a: 'pick' | 'drop' | 'throw' | 'snap' | 'night'; color?: string; force?: number }
  | { t: 'spawn'; def: ItemDef }
  | GameSnap;
