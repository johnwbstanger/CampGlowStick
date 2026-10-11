import { CamperActor } from './campers';

/**
 * Presentation correction for the procedural camper rig.
 *
 * The host simulation already moves campers in the correct direction, but the procedural mesh's
 * authored forward axis is opposite the heading convention used by Game. Correct the visual root
 * only; never reverse movement/pathing to compensate for an art-axis mismatch.
 *
 * Hidden campers also spawn neutral with arms down. Crouched/cover-specific hiding poses should be
 * selected by semantic hide anchors later, not applied to every undiscovered camper globally.
 */
const originalUpdate = CamperActor.prototype.update;

CamperActor.prototype.update = function camperPresentationUpdate(
  dt: number,
  moving: boolean,
  scared = false,
  hiding = false,
): void {
  if (hiding) originalUpdate.call(this, dt, false, false, false);
  else originalUpdate.call(this, dt, moving, scared, false);

  // Game currently computes movement heading with a +PI model correction. The procedural rig faces
  // the opposite local forward axis, so remove that art-only half-turn after the game applies heading.
  if (moving) this.root.rotation.y -= Math.PI;
};
