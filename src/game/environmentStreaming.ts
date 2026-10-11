import * as THREE from 'three';

/** Camera-distance streaming for imported environment sectors plus Three.js Water time advance. */
export function updateEnvironmentStreaming(root: THREE.Object3D, camera: THREE.Camera, dt: number): void {
  const cx = camera.position.x, cz = camera.position.z;
  root.traverse((o) => {
    const r = Number(o.userData.streamRadius ?? 0);
    if (r > 0) {
      const dx = cx - Number(o.userData.streamCenterX ?? 0), dz = cz - Number(o.userData.streamCenterZ ?? 0);
      o.visible = dx * dx + dz * dz <= r * r;
    }
    if (o.name === 'three-water-lake') {
      const material = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      const time = material?.uniforms?.time;
      if (time) time.value += Math.min(dt, .05) * .65;
    }
  });
}
