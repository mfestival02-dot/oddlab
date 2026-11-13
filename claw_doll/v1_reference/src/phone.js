import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  clamp, lerp, damp, rand, pick, toon, addOutline, darker, lighter, fabricTexture,
  Sfx, Music, seq, makeKeys, canvasTex, roundRect, FONT,
} from './common.js';

const $ = (id) => document.getElementById(id);
const keys = makeKeys();
const sfx = new Sfx();
const FAST = location.hash.includes('fast');

// ======================================================================
// renderer / scene
// ======================================================================
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const BG = 0xeef6f2;
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 30, 60);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 120);

scene.add(new THREE.HemisphereLight(0xffffff, 0xe9dccb, 1.45));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
sun.position.set(5, 26, -22);
sun.target.position.set(0, 0, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 5, far: 70 });
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const ROOM = 13;
const occluders = []; // meshes that block the owner's view
const boxes = []; // phone obstacles: {x0,x1,z0,z1}
const circles = []; // phone obstacles: {x,z,r}
function occ(m) {
  occluders.push(m);
  return m;
}
function block(x0, x1, z0, z1) {
  boxes.push({ x0, x1, z0, z1 });
}
function mesh(geo, mat, x, y, z, parent = scene) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const RB = (w, h, d, r = 0.15, s = 2) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));

// ======================================================================
// room
// ======================================================================
{
  const wood = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#ecd2ad';
    g.fillRect(0, 0, w, h);
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const y = (r * h) / rows;
      const tone = ['#e8cba3', '#efd8b6', '#e4c59b', '#f0dbbb'][r % 4];
      g.fillStyle = tone;
      g.fillRect(0, y, w, h / rows);
      g.strokeStyle = 'rgba(160,110,70,0.35)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
      const off = (r % 2) * 180 + 60;
      g.beginPath();
      g.moveTo(off, y);
      g.lineTo(off, y + h / rows);
      g.moveTo(off + 256, y);
      g.lineTo(off + 256, y + h / rows);
      g.stroke();
      g.strokeStyle = 'rgba(170,120,80,0.12)';
      g.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        const yy = y + rand(6, h / rows - 6);
        g.moveTo(0, yy);
        g.bezierCurveTo(w * 0.3, yy + rand(-4, 4), w * 0.6, yy + rand(-4, 4), w, yy);
        g.stroke();
      }
    }
  });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  wood.repeat.set(5, 5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, ROOM * 2), toon(0xffffff, { map: wood }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const paper = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d7f0e4';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let y = 16; y < h; y += 32)
      for (let x = (y / 32) % 2 ? 32 : 16; x < w; x += 32) {
        g.beginPath();
        g.arc(x, y, 3, 0, Math.PI * 2);
        g.fill();
      }
  });
  paper.wrapS = paper.wrapT = THREE.RepeatWrapping;
  paper.repeat.set(6, 4);
  const wallMat = toon(0xffffff, { map: paper });
  const H = 18;
  const walls = [
    [0, -ROOM, 0],
    [0, ROOM, Math.PI],
    [-ROOM, 0, Math.PI / 2],
    [ROOM, 0, -Math.PI / 2],
  ];
  for (const [x, z, ry] of walls) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, H), wallMat);
    w.position.set(x, H / 2, z);
    w.rotation.y = ry;
    w.receiveShadow = true;
    scene.add(w);
    const base = new THREE.Mesh(new THREE.BoxGeometry(ROOM * 2, 0.7, 0.2), toon(0xffffff));
    base.position.set(x, 0.35, z);
    base.rotation.y = ry;
    base.translateZ(0.1);
    scene.add(base);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, ROOM * 2), toon(0xfbfbf7));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  scene.add(ceil);
  // window on back wall
  const win = new THREE.Group();
  win.position.set(4, 9.5, -ROOM + 0.05);
  scene.add(win);
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 6),
    new THREE.MeshBasicMaterial({
      map: canvasTex(256, 220, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#bfe6ff');
        gr.addColorStop(1, '#f2fbff');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#ffffff';
        for (const [x, y, s] of [[60, 70, 1], [180, 120, 0.8]]) {
          g.beginPath();
          g.arc(x, y, 22 * s, 0, 7);
          g.arc(x + 26 * s, y - 8 * s, 26 * s, 0, 7);
          g.arc(x + 54 * s, y, 20 * s, 0, 7);
          g.fill();
        }
      }),
    })
  );
  win.add(sky);
  const frameMat = toon(0xffffff);
  for (const [w, h, x, y] of [[7.6, 0.4, 0, 3.1], [7.6, 0.6, 0, -3.1], [0.4, 6.4, -3.6, 0], [0.4, 6.4, 3.6, 0], [0.22, 6, 0, 0], [7, 0.22, 0, 0.4]])
    mesh(new THREE.BoxGeometry(w, h, 0.35), frameMat, x, y, 0.1, win);
  const curtainMat = toon(0xffd9e6);
  for (const s of [-1, 1]) {
    const c = mesh(RB(1.6, 7.8, 0.4, 0.2), curtainMat, s * 4.5, -0.4, 0.4, win);
    c.scale.x = 1;
  }
  // calendar above desk: "시험 D-1"
  const cal = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 3.6),
    new THREE.MeshBasicMaterial({
      map: canvasTex(320, 360, (g, w, h) => {
        g.fillStyle = '#fff';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#ff8fab';
        g.fillRect(0, 0, w, 70);
        g.fillStyle = '#fff';
        g.font = `900 44px ${FONT}`;
        g.textAlign = 'center';
        g.fillText('11월', w / 2, 52);
        g.fillStyle = '#c9c0d6';
        g.font = `700 22px ${FONT}`;
        for (let i = 0; i < 28; i++) g.fillText(String(i + 1), 34 + (i % 7) * 42, 112 + Math.floor(i / 7) * 52);
        g.strokeStyle = '#ff4f6b';
        g.lineWidth = 6;
        g.beginPath();
        g.arc(34 + 6 * 42, 105 + 2 * 52, 24, 0, 7);
        g.stroke();
        g.fillStyle = '#ff4f6b';
        g.font = `900 40px ${FONT}`;
        g.fillText('시험 D-1', w / 2, 340);
      }),
    })
  );
  cal.position.set(ROOM - 0.05, 9.5, -2);
  cal.rotation.y = -Math.PI / 2;
  scene.add(cal);
}

// ======================================================================
// furniture
// ======================================================================
const BED = { x0: -13, x1: -5, z0: -13, z1: -2.5, gap: 1.0, top: 3.4 };
{
  const frame = toon(0xd9b48c);
  // legs
  for (const [x, z] of [[-12.6, -12.6], [-5.35, -12.6], [-12.6, -2.85], [-5.35, -2.85]]) {
    mesh(new THREE.BoxGeometry(0.6, 1.0, 0.6), frame, x, 0.5, z);
  }
  block(-5.65, -5.05, -3.15, -2.55);
  block(-5.65, -5.05, -12.9, -12.3);
  occ(mesh(new THREE.BoxGeometry(8, 0.35, 10.5), frame, -9, 1.17, -7.75));
  const mattress = occ(mesh(RB(7.8, 1.9, 10.3, 0.45, 3), toon(0xfdfaf5), -9, 2.3, -7.75));
  const head = occ(mesh(RB(8.2, 5.5, 0.6, 0.25), frame, -9, 2.75, -12.75));
  // pillow
  mesh(RB(4, 0.9, 2, 0.4, 3), toon(0xcfe8ff), -9.5, 3.55, -11.2);
  mattress.receiveShadow = true;
  head.receiveShadow = true;
}

// blanket: covers the bed and spills onto the floor (soft hiding spot)
const BLANKET = { x0: -4.5, x1: -1.3, z0: -10.3, z1: -3.6 };
const blanketG = new THREE.Group();
scene.add(blanketG);
let blanketGeo, blanketBase;
{
  const nx = 46, nz = 36;
  blanketGeo = new THREE.PlaneGeometry(9.8, 7.2, nx, nz);
  blanketGeo.rotateX(-Math.PI / 2);
  blanketGeo.translate(-5.9, 0, -6.95);
  const pos = blanketGeo.attributes.position;
  blanketBase = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let y;
    const folds = Math.sin(z * 1.7 + x * 0.6) * 0.12 + Math.sin(x * 2.3) * 0.06;
    if (x < -5.1) y = 3.42 + folds * 0.6;
    else if (x < -4.5) {
      const t = (x + 5.1) / 0.6;
      y = lerp(3.42, 0.55, Math.pow(t, 0.7)) + folds * 0.3;
    } else {
      const ex = clamp(Math.min(x - BLANKET.x0 + 0.3, BLANKET.x1 + 0.5 - x) / 1.0, 0, 1);
      const ez = clamp(Math.min(z - BLANKET.z0 + 0.4, BLANKET.z1 + 0.4 - z) / 1.1, 0, 1);
      const e = Math.min(ex, ez);
      y = 0.06 + (0.42 + folds * 1.4) * Math.pow(e, 0.6);
    }
    blanketBase[i] = Math.max(0.04, y);
    pos.setY(i, blanketBase[i]);
  }
  blanketGeo.computeVertexNormals();
  const tex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ffe7a8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd36e';
    for (let y = 0; y < h; y += 64)
      for (let x = 0; x < w; x += 64) {
        g.fillRect(x, y, 32, 32);
        g.fillRect(x + 32, y + 32, 32, 32);
      }
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let y = 16; y < h; y += 64)
      for (let x = 16; x < w; x += 64) {
        g.beginPath();
        g.arc(x, y, 5, 0, 7);
        g.fill();
      }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2.2);
  const bl = new THREE.Mesh(blanketGeo, toon(0xffffff, { map: tex, side: THREE.DoubleSide, bumpMap: fabricTexture(), bumpScale: 0.6 }));
  bl.castShadow = true;
  bl.receiveShadow = true;
  blanketG.add(bl);
}
function updateBlanket(px, pz, under, t) {
  const pos = blanketGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let y = blanketBase[i];
    if (under && x > -4.6) {
      const d = Math.hypot(x - px, z - pz);
      if (d < 1.3) y += Math.pow(1 - d / 1.3, 2) * (0.38 + Math.sin(t * 40) * 0.04 * phoneState.buzz);
    }
    pos.setY(i, y);
  }
  pos.needsUpdate = true;
  blanketGeo.computeVertexNormals();
}

