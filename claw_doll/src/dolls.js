import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, bead, white, felt } from './materials.js';
import { lighter, rnd, canvasTex, roundRect, FONT } from './util.js';

// ---------- 조각 만들기 (반지름 1 기준, 나중에 통째로 키운다) ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function place(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
  return geo.applyMatrix4(_m);
}
const ell = (sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0, seg = 28) =>
  place(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), x, y, z, rx, ry, rz, sx, sy, sz);
function tint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
const INK = 0x3a2530;
function finish(group, parts, mats) {
  for (const k of Object.keys(parts)) {
    if (!parts[k].length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(parts[k].map((g) => (g.index ? g.toNonIndexed() : g))), mats[k]);
    mesh.castShadow = k === 'main' || k === 'light' || k === 'felt';
    mesh.receiveShadow = k !== 'dark' && k !== 'white';
    group.add(mesh);
    group.userData[k] = mesh;
  }
  return group;
}

// 머리(타원체) 표면 위에 얼굴 조각을 붙일 자리와 기울기
function onHead(x, y, lift = 0) {
  const k = Math.sqrt(Math.max(0.02, 1 - (x / 0.8) ** 2 - ((y - 0.3) / 0.72) ** 2));
  return { z: 0.74 * k + lift, ry: x * 1.05, rx: -(y - 0.3) * 0.95 };
}
// 큼직한 눈: 0 또랑또랑, 1 웃는 눈, 2 졸린 눈
function eyes(P, style, ex = 0.3, ey = 0.36) {
  for (const s of [-1, 1]) {
    const h = onHead(s * ex, ey, 0.005);
    if (style === 1) {
      P.dark.push(place(new THREE.TorusGeometry(0.105, 0.03, 6, 14, Math.PI), s * ex, ey - 0.04, h.z + 0.01, h.rx, h.ry, 0));
    } else if (style === 2) {
      P.dark.push(ell(0.125, 0.03, 0.03, s * ex, ey, h.z, h.rx, h.ry, s * 0.12, 12));
    } else {
      P.dark.push(ell(0.125, 0.165, 0.045, s * ex, ey, h.z, h.rx, h.ry, 0, 18));
      P.white.push(ell(0.048, 0.055, 0.02, s * ex + 0.04, ey + 0.065, h.z + 0.04, h.rx, h.ry, 0, 10));
      P.white.push(ell(0.022, 0.025, 0.012, s * ex - 0.045, ey - 0.06, h.z + 0.038, h.rx, h.ry, 0, 8));
    }
    const b = onHead(s * 0.52, 0.16, 0.0);
    P.felt.push(tint(ell(0.12, 0.075, 0.02, s * 0.52, 0.16, b.z, b.rx, b.ry, 0, 14), 0xff8fa6));
  }
}
// 입: 0 ω, 1 활짝, 2 오
function mouth(P, style, y, z) {
  if (style === 1) {
    P.felt.push(tint(place(new THREE.CircleGeometry(0.115, 18, Math.PI, Math.PI), 0, y + 0.03, z + 0.012), 0x8a2f45));
    P.felt.push(tint(ell(0.06, 0.035, 0.012, 0, y - 0.05, z + 0.018, 0, 0, 0, 10), 0xff8f9f));
  } else if (style === 2) {
    P.dark.push(ell(0.045, 0.055, 0.02, 0, y - 0.01, z + 0.005, 0, 0, 0, 12));
  } else {
    for (const k of [-1, 1]) P.dark.push(place(new THREE.TorusGeometry(0.062, 0.017, 6, 14, Math.PI), k * 0.062, y, z, 0, 0, Math.PI));
  }
}

