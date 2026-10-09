import { describe, expect, it } from 'vitest';
import { CODE_RE, WORDS, generateCode, isValidCode, normalizeCode, peerIdFor } from '../../src/net/codes';

describe('lobby codes', () => {
  it('matches ^[a-z]+\\d{2}$ for many random codes', () => {
    for (let i = 0; i < 500; i++) expect(generateCode()).toMatch(/^[a-z]+\d{2}$/);
  });
  it('retries on collision and throws when exhausted', () => {
    const seq = [0, 0, 0, 0, 0.5, 0.5];
    let n = 0;
    const taken = new Set([WORDS[0] + '00']);
    const code = generateCode((c) => taken.has(c), () => seq[n++ % seq.length]);
    expect(taken.has(code)).toBe(false);
    expect(() => generateCode(() => true)).toThrow();
  });
  it('maps to the host peer id and normalises input', () => {
    expect(peerIdFor('pine21')).toBe('campglowstick-pine21');
    expect(normalizeCode('  Pine 21 ')).toBe('pine21');
    expect(isValidCode('pine21')).toBe(true);
    expect(isValidCode('zzz')).toBe(false);
    expect(CODE_RE.test('neon42')).toBe(true);
  });
});
