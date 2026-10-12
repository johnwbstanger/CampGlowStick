import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '../..', p), 'utf8');

describe('camp presentation contracts', () => {
  it('keeps real interactive cabin doors and cabin-floor-anchored furniture', () => {
    const world = read('src/game/world.ts');
    expect(world).toContain("makeDoor(`door:cabin:${index}`");
    expect(world).toContain('nearestCabinFloor');
    expect(world).toContain("['bunk', 'bookshelf', 'table']");
    expect(world).toContain('terrainHeight(best.x, best.z, layout)');
  });

  it('keeps the school bus enterable and visibly finished', () => {
    const world = read('src/game/world.ts');
    expect(world).toContain("doors.set('door:bus'");
    expect(world).toContain("g.name = 'usable-school-bus'");
    expect(world).toContain('addBusInterior');
    expect(world).toContain('seatMat');
    expect(world).toContain('transparent: true');
    expect(world).toContain('SpotLight');
    expect(world).toContain("color: '#e4a827'");
  });

  it('keeps landmark doorways clear for the authoritative interactive door', () => {
    const buildings = read('src/game/environmentBuildings.ts');
    expect(buildings).toContain('interactive door leaf + collider');
    expect(buildings).not.toContain('placeModule(g, door,');
  });

  it('keeps a touch-accessible way to put the map away', () => {
    const map = read('src/ui/campMap.ts');
    expect(map).toContain('camp-map-close');
    expect(map).toContain('PUT MAP AWAY');
    expect(map).toContain('this.hide()');
  });

  it('keeps audible creature approach cues wired to the game client', () => {
    const game = read('src/game/game.ts');
    const synth = read('src/audio/synth.ts');
    expect(game).toContain('creatureStep');
    expect(game).toContain('creaturePresence');
    expect(game).toContain('updateCreatureAudio');
    expect(synth).toContain('export function creatureStep');
    expect(synth).toContain('export function creaturePresence');
  });
});
