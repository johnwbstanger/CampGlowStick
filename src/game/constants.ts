export const PLAYER = { radius: 0.35, height: 1.75, crouchHeight: 1.1, eye: 1.6, crouchEye: 1.0, walk: 3.2, sprint: 5.6, crouch: 1.6 };
export const REACH = 2.6;
/** Authored campground footprint: 360m x 360m with forested soft boundaries. */
export const WORLD_HALF = 180;
export const GLOW_COLORS: Record<string, string> = { green: '#7CFF4F', yellow: '#FFE94A', orange: '#FF8A2B', pink: '#FF5FA8', blue: '#4FB0FF' };
export const GLOW_NAMES = Object.keys(GLOW_COLORS);
/** Arrival starts at sunset and fades continuously through golden hour + blue hour to full night over six minutes. */
export const DAY_SECONDS = 360;
