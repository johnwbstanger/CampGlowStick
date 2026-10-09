import * as THREE from 'three';

/** Stylized oversized camp-director emergency handgun: readable, polished, and cheap to render. */
export function makeDirectorGun(): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'director-emergency-gun';
  const metal = new THREE.MeshStandardMaterial({ color: '#24282c', roughness: .34, metalness: .68 });
  const grip = new THREE.MeshStandardMaterial({ color: '#5b4030', roughness: .72, metalness: .05 });
  const brass = new THREE.MeshStandardMaterial({ color: '#b88b42', roughness: .35, metalness: .72 });
  const glow = new THREE.MeshStandardMaterial({ color: '#ffbd52', emissive: '#ff8c28', emissiveIntensity: 3.2, roughness: .4 });

  const slide = new THREE.Mesh(new THREE.BoxGeometry(.48, .18, .16), metal); slide.position.set(.08, .16, 0); g.add(slide);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .42, 16), metal); barrel.rotation.z = Math.PI / 2; barrel.position.set(.30, .14, 0); g.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(.068, .068, .045, 16), brass); muzzle.rotation.z = Math.PI / 2; muzzle.position.set(.52, .14, 0); g.add(muzzle);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(.17, .38, .15), grip); handle.position.set(-.08, -.08, 0); handle.rotation.z = -.18; g.add(handle);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(.105, .018, 8, 18, Math.PI * 1.25), metal); guard.rotation.y = Math.PI / 2; guard.rotation.z = -.2; guard.position.set(.11, -.01, 0); g.add(guard);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(.045, .045, .06), glow); sight.position.set(.34, .275, 0); g.add(sight);
  const halo = new THREE.PointLight('#ff9b35', 4, 2.2, 2); halo.position.set(.08, .2, 0); g.add(halo);
  g.scale.setScalar(1.15);
  return g;
}