const ACC = [0xff5d6c, 0xffc93a, 0x4fb8ff, 0x7be0a8, 0xb48cff, 0xff8fc8, 0xffffff];
function accessory(P, type, color) {
  const r = rnd();
  let c = ACC[Math.floor(rnd() * ACC.length)];
  if (new THREE.Color(c).getHex() === new THREE.Color(color).getHex()) c = 0xffffff;
  if (r < 0.28) return;
  if (r < 0.5) {                                    // 목도리
    P.felt.push(tint(place(new THREE.TorusGeometry(0.47, 0.1, 10, 28), 0, -0.1, 0.02, Math.PI / 2, 0, 0, 1, 1, 1.15), c));
    P.felt.push(tint(place(new THREE.BoxGeometry(0.17, 0.36, 0.07), 0.3, -0.3, 0.44, 0.2, 0, -0.25), c));
  } else if (r < 0.68) {                            // 리본
    for (const s of [-1, 1]) P.felt.push(tint(place(new THREE.ConeGeometry(0.15, 0.3, 12), 0.36 + s * 0.15, 0.93, 0.3, 0, 0, s * Math.PI / 2 + 0.3, 1, 1, 0.6), c));
    P.felt.push(tint(ell(0.07, 0.07, 0.06, 0.36, 0.93, 0.32, 0, 0, 0, 10), c));
  } else if (r < 0.84 && type !== 'bunny') {        // 고깔모자
    P.felt.push(tint(place(new THREE.ConeGeometry(0.24, 0.5, 18), -0.12, 1.2, 0.05, 0, 0, 0.22), c));
    P.felt.push(tint(ell(0.08, 0.08, 0.08, -0.175, 1.45, 0.05, 0, 0, 0, 10), 0xffffff));
    P.felt.push(tint(place(new THREE.TorusGeometry(0.235, 0.035, 8, 20), -0.065, 0.96, 0.05, Math.PI / 2, 0.22, 0), 0xffffff));
  } else {                                          // 꽃
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      P.felt.push(tint(ell(0.08, 0.08, 0.04, -0.42 + Math.cos(a) * 0.1, 0.9 + Math.sin(a) * 0.1, 0.36, 0, -0.4, 0, 10), c));
    }
    P.felt.push(tint(ell(0.06, 0.06, 0.05, -0.42, 0.9, 0.39, 0, -0.4, 0, 10), 0xffd84a));
  }
}

