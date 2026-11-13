import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fabric, bead, felt } from './materials.js';
import { lighter, canvasTex, roundRect, FONT } from './util.js';

// ---------- 조각 만들기 (반지름 1 기준, 나중에 통째로 키운다) ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function place(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
  return geo.applyMatrix4(_m);
}
// 타원체
const ell = (sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0, seg = 28) =>
  place(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), x, y, z, rx, ry, rz, sx, sy, sz);
function tint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
// 실로 놓은 'ω' 입
function mouth(y, z, s = 1, hex = 0x4a2f33) {
  const out = [];
  for (const k of [-1, 1]) {
    const g = new THREE.TorusGeometry(0.07 * s, 0.014 * s, 6, 14, Math.PI);
    out.push(tint(place(g, k * 0.07 * s, y, z, 0, 0, Math.PI), hex));
  }
  return out;
}
const blush = (x, y, z, ry) => tint(ell(0.11, 0.07, 0.02, x, y, z, 0, ry, 0, 14), 0xff8fa6);
function finish(group, parts, mats) {
  for (const k of Object.keys(parts)) {
    if (!parts[k].length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(parts[k]), mats[k]);
    mesh.castShadow = k !== 'felt';
    mesh.receiveShadow = true;
    group.add(mesh);
    group.userData[k] = mesh;
  }
  return group;
}

const WEAVE = { bear: 'teddy', bunny: 'fleece', cat: 'velvet', chick: 'fleece', frog: 'velvet' };

// ---------- 동료 인형 ----------
export function makeDoll(type, color, r) {
  const P = { main: [], light: [], bead: [], felt: [] };
  // 몸: 큰 머리 + 작은 몸통 + 짧은 팔다리
  P.main.push(ell(0.78, 0.7, 0.72, 0, 0.3, 0, 0, 0, 0, 36));
  P.main.push(ell(0.56, 0.52, 0.5, 0, -0.45, 0));
  for (const s of [-1, 1]) {
    P.main.push(ell(0.17, 0.27, 0.17, s * 0.56, -0.32, 0.1, 0, 0, s * 0.55, 18));
    P.light.push(ell(0.2, 0.15, 0.27, s * 0.27, -0.88, 0.2, 0, 0, 0, 18));
    P.felt.push(blush(s * 0.5, 0.17, 0.57, s * 0.7));
  }
  P.light.push(ell(0.36, 0.34, 0.14, 0, -0.47, 0.4, 0, 0, 0, 20));
  let eyeZ = 0.67, eyeY = 0.36, eyeX = 0.27;

  if (type === 'bear') {
    for (const s of [-1, 1]) {
      P.main.push(ell(0.25, 0.25, 0.14, s * 0.56, 0.88, 0, 0, 0, 0, 18));
      P.light.push(ell(0.14, 0.14, 0.06, s * 0.56, 0.88, 0.1, 0, 0, 0, 14));
    }
    P.light.push(ell(0.25, 0.19, 0.15, 0, 0.15, 0.64, 0, 0, 0, 20));
    P.felt.push(tint(ell(0.08, 0.058, 0.05, 0, 0.22, 0.78, 0, 0, 0, 12), 0x3a2426), ...mouth(0.13, 0.775, 0.9));
  } else if (type === 'bunny') {
    for (const s of [-1, 1]) {
      P.main.push(ell(0.15, 0.5, 0.11, s * 0.27, 1.22, -0.02, 0, 0, -s * 0.16, 20));
      P.light.push(ell(0.08, 0.38, 0.04, s * 0.27, 1.22, 0.06, 0, 0, -s * 0.16, 14));
    }
    P.felt.push(tint(ell(0.05, 0.035, 0.03, 0, 0.24, 0.715, 0, 0, 0, 10), 0xe86a8a), ...mouth(0.17, 0.7, 0.85));
    P.main.push(ell(0.16, 0.16, 0.16, 0, -0.62, -0.5, 0, 0, 0, 14));
  } else if (type === 'cat') {
    for (const s of [-1, 1]) {
      P.main.push(place(new THREE.ConeGeometry(0.27, 0.44, 20), s * 0.46, 0.9, 0, 0, 0, -s * 0.36));
      P.light.push(place(new THREE.ConeGeometry(0.15, 0.26, 14), s * 0.455, 0.87, 0.09, 0, 0, -s * 0.36));
    }
    P.light.push(ell(0.2, 0.14, 0.1, 0, 0.17, 0.66, 0, 0, 0, 16));
    P.felt.push(tint(ell(0.05, 0.035, 0.03, 0, 0.23, 0.75, 0, 0, 0, 10), 0xe86a8a), ...mouth(0.16, 0.745, 0.85));
    P.main.push(ell(0.1, 0.1, 0.42, 0.22, -0.72, -0.6, 0.5, 0.5, 0, 14));
  } else if (type === 'chick') {
    P.felt.push(tint(place(new THREE.ConeGeometry(0.11, 0.2, 14), 0, 0.2, 0.76, Math.PI / 2, 0, 0), 0xff9a3c));
    P.main.push(ell(0.07, 0.16, 0.07, 0, 1.02, 0, 0, 0, 0.4, 12), ell(0.06, 0.13, 0.06, 0.08, 1.0, 0, 0, 0, -0.5, 12));
    eyeY = 0.38;
  } else if (type === 'frog') {
    for (const s of [-1, 1]) {
      P.main.push(ell(0.27, 0.27, 0.25, s * 0.35, 0.86, 0.18, 0, 0, 0, 20));
      P.light.push(ell(0.17, 0.17, 0.1, s * 0.35, 0.88, 0.37, 0, 0, 0, 16));
    }
    P.felt.push(tint(place(new THREE.TorusGeometry(0.3, 0.016, 6, 22, Math.PI * 0.8), 0, 0.42, 0.6, -0.35, 0, Math.PI * 1.1), 0x3a2f2a));
    eyeY = 0.88; eyeZ = 0.455; eyeX = 0.35;
  }
  for (const s of [-1, 1]) P.bead.push(ell(0.082, 0.09, 0.06, s * eyeX, eyeY, eyeZ, 0, 0, 0, 16));

  const g = new THREE.Group();
  const kind = WEAVE[type];
  const mats = {
    main: fabric(kind, color),
    light: fabric(kind, type === 'frog' ? 0xfaf6e8 : lighter(color, 0.62)),
    bead, felt,
  };
  finish(g, P, mats);
  g.scale.setScalar(r);
  return g;
}

