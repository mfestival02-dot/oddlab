import * as THREE from 'three';
import teddyNor from '../assets/teddy_nor.jpg';
import teddyRough from '../assets/teddy_rough.jpg';
import fleeceNor from '../assets/fleece_nor.jpg';
import fleeceRough from '../assets/fleece_rough.jpg';
import velvetNor from '../assets/velvet_nor.jpg';
import velvetRough from '../assets/velvet_rough.jpg';
import { lighter } from './util.js';

const loader = new THREE.TextureLoader();
function tex(url) {
  const t = loader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
const SRC = {
  teddy: [teddyNor, teddyRough], fleece: [fleeceNor, fleeceRough], velvet: [velvetNor, velvetRough],
};
const cache = {};
function maps(kind, rx, ry) {
  const key = `${kind}:${rx}:${ry}`;
  if (!cache[key]) {
    const [n, r] = SRC[kind].map(tex);
    n.repeat.set(rx, ry); r.repeat.set(rx, ry);
    cache[key] = { n, r };
  }
  return cache[key];
}

// 봉제인형 천: 스캔 원단의 요철 + 가장자리에 보송하게 도는 광택(sheen)
export function fabric(kind, color, { repeat = [5, 3], bump = 1.0, sheen = 1.0 } = {}) {
  const m = maps(kind, repeat[0], repeat[1]);
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 1, roughnessMap: m.r, normalMap: m.n, normalScale: new THREE.Vector2(bump, bump),
    sheen, sheenColor: lighter(color, 0.55), sheenRoughness: 0.5, envMapIntensity: 0.7,
  });
}
export const plastic = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, ...o });
export const chrome = (color = 0xdfe3ee) => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.22 });
export const bead = new THREE.MeshPhysicalMaterial({ color: 0x120c10, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6 });
export const felt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
export const glow = (color, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: true });
