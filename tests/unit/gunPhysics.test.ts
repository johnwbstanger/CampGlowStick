import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeDirectorGun } from '../../src/game/gun';
import { propInfo } from '../../src/game/items';
import { heldPose, releaseVelocity, viewForward } from '../../src/game/viewPhysics';

describe('director gun orientation + physics contract', () => {
  it('points local muzzle down -Z and exposes a real muzzle socket beyond the barrel', () => {
    const gun = makeDirectorGun();
    const socket = gun.getObjectByName('muzzle-socket');
    expect(socket).toBeTruthy();
    expect(socket!.position.z).toBeLessThan(-0.55);
    expect(Math.abs(socket!.position.x)).toBeLessThan(0.01);

    const bounds = new THREE.Box3().setFromObject(gun).getSize(new THREE.Vector3());
    expect(bounds.z).toBeGreaterThan(bounds.x);
    expect(bounds.z).toBeGreaterThan(0.6);
  });

  it('uses camera yaw/pitch for both held orientation and shot direction', () => {
    const yaw = Math.PI / 3, pitch = -0.21;
    const forward = viewForward(yaw, pitch);
    const pose = heldPose({ p: [4, 2, -7], yaw, pitch, crouch: false }, 1.6, { forward: .64, right: .20, down: .34 });
    expect(pose.euler[0]).toBeCloseTo(-pitch, 6);
    expect(pose.euler[1]).toBeCloseTo(yaw, 6);

    const fromPlayer = [pose.position[0] - 4, pose.position[1] - (2 + 1.6 - .34), pose.position[2] + 7];
    expect(Math.sign(fromPlayer[0])).toBe(Math.sign(forward[0]));
    expect(Math.sign(fromPlayer[2])).toBe(Math.sign(forward[2]));
  });

  it('has deliberate heavy-sidearm mass and obeys mass-aware drop/throw physics', () => {
    const mass = propInfo('directorGun').mass;
    expect(mass).toBeGreaterThanOrEqual(1.5);
    expect(mass).toBeLessThanOrEqual(2.5);

    const drop = releaseVelocity(0, 0, .3, mass, false);
    const throwV = releaseVelocity(0, 0, 1, mass, true);
    expect(Math.hypot(...drop)).toBeLessThan(2);
    expect(Math.hypot(...throwV)).toBeGreaterThan(6);
    expect(throwV[2]).toBeLessThan(0);
  });
});