// desk
const DESK = { x0: 7.6, x1: 13, z0: -6.4, z1: 2.4, top: 5 };
const deskG = new THREE.Group();
scene.add(deskG);
const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1b8 }));
{
  const wood = toon(0xf3e1c7);
  const top = occ(mesh(RB(5.4, 0.4, 8.8, 0.12), wood, 10.3, 4.8, -2, deskG));
  for (const [x, z] of [[7.95, -6.05], [12.7, -6.05], [7.95, 2.05], [12.7, 2.05]]) {
    mesh(new THREE.BoxGeometry(0.4, 4.6, 0.4), toon(0xe6cfae), x, 2.3, z, deskG);
    block(x - 0.2, x + 0.2, z - 0.2, z + 0.2);
  }
  const drawer = occ(mesh(RB(3.2, 4.2, 2.6, 0.12), toon(0xf7ead6), 11.2, 2.4, -4.8, deskG));
  for (let i = 0; i < 3; i++) mesh(RB(0.9, 0.18, 0.18, 0.06), toon(0xc9a27a), 9.55, 1.1 + i * 1.3, -4.8, deskG);
  drawer.receiveShadow = true;
  block(9.6, 13, -6.1, -3.5);
  // stuff on desk
  const books = [0x9fd3ff, 0xffb3c7, 0xc4f0c5, 0xffe08a];
  books.forEach((c, i) => mesh(RB(2.2, 0.35, 1.6, 0.06), toon(c), 11.6, 5.2 + i * 0.36, -5.2 + i * 0.05, deskG));
  const note = mesh(new THREE.BoxGeometry(2.0, 0.08, 2.6), toon(0xffffff), 9.0, 5.05, -1.5, deskG);
  note.rotation.y = 0.2;
  const cup = mesh(new THREE.CylinderGeometry(0.4, 0.35, 1.0, 14), toon(0xb9a6ff), 11.8, 5.5, 0.9, deskG);
  for (let i = 0; i < 3; i++) {
    const pen = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), toon([0xff7a8a, 0x5ab0ff, 0xffd34d][i]), 11.8 + (i - 1) * 0.12, 6.1, 0.9 + (i - 1) * 0.08, deskG);
    pen.rotation.z = (i - 1) * 0.2;
  }
  // lamp
  mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.25, 16), toon(0xffffff), 12.2, 5.1, -1.2, deskG);
  const arm = mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 8), toon(0xffffff), 12.0, 6.6, -1.2, deskG);
  arm.rotation.z = 0.25;
  const shade = mesh(new THREE.ConeGeometry(0.9, 1.1, 18, 1, true), toon(0xffc6d9, { side: THREE.DoubleSide }), 11.2, 8, -1.2, deskG);
  shade.rotation.z = 0.5;
  lampBulb.position.set(11.0, 7.6, -1.2);
  deskG.add(lampBulb);
  const lampLight = new THREE.PointLight(0xffe2a8, 18, 14, 1.6);
  lampLight.position.set(10.6, 7.2, -1.2);
  deskG.add(lampLight);
}
// chair (owner sits here)
const CHAIR = { x: 6.2, z: -1.6 };
const chairG = new THREE.Group();
chairG.position.set(CHAIR.x, 0, CHAIR.z);
scene.add(chairG);
{
  const m = toon(0xb6a6ff);
  const dark = toon(0x8a80a8);
  for (let i = 0; i < 5; i++) {
    const leg = mesh(new THREE.BoxGeometry(0.25, 0.2, 1.5), dark, 0, 0.35, 0, chairG);
    leg.rotation.y = (i / 5) * Math.PI * 2;
    leg.translateZ(0.75);
    const wh = mesh(new THREE.SphereGeometry(0.2, 8, 6), dark, 0, 0.18, 0, chairG);
    wh.position.set(Math.sin(leg.rotation.y) * 1.45, 0.18, Math.cos(leg.rotation.y) * 1.45);
  }
  mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.4, 8), dark, 0, 1.6, 0, chairG);
  occ(mesh(RB(2.4, 0.45, 2.3, 0.2), m, 0, 2.95, 0, chairG));
  const back = occ(mesh(RB(2.3, 2.6, 0.4, 0.2), m, -1.25, 4.4, 0, chairG));
  back.rotation.y = Math.PI / 2;
  circles.push({ x: CHAIR.x, z: CHAIR.z, r: 0.45 });
}
// bookshelf
{
  const shelf = toon(0xfff3e2);
  const g = new THREE.Group();
  g.position.set(-3.5, 0, ROOM - 0.9);
  scene.add(g);
  occ(mesh(RB(5.4, 9, 1.6, 0.12), shelf, 0, 4.5, 0, g));
  const cols = [0xff9fb8, 0x9fd3ff, 0xffe08a, 0xb6f0c0, 0xc8b6ff, 0xffc49a];
  for (let r = 0; r < 4; r++) {
    let x = -2.3;
    while (x < 2.1) {
      const w = rand(0.3, 0.55);
      const h = rand(1.2, 1.7);
      mesh(new THREE.BoxGeometry(w, h, 1.1), toon(pick(cols)), x + w / 2, 0.6 + r * 2.15 + h / 2, -0.85, g);
      x += w + 0.05;
    }
  }
  block(-6.3, -0.7, ROOM - 1.8, ROOM);
}
// backpack, cushions, basket, trash
{
  const bag = occ(mesh(RB(2.2, 2.8, 1.5, 0.6, 3), toon(0xffb27a), 3.6, 1.4, -6.6));
  bag.rotation.y = 0.3;
  mesh(RB(1.6, 1.2, 0.5, 0.3, 3), toon(0xff9a5c), 3.75, 0.9, -5.8).rotation.y = 0.3;
  block(2.5, 4.7, -7.4, -5.6);
  const cush = (x, z, c, ry) => {
    const m = occ(mesh(RB(2.8, 1.3, 2.8, 0.6, 4), toon(c, { bumpMap: fabricTexture(), bumpScale: 0.5 }), x, 0.62, z));
    m.rotation.y = ry;
    m.scale.y = 0.95;
    block(x - 1.45, x + 1.45, z - 1.45, z + 1.45);
  };
  cush(-1.8, 8.3, 0xa8e6cf, 0.2);
  cush(1.6, 9.6, 0xffc6e0, -0.35);
  const basket = occ(mesh(new THREE.CylinderGeometry(1.5, 1.2, 2.6, 18), toon(0xe8d3b8), -10.6, 1.3, 10.2));
  mesh(new THREE.SphereGeometry(1.2, 12, 8), toon(0xbfd9ff), -10.4, 2.6, 10.1);
  circles.push({ x: -10.6, z: 10.2, r: 1.55 });
  const bin = occ(mesh(new THREE.CylinderGeometry(0.9, 0.75, 2, 16), toon(0xc6e7ff), 8.6, 1, 4.4));
  circles.push({ x: 8.6, z: 4.4, r: 0.95 });
  bin.receiveShadow = true;
}
// rug + socks (quiet patches)
const RUG = { x: -0.5, z: 2.6, r: 4.6 };
{
  const tex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    const rings = ['#ffd6e4', '#fff1c9', '#d9f2ff', '#e5dcff', '#ffd6e4'];
    rings.forEach((c, i) => {
      g.fillStyle = c;
      g.beginPath();
      g.arc(w / 2, h / 2, w / 2 - i * 48, 0, 7);
      g.fill();
    });
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(w / 2, h / 2, 40, 0, 7);
    g.fill();
  });
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(RUG.r, RUG.r, 0.08, 48), toon(0xffffff, { map: tex, bumpMap: fabricTexture(), bumpScale: 0.8 }));
  rug.position.set(RUG.x, 0.04, RUG.z);
  rug.receiveShadow = true;
  scene.add(rug);
  // fringe
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const f = mesh(new THREE.BoxGeometry(0.06, 0.03, 0.35), toon(0xfff1c9), RUG.x + Math.cos(a) * (RUG.r + 0.15), 0.03, RUG.z + Math.sin(a) * (RUG.r + 0.15));
    f.rotation.y = -a + Math.PI / 2;
    f.castShadow = false;
  }
}
const SOCKS = [
  { x: 3.2, z: -2.8, ry: 0.6, c: 0xffffff },
  { x: 4.9, z: 1.2, ry: -0.4, c: 0xbfe3ff },
  { x: -5.6, z: 3.6, ry: 1.2, c: 0xffd1dc },
  { x: -3.4, z: -1.6, ry: -1.1, c: 0xd9f5d0 },
];
for (const s of SOCKS) {
  const g = new THREE.Group();
  g.position.set(s.x, 0, s.z);
  g.rotation.y = s.ry;
  scene.add(g);
  const m = toon(s.c, { bumpMap: fabricTexture(), bumpScale: 0.6 });
  mesh(RB(0.9, 0.22, 1.9, 0.1), m, 0, 0.11, 0, g);
  mesh(RB(1.0, 0.24, 0.9, 0.1), m, 0.35, 0.12, 0.85, g).rotation.y = 0.5;
  mesh(RB(0.92, 0.24, 0.3, 0.08), toon(darker(s.c, 0.85)), 0, 0.12, -0.95, g);
}
// wireless charger pad
const PAD = { x: 5.8, z: 10.6, r: 0.8 };
const padLed = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: 0xbfe9d2 }));
const padLight = new THREE.PointLight(0x6dffb0, 0, 6, 1.5);
{
  mesh(new THREE.CylinderGeometry(PAD.r, PAD.r + 0.05, 0.12, 30), toon(0xffffff), PAD.x, 0.06, PAD.z);
  padLed.rotation.x = Math.PI / 2;
  padLed.position.set(PAD.x, 0.13, PAD.z);
  scene.add(padLed);
  padLight.position.set(PAD.x, 0.8, PAD.z);
  scene.add(padLight);
  // cable to the wall
  const pts = [new THREE.Vector3(PAD.x, 0.06, PAD.z + 0.8), new THREE.Vector3(PAD.x + 0.8, 0.06, PAD.z + 1.4), new THREE.Vector3(PAD.x + 0.3, 0.06, ROOM - 0.5), new THREE.Vector3(PAD.x + 0.3, 1.2, ROOM - 0.1)];
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.06, 6), toon(0xffffff));
  scene.add(cable);
  mesh(RB(0.9, 1.2, 0.2, 0.08), toon(0xffffff), PAD.x + 0.3, 1.3, ROOM - 0.08);
}

