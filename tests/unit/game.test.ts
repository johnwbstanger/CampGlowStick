import { describe, expect, it } from 'vitest';
import { drainRate, stepStamina } from '../../src/game/stamina';
import { DAY_SECONDS, STAMINA } from '../../src/game/constants';
import { NoiseBus, falloff } from '../../src/game/noise';
import { MONSTER, newMonster, stepMonster } from '../../src/game/monster';
import { resolveCapsule } from '../../src/game/colliders';
import { lerpAngle } from '../../src/game/interp';
import { buildLayout } from '../../src/game/layout';
import { findPath } from '../../src/game/navigation';

describe('stamina', () => {
  it('drain = base * (1 + carry / cap)', () => {
    expect(drainRate(10, 0, 10)).toBe(10);
    expect(drainRate(10, 10, 10)).toBe(20);
    const free = STAMINA.max - stepStamina(STAMINA.max, 1, true, 0);
    const loaded = STAMINA.max - stepStamina(STAMINA.max, 1, true, STAMINA.maxWeightCap);
    expect(loaded).toBeCloseTo(free * 2);
  });
  it('regenerates and clamps', () => {
    expect(stepStamina(50, 1, false, 0)).toBe(50 + STAMINA.regen);
    expect(stepStamina(1, 10, true, 0)).toBe(0);
  });
});

describe('dusk', () => {
  it('uses a six minute sunset-to-night transition', () => {
    expect(DAY_SECONDS).toBe(360);
  });
});

describe('noise + monster', () => {
  it('falls off with distance and picks the loudest', () => {
    expect(falloff(5, 20)).toBeLessThan(falloff(5, 2));
    const bus = new NoiseBus();
    bus.emit({ x: 5, z: 0, vol: 2, mat: 'wood', t: 0 });
    bus.emit({ x: -5, z: 0, vol: 8, mat: 'metal', t: 0 });
    expect(bus.loudest(0, 0, 0)?.noise.x).toBe(-5);
    bus.prune(100);
    expect(bus.events.length).toBe(0);
  });

  it('investigates the loudest noise and catches visible prey', () => {
    const bus = new NoiseBus(), m = newMonster(0, 0);
    bus.emit({ x: 0, z: 8, vol: 8, mat: 'metal', t: 0, source: 'impact' });
    for (let i = 0; i < 5; i++) stepMonster(m, 0.1, i * 0.1, bus, [], true);
    expect(m.mode).toBe('investigate');
    expect(m.z).toBeGreaterThan(0);
    const caught = stepMonster(m, 0.1, 2, bus, [{ id: 3, x: m.x, z: m.z + MONSTER.catchDist / 2, crouch: false, alive: true }], true);
    expect(caught).toBe(3);
    expect(stepMonster(newMonster(0, 0), 0.1, 0, bus, [], false)).toBeNull();
  });

  it('redirects search toward a thrown object impact when no player is visible', () => {
    const bus = new NoiseBus(), m = newMonster(0, 0);
    m.mode = 'search'; m.tx = 0; m.tz = 4; m.timer = 3;
    bus.emit({ x: 1, z: 1, vol: 5, mat: 'step', t: 0, source: 'step' });
    bus.emit({ x: 9, z: -2, vol: 6, mat: 'can', t: 0, source: 'thrown-impact' });
    stepMonster(m, 0.1, 0.1, bus, [{ id: 1, x: 30, z: 30, crouch: false, alive: true }], true);
    expect(m.mode).toBe('investigate');
    expect(m.tx).toBe(9);
    expect(m.tz).toBe(-2);
  });

  it('visible prey still overrides a thrown-object distraction', () => {
    const bus = new NoiseBus(), m = newMonster(0, 0);
    bus.emit({ x: -8, z: 0, vol: 8, mat: 'metal', t: 0, source: 'thrown-impact' });
    stepMonster(m, 0.1, 0.1, bus, [{ id: 2, x: 0, z: 4, crouch: false, alive: true }], true);
    expect(m.mode).toBe('chase');
    expect(m.tz).toBe(4);
  });
});

describe('colliders, interp, layout', () => {
  it('pushes a capsule out of a box', () => {
    const pos = { x: 0.9, y: 0, z: 0 };
    resolveCapsule(pos, 0.35, 1.7, [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1, minY: 0, maxY: 2 }]);
    expect(pos.x).toBeGreaterThanOrEqual(1.34);
  });
  it('lerps angles the short way', () => {
    expect(lerpAngle(3.0, -3.0, 0.5)).toBeGreaterThan(3.0);
  });
  it('builds a deterministic layout', () => {
    const a = buildLayout(7), b = buildLayout(7);
    expect(a).toEqual(b);
    expect(a.items.filter((i) => i.kind === 'loot').length).toBeGreaterThanOrEqual(a.need);
  });
  it('routes around a solid building rather than through it', () => {
    const wall = [{ minX: -2, maxX: 2, minZ: -4, maxZ: 4, minY: 0, maxY: 3 }];
    const path = findPath(-8, 0, 8, 0, wall, 0.48, 2);
    expect(path.length).toBeGreaterThan(1);
    expect(path.some((p) => Math.abs(p.z) > 4)).toBe(true);
  });
});