// ---------- 주인공: 한정판 햄스터 (앞이 +z, 엎드린 찹쌀떡 모양) ----------
export function makeHamster(r) {
  const GOLD = 0xe8a24c, CREAM = 0xfff1da;
  const P = { main: [], light: [], dark: [], bead: [], felt: [] };
  P.main.push(ell(0.86, 0.74, 1.0, 0, 0, 0, 0, 0, 0, 48));
  P.dark.push(ell(0.3, 0.2, 0.78, 0, 0.56, -0.12, 0, 0, 0, 24));               // 등줄무늬
  P.light.push(ell(0.845, 0.56, 0.975, 0, -0.215, 0.03, 0, 0, 0, 40));        // 배
  for (const s of [-1, 1]) {
    P.light.push(ell(0.33, 0.27, 0.26, s * 0.4, -0.13, 0.72, 0, 0, 0, 22));    // 볼주머니
    P.main.push(ell(0.18, 0.18, 0.07, s * 0.43, 0.66, 0.4, -0.25, s * 0.25, 0, 18));
    P.felt.push(tint(ell(0.105, 0.105, 0.03, s * 0.44, 0.66, 0.455, -0.25, s * 0.25, 0, 14), 0xf7a3a8));
    P.felt.push(tint(ell(0.12, 0.075, 0.17, s * 0.3, -0.72, 0.72, 0, s * 0.3, 0, 14), 0xf9b7ae));   // 앞발
    P.felt.push(tint(ell(0.14, 0.08, 0.2, s * 0.5, -0.73, -0.45, 0, -s * 0.4, 0, 14), 0xf9b7ae));   // 뒷발
    P.felt.push(blush(s * 0.56, -0.02, 0.69, s * 0.75));
    P.bead.push(ell(0.092, 0.1, 0.06, s * 0.33, 0.2, 0.845, 0, 0, 0, 18));
  }
  P.light.push(ell(0.25, 0.19, 0.18, 0, -0.07, 0.9, 0, 0, 0, 20));              // 주둥이
  P.felt.push(tint(ell(0.06, 0.045, 0.04, 0, 0.0, 1.07, 0, 0, 0, 10), 0xe9758f), ...mouth(-0.075, 1.065, 0.8));
  P.light.push(ell(0.11, 0.11, 0.11, 0, -0.32, -1.0, 0, 0, 0, 14));             // 꼬리
  // 한정판 금별
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? 0.075 : 0.17;
    i ? star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const sg = new THREE.ExtrudeGeometry(star, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
  const starMesh = new THREE.Mesh(sg, new THREE.MeshPhysicalMaterial({ color: 0xffc94a, metalness: 0.7, roughness: 0.3, clearcoat: 0.5 }));
  starMesh.position.set(-0.48, 0.78, 0.46);
  starMesh.rotation.set(-0.25, -0.35, 0.25);
  starMesh.castShadow = true;

  const body = new THREE.Group();
  const mats = { main: fabric('teddy', GOLD, { repeat: [6, 4], bump: 1.6 }), light: fabric('teddy', CREAM, { repeat: [6, 4], bump: 1.6 }),
    dark: fabric('teddy', 0xb26a2c, { repeat: [3, 3], bump: 1.6 }), bead, felt };
  finish(body, P, mats);
  body.add(starMesh);
  // 빨간 목도리와 리본, 작은 금관: 멀리서도 '저게 나'
  const red = fabric('fleece', 0xe2323f, { repeat: [8, 1] });
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.775, 0.1, 12, 40), red);
  scarf.scale.set(1.0, 0.855, 1.3);
  scarf.position.set(0, 0, 0.36);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), red);
  knot.position.set(0, 0.72, 0.3);
  body.add(scarf, knot);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.34, 12), red);
    wing.position.set(s * 0.2, 0.75, 0.3); wing.rotation.z = s * Math.PI / 2; wing.scale.z = 0.6;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.05), red);
    tail.position.set(s * 0.1, 0.62, 0.12); tail.rotation.set(-1.1, 0, s * 0.3);
    wing.castShadow = tail.castShadow = true;
    body.add(wing, tail);
  }
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xffc83a, metalness: 0.85, roughness: 0.22, emissive: 0x6a4200, side: THREE.DoubleSide });
  const crown = new THREE.Group();
  crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.1, 20, 1, true), gold));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), gold);
    sp.position.set(Math.cos(a) * 0.17, 0.12, Math.sin(a) * 0.17);
    crown.add(sp);
  }
  crown.position.set(0, 0.76, 0.62); crown.rotation.x = 0.45;
  crown.traverse((o) => { o.castShadow = true; });
  body.add(crown);
  // 등 뒤 꼬리표
  const tagTex = canvasTex(256, 160, (g, w, h) => {
    roundRect(g, 6, 6, w - 12, h - 12, 22); g.fillStyle = '#fffaf0'; g.fill();
    g.strokeStyle = '#f0a65a'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#d9602f'; g.font = `900 56px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('한정판', w / 2, h / 2 - 16);
    g.fillStyle = '#9a8676'; g.font = `800 26px ${FONT}`; g.fillText('No.001', w / 2, h / 2 + 38);
  });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.31), new THREE.MeshStandardMaterial({ map: tagTex, side: THREE.DoubleSide, roughness: 0.8 }));
  tag.position.set(0.5, 0.2, -0.86);
  tag.rotation.set(0.2, Math.PI - 0.5, 0.25);
  body.add(tag);


  const g = new THREE.Group();
  g.add(body);
  g.userData.body = body;
  g.scale.setScalar(r);
  return g;
}
