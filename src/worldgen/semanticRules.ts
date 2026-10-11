import type { SemanticAssetRule } from './semanticTypes';

/**
 * Asset-allocation rules. An asset is not eligible merely because there is empty XYZ space.
 * It must belong to a room/district/socket that gives it a believable purpose.
 */
export const SEMANTIC_ASSET_RULES: SemanticAssetRule[] = [
  { asset: 'bunk', allowedRooms: ['sleeping'], allowedSockets: ['bunk-wall'], forbiddenOutdoors: true, maxPerRoom: 6, narrativeRole: 'camper sleeping furniture' },
  { asset: 'bedSingle', allowedRooms: ['sleeping', 'counselor-corner'], allowedSockets: ['single-bed'], forbiddenOutdoors: true, maxPerRoom: 2, narrativeRole: 'counselor or staff bed' },
  { asset: 'sink', allowedRooms: ['kitchen', 'washroom'], allowedSockets: ['sink', 'counter'], forbiddenOutdoors: true, maxPerRoom: 3, narrativeRole: 'washing / food-prep fixture' },
  { asset: 'table', allowedRooms: ['sleeping', 'dining', 'activity', 'office', 'workshop'], allowedSockets: ['table-center', 'desk', 'counter'], forbiddenOutdoors: true, narrativeRole: 'primary work/eating surface' },
  { asset: 'chair', allowedRooms: ['dining', 'activity', 'office'], allowedSockets: ['chair'], forbiddenOutdoors: true, narrativeRole: 'seating paired with tables/desks' },
  { asset: 'bookshelf', allowedRooms: ['office', 'activity', 'storage', 'pantry'], allowedSockets: ['shelf'], forbiddenOutdoors: true, narrativeRole: 'organized storage' },
  { asset: 'teddy', allowedRooms: ['sleeping'], allowedSockets: ['bed-top', 'shelf-surface'], forbiddenOutdoors: true, maxPerRoom: 2, narrativeRole: 'personal camper possession' },
  { asset: 'radio', allowedRooms: ['office', 'workshop', 'storage'], allowedDistricts: ['waterfront'], allowedSockets: ['desk', 'shelf-surface', 'counter'], narrativeRole: 'staff communications equipment' },
  { asset: 'axe', allowedRooms: ['workshop', 'storage'], allowedDistricts: ['maintenance', 'campfire'], allowedSockets: ['wall-hook', 'floor-wall'], narrativeRole: 'wood/maintenance tool' },
  { asset: 'cooler', allowedRooms: ['storage', 'kitchen'], allowedDistricts: ['waterfront', 'tent-camping', 'program', 'campfire'], allowedSockets: ['floor-wall', 'porch'], narrativeRole: 'food/drink storage near group activity' },
  { asset: 'lantern', allowedRooms: ['sleeping', 'office', 'workshop', 'storage'], allowedDistricts: ['tent-camping', 'campfire', 'waterfront'], allowedSockets: ['table-surface', 'shelf-surface', 'wall-hook', 'porch'], narrativeRole: 'portable camp lighting' },
  { asset: 'backpack', allowedRooms: ['sleeping', 'storage'], allowedDistricts: ['tent-camping', 'waterfront', 'program'], allowedSockets: ['floor-wall', 'bed-under', 'porch'], narrativeRole: 'camper/counselor personal gear' },
  { asset: 'mug', allowedRooms: ['dining', 'kitchen', 'office', 'sleeping'], allowedDistricts: ['campfire', 'tent-camping'], allowedSockets: ['table-surface', 'shelf-surface', 'counter'], narrativeRole: 'evidence of eating/drinking' },
  { asset: 'can', allowedRooms: ['dining', 'kitchen', 'pantry', 'workshop'], allowedDistricts: ['campfire', 'tent-camping'], allowedSockets: ['table-surface', 'shelf-surface', 'counter'], narrativeRole: 'food/supply clutter' },
  { asset: 'bottle', allowedRooms: ['dining', 'kitchen', 'office', 'workshop'], allowedDistricts: ['waterfront', 'campfire', 'program', 'tent-camping'], allowedSockets: ['table-surface', 'shelf-surface', 'counter'], narrativeRole: 'drink/utility container' },
  { asset: 'bucket', allowedRooms: ['kitchen', 'washroom', 'workshop', 'storage'], allowedDistricts: ['waterfront', 'maintenance'], allowedSockets: ['floor-wall'], narrativeRole: 'cleaning/utility container' },
  { asset: 'barrel', allowedRooms: ['workshop', 'storage'], allowedDistricts: ['maintenance'], allowedSockets: ['floor-wall'], narrativeRole: 'bulk service storage' },
  { asset: 'paddle', allowedDistricts: ['waterfront'], allowedSockets: ['wall-hook', 'floor-wall'], narrativeRole: 'waterfront equipment' },
  { asset: 'canoe', allowedDistricts: ['waterfront'], narrativeRole: 'waterfront boating equipment' },
  { asset: 'logs', allowedDistricts: ['campfire', 'maintenance'], narrativeRole: 'firewood / maintenance stock' },
  { asset: 'tent', allowedDistricts: ['tent-camping'], narrativeRole: 'designated camping-site shelter' },
  // Socks are personal interior dressing only. This explicitly prevents the current "socks all over camp" failure.
  { asset: 'sock', allowedRooms: ['sleeping'], allowedSockets: ['bed-top', 'bed-under', 'floor-wall'], forbiddenOutdoors: true, maxPerRoom: 2, narrativeRole: 'personal clothing clutter near a camper bunk' },
];

export const ruleFor = (asset: SemanticAssetRule['asset']): SemanticAssetRule | undefined => SEMANTIC_ASSET_RULES.find((r) => r.asset === asset);
