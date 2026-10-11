import * as THREE from 'three';

/**
 * Camp-director emergency sidearm. Built as a proper first-person/world prop with the muzzle on -Z,
 * so the networked held-item quaternion can follow camera yaw/pitch without the old sideways spin.
 */
export function makeDirectorGun(): THREE.Object3D {
  const g = new THREE.Group();
  g.name = 'director-emergency-gun';

  const blued = new THREE.MeshStandardMaterial({ color: '#22282e', roughness: .26, metalness: .78 });
  const steel = new THREE.MeshStandardMaterial({ color: '#59636b', roughness: .24, metalness: .84 });
  const grip = new THREE.MeshStandardMaterial({ color: '#473326', roughness: .74, metalness: .03 });
  const black = new THREE.MeshStandardMaterial({ color: '#101315', roughness: .42, metalness: .34 });
  const brass = new THREE.MeshStandardMaterial({ color: '#a87934', roughness: .35, metalness: .7 });

  const slide = new THREE.Mesh(new THREE.BoxGeometry(.25, .19, .58), blued);
  slide.position.set(0, .17, -.03);
  slide.castShadow = slide.receiveShadow = true;
  g.add(slide);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(.23, .15, .44), steel);
  frame.position.set(0, .04, .02);
  frame.castShadow = frame.receiveShadow = true;
  g.add(frame);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.047, .047, .5, 18), black);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, .145, -.31);
  g.add(barrel);

  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(.061, .061, .045, 18), brass);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, .145, -.57);
  g.add(muzzle);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(.2, .38, .18), grip);
  handle.position.set(0, -.16, .13);
  handle.rotation.x = -.18;
  handle.castShadow = handle.receiveShadow = true;
  g.add(handle);

  const guard = new THREE.Mesh(new THREE.TorusGeometry(.105, .017, 8, 20, Math.PI * 1.35), black);
  guard.rotation.x = Math.PI / 2;
  guard.rotation.z = Math.PI / 2;
  guard.position.set(0, -.035, -.05);
  g.add(guard);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(.025, .09, .035), black);
  trigger.position.set(0, -.055, -.08);
  trigger.rotation.x = -.35;
  g.add(trigger);

  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(.12, .045, .035), black);
  rearSight.position.set(0, .29, .19);
  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(.035, .055, .035), black);
  frontSight.position.set(0, .29, -.47);
  g.add(rearSight, frontSight);

  // Separate named muzzle socket lets the presentation layer flash light/sparks exactly at the bore.
  const socket = new THREE.Object3D();
  socket.name = 'muzzle-socket';
  socket.position.set(0, .145, -.61);
  g.add(socket);

  g.scale.setScalar(1.18);
  g.rotation.z = -.03;
  return g;
}
