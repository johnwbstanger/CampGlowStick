export const FUNNY = ['DO NOT EAT THE CHILI', 'CABIN 4 > CABIN 6', 'TOM + MIKE \u201981', 'PROPERTY OF CAMP GLOWSTICK', 'CABIN 6 RULES', 'THE LAKE IS NOT A BATHTUB', 'KEEP OUT - SERIOUSLY, MIKE'];
export const CREEPY = ['I SAW IT BY THE LAKE', 'IT HUMS AT NIGHT', 'DON\u2019T COUNT THE CAMPERS'];

/** Mostly stupid, occasionally creepy so the horror lands harder. */
export function pickGraffiti(rng: () => number): string {
  const pool = rng() < 0.14 ? CREEPY : FUNNY;
  return pool[Math.floor(rng() * pool.length)];
}

/** Canvas text decal (the one thing besides UI/glowsticks/flashlight cookie that is generated in code). */
export function makeDecalCanvas(text: string, creepy: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, 512, 128);
  x.font = 'bold 44px "Comic Sans MS", "Courier New", cursive';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = creepy ? '#9B2226' : '#FFFDD0';
  x.globalAlpha = 0.85;
  x.save(); x.translate(256, 64); x.rotate(creepy ? 0.03 : -0.04);
  const words = text.split(' ');
  if (text.length > 18) { x.font = 'bold 36px "Comic Sans MS", "Courier New", cursive'; x.fillText(words.slice(0, Math.ceil(words.length / 2)).join(' '), 0, -22); x.fillText(words.slice(Math.ceil(words.length / 2)).join(' '), 0, 22); }
  else x.fillText(text, 0, 0);
  x.restore();
  return c;
}