// ---------- 동료 인형 ----------
export function makeDoll(type, color, r) {
  const P = { main: [], light: [], dark: [], white: [], felt: [] };
  // 큰 머리 + 통통한 몸 + 짧은 팔다리
  P.main.push(ell(0.8, 0.72, 0.74, 0, 0.3, 0, 0, 0, 0, 36));
  P.main.push(ell(0.58, 0.52, 0.52, 0, -0.45, 0));
  for (const s of [-1, 1]) {
    P.main.push(ell(0.18, 0.28, 0.18, s * 0.58, -0.3, 0.1, 0, 0, s * 0.6, 18));
    P.light.push(ell(0.21, 0.15, 0.28, s * 0.28, -0.88, 0.2, 0, 0, 0, 18));
  }
  P.light.push(ell(0.38, 0.35, 0.14, 0, -0.47, 0.42, 0, 0, 0, 20));
  let eyeStyle = Math.floor(rnd() * 3.4) % 3, mouthStyle = Math.floor(rnd() * 3);
  let mouthY = 0.15, mouthZ = onHead(0, 0.15).z + 0.005, lightHex = lighter(color, 0.65);

  if (type === 'bear') {
    for (const s of [-1, 1]) {
      P.main.push(ell(0.26, 0.26, 0.14, s * 0.58, 0.9, 0, 0, 0, 0, 18));
      P.light.push(ell(0.15, 0.15, 0.06, s * 0.58, 0.9, 0.1, 0, 0, 0, 14));
    }
    P.light.push(ell(0.27, 0.2, 0.15, 0, 0.13, 0.65, 0, 0, 0, 20));
    P.dark.push(ell(0.085, 0.06, 0.05, 0, 0.21, 0.79, 0, 0, 0, 12));
    mouthY = 0.1; mouthZ = 0.795; if (mouthStyle === 1) mouthStyle = 0;
  } else if (type === 'bunny') {
    const flop = rnd() < 0.5;
    P.main.push(ell(0.16, 0.52, 0.11, -0.28, 1.24, -0.02, 0, 0, 0.16, 20));
    P.light.push(ell(0.085, 0.4, 0.04, -0.28, 1.24, 0.065, 0, 0, 0.16, 14));
    if (flop) {
      P.main.push(ell(0.16, 0.3, 0.11, 0.3, 1.05, -0.02, 0, 0, -0.3, 20), ell(0.16, 0.3, 0.11, 0.56, 1.1, 0.02, 0, 0, -1.9, 20));
    } else {
      P.main.push(ell(0.16, 0.52, 0.11, 0.28, 1.24, -0.02, 0, 0, -0.16, 20));
      P.light.push(ell(0.085, 0.4, 0.04, 0.28, 1.24, 0.065, 0, 0, -0.16, 14));
    }
    P.felt.push(tint(ell(0.055, 0.04, 0.03, 0, 0.245, onHead(0, 0.245).z, 0, 0, 0, 10), 0xff6f93));
    P.main.push(ell(0.17, 0.17, 0.17, 0, -0.62, -0.5, 0, 0, 0, 14));
  } else if (type === 'cat') {
    for (const s of [-1, 1]) {
      P.main.push(place(new THREE.ConeGeometry(0.28, 0.46, 20), s * 0.47, 0.92, 0, 0, 0, -s * 0.36));
      P.light.push(place(new THREE.ConeGeometry(0.16, 0.27, 14), s * 0.465, 0.89, 0.09, 0, 0, -s * 0.36));
      for (const k of [0, 1]) P.dark.push(ell(0.13, 0.012, 0.012, s * 0.66, 0.2 - k * 0.09, 0.42, 0, s * 0.75, s * (0.12 - k * 0.24), 8));   // 수염
    }
    P.felt.push(tint(ell(0.055, 0.04, 0.03, 0, 0.24, onHead(0, 0.24).z, 0, 0, 0, 10), 0xff6f93));
    P.main.push(ell(0.1, 0.1, 0.44, 0.24, -0.72, -0.6, 0.5, 0.5, 0, 14));
    lightHex = 0xffffff;
  } else if (type === 'chick') {
    P.felt.push(tint(place(new THREE.ConeGeometry(0.12, 0.22, 14), 0, 0.2, 0.78, Math.PI / 2, 0, 0), 0xff8a2a));
    P.main.push(ell(0.07, 0.17, 0.07, 0, 1.04, 0, 0, 0, 0.4, 12), ell(0.06, 0.14, 0.06, 0.09, 1.02, 0, 0, 0, -0.5, 12));
    for (const s of [-1, 1]) P.felt.push(tint(ell(0.2, 0.09, 0.26, s * 0.3, -0.92, 0.26, 0, s * 0.3, 0, 12), 0xff8a2a));
    mouthStyle = -1; eyeStyle = eyeStyle === 2 ? 0 : eyeStyle;
  } else if (type === 'frog') {
    for (const s of [-1, 1]) {
      P.main.push(ell(0.28, 0.28, 0.26, s * 0.36, 0.88, 0.16, 0, 0, 0, 20));
      P.white.push(ell(0.19, 0.19, 0.1, s * 0.36, 0.9, 0.36, 0, 0, 0, 16));
      P.dark.push(ell(0.09, 0.11, 0.04, s * 0.36, 0.9, 0.455, 0, 0, 0, 12));
      const b = onHead(s * 0.52, 0.2);
      P.felt.push(tint(ell(0.12, 0.075, 0.02, s * 0.52, 0.2, b.z, b.rx, b.ry, 0, 14), 0xff8fa6));
    }
    P.dark.push(place(new THREE.TorusGeometry(0.32, 0.02, 6, 22, Math.PI * 0.7), 0, 0.52, 0.6, -0.3, 0, Math.PI * 1.15));
    mouthStyle = -1; eyeStyle = -1; lightHex = 0xfffbe0;
  }
  if (eyeStyle >= 0) eyes(P, eyeStyle);
  if (mouthStyle >= 0) mouth(P, mouthStyle, mouthY, mouthZ);
  accessory(P, type, color);

  const g = new THREE.Group();
  finish(g, P, { main: toon(color), light: toon(lightHex), dark: bead, white, felt });
  g.scale.setScalar(r);
  return g;
}

