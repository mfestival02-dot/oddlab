// 외부 모델(CC0, CREDITS.md 참고)을 읽어 둔다. 파일은 빌드할 때 번들 안에 들어간다.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MODELS } from './config.js';
import cat from '../assets/models/animal-cat.glb';
import bunny from '../assets/models/animal-bunny.glb';
import elephant from '../assets/models/animal-elephant.glb';
import chA from '../assets/models/character-a.glb';
import chO from '../assets/models/character-o.glb';
import colormap from '../assets/models/colormap.png';
import texA from '../assets/models/texture-a.png';
import texO from '../assets/models/texture-o.png';
const FILES = { 'animal-cat.glb': cat, 'animal-bunny.glb': bunny, 'animal-elephant.glb': elephant, 'character-a.glb': chA, 'character-o.glb': chO };
const TEX = { 'colormap.png': colormap, 'texture-a.png': texA, 'texture-o.png': texO };
const loaded = {};
export async function loadModels() {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => { const n = url.split('/').pop(); return TEX[n] || url; });
  const loader = new GLTFLoader(manager);
  await Promise.all(Object.entries(MODELS).map(async ([key, M]) => {
    const buf = FILES[M.file]; const g = await loader.parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
    loaded[key] = g.scene;
  }));
}
// 지우개 하나의 겉모습. com은 무게중심(충돌 조각에서 계산한 값), tint는 플레이어 색.
export function makeModel(key, com, tint) {
  const M = MODELS[key], src = loaded[key]; if (!src) return null;
  const top = src.clone(true); top.rotation.set(...M.rot); top.scale.setScalar(M.scale); top.position.set(-com[0], -com[1], -com[2]);
  const mats = new Map(), meshes = [];
  top.traverse((o) => {
    if (M.pose[o.name]) o.rotation.set(...M.pose[o.name]);
    if (!o.isMesh) return;
    if (!mats.has(o.material)) { const m = new THREE.MeshStandardMaterial({ map: o.material.map, roughness: 0.82, metalness: 0 }); m.color.set(0xffffff).lerp(new THREE.Color(tint), 0.12); mats.set(o.material, m); }
    o.material = mats.get(o.material); o.castShadow = o.receiveShadow = true; meshes.push(o);
  });
  // 플레이어 색 테두리: 조금 키운 뒷면을 색으로 칠한다
  const line = new THREE.MeshBasicMaterial({ color: tint, side: THREE.BackSide });
  for (const o of meshes) {
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const c = o.geometry.boundingBox.getCenter(new THREE.Vector3()), sz = o.geometry.boundingBox.getSize(new THREE.Vector3());
    const ws = o.getWorldScale(new THREE.Vector3()).x / top.scale.x, pad = 0.045 / ws;      // 모델 단위로 같은 두께
    const k = new THREE.Vector3(1 + pad / Math.max(sz.x, 0.01), 1 + pad / Math.max(sz.y, 0.01), 1 + pad / Math.max(sz.z, 0.01));
    const e = new THREE.Mesh(o.geometry, line); e.scale.copy(k); e.position.set(c.x * (1 - k.x), c.y * (1 - k.y), c.z * (1 - k.z)); o.add(e);
  }
  return top;
}