// ======================================================================
// surfaces
// ======================================================================
const SURF = {
  wood: { name: '나무 바닥', sub: '시끄러움!', loud: 1.0, soft: false },
  rug: { name: '러그', sub: '조용', loud: 0.3, soft: true },
  sock: { name: '양말', sub: '아주 조용', loud: 0.18, soft: true },
  blanket: { name: '이불 속', sub: '숨음 · 조용', loud: 0.26, soft: true },
  underbed: { name: '침대 밑', sub: '숨음 · 울림 있음', loud: 0.72, soft: false },
  pad: { name: '충전기 위', sub: '충전 중 · 눈에 띔', loud: 0.85, soft: false },
};
function inBlanket(x, z, m = 0) {
  return x > BLANKET.x0 + m && x < BLANKET.x1 - m && z > BLANKET.z0 + m && z < BLANKET.z1 - m;
}
function inBed(x, z) {
  return x < BED.x1 - 0.2 && z < BED.z1 - 0.2;
}
function surfaceAt(x, z) {
  if (inBlanket(x, z, 0.15)) return 'blanket';
  if (inBed(x, z)) return 'underbed';
  if (Math.hypot(x - PAD.x, z - PAD.z) < PAD.r) return 'pad';
  for (const s of SOCKS) if (Math.hypot(x - s.x, z - s.z) < 1.1) return 'sock';
  if (Math.hypot(x - RUG.x, z - RUG.z) < RUG.r) return 'rug';
  return 'wood';
}

// ======================================================================
// owner (giant student)
// ======================================================================
const SKIN = 0xffdcc6;
const owner = {
  root: new THREE.Group(),
  x: CHAIR.x, z: CHAIR.z, yaw: Math.PI / 2, headYaw: 0, headPitch: 0.35,
  stand: 0, bend: 0, kneel: 0, walk: 0, walkPhase: 0, reach: 0, stretch: 0,
  mode: 'study', t: 0, sus: 0, seen: 0, heard: { x: 0, z: 0 }, target: null, quietT: 0, spotted: false, lookPhase: 0,
};
scene.add(owner.root);
const OW = {};
{
  const hoodie = toon(0xc3b4ff);
  const pants = toon(0x6e7fb8);
  const skin = toon(SKIN);
  const hairMat = toon(0x4a3a40);
  OW.hips = new THREE.Group();
  owner.root.add(OW.hips);
  mesh(RB(2.4, 1.0, 1.6, 0.45, 3), pants, 0, 0.1, 0, OW.hips);
  OW.torso = new THREE.Group();
  OW.hips.add(OW.torso);
  mesh(RB(2.6, 3.0, 1.7, 0.7, 3), hoodie, 0, 1.6, 0, OW.torso);
  const pocket = mesh(RB(1.6, 0.8, 0.2, 0.15), toon(0xb3a2f5), 0, 0.9, 0.82, OW.torso);
  pocket.castShadow = false;
  // hood behind neck
  mesh(RB(2.0, 0.7, 1.0, 0.35, 3), hoodie, 0, 3.1, -0.7, OW.torso);
  OW.head = new THREE.Group();
  OW.head.position.y = 3.25;
  OW.torso.add(OW.head);
  const headM = mesh(new THREE.SphereGeometry(1.35, 28, 20), skin, 0, 1.05, 0, OW.head);
  headM.scale.set(1, 1.02, 0.95);
  const hair = mesh(new THREE.SphereGeometry(1.42, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat, 0, 1.12, -0.05, OW.head);
  hair.rotation.x = -0.25;
  for (let i = 0; i < 4; i++) {
    const b = mesh(new THREE.SphereGeometry(0.42, 10, 8), hairMat, -0.75 + i * 0.5, 1.95 - Math.abs(i - 1.5) * 0.08, 1.05, OW.head);
    b.scale.set(1, 0.7, 0.6);
  }
  // ahoge
  const ah = mesh(new THREE.TorusGeometry(0.35, 0.07, 6, 12, Math.PI * 1.2), hairMat, 0.1, 2.75, -0.1, OW.head);
  ah.rotation.set(0, Math.PI / 2, 0.4);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.3, 10, 8), skin, s * 1.33, 1.0, 0, OW.head);
  // face parts (front = +z)
  OW.eyes = [];
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshBasicMaterial({ color: 0x2f2530 }), s * 0.45, 1.12, 1.2, OW.head);
    e.scale.set(1, 1.25, 0.5);
    const h = mesh(new THREE.SphereGeometry(0.055, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.06, 0.07, 0.08, e);
    e.castShadow = h.castShadow = false;
    OW.eyes.push(e);
  }
  OW.happyEyes = [];
  for (const s of [-1, 1]) {
    const a = mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x2f2530 }), s * 0.45, 1.08, 1.24, OW.head);
    a.visible = false;
    OW.happyEyes.push(a);
  }
  // glasses
  const gm = toon(0x6b4e5a);
  OW.glasses = new THREE.Group();
  OW.head.add(OW.glasses);
  for (const s of [-1, 1]) {
    const r = mesh(new THREE.TorusGeometry(0.34, 0.045, 6, 22), gm, s * 0.45, 1.12, 1.32, OW.glasses);
    r.castShadow = false;
  }
  mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), gm, 0, 1.18, 1.36, OW.glasses);
  OW.glint = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
  OW.glint.position.set(-0.45, 1.2, 1.4);
  OW.glint.rotation.z = 0.6;
  OW.head.add(OW.glint);
  OW.brows = [];
  for (const s of [-1, 1]) {
    const b = mesh(RB(0.42, 0.09, 0.08, 0.04), hairMat, s * 0.45, 1.58, 1.22, OW.head);
    b.castShadow = false;
    OW.brows.push(b);
  }
  for (const s of [-1, 1]) {
    const bl = mesh(new THREE.CircleGeometry(0.2, 14), new THREE.MeshBasicMaterial({ color: 0xff9fb4, transparent: true, opacity: 0.6 }), s * 0.78, 0.82, 1.14, OW.head);
    bl.rotation.y = s * 0.55;
    bl.castShadow = false;
  }
  OW.mouth = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x8a3b52, side: THREE.DoubleSide }));
  OW.mouth.position.set(0, 0.55, 1.3);
  OW.head.add(OW.mouth);
  // arms
  OW.arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 1.45, 2.7, 0);
    OW.torso.add(sh);
    mesh(new THREE.CapsuleGeometry(0.42, 1.2, 6, 10), hoodie, 0, -0.8, 0, sh);
    const el = new THREE.Group();
    el.position.y = -1.6;
    sh.add(el);
    mesh(new THREE.CapsuleGeometry(0.36, 1.0, 6, 10), hoodie, 0, -0.65, 0, el);
    const hand = mesh(new THREE.SphereGeometry(0.42, 12, 10), skin, 0, -1.45, 0, el);
    hand.scale.set(1, 1.1, 0.8);
    OW.arms.push({ sh, el, hand });
  }
  // legs
  OW.legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.62, 0, 0);
    OW.hips.add(hip);
    mesh(new THREE.CapsuleGeometry(0.5, 1.7, 6, 10), pants, 0, -1.2, 0, hip);
    const knee = new THREE.Group();
    knee.position.y = -2.6;
    hip.add(knee);
    mesh(new THREE.CapsuleGeometry(0.45, 2.1, 6, 10), pants, 0, -1.3, 0, knee);
    const foot = new THREE.Group();
    foot.position.set(0, -3.0, 0.35);
    knee.add(foot);
    // bunny slipper
    mesh(RB(1.05, 0.6, 1.9, 0.28, 3), toon(0xffd6e4), 0, 0, 0.1, foot);
    for (const e of [-1, 1]) {
      const ear = mesh(new THREE.CapsuleGeometry(0.13, 0.5, 4, 8), toon(0xffd6e4), e * 0.22, 0.45, 0.65, foot);
      ear.rotation.x = -0.5;
      ear.rotation.z = e * 0.2;
    }
    for (const e of [-1, 1]) mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0x2f2530 }), e * 0.2, 0.22, 1.02, foot);
    OW.legs.push({ hip, knee, foot });
  }
  owner.root.traverse((o) => {
    if (o.isMesh) o.userData.owner = true;
  });
}
const oexpr = { smile: 0.05, open: 0, eye: 0.8, browL: 0, browR: 0, browA: 0, happy: 0, look: -0.08 };
const OEX = {
  study: { smile: 0.0, open: 0, eye: 0.75, browL: 0, browR: 0, browA: 0.05, happy: 0, look: -0.09 },
  hmm: { smile: -0.15, open: 0.15, eye: 1, browL: 0.18, browR: -0.05, browA: 0, happy: 0, look: 0 },
  sus: { smile: -0.35, open: 0, eye: 0.5, browL: -0.06, browR: -0.06, browA: 0.4, happy: 0, look: 0 },
  spot: { smile: -0.1, open: 0.9, eye: 1.35, browL: 0.25, browR: 0.25, browA: -0.2, happy: 0, look: 0 },
  gotcha: { smile: 1, open: 0.55, eye: 1.1, browL: 0.15, browR: 0.15, browA: -0.3, happy: 0, look: 0 },
  sigh: { smile: -0.25, open: 0.2, eye: 0.55, browL: 0.05, browR: 0.05, browA: -0.35, happy: 0, look: 0 },
  happy: { smile: 1, open: 0.5, eye: 1, browL: 0.15, browR: 0.15, browA: -0.2, happy: 1, look: 0 },
};
let oexTarget = OEX.study;
let oMouthKey = '';
function ownerFace(dt, t) {
  for (const k in oexpr) oexpr[k] = damp(oexpr[k], oexTarget[k], 8, dt);
  const key = oexpr.smile.toFixed(2) + oexpr.open.toFixed(2);
  if (key !== oMouthKey) {
    oMouthKey = key;
    const w = 0.34, sm = oexpr.smile, op = oexpr.open;
    const s = new THREE.Shape();
    const cy = sm * 0.1;
    s.moveTo(-w, cy);
    s.quadraticCurveTo(0, -sm * 0.04 + 0.03, w, cy);
    s.quadraticCurveTo(0, -sm * 0.16 - op * 0.55 - 0.05, -w, cy);
    OW.mouth.geometry.dispose();
    OW.mouth.geometry = new THREE.ShapeGeometry(s, 12);
  }
  const blink = t % 3.3 < 0.11 ? 0.12 : 1;
  OW.eyes.forEach((e, i) => {
    e.scale.y = 1.25 * oexpr.eye * blink;
    e.position.y = 1.12 + oexpr.look;
    e.visible = oexpr.happy < 0.5;
    OW.happyEyes[i].visible = oexpr.happy >= 0.5;
  });
  OW.brows.forEach((b, i) => {
    const s = i ? 1 : -1;
    b.position.y = 1.58 + (i ? oexpr.browR : oexpr.browL);
    b.rotation.z = -s * oexpr.browA;
  });
}
function setOwnerExpr(n) {
  oexTarget = OEX[n];
}
function headWorld(out = new THREE.Vector3()) {
  return OW.head.localToWorld(out.set(0, 1.1, 0.6));
}
function ownerFacingYaw() {
  return owner.yaw + owner.headYaw;
}

