import * as THREE from 'three';
import type { PlayerState } from '../net/protocol';
import { buildCamper, COUNSELORS, poseCamper, type Camper, type Pose } from './campers';

/** Stable gameplay actor API with imported Quaternius model/animation selection hidden underneath. */
export class CounselorActor {
  root: THREE.Group;
  private actor: Camper;
  private current: Pose = 'idle';
  private t = 0;

  constructor(id: number) {
    this.actor = buildCamper(COUNSELORS[id % COUNSELORS.length]);
    this.root = this.actor.root;
    this.root.name = `counselor-${id}`;
  }

  play(name: string): void {
    this.current = name === 'sprint' ? 'run' : name === 'walk' ? 'walk' : 'idle';
  }

  update(dt: number, state?: PlayerState): void {
    this.t += dt;
    const pose: Pose = state?.crouch ? 'hide' : this.current;
    poseCamper(this.actor, pose, this.t);
  }
}
