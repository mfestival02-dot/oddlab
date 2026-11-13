// 외부 모델(GLB)에서 충돌 조각을 뽑아 src/models.json 에 쓴다.  실행: node tools/model_parts.mjs
// 보이는 모델과 충돌 모양이 같은 자료에서 나오게 하려는 것. 모델이나 아래 표를 바꾸면 다시 돌린다.
import fs from 'fs';
import * as THREE from 'three';
const DIR = 'assets/models/';
// rot: 모델 좌표를 게임 좌표로 돌리는 오일러각, pose: 마디 이름별 회전(라디안)
const LIE = [-Math.PI / 2, 0, -Math.PI / 2];   // 서 있는 모델을 등으로 눕힌다: 머리가 +x, 앞면이 위
const MODELS = {
  bear:   { file: 'animal-cat.glb', tex: 'colormap.png', scale: 0.2, rot: [0, Math.PI / 2, 0], pose: {} },
  rabbit: { file: 'animal-bunny.glb', tex: 'colormap.png', scale: 0.17, rot: [0, Math.PI / 2, 0], pose: {} },
  turtle: { file: 'animal-elephant.glb', tex: 'colormap.png', scale: 0.24, rot: [0, Math.PI / 2, 0], pose: {} },
  wrest1: { file: 'character-a.glb', tex: 'texture-a.png', scale: 0.16, rot: LIE, pose: { 'arm-left': [0, 0, 2.2], 'arm-right': [0, 0, -2.2], 'leg-left': [0, 0, 0.3], 'leg-right': [0, 0, -0.3] } },
  wrest2: { file: 'character-o.glb', tex: 'texture-o.png', scale: 0.2, rot: LIE, pose: { 'arm-left': [0, 0, 0.9], 'arm-right': [0, 0, -0.9], 'leg-left': [0, 0, 0.18], 'leg-right': [0, 0, -0.18] } },
};
function readGlb(file) {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString()), bin = b.slice(20 + jl + 8);
  const acc = (i) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type], off = (v.byteOffset || 0) + (a.byteOffset || 0), st = v.byteStride || 0;
    const rd = { 5126: (o) => bin.readFloatLE(o), 5123: (o) => bin.readUInt16LE(o), 5125: (o) => bin.readUInt32LE(o), 5121: (o) => bin.readUInt8(o) }[a.componentType], sz = { 5126: 4, 5123: 2, 5125: 4, 5121: 1 }[a.componentType];
    const out = []; for (let k = 0; k < a.count; k++) { const r = []; for (let c = 0; c < n; c++) r.push(rd(off + k * (st || sz * n) + c * sz)); out.push(n === 1 ? r[0] : r); } return out; };
  return { j, acc };
}
// 한 메시를 이어진 덩어리로 나눠 덩어리마다 상자(최소·최대)를 돌려준다
function chunks(pos, idx) {
  const key = (v) => v.map((x) => Math.round(x * 1000)).join(','), id = new Map(), par = [];
  const find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  const vid = pos.map((v) => { const k = key(v); if (!id.has(k)) { id.set(k, par.length); par.push(par.length); } return id.get(k); });
  for (let i = 0; i < idx.length; i += 3) { const a = find(vid[idx[i]]), b = find(vid[idx[i + 1]]), c = find(vid[idx[i + 2]]); par[b] = a; par[find(c)] = a; }
  const box = new Map();
  pos.forEach((v, i) => { const r = find(vid[i]); if (!box.has(r)) box.set(r, { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }); const B = box.get(r); for (let k = 0; k < 3; k++) { B.min[k] = Math.min(B.min[k], v[k]); B.max[k] = Math.max(B.max[k], v[k]); } });
  return [...box.values()];
}
const out = {}, r3 = (v) => Math.round(v * 10000) / 10000;
for (const [key, M] of Object.entries(MODELS)) {
  const { j, acc } = readGlb(DIR + M.file);
  const top = new THREE.Group(); top.rotation.set(...M.rot); top.scale.setScalar(M.scale);
  const parts = [];
  const walk = (i, parent) => {
    const n = j.nodes[i], o = new THREE.Group(); parent.add(o);
    if (n.translation) o.position.set(...n.translation); if (n.rotation) o.quaternion.set(...n.rotation); if (n.scale) o.scale.set(...n.scale);
    if (M.pose[n.name]) o.rotation.set(...M.pose[n.name]);
    (n.children || []).forEach((c) => walk(c, o));
    if (n.mesh == null) return;
    top.updateMatrixWorld(true);
    for (const pr of j.meshes[n.mesh].primitives) for (const B of chunks(acc(pr.attributes.POSITION), acc(pr.indices))) {
      const c = new THREE.Vector3((B.min[0] + B.max[0]) / 2, (B.min[1] + B.max[1]) / 2, (B.min[2] + B.max[2]) / 2).applyMatrix4(o.matrixWorld);
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); o.matrixWorld.decompose(p, q, s);
      const h = [0, 1, 2].map((k) => Math.abs(((B.max[k] - B.min[k]) / 2) * s.getComponent(k)));
      parts.push({ s: 'box', node: n.name, h: h.map(r3), p: c.toArray().map(r3), q: { x: r3(q.x), y: r3(q.y), z: r3(q.z), w: r3(q.w) }, vol: h[0] * h[1] * h[2] });
    }
  };
  j.scenes[0].nodes.forEach((n) => walk(n, top));
  // 눈·코 같은 얇고 작은 조각은 충돌에서 뺀다. 큰 것부터 8개까지.
  const big = Math.max(...parts.map((p) => p.vol));
  const keep = parts.filter((p) => Math.min(...p.h) > 0.008 && p.vol > big * 0.004).sort((a, b) => b.vol - a.vol).slice(0, 8);
  console.log(key, M.file, '조각', parts.length, '→', keep.length, keep.map((p) => `${p.node}[${p.h.map((v) => (v * 20).toFixed(1)).join('×')}cm]`).join(' '));
  out[key] = { file: M.file, tex: M.tex, scale: M.scale, rot: M.rot.map(r3), pose: M.pose, parts: keep.map(({ vol, node, ...p }) => p) };
}
fs.writeFileSync('src/models.json', JSON.stringify(out, null, 1));