// ---------- 주인공: 한정판 햄스터 (앞이 +z, 엎드린 찹쌀떡 모양) ----------
export function makeHamster(r) {
  const ORANGE = 0xff9a2e, CREAM = 0xfff6e6;
  const P = { main: [], light: [], dark: [], white: [], felt: [] };
  P.main.push(ell(0.86, 0.74, 1.0, 0, 0, 0, 0, 0, 0, 48));
  P.light.push(ell(0.848, 0.56, 0.978, 0, -0.215, 0.03, 0, 0, 0, 40));         // 배
  P.light.push(ell(0.36, 0.3, 0.2, 0, 0.36, 0.72, 0, 0, 0, 20));               // 이마 흰 무늬
  for (const s of [-1, 1]) {
    P.light.push(ell(0.34, 0.28, 0.27, s * 0.4, -0.13, 0.72, 0, 0, 0, 22));    // 볼주머니
    P.felt.push(tint(ell(0.13, 0.08, 0.18, s * 0.3, -0.72, 0.74, 0, s * 0.3, 0, 14), 0xffb3a6));
    P.felt.push(tint(ell(0.15, 0.085, 0.21, s * 0.5, -0.73, -0.45, 0, -s * 0.4, 0, 14), 0xffb3a6));
    P.felt.push(tint(ell(0.13, 0.08, 0.02, s * 0.58, -0.04, 0.685, 0, s * 0.8, 0, 14), 0xff7f96));
  }
  P.light.push(ell(0.26, 0.2, 0.18, 0, -0.07, 0.9, 0, 0, 0, 20));
  P.felt.push(tint(ell(0.065, 0.05, 0.04, 0, 0.005, 1.07, 0, 0, 0, 10), 0xff6f8f));
  for (const k of [-1, 1]) P.dark.push(place(new THREE.TorusGeometry(0.055, 0.016, 6, 14, Math.PI), k * 0.055, -0.075, 1.068, 0, 0, Math.PI));
  P.dark.push(ell(0.3, 0.2, 0.78, 0, 0.565, -0.12, 0, 0, 0, 24));
  const stripe = P.dark.pop();                                                   // 등줄무늬는 따로 색을 준다

  const body = new THREE.Group();
  finish(body, P, { main: toon(ORANGE), light: toon(CREAM), dark: bead, white, felt });
  const st = new THREE.Mesh(stripe, toon(0xd9701a));
  st.castShadow = true;
  body.add(st);
  // 흰 테두리: 더미 속에서도 '저게 나'
  const hull = new THREE.Mesh(body.userData.main.geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }));
  hull.scale.setScalar(1.055);
  hull.userData.outline = true;
  body.add(hull);

  // 눈: 평소(또랑또랑) / 긴장(동그랗게 뜬 눈)
  const eyeN = new THREE.Group(), eyeW = new THREE.Group();
  for (const s of [-1, 1]) {
    const d = new THREE.Mesh(ell(0.115, 0.15, 0.05, s * 0.34, 0.2, 0.85, -0.15, s * 0.36, 0, 18), bead);
    const h1 = new THREE.Mesh(ell(0.045, 0.05, 0.02, s * 0.34 + 0.04, 0.26, 0.9, 0, s * 0.36, 0, 10), white);
    const h2 = new THREE.Mesh(ell(0.02, 0.022, 0.012, s * 0.34 - 0.04, 0.14, 0.895, 0, s * 0.36, 0, 8), white);
    eyeN.add(d, h1, h2);
    const w = new THREE.Mesh(ell(0.15, 0.18, 0.05, s * 0.34, 0.22, 0.85, -0.15, s * 0.36, 0, 18), white);
    const p = new THREE.Mesh(ell(0.055, 0.065, 0.02, s * 0.33, 0.21, 0.9, -0.15, s * 0.36, 0, 10), bead);
    eyeW.add(w, p);
  }
  eyeW.visible = false;
  const sweat = new THREE.Mesh(mergeGeometries([ell(0.09, 0.09, 0.09, 0, 0, 0, 0, 0, 0, 10), place(new THREE.ConeGeometry(0.083, 0.17, 10), 0, 0.11, 0).toNonIndexed()].map((g) => (g.index ? g.toNonIndexed() : g))),
    new THREE.MeshBasicMaterial({ color: 0x8fd6ff }));
  sweat.position.set(0.62, 0.52, 0.5);
  sweat.visible = false;
  body.add(eyeN, eyeW, sweat);

  // 귀와 꼬리: 기어갈 때 흔들린다
  const ears = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.42, 0.56, 0.4);
    const ear = new THREE.Mesh(ell(0.2, 0.2, 0.08, 0, 0.13, 0, -0.25, s * 0.25, 0, 18), toon(ORANGE));
    const inner = new THREE.Mesh(ell(0.115, 0.115, 0.03, 0, 0.13, 0.06, -0.25, s * 0.25, 0, 14), toon(0xffa3b0));
    ear.castShadow = true;
    pivot.add(ear, inner);
    body.add(pivot);
    ears.push(pivot);
  }
  const tail = new THREE.Mesh(ell(0.12, 0.12, 0.12, 0, 0, -0.06, 0, 0, 0, 14), toon(CREAM));
  tail.position.set(0, -0.3, -0.96);
  body.add(tail);

  // 빨간 목도리와 리본, 금관, 꼬리표
  const red = toon(0xff3b4e);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.775, 0.105, 12, 40), red);
  scarf.scale.set(1.0, 0.855, 1.3);
  scarf.position.set(0, 0, 0.36);
  scarf.castShadow = true;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), red);
  knot.position.set(0, 0.72, 0.3);
  body.add(scarf, knot);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.36, 12), red);
    wing.position.set(s * 0.21, 0.76, 0.3); wing.rotation.z = s * Math.PI / 2; wing.scale.z = 0.6;
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.44, 0.06), red);
    end.position.set(s * 0.1, 0.62, 0.1); end.rotation.set(-1.1, 0, s * 0.3);
    wing.castShadow = end.castShadow = true;
    body.add(wing, end);
  }
  const gold = toon(0xffcf3a, { side: THREE.DoubleSide });
  const crown = new THREE.Group();
  crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.19, 0.11, 20, 1, true), gold));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.17, 8), gold);
    sp.position.set(Math.cos(a) * 0.18, 0.13, Math.sin(a) * 0.18);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4f7a }));
    gem.position.set(Math.cos(a) * 0.18, 0.23, Math.sin(a) * 0.18);
    crown.add(sp, gem);
  }
  crown.position.set(0, 0.78, 0.6); crown.rotation.x = 0.42;
  crown.traverse((o) => { o.castShadow = true; });
  body.add(crown);
  const tagTex = canvasTex(256, 160, (g, w, h) => {
    roundRect(g, 6, 6, w - 12, h - 12, 22); g.fillStyle = '#fffaf0'; g.fill();
    g.strokeStyle = '#ff8a3a'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#e8452f'; g.font = `900 56px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('한정판', w / 2, h / 2 - 16);
    g.fillStyle = '#9a8676'; g.font = `800 26px ${FONT}`; g.fillText('No.001', w / 2, h / 2 + 38);
  });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.325), new THREE.MeshBasicMaterial({ map: tagTex, side: THREE.DoubleSide }));
  tag.position.set(0.5, 0.2, -0.87);
  tag.rotation.set(0.2, Math.PI - 0.5, 0.25);
  body.add(tag);

  const g = new THREE.Group();
  g.add(body);
  g.userData = { body, ears, tail,
    setMood(nervous) { eyeN.visible = !nervous; eyeW.visible = nervous; sweat.visible = nervous; } };
  g.scale.setScalar(r);
  return g;
}
