import * as THREE from 'three';

// 만화풍 음영: 밝은 면에서 그늘로 부드럽게 넘어가는 단계
const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([150, 158, 196, 232, 250, 255, 255, 255]), 8, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();
export const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...o });
export const fabric = (_kind, color) => toon(color);
export const plastic = (color) => toon(color);
export const chrome = (color = 0x7d879c) => toon(color);
export const bead = new THREE.MeshBasicMaterial({ color: 0x2b1b24 });
export const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
export const felt = toon(0xffffff, { vertexColors: true });
export const glow = (color, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });
