export const CODE_PREFIX = 'campglowstick-';
export const CODE_RE = /^[a-z]+\d{2}$/;
export const WORDS = ['pine', 'neon', 'lake', 'camp', 'glow', 'fire', 'moss', 'owl', 'cabin', 'canoe', 'smore', 'loon', 'birch', 'ember', 'trail', 'cedar', 'pond', 'fern', 'cove', 'dusk', 'tent', 'oak', 'bark', 'wolf'];

export const normalizeCode = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, '');
export const isValidCode = (s: string): boolean => CODE_RE.test(s);
export const peerIdFor = (code: string): string => CODE_PREFIX + code;

/** word + 2 digits, retrying until `isTaken` says the code is free. */
export function generateCode(isTaken: (code: string) => boolean = () => false, rng: () => number = Math.random, maxTries = 50): string {
  for (let i = 0; i < maxTries; i++) {
    const code = WORDS[Math.floor(rng() * WORDS.length)] + String(Math.floor(rng() * 100)).padStart(2, '0');
    if (!isTaken(code)) return code;
  }
  throw new Error('no free lobby code');
}