function poseOwner(dt, t) {
  const o = owner;
  const st = o.stand, kn = o.kneel;
  const hipY = lerp(lerp(3.35, 5.6, st), 2.3, kn);
  o.root.position.set(o.x, 0, o.z);
  o.root.rotation.y = o.yaw;
  const bob = o.walk > 0.1 ? Math.abs(Math.sin(o.walkPhase)) * 0.18 : 0;
  OW.hips.position.y = hipY + bob - o.stretch * -0.1;
  OW.torso.rotation.x = o.bend + kn * 0.7 + (st < 0.5 ? 0.12 : 0) - o.stretch * 0.15;
  OW.head.rotation.y = o.headYaw;
  OW.head.rotation.x = o.headPitch;
  // legs
  OW.legs.forEach((L, i) => {
    const s = i ? 1 : -1;
    const swing = o.walk * Math.sin(o.walkPhase + i * Math.PI) * 0.55;
    const sitThigh = -Math.PI / 2, sitKnee = Math.PI / 2;
    let thigh = lerp(sitThigh, swing, st);
    let knee = lerp(sitKnee, Math.max(0, -swing) * 0.9 + 0.05, st);
    thigh = lerp(thigh, -1.25, kn);
    knee = lerp(knee, 2.2, kn);
    L.hip.rotation.x = thigh;
    L.knee.rotation.x = knee;
    L.foot.rotation.x = -(thigh + knee);
    L.hip.rotation.z = s * 0.04;
    // foot tapping while studying
    if (st < 0.1 && i === 1) L.knee.rotation.x += Math.max(0, Math.sin(t * 6)) * 0.12;
  });
  // arms
  const writing = (1 - st) * (o.mode === 'study' ? 1 : 0.3);
  OW.arms.forEach((A, i) => {
    const s = i ? 1 : -1;
    let sh = lerp(0.15, -0.65, 1 - st);
    let el = lerp(-0.25, -1.15, 1 - st);
    if (o.walk > 0.1) sh += Math.sin(o.walkPhase + i * Math.PI + Math.PI) * 0.45 * o.walk;
    if (i === 1) el += Math.sin(t * 14) * 0.06 * writing;
    // reach down (grab phone)
    sh = lerp(sh, -1.2, o.reach * (i === 1 ? 1 : 0.3));
    el = lerp(el, -0.2, o.reach * (i === 1 ? 1 : 0.3));
    // stretch (win)
    sh = lerp(sh, -2.9, o.stretch);
    el = lerp(el, -0.1, o.stretch);
    A.sh.rotation.x = sh;
    A.el.rotation.x = el;
    A.sh.rotation.z = s * (0.12 + o.stretch * 0.25);
  });
  ownerFace(dt, t);
  // glasses glint when suspicious
  const g = OW.glint.material;
  g.opacity = o.mode === 'turn' || o.mode === 'search' ? Math.max(0, Math.sin(t * 2.2)) ** 8 : 0;
}

// ======================================================================
// phone
// ======================================================================
const phone = new THREE.Group();
scene.add(phone);
const phoneBody = new THREE.Group();
phone.add(phoneBody);
const screenCanvas = document.createElement('canvas');
screenCanvas.width = 256;
screenCanvas.height = 512;
const sctx = screenCanvas.getContext('2d');
const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.colorSpace = THREE.SRGBColorSpace;
screenTex.anisotropy = 8;
{
  const caseM = mesh(RB(0.6, 0.11, 1.16, 0.05, 3), toon(0xb9a8ff), 0, 0.055, 0, phoneBody);
  addOutline(caseM, 0x7d6bd1, 0.04);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 1.04), new THREE.MeshBasicMaterial({ map: screenTex }));
  screen.rotation.set(-Math.PI / 2, 0, Math.PI);
  screen.position.y = 0.113;
  phoneBody.add(screen);
  // side buttons
  mesh(new THREE.BoxGeometry(0.04, 0.05, 0.22), toon(0x9d8cf0), 0.31, 0.06, 0.18, phoneBody);
  // charm strap (detail)
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), toon(0xff8fb1));
  strap.position.set(-0.24, 0.06, -0.62);
  strap.rotation.x = Math.PI / 2;
  phoneBody.add(strap);
  const charm = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), toon(0xffe36e));
  charm.position.set(-0.3, 0.07, -0.78);
  phoneBody.add(charm);
}
// screen light pool on the floor
const glowTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
});
const glow = new THREE.Mesh(
  new THREE.PlaneGeometry(3, 3),
  new THREE.MeshBasicMaterial({ map: glowTex, color: 0xd8ccff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending })
);
glow.rotation.x = -Math.PI / 2;
glow.position.y = 0.02;
phone.add(glow);

const phoneState = {
  x: -0.5, z: 3.2, yaw: Math.PI, buzz: 0, battery: 55, surf: 'rug', charging: false, wasCharging: false,
  forced: 0, forcedPower: 0, dead: false, lowWarned: false, face: 'normal', faceT: 0, moving: false,
};

