import type { BuildingTemplate, District, Footprint, RoomTemplate, SemanticSocket } from './semanticTypes';

/**
 * Camp-layout reference basis
 * ---------------------------
 * These templates are intentionally simple and one-story. They are based on recurring real-world
 * overnight-camp planning patterns: sleeping cabins grouped on pedestrian loops, centralized dining,
 * nearby bathhouse/shower buildings, a separated service/maintenance zone, and a waterfront/program
 * zone reached by paths rather than random scatter.
 *
 * Reference set used for the planning model (kept here so the generator stays grounded in real camp
 * organization instead of free-form guesses):
 * - Camp Shenandoah master plan: https://www.campshenandoah.org/about-camp-shenandoah/camp-master-plan/
 * - Camp Y-Noah planning precedent: https://tcarchitects.com/project/akron-area-ymca-camp-y-noah/
 * - Deer Lake camp planning precedent: https://www.huestistucker.com/projects/deer-lake-dining-hall
 *
 * Exact building geometry remains asset-driven; these dimensions are gameplay envelopes and semantic
 * room/socket plans, not claims that those public facilities use these exact measurements.
 */

const socket = (id: string, kind: SemanticSocket['kind'], x: number, z: number, rot = 0, y = 0): SemanticSocket => ({ id, kind, x, y, z, rot });
const room = (id: string, kind: RoomTemplate['kind'], local: Footprint, sockets: SemanticSocket[]): RoomTemplate => ({ id, kind, local, sockets });

export const ONE_STORY_BUNK_CABIN: BuildingTemplate = {
  id: 'bunk-cabin-12x24',
  kind: 'cabin',
  asset: 'cabin',
  footprint: { w: 7.3, d: 4.3 },
  floors: 1,
  tags: ['one-story', 'sleeping', 'rustic', 'porch-facing-path'],
  rooms: [
    room('sleeping', 'sleeping', { cx: 0, cz: 0, w: 6.7, d: 3.7, rot: 0 }, [
      socket('bunk-a', 'bunk-wall', -2.45, -1.15, Math.PI / 2),
      socket('bunk-b', 'bunk-wall', -2.45, 1.15, Math.PI / 2),
      socket('bunk-c', 'bunk-wall', 2.45, -1.15, -Math.PI / 2),
      socket('bunk-d', 'bunk-wall', 2.45, 1.15, -Math.PI / 2),
      socket('counselor-bed', 'single-bed', 0, -1.25, 0),
      socket('center-table', 'table-center', 0, 0.35, 0),
      socket('bag-left', 'floor-wall', -1.4, 1.45, 0),
      socket('bag-right', 'floor-wall', 1.4, 1.45, 0),
      socket('hide-under-a', 'hide-under-bed', -2.45, -1.15, 0),
      socket('hide-under-b', 'hide-under-bed', 2.45, 1.15, 0),
      socket('hide-standing', 'hide-standing', 0, 1.35, Math.PI),
    ]),
  ],
};

export const DINING_HALL_TEMPLATE: BuildingTemplate = {
  id: 'dining-hall-one-story',
  kind: 'dining-hall',
  asset: 'lodge',
  footprint: { w: 15, d: 9 },
  floors: 1,
  tags: ['central', 'public', 'large-room', 'service-adjacent'],
  rooms: [
    room('dining', 'dining', { cx: -1.8, cz: 0, w: 10, d: 8, rot: 0 }, [
      socket('table-1', 'table-center', -3, -2), socket('table-2', 'table-center', 0, -2), socket('table-3', 'table-center', 3, -2),
      socket('table-4', 'table-center', -3, 1.5), socket('table-5', 'table-center', 0, 1.5), socket('table-6', 'table-center', 3, 1.5),
      socket('hide-dining', 'hide-crouched', -4.2, 3.1),
    ]),
    room('kitchen', 'kitchen', { cx: 5.35, cz: 0, w: 3.8, d: 5.6, rot: 0 }, [
      socket('sink-main', 'sink', 5.7, -1.6, Math.PI),
      socket('counter-a', 'counter', 4.45, 1.6),
      socket('counter-b', 'counter', 5.8, 1.6),
      socket('hide-kitchen', 'hide-standing', 5.7, 2.2, Math.PI),
    ]),
    room('pantry', 'pantry', { cx: 5.3, cz: 3.1, w: 3.6, d: 1.8, rot: 0 }, [
      socket('shelf-a', 'shelf', 4.55, 3.1, Math.PI / 2),
      socket('shelf-b', 'shelf', 5.95, 3.1, -Math.PI / 2),
      socket('hide-pantry', 'hide-standing', 5.25, 3.35, Math.PI),
    ]),
  ],
};

export const BATHHOUSE_TEMPLATE: BuildingTemplate = {
  id: 'bathhouse-one-story',
  kind: 'bathhouse',
  asset: 'shed',
  footprint: { w: 10.5, d: 7.5 },
  floors: 1,
  tags: ['utility', 'wet-room', 'near-cabins'],
  rooms: [
    room('washroom', 'washroom', { cx: -2.1, cz: 0, w: 5.1, d: 6.6, rot: 0 }, [
      socket('sink-a', 'sink', -3.8, -1.9, 0), socket('sink-b', 'sink', -2.2, -1.9, 0),
      socket('hide-wash', 'hide-standing', -4.1, 2.1, Math.PI),
    ]),
    room('showers', 'shower', { cx: 2.7, cz: 0, w: 4, d: 6.6, rot: 0 }, [
      socket('hide-shower', 'hide-standing', 3.6, 2.15, Math.PI),
    ]),
  ],
};

export const MAINTENANCE_TEMPLATE: BuildingTemplate = {
  id: 'maintenance-one-story',
  kind: 'maintenance',
  asset: 'shed',
  footprint: { w: 8, d: 6 },
  floors: 1,
  tags: ['service', 'vehicle-access', 'away-from-cabins'],
  rooms: [
    room('workshop', 'workshop', { cx: 0, cz: 0, w: 7.2, d: 5.2, rot: 0 }, [
      socket('bench', 'counter', -2.3, -1.7, 0),
      socket('tool-wall', 'wall-hook', 2.7, -1.5, -Math.PI / 2),
      socket('storage', 'shelf', 2.7, 1.3, -Math.PI / 2),
      socket('hide-workshop', 'hide-crouched', -2.7, 1.7, Math.PI),
    ]),
  ],
};

export const DEFAULT_DISTRICTS: District[] = [
  { id: 'arrival', kind: 'arrival', footprint: { cx: 30, cz: 4, w: 32, d: 18, rot: 0 } },
  { id: 'admin', kind: 'administration', footprint: { cx: -18, cz: 8, w: 24, d: 20, rot: 0 } },
  { id: 'dining', kind: 'dining', footprint: { cx: 5, cz: -14, w: 32, d: 24, rot: 0 } },
  { id: 'cabins-west', kind: 'cabin-loop', footprint: { cx: -58, cz: 16, w: 66, d: 56, rot: -0.08 } },
  { id: 'cabins-south', kind: 'cabin-loop', footprint: { cx: -8, cz: -58, w: 84, d: 42, rot: 0.04 } },
  { id: 'waterfront', kind: 'waterfront', footprint: { cx: 86, cz: -4, w: 38, d: 46, rot: 0 } },
  { id: 'maintenance', kind: 'maintenance', footprint: { cx: -98, cz: -48, w: 28, d: 24, rot: 0 } },
  { id: 'program', kind: 'program', footprint: { cx: -8, cz: 60, w: 42, d: 30, rot: 0 } },
];
