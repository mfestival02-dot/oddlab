import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
let seed = 20261113;
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // 매번 같은 더미가 나오게 고정
export const rand = (a, b) => a + rnd() * (b - a);
export const lighter = (hex, k = 0.5) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), k);
export const darker = (hex, k = 0.6) => new THREE.Color(hex).multiplyScalar(k);

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.userData.ctx = g;
  return t;
}
export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
}
export const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