function drawScreen(t) {
  const g = sctx, W = 256, H = 512;
  const ps = phoneState;
  g.clearRect(0, 0, W, H);
  if (ps.dead) {
    g.fillStyle = '#121016';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#ff4f6b';
    g.lineWidth = 6;
    roundRect(g, 88, 230, 70, 40, 8);
    g.stroke();
    g.fillStyle = '#ff4f6b';
    g.fillRect(160, 242, 8, 16);
    screenTex.needsUpdate = true;
    return;
  }
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#cbbcff');
  gr.addColorStop(1, '#ffd1e8');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (const [x, y, r] of [[40, 420, 4], [210, 380, 3], [190, 470, 5], [30, 150, 3], [225, 160, 4]]) {
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.fill();
  }
  // status bar
  g.fillStyle = '#4a3d6b';
  g.font = `800 22px ${FONT}`;
  g.textAlign = 'left';
  const mins = Math.max(0, Math.ceil(game.timeLeft));
  g.fillText(`23:${String(59 - Math.floor((mins / 90) * 59)).padStart(2, '0')}`, 16, 30);
  const bat = ps.battery;
  g.strokeStyle = bat < 20 ? '#ff4f6b' : '#4a3d6b';
  g.lineWidth = 3;
  roundRect(g, 180, 12, 52, 24, 6);
  g.stroke();
  g.fillStyle = bat < 20 ? '#ff4f6b' : ps.charging ? '#2ecc80' : '#4a3d6b';
  g.fillRect(184, 16, Math.max(2, (44 * bat) / 100), 16);
  g.fillRect(233, 19, 4, 10);
  if (ps.charging) {
    g.fillStyle = '#2ecc80';
    g.beginPath();
    g.moveTo(140, 10);
    g.lineTo(126, 28);
    g.lineTo(136, 28);
    g.lineTo(130, 42);
    g.lineTo(146, 22);
    g.lineTo(136, 22);
    g.closePath();
    g.fill();
  }
  // face
  const cx = 128, cy = 300;
  const face = ps.face;
  const blink = t % 2.6 < 0.1;
  g.fillStyle = 'rgba(255,140,180,0.55)';
  g.beginPath();
  g.ellipse(cx - 70, cy + 30, 20, 12, 0, 0, 7);
  g.ellipse(cx + 70, cy + 30, 20, 12, 0, 0, 7);
  g.fill();
  g.fillStyle = '#3a2d4f';
  g.strokeStyle = '#3a2d4f';
  g.lineCap = 'round';
  if (face === 'happy') {
    g.lineWidth = 9;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + s * 42, cy, 18, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
    g.beginPath();
    g.arc(cx, cy + 30, 24, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
  } else if (face === 'shock') {
    for (const s of [-1, 1]) {
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(cx + s * 42, cy, 24, 0, 7);
      g.fill();
      g.fillStyle = '#3a2d4f';
      g.beginPath();
      g.arc(cx + s * 42, cy, 11, 0, 7);
      g.fill();
    }
    g.beginPath();
    g.ellipse(cx, cy + 50, 16, 22, 0, 0, 7);
    g.fill();
  } else if (face === 'sleepy') {
    g.lineWidth = 8;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * 42 - 16, cy + 4);
      g.lineTo(cx + s * 42 + 16, cy + 4);
      g.stroke();
    }
    g.beginPath();
    g.arc(cx, cy + 46, 12, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
  } else {
    const tense = face === 'tense';
    for (const s of [-1, 1]) {
      g.beginPath();
      if (blink) g.ellipse(cx + s * 42, cy, 16, 3, 0, 0, 7);
      else if (tense) g.arc(cx + s * 42 + Math.sin(t * 30) * 1.5, cy, 9, 0, 7);
      else g.ellipse(cx + s * 42, cy, 14, 22, 0, 0, 7);
      g.fill();
      if (!blink && !tense) {
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(cx + s * 42 + 5, cy - 8, 5, 0, 7);
        g.fill();
        g.fillStyle = '#3a2d4f';
      }
    }
    g.lineWidth = 7;
    g.beginPath();
    if (tense) {
      g.moveTo(cx - 22, cy + 42);
      for (let i = 0; i <= 4; i++) g.lineTo(cx - 22 + i * 11, cy + 42 + (i % 2 ? -6 : 6));
    } else g.arc(cx, cy + 26, 18, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
    if (tense) {
      // sweat drop
      g.fillStyle = '#8fd0ff';
      const sy = cy - 70 + ((t * 40) % 30);
      g.beginPath();
      g.moveTo(cx + 92, sy - 22);
      g.quadraticCurveTo(cx + 108, sy, cx + 92, sy + 8);
      g.quadraticCurveTo(cx + 76, sy, cx + 92, sy - 22);
      g.fill();
    }
  }
  // notification banner
  if (notif.phase !== 'idle') {
    const y = notif.phase === 'count' ? 52 : 52 + Math.sin(t * 60) * 3;
    g.fillStyle = 'rgba(255,255,255,0.96)';
    roundRect(g, 12, y, W - 24, 104, 20);
    g.fill();
    g.fillStyle = '#ff8a2a';
    roundRect(g, 26, y + 16, 34, 34, 9);
    g.fill();
    g.fillStyle = '#9a8aa8';
    g.font = `800 17px ${FONT}`;
    g.fillText(notif.app, 70, y + 38);
    g.fillStyle = '#3a2d4f';
    g.font = `800 19px ${FONT}`;
    const msg = notif.msg.length > 11 ? notif.msg.slice(0, 11) + '…' : notif.msg;
    g.fillText(msg, 26, y + 82);
  }
  if (ps.battery < 15 && !ps.charging && Math.floor(t * 2) % 2 === 0) {
    g.fillStyle = '#ff4f6b';
    g.font = `900 22px ${FONT}`;
    g.textAlign = 'center';
    g.fillText('배터리 부족', cx, 470);
  }
  screenTex.needsUpdate = true;
}

// ======================================================================
// effects: sound rings, onomatopoeia, vision cone
// ======================================================================
const rings = [];
const ringGeo = new THREE.RingGeometry(0.92, 1, 48);
function spawnRing(x, z, loud, soft) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: soft ? 0x8cc9ff : 0xff9b52, transparent: true, opacity: 0.85, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.06, z);
  scene.add(m);
  rings.push({ m, t: 0, max: 0.8 + loud * 4.2 });
}
const sprites = [];
function spawnWord(text, x, y, z, color = '#ff8a2a', size = 1) {
  const tex = canvasTex(256, 128, (g, w, h) => {
    g.font = `900 64px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 14;
    g.strokeStyle = '#ffffff';
    g.lineJoin = 'round';
    g.strokeText(text, w / 2, h / 2);
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  s.position.set(x, y, z);
  s.scale.set(1.4 * size, 0.7 * size, 1);
  s.renderOrder = 10;
  scene.add(s);
  sprites.push({ s, t: 0, vy: 0.9, rot: rand(-0.3, 0.3) });
}
function updateFx(dt) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += dt;
    const k = r.t / 0.8;
    r.m.scale.setScalar(0.2 + k * r.max);
    r.m.material.opacity = 0.85 * (1 - k);
    if (k >= 1) {
      scene.remove(r.m);
      r.m.material.dispose();
      rings.splice(i, 1);
    }
  }
  for (let i = sprites.length - 1; i >= 0; i--) {
    const p = sprites[i];
    p.t += dt;
    p.s.position.y += p.vy * dt;
    p.s.material.rotation = p.rot;
    p.s.material.opacity = 1 - Math.max(0, (p.t - 0.5) / 0.5);
    const pop = Math.min(1, p.t / 0.12);
    p.s.scale.x = p.s.scale.x * 0 + 1.4 * pop * (p.s.userData.size || 1);
    if (p.t > 1) {
      scene.remove(p.s);
      p.s.material.map.dispose();
      p.s.material.dispose();
      sprites.splice(i, 1);
    }
  }
}
const coneMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
let coneMesh = null;
function setCone(range, half) {
  if (coneMesh && coneMesh.userData.k === range + ':' + half) return;
  if (coneMesh) {
    scene.remove(coneMesh);
    coneMesh.geometry.dispose();
  }
  const geo = new THREE.CircleGeometry(range, 28, Math.PI / 2 - half, half * 2);
  geo.rotateX(-Math.PI / 2);
  coneMesh = new THREE.Mesh(geo, coneMat);
  coneMesh.userData.k = range + ':' + half;
  coneMesh.position.y = 0.05;
  coneMesh.renderOrder = 2;
  scene.add(coneMesh);
}
setCone(12, 0.5);

// ======================================================================
// sound
// ======================================================================
let buzzHum = null;
let music = null;
function initAudio() {
  sfx.init();
  if (!buzzHum) buzzHum = sfx.hum({ type: 'sawtooth', f: 150, filter: 900, v: 0 });
  if (!music) {
    music = new Music(sfx, {
      bpm: 112,
      melody: seq('E5 - G5 - E5 D5 C5 - D5 - E5 - G4 - - - E5 - G5 - A5 G5 E5 - D5 - C5 - D5 - - -'),
      bass: seq('C3 - - - G2 - - - A2 - - - G2 - - -'),
      v: 0.02,
      wave: 'triangle',
    });
    music.start();
  }
}
const S = {
  ping: () => { sfx.tone({ f: 1046, d: 0.12, type: 'sine', v: 0.12 }); sfx.tone({ f: 1568, d: 0.25, type: 'sine', v: 0.1, delay: 0.1 }); },
  tick: () => sfx.tone({ f: 880, d: 0.06, type: 'square', v: 0.06 }),
  chime: () => [784, 988, 1318].forEach((f, i) => sfx.tone({ f, d: 0.2, type: 'sine', v: 0.14, delay: i * 0.09 })),
  step: (v) => { sfx.tone({ f: 70, f2: 40, d: 0.18, type: 'sine', v: 0.35 * v }); sfx.noise({ d: 0.1, v: 0.12 * v, f: 300 }); },
  talk: (n = 5) => { for (let i = 0; i < n; i++) sfx.tone({ f: rand(260, 420), d: 0.07, type: 'triangle', v: 0.1, delay: i * 0.075 }); },
  sting: () => { sfx.tone({ f: 523, d: 0.12, type: 'square', v: 0.12 }); sfx.tone({ f: 784, d: 0.4, type: 'square', v: 0.12, delay: 0.12 }); },
  gasp: () => sfx.tone({ f: 300, f2: 900, d: 0.25, type: 'triangle', v: 0.18 }),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => sfx.tone({ f, d: 0.25, type: 'triangle', v: 0.14, delay: i * 0.1 })),
  lose: () => [659, 587, 523, 392].forEach((f, i) => sfx.tone({ f, d: 0.3, type: 'triangle', v: 0.15, delay: i * 0.18 })),
};

// ======================================================================
// game state
// ======================================================================
const game = { phase: 'title', timeLeft: 90, total: 90, maxSus: 0, buzzTime: 0, notifSurvived: 0, shake: 0, endT: 0, result: '' };
const notif = { phase: 'idle', t: 0, next: 9, app: '', msg: '' };
const NOTIFS = [
  ['3학년 2반 단톡', '내일 시험 범위 어디까지야??'],
  ['엄마', '밥 먹고 공부해라'],
  ['게임 알림', '출석 보상이 도착했어요!'],
  ['쇼핑', '장바구니 상품이 할인 중이에요'],
  ['친구 지민', 'ㅋㅋㅋㅋ 이거 봐봐'],
  ['날씨', '내일 아침 비 소식이 있어요'],
  ['동네 맛집', '오늘만 치킨 3천원 할인'],
];

let bubbleT = 0;
function say(text, dur = 1.8, alert = false) {
  const b = $('bubble');
  b.textContent = text;
  b.classList.toggle('alert', alert);
  b.classList.add('on');
  bubbleT = dur;
  S.talk(Math.min(7, Math.ceil(text.length / 2)));
}

// ======================================================================
// phone movement + collision
// ======================================================================
function collide(p) {
  const r = 0.55;
  p.x = clamp(p.x, -ROOM + r + 0.2, ROOM - r - 0.2);
  p.z = clamp(p.z, -ROOM + r + 0.2, ROOM - r - 0.2);
  for (const b of boxes) {
    const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
    const dx = p.x - cx, dz = p.z - cz;
    const d = Math.hypot(dx, dz);
    if (d < r) {
      if (d > 1e-4) {
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
      } else {
        // inside: push out on shortest axis
        const opts = [[b.x0 - r - p.x, 0], [b.x1 + r - p.x, 0], [0, b.z0 - r - p.z], [0, b.z1 + r - p.z]];
        opts.sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1]));
        p.x += opts[0][0];
        p.z += opts[0][1];
      }
    }
  }
  const cs = circles.concat(ownerFeetCircles());
  for (const c of cs) {
    const dx = p.x - c.x, dz = p.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < r + c.r && d > 1e-4) {
      p.x = c.x + (dx / d) * (r + c.r);
      p.z = c.z + (dz / d) * (r + c.r);
    }
  }
}
const _fv = new THREE.Vector3();
function ownerFeetCircles() {
  if (owner.stand < 0.5) return [];
  return OW.legs.map((L) => {
    L.foot.getWorldPosition(_fv);
    return { x: _fv.x, z: _fv.z, r: 0.8 };
  });
}

let ringT = 0, wordT = 0;
function updatePhone(dt, t) {
  const ps = phoneState;
  let fwd = 0, turn = 0;
  const canMove = !ps.dead && game.phase === 'play';
  if (canMove) {
    if (keys.any('KeyW', 'ArrowUp')) fwd += 1;
    if (keys.any('KeyS', 'ArrowDown')) fwd -= 0.65;
    if (keys.any('KeyA', 'ArrowLeft')) turn += 1;
    if (keys.any('KeyD', 'ArrowRight')) turn -= 1;
  }
  const soft = keys.any('ShiftLeft', 'ShiftRight');
  const k = soft ? 0.42 : 1;
  ps.yaw += turn * 2.3 * dt * (soft ? 0.7 : 1);
  const speed = 2.7 * k;
  const jitter = (fwd || turn) ? rand(-0.35, 0.35) : 0;
  const yawJ = ps.yaw + jitter * 0.25;
  ps.x += Math.sin(yawJ) * fwd * speed * dt;
  ps.z += Math.cos(yawJ) * fwd * speed * dt;
  // forced vibration slides the phone a little
  if (ps.forced > 0) {
    ps.forced -= dt;
    ps.x += rand(-1, 1) * 0.9 * dt;
    ps.z += rand(-1, 1) * 0.9 * dt;
    ps.yaw += rand(-1, 1) * 1.2 * dt;
  }
  collide(ps);
  ps.moving = !!(fwd || turn);
  // vibration amount
  let buzz = 0;
  if (fwd) buzz = Math.abs(fwd) * k;
  else if (turn) buzz = 0.4 * k;
  if (ps.forced > 0) buzz = Math.max(buzz, ps.forcedPower);
  if (ps.chimeT > 0) {
    ps.chimeT -= dt;
    buzz = Math.max(buzz, 0.9);
  }
  ps.buzz = damp(ps.buzz, buzz, 20, dt);
  ps.surf = surfaceAt(ps.x, ps.z);
  const S0 = SURF[ps.surf];
  ps.noise = ps.buzz * S0.loud;
  if (ps.buzz > 0.2) game.buzzTime += dt;
  // battery
  if (!ps.dead && game.phase === 'play') {
    const drain = (fwd ? (soft ? 0.65 : 1.25) : 0) + (turn && !fwd ? 0.35 : 0) + (ps.forced > 0 ? 2 : 0);
    ps.battery -= drain * dt;
    ps.charging = ps.surf === 'pad';
    if (ps.charging) {
      ps.battery = Math.min(100, ps.battery + 6 * dt);
      if (!ps.wasCharging) {
        ps.chimeT = 0.45;
        S.chime();
        spawnWord('띠링!', ps.x, 1.2, ps.z, '#2ecc80', 0.9);
      }
    }
    ps.wasCharging = ps.charging;
    if (ps.battery < 15 && !ps.lowWarned && !ps.charging) {
      ps.lowWarned = true;
      ps.forced = 0.8;
      ps.forcedPower = 1;
      spawnWord('배터리 부족!', ps.x, 1.3, ps.z, '#ff4f6b', 1.2);
    }
    if (ps.battery > 30) ps.lowWarned = false;
    if (ps.battery <= 0) {
      ps.battery = 0;
      ps.dead = true;
      endGame('dead');
    }
  }
  // fx
  ringT -= dt;
  if (ps.buzz > 0.25 && ringT <= 0) {
    ringT = 0.16;
    spawnRing(ps.x, ps.z, ps.noise, S0.soft);
  }
  wordT -= dt;
  if (ps.buzz > 0.5 && wordT <= 0) {
    wordT = 0.75;
    if (S0.soft) spawnWord(pick(['르륵…', '부르…']), ps.x + rand(-0.3, 0.3), 0.9, ps.z, '#6fb6ff', 0.7);
    else spawnWord(pick(['드르륵!', '부르르!', '징징!']), ps.x + rand(-0.3, 0.3), 1.1, ps.z, '#ff8a2a', 1 + ps.noise * 0.3);
  }
  // visuals
  phone.position.set(ps.x, ps.surf === 'blanket' ? 0.02 : ps.surf === 'pad' ? 0.12 : ps.surf === 'rug' ? 0.08 : ps.surf === 'sock' ? 0.22 : 0, ps.z);
  phone.rotation.y = ps.yaw;
  const j = ps.buzz * 0.025;
  phoneBody.position.set(rand(-j, j), Math.abs(rand(0, j)), rand(-j, j));
  phoneBody.rotation.z = rand(-1, 1) * ps.buzz * 0.03;
  phoneBody.visible = true;
  const screenBright = ps.dead ? 0 : notif.phase !== 'idle' || ps.charging ? 1 : 0.45;
  glow.material.opacity = damp(glow.material.opacity, screenBright * (ps.surf === 'blanket' ? 0.15 : 0.55), 6, dt);
  glow.material.color.setHex(ps.charging ? 0x9cffc8 : 0xd8ccff);
  padLight.intensity = damp(padLight.intensity, ps.charging ? 6 : 0, 5, dt);
  padLed.material.color.setHex(ps.charging ? (Math.floor(t * 3) % 2 ? 0x40ff9a : 0x9cffc8) : 0xd9efe3);
  // face
  const watching = ['glance', 'turn', 'search'].includes(owner.mode);
  ps.face = ps.dead ? 'dead' : game.phase === 'caught' ? 'shock' : game.phase === 'win' ? 'happy' : ps.battery < 15 ? 'sleepy' : watching || owner.sus > 55 || notif.phase !== 'idle' ? 'tense' : 'normal';
  // audio
  if (buzzHum) {
    const vol = ps.buzz * (S0.soft ? 0.05 : 0.11) * (0.75 + Math.sin(t * 70) * 0.25);
    buzzHum.set(S0.soft ? 120 : 165, vol, S0.soft ? 380 : 1600);
  }
}

// ======================================================================
// owner AI
// ======================================================================
const _hp = new THREE.Vector3();
const ray = new THREE.Raycaster();
function angleTo(x, z) {
  return Math.atan2(x - owner.x, z - owner.z);
}
function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function dampAngle(a, b, l, dt) {
  return a + wrap(b - a) * (1 - Math.exp(-l * dt));
}
function clampOwnerSpot(x, z) {
  const p = { x: clamp(x, -11.6, 11.6), z: clamp(z, -11.6, 11.6) };
  const rects = [
    { x0: -13, x1: -4.3, z0: -13, z1: -1.9 },
    { x0: 7.2, x1: 13, z0: -6.8, z1: 2.8 },
    { x0: -6.6, x1: -0.4, z0: 10.8, z1: 13 },
  ];
  for (const r of rects) {
    if (p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1) {
      const opts = [[r.x0 - p.x, 0], [r.x1 - p.x, 0], [0, r.z0 - p.z], [0, r.z1 - p.z]];
      opts.sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1]));
      p.x += opts[0][0];
      p.z += opts[0][1];
    }
  }
  return p;
}
function setMode(m) {
  owner.mode = m;
  owner.t = 0;
}

function visibleToOwner() {
  // returns detection rate multiplier (0 = not visible)
  const ps = phoneState;
  const o = owner;
  if (!['glance', 'turn', 'search', 'look'].includes(o.mode) && !(o.mode === 'walk' && o.stand > 0.8)) return 0;
  headWorld(_hp);
  const dx = ps.x - _hp.x, dz = ps.z - _hp.z;
  const dist = Math.hypot(dx, dz);
  const ang = Math.abs(wrap(Math.atan2(dx, dz) - ownerFacingYaw()));
  const P = viewParams();
  if (dist > P.range || ang > P.half) return 0;
  let mult = 1;
  if (ps.surf === 'underbed') {
    if (!(o.kneel > 0.6 && dist < 8)) return 0;
    return 1.2;
  }
  if (ps.surf === 'blanket') {
    if (ps.buzz < 0.3) return 0;
    mult = 0.5; // moving lump under the blanket
  }
  // line of sight
  const target = new THREE.Vector3(ps.x, ps.surf === 'blanket' ? 0.6 : 0.15, ps.z);
  const dir = target.clone().sub(_hp);
  const len = dir.length();
  ray.set(_hp, dir.normalize());
  ray.far = len - 0.3;
  if (ray.intersectObjects(occluders, false).length) return 0;
  if (ps.charging) mult *= 1.9;
  if (notif.phase !== 'idle') mult *= 1.4;
  if (ps.buzz > 0.3) mult *= 1.3;
  return mult * (1.35 - (dist / P.range) * 0.7);
}
function viewParams() {
  switch (owner.mode) {
    case 'glance': return { range: 12, half: 0.42 };
    case 'turn': return { range: 16, half: 0.52 };
    default: return { range: 11, half: 0.72 };
  }
}

let stepT = 0;
function updateOwner(dt, t) {
  const o = owner;
  const ps = phoneState;
  o.t += dt;
  headWorld(_hp);
  // hearing
  if (game.phase === 'play') {
    const dist = Math.hypot(ps.x - _hp.x, ps.z - _hp.z);
    const fall = clamp(1.15 - dist / 20, 0.18, 1);
    const heard = ps.noise * fall;
    if (heard > 0.04) {
      o.sus = Math.min(100, o.sus + heard * 30 * dt);
      o.quietT = 0;
      const err = (1 - clamp(heard, 0, 1)) * 2.4;
      o.heard.x = damp(o.heard.x, ps.x + rand(-err, err), 6, dt);
      o.heard.z = damp(o.heard.z, ps.z + rand(-err, err), 6, dt);
    } else {
      o.quietT += dt;
      if (o.quietT > 1.5 && ['study', 'glance'].includes(o.mode)) o.sus = Math.max(0, o.sus - 5 * dt);
    }
    game.maxSus = Math.max(game.maxSus, o.sus);
  }
  const toHeard = angleTo(o.heard.x, o.heard.z);
  switch (o.mode) {
    case 'study':
      o.stand = damp(o.stand, 0, 5, dt);
      o.bend = damp(o.bend, 0.1, 4, dt);
      o.yaw = dampAngle(o.yaw, Math.PI / 2, 4, dt);
      o.headYaw = damp(o.headYaw, 0, 4, dt);
      o.headPitch = damp(o.headPitch, 0.42 + Math.sin(t * 1.3) * 0.04, 4, dt);
      setOwnerExpr('study');
      if (game.phase === 'play' && o.sus >= 35) {
        setMode('glance');
        say(pick(['음?', '뭐지?', '방금 무슨 소리…']), 1.4);
      }
      break;
    case 'glance': {
      const rel = clamp(wrap(toHeard - o.yaw), -1.9, 1.9);
      o.headYaw = damp(o.headYaw, rel, 5, dt);
      o.headPitch = damp(o.headPitch, 0.15, 4, dt);
      setOwnerExpr('hmm');
      if (o.sus >= 65) {
        setMode('turn');
        say(pick(['뭐야, 진동 소리 아냐?', '어디서 드르륵거리지?']), 1.8);
      } else if (o.t > 2.0) setMode('study');
      break;
    }
    case 'turn': {
      o.yaw = dampAngle(o.yaw, toHeard, 3.2, dt);
      o.headYaw = damp(o.headYaw, Math.sin(o.t * 1.6) * 0.38, 3, dt);
      o.headPitch = damp(o.headPitch, 0.32, 3, dt);
      setOwnerExpr('sus');
      if (o.sus >= 100) startSearch(o.heard.x, o.heard.z);
      else if (o.t > 3.4) {
        setMode('study');
        say(pick(['기분 탓인가…', '공부나 하자…']), 1.4);
      }
      break;
    }
    case 'walk': {
      o.stand = damp(o.stand, 1, 6, dt);
      if (o.stand > 0.85) {
        const dx = o.target.x - o.x, dz = o.target.z - o.z;
        const d = Math.hypot(dx, dz);
        const sp = o.hurry ? 5.2 : 3.2;
        o.yaw = dampAngle(o.yaw, Math.atan2(dx, dz), 6, dt);
        if (d > 0.15) {
          const st = Math.min(d, sp * dt);
          o.x += (dx / d) * st;
          o.z += (dz / d) * st;
          o.walk = damp(o.walk, 1, 8, dt);
          o.walkPhase += dt * (o.hurry ? 11 : 7.5);
          stepT -= dt;
          if (stepT <= 0) {
            stepT = Math.PI / (o.hurry ? 11 : 7.5);
            const cd = Math.hypot(ps.x - o.x, ps.z - o.z);
            const v = clamp(1 - cd / 18, 0.08, 1);
            S.step(v);
            game.shake = Math.max(game.shake, v * 0.35);
            if (cd < 9) spawnWord('쿵', o.x + rand(-1, 1), 0.6, o.z + rand(-1, 1), '#b79bff', 0.8);
          }
        } else {
          o.walk = damp(o.walk, 0, 8, dt);
          if (o.walk < 0.1) {
            if (o.next === 'look') setMode('look');
            else if (o.next === 'sit') setMode('sit');
            else if (o.next === 'grab') setMode('grab');
          }
        }
      }
      o.headYaw = damp(o.headYaw, Math.sin(t * 1.8) * 0.25, 3, dt);
      o.headPitch = damp(o.headPitch, 0.45, 3, dt);
      break;
    }
    case 'look': {
      o.walk = damp(o.walk, 0, 8, dt);
      const lookBed = o.lookBed;
      o.kneel = damp(o.kneel, lookBed ? 1 : 0, 3, dt);
      o.bend = damp(o.bend, lookBed ? 0.2 : 0.55, 3, dt);
      o.headPitch = damp(o.headPitch, lookBed ? 0.1 : 0.55, 3, dt);
      o.headYaw = damp(o.headYaw, Math.sin(o.t * 1.5) * 0.65, 3, dt);
      if (lookBed) o.yaw = dampAngle(o.yaw, -Math.PI / 2, 3, dt);
      setOwnerExpr('sus');
      // lift the blanket?
      if (o.lookBlanket && o.t > 1.2 && !o.liftedBlanket) {
        o.liftedBlanket = true;
        say('이불 속?', 1.2);
        blanketLift.target = 1;
        if (ps.surf === 'blanket') {
          caught();
          break;
        }
      }
      if (o.t > 4.2) {
        o.kneel = 0;
        blanketLift.target = 0;
        o.target = { x: CHAIR.x - 1.4, z: CHAIR.z };
        o.next = 'sit';
        o.hurry = false;
        say(pick(['없네… 공부해야지', '분명히 들었는데…']), 1.6);
        setMode('walk');
      }
      break;
    }
    case 'sit': {
      o.yaw = dampAngle(o.yaw, Math.PI / 2, 4, dt);
      o.x = damp(o.x, CHAIR.x, 4, dt);
      o.z = damp(o.z, CHAIR.z, 4, dt);
      o.stand = damp(o.stand, 0, 4, dt);
      o.bend = damp(o.bend, 0.1, 4, dt);
      setOwnerExpr('sigh');
      if (o.t > 1.2) {
        o.sus = 42;
        o.seen = 0;
        o.spotted = false;
        setMode('study');
      }
      break;
    }
    case 'grab': {
      // bend down and pick up the phone
      o.bend = damp(o.bend, 0.95, 4, dt);
      o.reach = damp(o.reach, 1, 4, dt);
      o.headPitch = damp(o.headPitch, 0.5, 4, dt);
      o.yaw = dampAngle(o.yaw, angleTo(ps.x, ps.z), 6, dt);
      setOwnerExpr('gotcha');
      break;
    }
    case 'cheer': {
      o.stand = damp(o.stand, 1, 3, dt);
      o.stretch = damp(o.stretch, o.t < 2.4 ? 1 : 0, 4, dt);
      o.headPitch = damp(o.headPitch, -0.25, 3, dt);
      setOwnerExpr('happy');
      break;
    }
  }
  if (o.mode !== 'look') o.kneel = damp(o.kneel, 0, 4, dt);
  if (o.mode !== 'grab') o.reach = damp(o.reach, 0, 4, dt);
  if (o.mode !== 'look' && o.mode !== 'grab' && o.mode !== 'walk') o.bend = damp(o.bend, o.mode === 'cheer' ? -0.1 : 0.1, 3, dt);

  // sight / detection
  if (game.phase === 'play') {
    const v = visibleToOwner();
    if (v > 0) {
      o.seen = Math.min(1, o.seen + v * 0.95 * dt);
      if (o.seen > 0.3 && !o.spotted) {
        o.spotted = true;
        setOwnerExpr('spot');
        say('어? 저기 뭐야?', 1.4, true);
        S.gasp();
        o.sus = 100;
        if (o.mode !== 'walk' && o.mode !== 'look') startSearch(ps.x, ps.z, true);
        else if (o.mode === 'walk') o.target = clampOwnerSpot(ps.x - 1.6, ps.z), (o.hurry = true);
      }
      if (o.seen >= 1) caught();
    } else o.seen = Math.max(0, o.seen - 0.5 * dt);
  }
  poseOwner(dt, t);
}

function startSearch(x, z, hurry = false) {
  const o = owner;
  const ps = phoneState;
  const underBed = inBed(x, z);
  const nearBlanket = inBlanket(x, z, -1.2);
  o.lookBed = underBed && !nearBlanket;
  o.lookBlanket = nearBlanket;
  o.liftedBlanket = false;
  // stand ~2.2 away from the spot, on the owner's side
  const a = Math.atan2(o.x - x, o.z - z);
  let tx = x + Math.sin(a) * 2.4, tz = z + Math.cos(a) * 2.4;
  if (o.lookBed) {
    tx = BED.x1 + 1.6;
    tz = clamp(z, BED.z0 + 1.5, BED.z1 - 0.5);
  }
  o.target = clampOwnerSpot(tx, tz);
  o.next = 'look';
  o.hurry = hurry;
  setMode('walk');
  if (!hurry) say(o.lookBed ? '침대 밑인가?' : o.lookBlanket ? '이불 쪽인데…' : '어디서 나는 거야', 1.6);
  void ps;
}

const blanketLift = { v: 0, target: 0 };
function caught() {
  if (game.phase !== 'play') return;
  game.phase = 'caught';
  game.endT = 0;
  const o = owner;
  const ps = phoneState;
  const d = Math.hypot(ps.x - o.x, ps.z - o.z);
  S.sting();
  setOwnerExpr('gotcha');
  if (ps.surf === 'blanket') blanketLift.target = 1;
  if (d > 2.6) {
    const a = Math.atan2(o.x - ps.x, o.z - ps.z);
    o.target = clampOwnerSpot(ps.x + Math.sin(a) * 1.9, ps.z + Math.cos(a) * 1.9);
    o.next = 'grab';
    o.hurry = true;
    setMode('walk');
  } else setMode('grab');
  say('찾았다!!', 2.4, true);
}

// ======================================================================
// notifications
// ======================================================================
function updateNotif(dt) {
  if (game.phase !== 'play' || phoneState.dead) return;
  notif.t += dt;
  const el = $('notif');
  if (notif.phase === 'idle') {
    el.style.display = 'none';
    if (notif.t > notif.next) {
      const [app, msg] = pick(NOTIFS);
      Object.assign(notif, { phase: 'count', t: 0, app, msg });
      $('notifApp').textContent = app;
      $('notifMsg').textContent = msg;
      S.ping();
    }
  } else if (notif.phase === 'count') {
    el.style.display = 'block';
    el.classList.remove('go');
    const left = Math.ceil(3 - notif.t);
    const txt = left > 0 ? `${left}초 뒤 강제 진동!` : '';
    if ($('notifCd').textContent !== txt) {
      $('notifCd').textContent = txt;
      S.tick();
    }
    if (notif.t >= 3) {
      notif.phase = 'buzz';
      notif.t = 0;
      phoneState.forced = 1.5;
      phoneState.forcedPower = 1.25;
      el.classList.add('go');
      $('notifCd').textContent = '드르르르륵!!';
      game.shake = Math.max(game.shake, 0.15);
    }
  } else if (notif.phase === 'buzz') {
    if (notif.t > 1.6) {
      notif.phase = 'idle';
      notif.t = 0;
      notif.next = rand(12, 18);
      game.notifSurvived++;
      el.style.display = 'none';
    }
  }
}

// ======================================================================
// camera
// ======================================================================
const camPos = new THREE.Vector3(0, 2, 6);
const camLook = new THREE.Vector3();
function updateCamera(dt) {
  const ps = phoneState;
  if (game.phase === 'caught' && owner.mode === 'grab' && owner.t > 0.6) {
    // the phone is lifted toward the owner's face
    const k = clamp((owner.t - 0.6) / 1.4, 0, 1);
    headWorld(_hp);
    const fy = ownerFacingYaw();
    const near = new THREE.Vector3(_hp.x + Math.sin(fy) * 2.3, _hp.y - 0.1, _hp.z + Math.cos(fy) * 2.3);
    const from = new THREE.Vector3(ps.x, 0.5, ps.z);
    const e = k * k * (3 - 2 * k);
    camera.position.lerpVectors(from, near, e);
    camLook.lerp(new THREE.Vector3(_hp.x, _hp.y + 0.1, _hp.z), 1 - Math.exp(-6 * dt));
    camera.lookAt(camLook);
    // hide the phone (we ARE the phone now)
    phoneBody.visible = e < 0.2;
    return;
  }
  const f = new THREE.Vector3(Math.sin(ps.yaw), 0, Math.cos(ps.yaw));
  const under = ps.surf === 'underbed';
  const want = new THREE.Vector3(ps.x, under ? 0.62 : 1.35, ps.z).addScaledVector(f, under ? -1.9 : -2.5);
  want.x = clamp(want.x, -ROOM + 0.3, ROOM - 0.3);
  want.z = clamp(want.z, -ROOM + 0.3, ROOM - 0.3);
  camPos.lerp(want, 1 - Math.exp(-6 * dt));
  const lookAt = new THREE.Vector3(ps.x, under ? 0.35 : 0.55, ps.z).addScaledVector(f, 2.6);
  camLook.lerp(lookAt, 1 - Math.exp(-8 * dt));
  camera.position.copy(camPos);
  if (game.shake > 0) {
    camera.position.x += rand(-1, 1) * game.shake * 0.12;
    camera.position.y += rand(-1, 1) * game.shake * 0.12;
  }
  camera.lookAt(camLook);
}

// ======================================================================
// HUD
// ======================================================================
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function updateHud() {
  const ps = phoneState;
  $('timeTxt').textContent = fmt(Math.max(0, Math.ceil(game.timeLeft)));
  $('batTxt').textContent = Math.ceil(ps.battery) + '%' + (ps.charging ? ' 충전 중' : '');
  $('batBar').style.width = ps.battery + '%';
  $('batBar').style.background = ps.charging ? '#2ecc80' : ps.battery < 20 ? '#ff5a78' : '#8f7cf0';
  const s = owner.sus;
  $('susBar').style.width = s + '%';
  $('susBar').style.background = s >= 100 ? '#ff5a78' : s >= 65 ? '#ff9a4d' : s >= 35 ? '#ffd166' : '#8fd8b4';
  const lbl = owner.mode === 'walk' || owner.mode === 'look' ? '찾는 중!' : s >= 65 ? '수상함' : s >= 35 ? '갸웃' : '평온';
  $('susLabel').textContent = lbl;
  $('seen').style.display = owner.seen > 0.02 ? 'block' : 'none';
  $('seenBar').style.width = owner.seen * 100 + '%';
  const S0 = SURF[ps.surf];
  $('floorTxt').textContent = S0.name;
  $('floorTxt').style.color = S0.soft ? '#4a9be0' : ps.surf === 'underbed' ? '#8a6fd8' : '#ff7a2a';
  $('floorSub').textContent = S0.sub;
}

// ======================================================================
// game flow
// ======================================================================
function resetGame() {
  Object.assign(game, { phase: 'play', timeLeft: 90, maxSus: 0, buzzTime: 0, notifSurvived: 0, shake: 0, endT: 0, result: '' });
  Object.assign(phoneState, { x: -0.5, z: 3.2, yaw: Math.PI, buzz: 0, battery: 55, charging: false, wasCharging: false, forced: 0, dead: false, lowWarned: false, chimeT: 0 });
  Object.assign(owner, { x: CHAIR.x, z: CHAIR.z, yaw: Math.PI / 2, headYaw: 0, headPitch: 0.4, stand: 0, bend: 0.1, kneel: 0, walk: 0, reach: 0, stretch: 0, sus: 0, seen: 0, spotted: false, quietT: 0 });
  setMode('study');
  Object.assign(notif, { phase: 'idle', t: 0, next: 9 });
  blanketLift.target = 0;
  $('end').classList.add('hide');
  $('notif').style.display = 'none';
  document.querySelectorAll('.hud').forEach((h) => (h.style.visibility = ''));
  camPos.set(-0.5, 1.4, 5.7);
  if (music) music.rate = 1;
}
function endGame(kind) {
  if (game.phase === 'over') return;
  game.result = kind;
  if (kind === 'win') {
    game.phase = 'win';
    game.endT = 0;
    setMode('cheer');
    say('끝! 시험 잘 보고 올게~', 2.6);
    S.win();
  } else if (kind === 'dead') {
    game.phase = 'dead';
    game.endT = 0;
    S.lose();
    say('어? 폰 꺼졌네. 충전해야지', 2.2);
    setTimeout(() => game.phase === 'dead' && caughtFromDead(), 1200);
  }
}
function caughtFromDead() {
  game.phase = 'play';
  caught();
}
function showEnd() {
  const r = game.result;
  const tag = $('endTag'), title = $('endTitle'), lead = $('endLead');
  if (r === 'win') {
    tag.textContent = '숨기 성공';
    tag.style.background = '#8f7cf0';
    title.textContent = '주인이 공부를 끝냈어요!';
    lead.textContent = '내일 시험, 주인이 잘 볼 거예요.';
  } else {
    tag.textContent = phoneState.dead ? '방전' : '들켰다';
    tag.style.background = '#ff6f8a';
    title.textContent = phoneState.dead ? '배터리가 바닥났어요…' : '찾았다!';
    lead.textContent = '주인은 공부 대신 폰을 3시간 했다…';
  }
  $('endStats').innerHTML = `<div><b>${fmt(game.total - Math.max(0, game.timeLeft))}</b>버틴 시간</div><div><b>${Math.round(game.maxSus)}%</b>최대 의심도</div><div><b>${game.notifSurvived}번</b>버틴 알림</div><div><b>${game.buzzTime.toFixed(1)}초</b>진동한 시간</div>`;
  $('end').classList.remove('hide');
}

// ======================================================================
// loop
// ======================================================================
let last = performance.now();
let elapsed = 0;
let screenT = 0;
let frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(FAST ? 0.2 : 0.05, (now - last) / 1000) * (FAST ? 2 : 1);
  last = now;
  elapsed += rdt;
  frames++;
  const dt = rdt;
  game.shake = Math.max(0, game.shake - dt * 1.5);
  if (keys.hit('KeyM')) sfx.setMuted(!sfx.muted);
  if (keys.hit('KeyR') && game.phase !== 'title') resetGame();

  if (game.phase === 'play') {
    game.timeLeft -= dt;
    if (game.timeLeft <= 0) endGame('win');
    updateNotif(dt);
  }
  updatePhone(dt, elapsed);
  updateOwner(dt, elapsed);
  updateFx(dt);
  blanketLift.v = damp(blanketLift.v, blanketLift.target, 4, dt);
  blanketG.position.y = blanketLift.v * 2.2;
  blanketG.rotation.z = blanketLift.v * 0.25;
  updateBlanket(phoneState.x, phoneState.z, phoneState.surf === 'blanket' && blanketLift.v < 0.3, elapsed);

  // vision cone
  const looking = ['glance', 'turn', 'look'].includes(owner.mode) || (owner.mode === 'walk' && owner.stand > 0.8);
  const P = viewParams();
  setCone(P.range, P.half);
  headWorld(_hp);
  coneMesh.position.set(_hp.x, 0.05, _hp.z);
  coneMesh.rotation.y = ownerFacingYaw();
  coneMat.opacity = damp(coneMat.opacity, looking && game.phase === 'play' ? 0.2 + owner.seen * 0.25 : 0, 6, dt);
  coneMat.color.setHex(owner.seen > 0.05 ? 0xff6b85 : 0xffd84d);

  if (game.phase === 'caught' || game.phase === 'win') {
    game.endT += dt;
    if (game.endT > (game.phase === 'win' ? 3.4 : 3.6) && $('end').classList.contains('hide')) {
      showEnd();
      game.phase = 'over';
    }
  }
  if (music) music.rate = 1 + clamp(owner.sus / 100, 0, 1) * 0.35;

  screenT -= dt;
  if (screenT <= 0) {
    screenT = 0.07;
    drawScreen(elapsed);
  }
  updateCamera(dt);
  updateHud();
  // bubble
  if (bubbleT > 0) {
    bubbleT -= dt;
    if (bubbleT <= 0) $('bubble').classList.remove('on');
  }
  headWorld(_hp);
  const pr = _hp.clone().add(new THREE.Vector3(0, 2.2, 0)).project(camera);
  const b = $('bubble');
  if (pr.z > 1 || Math.abs(pr.x) > 1.05 || Math.abs(pr.y) > 1.05) {
    b.style.left = innerWidth / 2 + 'px';
    b.style.top = '150px';
    if (!b.textContent.startsWith('(뒤에서)') && bubbleT > 0) b.dataset.behind = '1';
  } else {
    b.style.left = clamp((pr.x * 0.5 + 0.5) * innerWidth, 150, innerWidth - 150) + 'px';
    b.style.top = clamp((-pr.y * 0.5 + 0.5) * innerHeight, 110, innerHeight - 80) + 'px';
  }
  renderer.render(scene, camera);
  keys.endFrame();
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
$('startBtn').onclick = () => {
  initAudio();
  $('start').classList.add('hide');
  resetGame();
};
$('againBtn').onclick = () => {
  initAudio();
  resetGame();
};
camPos.set(-0.5, 1.4, 5.7);
requestAnimationFrame(frame);
window.__game = { game, owner, phoneState, notif, caught, endGame, startSearch, get frames() { return frames; } };
