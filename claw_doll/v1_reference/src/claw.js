import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  clamp, lerp, damp, rand, pick, toon, addOutline, darker, lighter, fabricTexture,
  Sfx, Music, seq, makeKeys, canvasTex, roundRect, FONT,
} from './common.js';

const $ = (id) => document.getElementById(id);
const keys = makeKeys();
const sfx = new Sfx();

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
const BG = 0xfdeef4;
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 26, 62);

const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 4, -6);

scene.add(new THREE.HemisphereLight(0xfff8fc, 0xf2d4e4, 1.55));
const topLight = new THREE.DirectionalLight(0xffffff, 1.7);
topLight.position.set(1.2, 24, -0.8);
topLight.target.position.set(0, 0, 0);
topLight.castShadow = true;
topLight.shadow.mapSize.set(2048, 2048);
Object.assign(topLight.shadow.camera, { left: -7.5, right: 7.5, top: 7.5, bottom: -7.5, near: 4, far: 40 });
topLight.shadow.bias = -0.0006;
topLight.shadow.normalBias = 0.03;
scene.add(topLight, topLight.target);
const fill = new THREE.DirectionalLight(0xffe4f1, 0.55);
fill.position.set(-8, 9, 16);
scene.add(fill);

// ======================================================================
// physics
// ======================================================================
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -22, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = false;
world.solver.iterations = 14;
const mGround = new CANNON.Material('ground');
const mDoll = new CANNON.Material('doll');
world.addContactMaterial(new CANNON.ContactMaterial(mDoll, mDoll, { friction: 0.42, restitution: 0.06 }));
world.addContactMaterial(new CANNON.ContactMaterial(mDoll, mGround, { friction: 0.5, restitution: 0.12 }));
function staticBox(hx, hy, hz, x, y, z) {
  const b = new CANNON.Body({ mass: 0, material: mGround });
  b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
  b.position.set(x, y, z);
  world.addBody(b);
  return b;
}

// machine interior: x,z in [-6,6], floor y=0, chute hole x[-6,-3] z[3,6]
const HALF = 6;
const CHUTE = { x0: -6, x1: -3, z0: 3, z1: 6, cx: -4.5, cz: 4.5 };
staticBox(4.5, 0.5, 6, 1.5, -0.5, 0);
staticBox(1.5, 0.5, 4.5, -4.5, -0.5, -1.5);
staticBox(0.5, 12, 7, 6.5, 8, 0);
staticBox(0.5, 12, 7, -6.5, 8, 0);
staticBox(7, 12, 0.5, 0, 8, 6.5);
staticBox(7, 12, 0.5, 0, 8, -6.5);
staticBox(7, 0.5, 7, 0, 14.4, 0);
staticBox(0.08, 0.75, 1.5, -3, 0.75, 4.5);
staticBox(1.5, 0.75, 0.08, -4.5, 0.75, 3);

// ======================================================================
// machine visuals
// ======================================================================
const machine = new THREE.Group();
scene.add(machine);

const PINK = 0xff9fc2;
const fab = fabricTexture();

// floor (soft lavender carpet) with hole
{
  const carpet = toon(0xe9dcff, { bumpMap: fab, bumpScale: 0.8 });
  const a = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 12), carpet);
  a.position.set(1.5, -0.5, 0);
  const b = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 9), carpet);
  b.position.set(-4.5, -0.5, -1.5);
  a.receiveShadow = b.receiveShadow = true;
  machine.add(a, b);
  // chute tube
  const tubeMat = toon(0xc9b7e6, { side: THREE.BackSide });
  const tube = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 3, 1, 1, 1), tubeMat);
  tube.position.set(CHUTE.cx, -4, CHUTE.cz);
  machine.add(tube);
  const holeDark = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: 0x8c79a8 }));
  holeDark.rotation.x = -Math.PI / 2;
  holeDark.position.set(CHUTE.cx, -7.9, CHUTE.cz);
  machine.add(holeDark);
  // acrylic guard
  const acr = new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.38, depthWrite: false });
  const g1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 3), acr);
  g1.position.set(-3, 0.75, 4.5);
  const g2 = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 0.12), acr);
  g2.position.set(-4.5, 0.75, 3);
  const edge = toon(0x9fd8f5);
  const e1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 3.1), edge);
  e1.position.set(-3, 1.52, 4.5);
  const e2 = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.14, 0.2), edge);
  e2.position.set(-4.5, 1.52, 3);
  machine.add(g1, g2, e1, e2);
  // "출구" sign on guard
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.55),
    new THREE.MeshBasicMaterial({
      transparent: true,
      map: canvasTex(256, 88, (g, w, h) => {
        roundRect(g, 4, 4, w - 8, h - 8, 30);
        g.fillStyle = '#ffe36e';
        g.fill();
        g.fillStyle = '#5b4363';
        g.font = `900 52px ${FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('출구', w / 2, h / 2 + 3);
      }),
    })
  );
  sign.position.set(-4.5, 1.1, 2.93);
  sign.rotation.y = Math.PI;
  machine.add(sign);
}

// glass texture (streaks, fingerprints, mirrored sticker on front)
function makeGlassTex(front) {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(0, 0, w, h);
    const streak = (x, wdt, a) => {
      g.save();
      g.translate(x, 0);
      g.rotate(-0.42);
      const gr = g.createLinearGradient(0, 0, wdt, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.5, `rgba(255,255,255,${a})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, -400, wdt, 2200);
      g.restore();
    };
    streak(120, 160, 0.22);
    streak(330, 50, 0.18);
    streak(720, 110, 0.14);
    for (let i = 0; i < (front ? 9 : 4); i++) drawPrint(g, rand(150, 870), rand(420, 900), rand(0.7, 1.1));
    if (front) {
      // sticker (seen mirrored from inside)
      g.save();
      g.translate(780, 120);
      g.rotate(0.08);
      roundRect(g, -150, -56, 300, 112, 40);
      g.fillStyle = 'rgba(255, 233, 120, 0.95)';
      g.fill();
      g.fillStyle = '#e0558a';
      g.font = `900 46px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('한정판 입고!', 0, -12);
      g.fillStyle = '#6a5470';
      g.font = `800 26px ${FONT}`;
      g.fillText('1회 500원', 0, 30);
      g.restore();
    }
  });
}
function drawPrint(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.rotate(rand(-1, 1));
  g.strokeStyle = 'rgba(255,255,255,0.32)';
  g.lineWidth = 2;
  for (let r = 4; r < 26; r += 4) {
    g.beginPath();
    g.ellipse(0, 0, r * s, r * 1.3 * s, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}
function drawPalm(tex, u, v) {
  const g = tex.userData.ctx;
  const W = 1024;
  const x = u * W, y = v * W;
  g.save();
  g.fillStyle = 'rgba(255,255,255,0.20)';
  g.beginPath();
  g.ellipse(x, y, 80, 95, 0, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.ellipse(x - 60 + i * 40, y - 150, 18, 52, (i - 1.5) * 0.12, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.ellipse(x + 100, y - 20, 18, 46, -0.7, 0, Math.PI * 2);
  g.fill();
  g.restore();
  tex.needsUpdate = true;
}
const glassFrontTex = makeGlassTex(true);
const glassFront = new THREE.Mesh(
  new THREE.PlaneGeometry(12, 14),
  new THREE.MeshBasicMaterial({ map: glassFrontTex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
);
glassFront.position.set(0, 7, HALF);
machine.add(glassFront);
for (const s of [-1, 1]) {
  const gs = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 14),
    new THREE.MeshBasicMaterial({ map: makeGlassTex(false), transparent: true, depthWrite: false, side: THREE.DoubleSide })
  );
  gs.position.set(s * HALF, 7, 0);
  gs.rotation.y = (s * Math.PI) / 2;
  machine.add(gs);
}
// back panel
{
  const tex = canvasTex(1024, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#ffd3e4');
    gr.addColorStop(1, '#ffeef5');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let y = 30; y < h; y += 80)
      for (let x = (y / 80) % 2 ? 70 : 30; x < w; x += 80) {
        g.beginPath();
        g.arc(x, y, 12, 0, Math.PI * 2);
        g.fill();
      }
    g.save();
    g.translate(w / 2, 260);
    roundRect(g, -330, -110, 660, 220, 110);
    g.fillStyle = '#fff';
    g.fill();
    g.fillStyle = '#ff6f9f';
    g.font = `900 120px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('말랑 캐치', 0, -8);
    g.fillStyle = '#b48ac9';
    g.font = `800 34px ${FONT}`;
    g.fillText('MALLANG CATCH', 0, 76);
    g.restore();
    // stars
    const star = (x, y, r, c) => {
      g.save();
      g.translate(x, y);
      g.fillStyle = c;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 ? r * 0.45 : r;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      g.restore();
    };
    star(130, 120, 50, '#ffe36e');
    star(900, 150, 40, '#9be7ff');
    star(880, 460, 34, '#c8b6ff');
    star(150, 470, 30, '#b9f3c9');
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 14), new THREE.MeshBasicMaterial({ map: tex }));
  back.position.set(0, 7, -HALF);
  machine.add(back);
}
// frame posts / trims / canopy / bulbs
const postMat = toon(PINK);
for (const x of [-HALF, HALF])
  for (const z of [-HALF, HALF]) {
    const p = new THREE.Mesh(new RoundedBoxGeometry(0.7, 16, 0.7, 2, 0.18), postMat);
    p.position.set(x, 6, z);
    machine.add(p);
  }
{
  const trimMat = toon(0xffc2d8);
  const t1 = new THREE.Mesh(new RoundedBoxGeometry(12.4, 0.5, 0.5, 2, 0.15), trimMat);
  t1.position.set(0, 0.1, -HALF);
  machine.add(t1);
  const canopy = new THREE.Mesh(new RoundedBoxGeometry(13.4, 1.6, 13.4, 3, 0.4), toon(0xffb5cf));
  canopy.position.set(0, 14.6, 0);
  machine.add(canopy);
}
const bulbs = [];
{
  const geo = new THREE.SphereGeometry(0.16, 12, 8);
  for (let i = 0; i < 48; i++) {
    const side = Math.floor(i / 12);
    const t = (i % 12) / 12 - 0.5 + 1 / 24;
    let x, z;
    if (side === 0) [x, z] = [t * 12, -5.7];
    else if (side === 1) [x, z] = [5.7, t * 12];
    else if (side === 2) [x, z] = [-t * 12, 5.7];
    else [x, z] = [-5.7, -t * 12];
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
    m.position.set(x, 13.75, z);
    machine.add(m);
    bulbs.push(m);
  }
}
// gantry
const metal = toon(0xe9e6f0);
const railMat = toon(0xd9d2e6);
for (const x of [-5.4, 5.4]) {
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 12, 10), railMat);
  r.rotation.x = Math.PI / 2;
  r.position.set(x, 12.9, 0);
  machine.add(r);
}
const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 11, 10), railMat);
crossBar.rotation.z = Math.PI / 2;
machine.add(crossBar);
const carriage = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.6, 1.1, 2, 0.15), toon(PINK));
machine.add(carriage);

// ======================================================================
// claw
// ======================================================================
const clawG = new THREE.Group();
machine.add(clawG);
const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), toon(0x9b8fb0));
machine.add(cable);
{
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.75, 16), metal);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(PINK));
  cap.position.y = 0.36;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 20), toon(0xffe36e));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.3;
  hub.castShadow = true;
  clawG.add(hub, cap, ring);
}
const prongs = [];
for (let i = 0; i < 3; i++) {
  const yaw = new THREE.Group();
  yaw.rotation.y = (i / 3) * Math.PI * 2;
  yaw.position.y = -0.32;
  const pivot = new THREE.Group();
  pivot.position.z = 0.32;
  const upper = new THREE.Mesh(new RoundedBoxGeometry(0.16, 1.0, 0.16, 2, 0.06), metal);
  upper.position.y = -0.5;
  const elbow = new THREE.Group();
  elbow.position.y = -1.0;
  const lower = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.7, 0.16, 2, 0.06), metal);
  lower.position.y = -0.33;
  elbow.rotation.x = -0.75;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), toon(PINK));
  tip.position.y = -0.7;
  elbow.add(lower, tip);
  pivot.add(upper, elbow);
  yaw.add(pivot);
  clawG.add(yaw);
  upper.castShadow = lower.castShadow = true;
  prongs.push(pivot);
}
const CLAW_REACH = 1.55; // hub center to prong tips (closed)

// ground ring indicator
const ringMat = new THREE.MeshBasicMaterial({ color: 0xff6f9f, transparent: true, opacity: 0, depthWrite: false });
const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.2, 40), ringMat);
ringMesh.rotation.x = -Math.PI / 2;
scene.add(ringMesh);
const discMat = new THREE.MeshBasicMaterial({ color: 0x7a4f8f, transparent: true, opacity: 0, depthWrite: false });
const discMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 32), discMat);
discMesh.rotation.x = -Math.PI / 2;
scene.add(discMesh);

// ======================================================================
// arcade outside
// ======================================================================
const outside = new THREE.Group();
scene.add(outside);
{
  const floorTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#fff3e6';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffe1ec';
    g.fillRect(0, 0, w / 2, h / 2);
    g.fillRect(w / 2, h / 2, w / 2, h / 2);
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(20, 20);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshBasicMaterial({ map: floorTex }));
  f.rotation.x = -Math.PI / 2;
  f.position.y = -7;
  outside.add(f);
  // machine body below glass
  const base = new THREE.Mesh(new RoundedBoxGeometry(13.4, 7, 13.4, 3, 0.4), toon(0xffb5cf));
  base.position.y = -3.6;
  outside.add(base);
  const colors = [0x9be7ff, 0xc8b6ff, 0xb9f3c9, 0xffe36e, 0xffc6a5, 0xffb5cf];
  const spots = [];
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    spots.push([i * 15, 0]);
  }
  for (let i = -2; i <= 2; i++) spots.push([i * 16 + 8, 34], [i * 16 - 8, -30]);
  spots.forEach(([x, z], i) => {
    const c = colors[i % colors.length];
    const grp = new THREE.Group();
    const bb = new THREE.Mesh(new RoundedBoxGeometry(11, 8, 11, 2, 0.5), toon(c));
    bb.position.y = -3;
    const gl = new THREE.Mesh(
      new THREE.BoxGeometry(10.4, 12, 10.4),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })
    );
    gl.position.y = 7;
    const top = new THREE.Mesh(new RoundedBoxGeometry(11.6, 2, 11.6, 2, 0.5), toon(c));
    top.position.y = 14;
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(6, 1.6, 0.4),
      new THREE.MeshBasicMaterial({ color: lighter(c, 0.35) })
    );
    sign.position.set(0, 16.2, 0);
    grp.add(bb, gl, top, sign);
    for (let k = 0; k < 6; k++) {
      const pl = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), toon(colors[(i + k) % colors.length]));
      pl.position.set(rand(-3.5, 3.5), 2, rand(-3.5, 3.5));
      grp.add(pl);
    }
    grp.position.set(x, 0, z);
    grp.lookAt(0, 0, 0);
    outside.add(grp);
  });
  // ceiling light panels
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(10, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    p.rotation.x = Math.PI / 2;
    p.position.set(((i % 4) - 1.5) * 20, 26, Math.floor(i / 4) * 30 - 10);
    outside.add(p);
  }
}

// ======================================================================
// customer (giant face outside the front glass)
// ======================================================================
const SKIN = 0xffd9c4;
const faceG = new THREE.Group();
const FACE_HOME = new THREE.Vector3(0, 5.7, 12.8);
faceG.position.copy(FACE_HOME);
scene.add(faceG);
const R = 5.0;
const FZ = 0.9; // depth scale
function surf(x, y, off = 0.04) {
  const yy = y / 1.04;
  return -(FZ * Math.sqrt(Math.max(0, R * R - x * x - yy * yy)) + off);
}
const face = {};
{
  const skin = toon(SKIN);
  const head = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 30), skin);
  head.scale.set(1, 1.04, FZ);
  faceG.add(head);
  const hairMat = toon(0x6a4a3f);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
  hair.scale.set(1, 1.04, FZ * 1.02);
  hair.rotation.x = 0.45;
  faceG.add(hair);
  // bangs
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10), hairMat);
    const x = (i - 2) * 1.55;
    b.scale.set(1, 0.75, 0.6);
    b.position.set(x, 3.75 - Math.abs(i - 2) * 0.3, surf(x, 3.6, -0.35));
    faceG.add(b);
  }
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10), skin);
    ear.scale.set(0.6, 1, 0.8);
    ear.position.set(s * R * 0.99, -0.2, -0.3);
    faceG.add(ear);
  }
  // eyes
  face.eyes = [];
  face.pupils = [];
  face.closed = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(s * 1.75, 0.75, surf(s * 1.75, 0.75, 0.02));
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    white.scale.set(1, 1.12, 0.45);
    const pg = new THREE.Group();
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.58, 18, 12), new THREE.MeshBasicMaterial({ color: 0x3a2a33 }));
    pupil.scale.set(1, 1.08, 0.4);
    pupil.position.z = -0.24;
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl.position.set(0.2 * s, 0.24, -0.44);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl2.position.set(-0.18 * s, -0.2, -0.44);
    pg.add(pupil, hl, hl2);
    eg.add(white, pg);
    faceG.add(eg);
    face.eyes.push(eg);
    face.pupils.push(pg);
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.14, 8, 20, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x3a2a33 })
    );
    arc.position.copy(eg.position);
    arc.position.z -= 0.25;
    arc.visible = false;
    faceG.add(arc);
    face.closed.push(arc);
  }
  // brows
  face.brows = [];
  for (const s of [-1, 1]) {
    const br = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.36, 0.3, 2, 0.14), hairMat);
    br.position.set(s * 1.8, 2.25, surf(s * 1.8, 2.25, -0.02));
    faceG.add(br);
    face.brows.push(br);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), toon(0xffc6ad));
  nose.scale.set(1, 0.8, 0.8);
  nose.position.set(0, -0.45, surf(0, -0.45, -0.05));
  faceG.add(nose);
  // blush
  face.blush = [];
  for (const s of [-1, 1]) {
    const bl = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 24),
      new THREE.MeshBasicMaterial({ color: 0xff9fb6, transparent: true, opacity: 0.55, depthWrite: false })
    );
    bl.position.set(s * 2.85, -0.9, surf(s * 2.85, -0.9, 0.06));
    bl.rotation.y = Math.PI - s * 0.5;
    bl.scale.y = 0.7;
    faceG.add(bl);
    face.blush.push(bl);
  }
  // mouth (rebuilt shape)
  face.mouth = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x8a3b52, side: THREE.DoubleSide }));
  face.mouth.position.set(0, -2.2, surf(0, -2.2, 0.06));
  faceG.add(face.mouth);
  // sweat drop
  face.sweat = new THREE.Group();
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), new THREE.MeshBasicMaterial({ color: 0xa6dcff }));
  const dropTop = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.75, 14), new THREE.MeshBasicMaterial({ color: 0xa6dcff }));
  dropTop.position.y = 0.5;
  face.sweat.add(drop, dropTop);
  face.sweat.position.set(3.4, 2.4, surf(3.4, 2.4, 0.3));
  face.sweat.visible = false;
  faceG.add(face.sweat);
  // shoulders / shirt below
  const shirt = new THREE.Mesh(new RoundedBoxGeometry(15, 8, 7, 3, 2.5), toon(0x9fc9ff));
  shirt.position.set(0, -8.8, 1.5);
  faceG.add(shirt);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, 3, 16), skin);
  neck.position.set(0, -5, 0.6);
  faceG.add(neck);
}
const expr = { smile: 0.7, open: 0.15, eye: 1, browA: 0, browY: 0, blush: 0.5, sweat: 0, happy: 0 };
const EXPR = {
  expect: { smile: 0.85, open: 0.25, eye: 1.05, browA: -0.12, browY: 0.25, blush: 0.6, sweat: 0, happy: 0 },
  focus: { smile: 0.15, open: 0.05, eye: 0.82, browA: 0.15, browY: -0.1, blush: 0.4, sweat: 0, happy: 0 },
  excited: { smile: 1, open: 0.95, eye: 1.15, browA: -0.25, browY: 0.45, blush: 0.9, sweat: 0, happy: 0 },
  shock: { smile: -0.3, open: 1, eye: 1.25, browA: -0.3, browY: 0.6, blush: 0.3, sweat: 1, happy: 0 },
  meh: { smile: -0.35, open: 0.1, eye: 0.6, browA: -0.2, browY: 0.05, blush: 0.3, sweat: 0.6, happy: 0 },
  annoyed: { smile: -0.55, open: 0.12, eye: 0.7, browA: 0.42, browY: -0.25, blush: 1, sweat: 1, happy: 0 },
  giveup: { smile: -0.85, open: 0.18, eye: 0.38, browA: -0.38, browY: -0.05, blush: 0.2, sweat: 1, happy: 0 },
  happy: { smile: 1, open: 0.7, eye: 1, browA: -0.2, browY: 0.4, blush: 1, sweat: 0, happy: 1 },
};
let exprTarget = EXPR.expect;
let mouthKey = '';
function buildMouth() {
  const w = 1.5;
  const sm = expr.smile;
  const op = expr.open;
  const key = sm.toFixed(2) + op.toFixed(2);
  if (key === mouthKey) return;
  mouthKey = key;
  const s = new THREE.Shape();
  const cornerY = sm * 0.45;
  s.moveTo(-w, cornerY);
  s.quadraticCurveTo(0, -sm * 0.15 + 0.12, w, cornerY);
  s.quadraticCurveTo(0, -sm * 0.7 - op * 2.2 - 0.18, -w, cornerY);
  face.mouth.geometry.dispose();
  face.mouth.geometry = new THREE.ShapeGeometry(s, 20);
}
const lookTarget = new THREE.Vector3();
function updateFace(dt, t) {
  for (const k in expr) expr[k] = damp(expr[k], exprTarget[k], 9, dt);
  buildMouth();
  const blink = (t % 3.7) < 0.12 ? 0.1 : 1;
  face.eyes.forEach((e, i) => {
    e.scale.y = Math.max(0.05, expr.eye * blink);
    e.visible = expr.happy < 0.5;
    face.closed[i].visible = expr.happy >= 0.5;
    face.closed[i].rotation.z = 0;
  });
  face.brows.forEach((b, i) => {
    const s = i ? 1 : -1;
    b.rotation.z = -s * expr.browA;
    b.position.y = 2.25 + expr.browY;
  });
  face.blush.forEach((b) => {
    b.material.opacity = 0.25 + expr.blush * 0.5;
    b.material.color.setHex(expr.blush > 0.85 && exprTarget === EXPR.annoyed ? 0xff6f86 : 0xff9fb6);
  });
  face.sweat.visible = expr.sweat > 0.5;
  face.sweat.position.y = 2.4 - ((t * 0.6) % 1) * 0.8;
  // pupils look at target
  const local = faceG.worldToLocal(lookTarget.clone());
  face.pupils.forEach((p, i) => {
    const eye = face.eyes[i].position;
    const dx = local.x - eye.x, dy = local.y - eye.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / 6) * 0.32;
    p.position.x = damp(p.position.x, (dx / len) * k, 12, dt);
    p.position.y = damp(p.position.y, (dy / len) * k * 1.1, 12, dt);
  });
  // head follows target slightly
  const yaw = clamp(-(lookTarget.x - faceG.position.x) * 0.03, -0.2, 0.2);
  faceG.rotation.y = damp(faceG.rotation.y, yaw, 4, dt);
  faceG.rotation.x = damp(faceG.rotation.x, clamp((lookTarget.y - 4) * -0.015, -0.12, 0.1), 4, dt);
}
function setExpr(name) {
  exprTarget = EXPR[name];
}

// hands
function makeHand(vsign = false) {
  const g = new THREE.Group();
  const skin = toon(SKIN);
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1.3, 18, 14), skin);
  palm.scale.set(1.1, 1.25, 0.55);
  g.add(palm);
  for (let i = 0; i < 4; i++) {
    const up = vsign ? i === 1 || i === 2 : true;
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, up ? 1.3 : 0.4, 6, 10), skin);
    const x = -0.9 + i * 0.6;
    f.position.set(x + (vsign && up ? (i === 1 ? -0.15 : 0.15) : 0), up ? 1.9 : 1.15, up ? 0 : -0.35);
    f.rotation.z = vsign && up ? (i === 1 ? 0.22 : -0.22) : (i - 1.5) * -0.08;
    if (!up) f.rotation.x = 1.2;
    g.add(f);
  }
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 6, 10), skin);
  th.position.set(1.35, 0.1, -0.2);
  th.rotation.z = -0.9;
  g.add(th);
  return g;
}
const slapHand = makeHand();
slapHand.visible = false;
scene.add(slapHand);

// ======================================================================
// dolls
// ======================================================================
const PASTELS = [0xffb5c8, 0xffd6a5, 0xfff1a8, 0xc5f5c0, 0xa8ecff, 0xb3cdff, 0xcdbfff, 0xffc6f2, 0xf9d5e5, 0xbde8dc];
const TYPES = ['bear', 'bunny', 'cat', 'chick', 'frog', 'bear', 'bunny'];
const dark = toon(0x3b2f3f);
const whiteBasic = new THREE.MeshBasicMaterial({ color: 0xffffff });

function makeDoll(type, color, r, isPlayer = false) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const mat = toon(color, { bumpMap: fab, bumpScale: 1.2, transparent: true });
  const light = toon(lighter(color, 0.55), { bumpMap: fab, bumpScale: 1, transparent: true });
  const oc = darker(color, 0.62);
  const parts = { inner, mats: [mat, light], outlines: [] };
  const head = new THREE.Mesh(new THREE.SphereGeometry(r * 0.8, 26, 18), mat);
  head.position.y = r * 0.22;
  head.scale.set(1.06, 0.94, 1);
  const body = new THREE.Mesh(new THREE.SphereGeometry(r * 0.56, 20, 14), mat);
  body.position.y = -r * 0.48;
  body.scale.set(1, 0.92, 0.95);
  parts.outlines.push(addOutline(head, oc, 0.05), addOutline(body, oc, 0.06));
  head.castShadow = body.castShadow = true;
  head.receiveShadow = body.receiveShadow = true;
  inner.add(head, body);
  parts.head = head;
  // belly patch
  const belly = new THREE.Mesh(new THREE.SphereGeometry(r * 0.36, 16, 12), light);
  belly.scale.set(1, 1, 0.45);
  belly.position.set(0, -r * 0.5, r * 0.4);
  inner.add(belly);
  // face
  const eyeGeo = new THREE.SphereGeometry(r * 0.085, 10, 8);
  parts.eyes = [];
  if (type !== 'frog') {
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, dark);
      e.position.set(s * r * 0.27, r * 0.3, r * 0.72);
      e.scale.z = 0.6;
      const h = new THREE.Mesh(new THREE.SphereGeometry(r * 0.03, 6, 4), whiteBasic);
      h.position.set(r * 0.025, r * 0.03, r * 0.05);
      e.add(h);
      inner.add(e);
      parts.eyes.push(e);
    }
  }
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(
      new THREE.CircleGeometry(r * 0.11, 12),
      new THREE.MeshBasicMaterial({ color: 0xff8fab, transparent: true, opacity: 0.75 })
    );
    b.position.set(s * r * 0.47, r * 0.12, r * 0.64);
    b.rotation.y = s * 0.55;
    b.scale.y = 0.7;
    inner.add(b);
  }
  if (type === 'bear' || type === 'cat') {
    const muz = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 14, 10), light);
    muz.scale.set(1.1, 0.8, 0.6);
    muz.position.set(0, r * 0.1, r * 0.74);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(r * 0.065, 8, 6), dark);
    nose.position.set(0, r * 0.16, r * 0.86);
    inner.add(muz, nose);
  }
  if (type === 'bear') {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(r * 0.24, 14, 10), mat);
      ear.position.set(s * r * 0.55, r * 0.88, 0);
      const inr = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 10, 8), light);
      inr.position.set(0, 0, r * 0.15);
      inr.scale.z = 0.5;
      ear.add(inr);
      inner.add(ear);
    }
  } else if (type === 'bunny') {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.14, r * 0.55, 6, 12), mat);
      ear.position.set(s * r * 0.26, r * 1.12, 0);
      ear.rotation.z = -s * 0.18;
      const inr = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.07, r * 0.4, 4, 8), light);
      inr.position.z = r * 0.09;
      ear.add(inr);
      inner.add(ear);
    }
  } else if (type === 'cat') {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, r * 0.42, 4), mat);
      ear.position.set(s * r * 0.45, r * 0.9, 0);
      ear.rotation.z = -s * 0.38;
      inner.add(ear);
    }
  } else if (type === 'chick') {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(r * 0.12, r * 0.25, 8), toon(0xffa64d));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, r * 0.14, r * 0.86);
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(r * 0.1, r * 0.3, 6), mat);
    tuft.position.set(0, r * 1.05, 0);
    tuft.rotation.z = 0.3;
    inner.add(beak, tuft);
  } else if (type === 'frog') {
    for (const s of [-1, 1]) {
      const bump = new THREE.Mesh(new THREE.SphereGeometry(r * 0.24, 14, 10), mat);
      bump.position.set(s * r * 0.32, r * 0.86, r * 0.2);
      const w = new THREE.Mesh(new THREE.SphereGeometry(r * 0.16, 12, 8), whiteBasic);
      w.position.set(0, 0, r * 0.14);
      const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.08, 8, 6), dark);
      p.position.set(0, 0, r * 0.12);
      w.add(p);
      bump.add(w);
      inner.add(bump);
      parts.eyes.push(w);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(r * 0.22, r * 0.025, 6, 16, Math.PI), dark);
    smile.rotation.z = Math.PI;
    smile.position.set(0, r * 0.08, r * 0.77);
    inner.add(smile);
  }
  // arms & feet
  parts.arms = [];
  parts.feet = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.SphereGeometry(r * 0.19, 12, 10), mat);
    arm.scale.set(0.85, 1.2, 0.85);
    arm.position.set(s * r * 0.56, -r * 0.36, r * 0.12);
    arm.castShadow = true;
    inner.add(arm);
    parts.arms.push(arm);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 12, 10), light);
    foot.scale.set(1, 0.7, 1.25);
    foot.position.set(s * r * 0.26, -r * 0.92, r * 0.16);
    inner.add(foot);
    parts.feet.push(foot);
  }
  if (isPlayer) {
    // gold star clip + back tag
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const rr = i % 2 ? r * 0.08 : r * 0.19;
      i ? starShape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : starShape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: r * 0.06, bevelEnabled: false }), toon(0xffd34d));
    star.position.set(r * 0.42, r * 0.78, r * 0.3);
    star.rotation.set(-0.3, 0.4, -0.2);
    inner.add(star);
    const tagTex = canvasTex(256, 160, (g2, w, h) => {
      roundRect(g2, 6, 6, w - 12, h - 12, 22);
      g2.fillStyle = '#ffffff';
      g2.fill();
      g2.strokeStyle = '#ffb3cf';
      g2.lineWidth = 8;
      g2.stroke();
      g2.fillStyle = '#e0558a';
      g2.font = `900 54px ${FONT}`;
      g2.textAlign = 'center';
      g2.textBaseline = 'middle';
      g2.fillText('한정판', w / 2, h / 2 - 16);
      g2.fillStyle = '#9b8aa6';
      g2.font = `800 26px ${FONT}`;
      g2.fillText('No.001', w / 2, h / 2 + 36);
    });
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 0.62, r * 0.39),
      new THREE.MeshBasicMaterial({ map: tagTex, side: THREE.DoubleSide })
    );
    tag.position.set(r * 0.2, -r * 0.25, -r * 0.6);
    tag.rotation.set(0.15, Math.PI + 0.35, 0.18);
    inner.add(tag);
    parts.tag = tag;
    // tiny bow on ear
    const bowMat = toon(0xff7aa8);
    const bow = new THREE.Group();
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(r * 0.1, r * 0.2, 8), bowMat);
      c.rotation.z = (s * Math.PI) / 2;
      c.position.x = s * r * 0.1;
      bow.add(c);
    }
    bow.position.set(-r * 0.55, r * 0.95, r * 0.12);
    bow.rotation.z = 0.4;
    inner.add(bow);
  }
  return parts.group = g, parts;
}

const dolls = []; // {body, view, r, isPlayer, gone}
function addDoll(type, color, r, pos, isPlayer = false) {
  const view = makeDoll(type, color, r, isPlayer);
  machine.add(view.group);
  const body = new CANNON.Body({
    mass: isPlayer ? 1 : 0.55,
    material: mDoll,
    shape: new CANNON.Sphere(r * 0.9),
    linearDamping: isPlayer ? 0.02 : 0.08,
    angularDamping: 0.45,
    fixedRotation: isPlayer,
  });
  body.position.set(pos.x, pos.y, pos.z);
  if (!isPlayer) body.quaternion.setFromEuler(rand(0, 6), rand(0, 6), rand(0, 6));
  world.addBody(body);
  const d = { body, view, r: r * 0.9, isPlayer, gone: false, kin: false };
  dolls.push(d);
  return d;
}

let player;
function spawnAll() {
  for (const d of dolls) {
    world.removeBody(d.body);
    machine.remove(d.view.group);
  }
  dolls.length = 0;
  player = addDoll('bear', 0x9fe3d0, 0.78, { x: 1, y: 2.5, z: -1.5 }, true);
  let i = 0;
  const heaps = [
    { x: 3.3, z: -3.3, n: 9 },
    { x: -3.6, z: -2.8, n: 8 },
    { x: 2.6, z: 3.2, n: 6 },
  ];
  for (const h of heaps)
    for (let k = 0; k < h.n; k++, i++)
      addDoll(TYPES[i % TYPES.length], PASTELS[i % PASTELS.length], rand(0.62, 0.78), { x: h.x + rand(-1.4, 1.4), y: 1 + k * 0.9, z: h.z + rand(-1.4, 1.4) });
  while (dolls.length < 33) {
    const x = rand(-5, 5), z = rand(-5, 5);
    if (x < -2.4 && z > 2.4) continue;
    addDoll(TYPES[i % TYPES.length], PASTELS[i % PASTELS.length], rand(0.62, 0.78), { x, y: rand(1.2, 5), z });
    i++;
  }
}

// ======================================================================
// game state
// ======================================================================
const G = {
  phase: 'title',
  attempt: 0,
  maxAttempts: 5,
  timeScale: 1,
  slowT: 0,
  shake: 0,
  conceal: 0,
  hiddenTime: 0,
  escapes: 0,
  taken: 0,
  crouch: 0,
  struggle: 0,
  strength: 0.6,
  grabbed: null,
  idleT: 0,
  slapped: false,
  photoT: 0,
  winT: 0,
  annoyed: false,
};
const HOME = { x: CHUTE.cx, z: CHUTE.cz, y: 11.2 };
const claw = { x: HOME.x, y: HOME.y, z: HOME.z, vx: 0, vy: 0, vz: 0, open: 0.35, openT: 0.35, state: 'home', t: 0,
  ax: 0, az: 0, errX: 0, errZ: 0, aimDur: 3.8, lost: false, carryWobble: 0 };

function coinsUI() {
  const row = $('coinRow');
  row.innerHTML = '';
  for (let i = 0; i < G.maxAttempts; i++) {
    const c = document.createElement('div');
    c.className = 'coin' + (i < G.attempt ? ' used' : '');
    row.appendChild(c);
  }
}

let bubbleT = 0;
function say(text, dur = 2) {
  const b = $('bubble');
  b.textContent = text;
  b.classList.add('on');
  bubbleT = dur;
}

// ---------- sounds
let motor = null;
let music = null;
function initAudio() {
  sfx.init();
  if (!motor) motor = sfx.hum({ type: 'sawtooth', f: 70, filter: 380, v: 0 });
  if (!music) {
    music = new Music(sfx, {
      bpm: 128,
      melody: seq('E5 G5 C6 G5 A5 - G5 - E5 G5 A5 G5 E5 - D5 - C5 E5 G5 E5 F5 - E5 - D5 E5 F5 D5 C5 - - -'),
      bass: seq('C3 - G3 - A2 - E3 - F2 - C3 - G2 - B2 -'),
      v: 0.022,
    });
    music.start();
  }
}
const S = {
  coin: () => { sfx.tone({ f: 1320, d: 0.08, type: 'square', v: 0.12 }); sfx.tone({ f: 1760, d: 0.25, type: 'square', v: 0.1, delay: 0.08 }); },
  beep: () => { sfx.tone({ f: 880, d: 0.09, type: 'square', v: 0.1 }); sfx.tone({ f: 880, d: 0.09, type: 'square', v: 0.1, delay: 0.16 }); },
  clunk: () => { sfx.noise({ d: 0.16, v: 0.35, f: 900 }); sfx.tone({ f: 140, f2: 70, d: 0.18, type: 'square', v: 0.15 }); },
  jump: () => sfx.tone({ f: 380, f2: 760, d: 0.16, type: 'sine', v: 0.18 }),
  land: () => sfx.noise({ d: 0.08, v: 0.12, f: 500 }),
  squeak: () => sfx.tone({ f: rand(700, 1000), f2: rand(1100, 1500), d: 0.09, type: 'triangle', v: 0.12 }),
  boing: () => { sfx.tone({ f: 200, f2: 620, d: 0.35, type: 'sine', v: 0.25 }); sfx.noise({ d: 0.3, v: 0.12, f: 2500, f2: 300 }); },
  fall: () => sfx.tone({ f: 700, f2: 120, d: 0.9, type: 'triangle', v: 0.18 }),
  thud: () => { sfx.tone({ f: 90, f2: 40, d: 0.35, type: 'sine', v: 0.5 }); sfx.noise({ d: 0.25, v: 0.35, f: 400 }); },
  shutter: () => { sfx.noise({ d: 0.05, v: 0.4, f: 4000, type: 'highpass' }); sfx.noise({ d: 0.09, v: 0.3, f: 3000, type: 'highpass', delay: 0.07 }); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => sfx.tone({ f, d: 0.25, type: 'square', v: 0.1, delay: i * 0.12 })),
  sad: () => [784, 659, 523, 392].forEach((f, i) => sfx.tone({ f, d: 0.3, type: 'triangle', v: 0.14, delay: i * 0.16 })),
};

// ======================================================================
// helpers
// ======================================================================
function surfaceAt(x, z, rad = 1.0) {
  let top = x > CHUTE.x0 && x < CHUTE.x1 && z > CHUTE.z0 && z < CHUTE.z1 ? -6 : 0;
  for (const d of dolls) {
    if (d.gone || d === G.grabbed) continue;
    const p = d.body.position;
    if (Math.hypot(p.x - x, p.z - z) < rad + d.r * 0.5) top = Math.max(top, p.y + d.r);
  }
  return top;
}
function computeConceal() {
  const p = player.body.position;
  let c = G.crouch * 0.2;
  for (const d of dolls) {
    if (d === player || d.gone) continue;
    const q = d.body.position;
    const dist = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
    if (dist > 1.9) continue;
    if (q.y > p.y + 0.35 && Math.hypot(q.x - p.x, q.z - p.z) < 1.25) c += 0.42;
    else if (Math.abs(q.y - p.y) < 0.6) c += 0.1;
  }
  return clamp(c, 0, 1);
}
const _contactN = new CANNON.Vec3();
function playerGrounded() {
  for (const c of world.contacts) {
    if (c.bi === player.body) c.ni.negate(_contactN);
    else if (c.bj === player.body) _contactN.copy(c.ni);
    else continue;
    if (_contactN.y > 0.45) return true;
  }
  return false;
}
function setKinematic(d, on) {
  d.kin = on;
  d.body.type = on ? CANNON.Body.KINEMATIC : CANNON.Body.DYNAMIC;
  d.body.velocity.setZero();
  d.body.angularVelocity.setZero();
  if (!on) d.body.wakeUp();
}
function shakeAllDolls(power) {
  for (const d of dolls) {
    if (d.gone || d.kin) continue;
    d.body.velocity.x += rand(-1, 1) * power;
    d.body.velocity.z += rand(-1, 1) * power;
    d.body.velocity.y += rand(0.6, 1.2) * power * 1.2;
    if (!d.isPlayer) d.body.angularVelocity.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
  }
}

// keep kinematic grabbed body glued under claw
world.addEventListener('preStep', () => {
  if (!G.grabbed) return;
  const b = G.grabbed.body;
  const w = claw.carryWobble;
  const tx = claw.x + Math.sin(performance.now() * 0.02) * 0.06 * w;
  const ty = claw.y - CLAW_REACH - G.grabbed.r * 0.35;
  const tz = claw.z;
  const dt = 1 / 60;
  b.velocity.set((tx - b.position.x) / dt, (ty - b.position.y) / dt, (tz - b.position.z) / dt);
});

// ======================================================================
// claw state machine
// ======================================================================
function startAttempt() {
  G.attempt++;
  coinsUI();
  claw.state = 'coin';
  claw.t = 0;
  claw.lost = false;
  G.strength = rand(0.25, 1);
  G.slapped = false;
  S.coin();
  const lines = ['한정판 말랑곰이다! 저거 뽑아야지', '다시! 이번엔 진짜다', '아 왜 안 잡혀…', '한 번만 더… 한 번만', '마지막 동전이다. 진짜 마지막'];
  say(lines[G.attempt - 1] || '한 번 더!', 2.2);
  setExpr(G.attempt <= 2 ? 'expect' : G.attempt === 5 ? 'annoyed' : 'focus');
  claw.aimDur = [4.2, 3.8, 3.3, 3.0, 2.8][G.attempt - 1];
  const ang = rand(0, Math.PI * 2);
  claw.errX = Math.cos(ang);
  claw.errZ = Math.sin(ang);
}

function moveClawTo(tx, tz, speed, dt) {
  const dx = tx - claw.x, dz = tz - claw.z;
  const dist = Math.hypot(dx, dz);
  const step = Math.min(dist, speed * dt);
  const nx = dist > 1e-4 ? (dx / dist) * step : 0;
  const nz = dist > 1e-4 ? (dz / dist) * step : 0;
  claw.x += nx;
  claw.z += nz;
  return dist;
}

function updateClaw(dt) {
  claw.t += dt;
  const p = player.body.position;
  let motorOn = false;
  switch (claw.state) {
    case 'home':
      break;
    case 'coin':
      if (claw.t > 1.3) { claw.state = 'aim'; claw.t = 0; }
      break;
    case 'aim': {
      const prog = clamp(claw.t / claw.aimDur, 0, 1);
      const skill = [2.6, 2.1, 1.5, 1.1, 0.8][G.attempt - 1];
      const err = lerp(skill, 0.25, prog) + G.conceal * 3.2;
      let tx = p.x + claw.errX * err;
      let tz = p.z + claw.errZ * err;
      if (G.conceal > 0.72) {
        if (!claw.lost) {
          claw.lost = true;
          say('어디 갔지…?', 1.6);
          setExpr('meh');
          const others = dolls.filter((d) => !d.isPlayer && !d.gone);
          const o = pick(others);
          claw.lostX = o ? o.body.position.x : rand(-4, 4);
          claw.lostZ = o ? o.body.position.z : rand(-4, 4);
        }
        tx = claw.lostX;
        tz = claw.lostZ;
      } else if (claw.lost && G.conceal < 0.35) {
        claw.lost = false;
        say('저기 있다!', 1.2);
        setExpr('focus');
      }
      claw.ax = damp(claw.ax, tx, 2.2, dt);
      claw.az = damp(claw.az, tz, 2.2, dt);
      const tx2 = clamp(claw.ax, -5, 5), tz2 = clamp(claw.az, -5, 5);
      const dist = moveClawTo(tx2, tz2, 3.6, dt);
      motorOn = dist > 0.05;
      claw.openT = 0.35;
      lookTarget.set(claw.x, 2, claw.z);
      if (claw.t > claw.aimDur) {
        claw.state = 'warn';
        claw.t = 0;
        S.beep();
      }
      break;
    }
    case 'warn':
      claw.openT = 0.95;
      if (claw.t > 0.65) { claw.state = 'drop'; claw.t = 0; }
      break;
    case 'drop': {
      claw.openT = 0.95;
      const surface = surfaceAt(claw.x, claw.z, 0.9);
      const stopY = Math.max(surface + CLAW_REACH - 0.25, 1.2);
      claw.y -= 8.5 * dt;
      motorOn = true;
      if (claw.y <= stopY) {
        claw.y = stopY;
        claw.state = 'close';
        claw.t = 0;
        S.clunk();
      }
      break;
    }
    case 'close': {
      claw.openT = 0.12;
      if (claw.t > 0.35 && !claw.decided) {
        claw.decided = true;
        const bottom = claw.y - CLAW_REACH;
        let best = null, bestTop = -99;
        for (const d of dolls) {
          if (d.gone) continue;
          const q = d.body.position;
          if (Math.hypot(q.x - claw.x, q.z - claw.z) > 1.2) continue;
          const top = q.y + d.r;
          if (top < bottom - 1.0) continue;
          if (top > bestTop) { bestTop = top; best = d; }
        }
        if (best && (best.isPlayer || G.strength > 0.32)) {
          G.grabbed = best;
          setKinematic(best, true);
          claw.openT = 0.38;
          claw.carryWobble = 0.4;
          if (best.isPlayer) {
            G.struggle = 0;
            say('잡았다!!', 1.5);
            setExpr('excited');
            S.squeak();
          } else {
            say(G.conceal > 0.5 ? '어? 이거 말고…' : '아 옆에 거 잡혔네…', 1.8);
            setExpr('meh');
          }
        } else {
          say('헛손질…', 1.4);
          setExpr(G.attempt >= 3 ? 'annoyed' : 'meh');
        }
      }
      if (claw.t > 0.7) { claw.state = 'lift'; claw.t = 0; claw.decided = false; }
      break;
    }
    case 'lift': {
      motorOn = true;
      claw.y += (G.grabbed ? 3.4 : 5) * dt;
      if (G.grabbed && !G.grabbed.isPlayer && G.strength < 0.5 && claw.y > 6 && !claw.slipChecked) {
        claw.slipChecked = true;
        if (Math.random() < 0.5) releaseGrab('slip');
      }
      if (G.grabbed && G.grabbed.isPlayer && G.strength < 0.38 && claw.y > 8.5 && !claw.slipChecked) {
        claw.slipChecked = true;
        releaseGrab('slip');
      }
      if (claw.y >= HOME.y) {
        claw.y = HOME.y;
        claw.state = 'carry';
        claw.t = 0;
        claw.slipChecked = false;
      }
      break;
    }
    case 'carry': {
      motorOn = true;
      const dist = moveClawTo(HOME.x, HOME.z, 3.2, dt);
      if (G.grabbed) lookTarget.set(claw.x, claw.y - 2, claw.z);
      if (dist < 0.02) {
        claw.state = 'release';
        claw.t = 0;
        if (G.grabbed) {
          const d = G.grabbed;
          releaseGrab('chute');
          if (!d.isPlayer) {
            d.leaving = true;
          }
        }
        claw.openT = 0.95;
        S.clunk();
      }
      break;
    }
    case 'release':
      claw.openT = 0.95;
      if (claw.t > 1.0) {
        claw.state = 'home';
        claw.t = 0;
        claw.openT = 0.35;
        afterAttempt();
      }
      break;
  }
  claw.open = damp(claw.open, claw.openT, 10, dt);
  if (motor) motor.set(motorOn ? 62 + Math.sin(performance.now() * 0.01) * 4 : 60, motorOn ? 0.06 : 0, 420);
  if (G.grabbed) claw.carryWobble = damp(claw.carryWobble, G.grabbed.isPlayer ? 1 + G.struggle * 0.02 : 0.3, 4, dt);
}

function releaseGrab(why) {
  const d = G.grabbed;
  if (!d) return;
  G.grabbed = null;
  setKinematic(d, false);
  if (why === 'chute') {
    d.body.velocity.set(0, -2, 0);
    return;
  }
  // escaped / slipped: pop out (away from the chute)
  const ox = d.body.position.x - CHUTE.cx, oz = d.body.position.z - CHUTE.cz;
  const ol = Math.hypot(ox, oz) || 1;
  if (ol < 3.2) d.body.velocity.set((ox / ol) * 4.5 + 1.5, 3, (oz / ol) * 4.5 - 1.5);
  else d.body.velocity.set(rand(-3, 3), 3, rand(-3, 3));
  claw.openT = 0.95;
  if (d.isPlayer) {
    G.escapes++;
    G.timeScale = 0.25;
    G.slowT = 0.9;
    G.shake = 0.5;
    S.boing();
    say(why === 'slip' ? '아 집게 힘 빠졌어!!' : '아아악! 빠졌어!!', 1.8);
    setExpr('shock');
    G.annoyed = true;
  } else {
    S.land();
    say('아 떨어졌어…', 1.4);
  }
}

function afterAttempt() {
  if (G.phase !== 'play') return;
  G.idleT = 0;
  if (G.attempt >= G.maxAttempts) {
    startWin();
    return;
  }
  setExpr(G.attempt >= 2 ? 'annoyed' : 'meh');
}

// ======================================================================
// player control
// ======================================================================
let wasGrounded = true;
let jumpBuffer = 0;
let facing = Math.PI; // face camera when idle
let squash = 0, squashV = 0;
function updatePlayer(dt, t) {
  const b = player.body;
  const grounded = playerGrounded();
  const v = player.view;
  if (G.grabbed === player) {
    // struggle
    if (keys.hit('Space') || keys.hit('KeyW') || keys.hit('KeyA') || keys.hit('KeyS') || keys.hit('KeyD')) {
      G.struggle += 100 / (5 + G.strength * 9);
      squashV += 3;
      S.squeak();
      G.shake = Math.max(G.shake, 0.12);
    }
    G.struggle = Math.max(0, G.struggle - 16 * dt);
    $('struggle').style.display = 'block';
    $('struggleBar').style.width = Math.min(100, G.struggle) + '%';
    if (G.struggle >= 100) releaseGrab('escape');
  } else {
    $('struggle').style.display = 'none';
    let ix = 0, iz = 0;
    if (keys.any('KeyW', 'ArrowUp')) iz += 1;
    if (keys.any('KeyS', 'ArrowDown')) iz -= 1;
    if (keys.any('KeyA', 'ArrowLeft')) ix += 1;
    if (keys.any('KeyD', 'ArrowRight')) ix -= 1;
    const len = Math.hypot(ix, iz) || 1;
    G.crouch = damp(G.crouch, keys.any('ShiftLeft', 'ShiftRight') ? 1 : 0, 12, dt);
    const speed = lerp(5.6, 2.4, G.crouch);
    const tx = (ix / len) * speed, tz = (iz / len) * speed;
    const ctrl = grounded ? 14 : 5;
    b.velocity.x = damp(b.velocity.x, tx, ctrl, dt);
    b.velocity.z = damp(b.velocity.z, tz, ctrl, dt);
    if (ix || iz) facing = Math.atan2(ix, iz);
    else facing = dampAngle(facing, Math.PI, 2.2, dt);
    if (G.crouch > 0.6) {
      // burrow: nearby dolls slump onto the player
      for (const d of dolls) {
        if (d === player || d.gone || d.kin) continue;
        const q = d.body.position;
        const dx = b.position.x - q.x, dz = b.position.z - q.z;
        const hd = Math.hypot(dx, dz);
        if (hd < 2.3 && hd > 0.15 && q.y > b.position.y - 0.25) {
          d.body.velocity.x += (dx / hd) * 7 * dt;
          d.body.velocity.z += (dz / hd) * 7 * dt;
        }
      }
    }
    if (keys.hit('Space')) jumpBuffer = 0.15;
    jumpBuffer -= dt;
    if (jumpBuffer > 0 && grounded && G.crouch < 0.5) {
      b.velocity.y = 9.6;
      jumpBuffer = 0;
      squashV -= 6;
      S.jump();
    }
    if (grounded && !wasGrounded && b.velocity.y < 1) {
      squashV += 5;
      S.land();
    }
  }
  wasGrounded = grounded;
  // spring squash
  squashV += (-squash * 160 - squashV * 12) * dt;
  squash += squashV * dt;
  const vy = b.velocity.y;
  const stretch = clamp(vy * 0.025, -0.15, 0.18);
  const sy = 1 + stretch - squash * 0.12 - G.crouch * 0.28;
  const sxz = 1 - stretch * 0.5 + squash * 0.08 + G.crouch * 0.14;
  v.inner.scale.set(sxz, sy, sxz);
  v.inner.position.y = -(1 - sy) * player.r * 0.9;
  // facing & tilt
  v.group.rotation.y = dampAngle(v.group.rotation.y, facing, 12, dt);
  const sp = Math.hypot(b.velocity.x, b.velocity.z);
  v.inner.rotation.x = damp(v.inner.rotation.x, G.grabbed === player ? 0 : clamp(sp * 0.04, 0, 0.22), 8, dt);
  // wiggle / flail
  const grabbed = G.grabbed === player;
  const fl = grabbed ? 1 : 0;
  v.arms.forEach((a, i) => {
    const s = i ? 1 : -1;
    a.rotation.z = s * (fl ? 0.9 + Math.sin(t * 30 + i) * 0.7 : Math.sin(t * 10) * 0.15 * clamp(sp / 4, 0, 1));
    a.position.y = -player.r * 0.36 / 0.9 * 0.9 + (fl ? 0.15 : 0);
  });
  v.feet.forEach((f, i) => {
    f.position.z = player.r * 0.16 + (fl ? Math.sin(t * 28 + i * 3) * 0.12 : Math.sin(t * 12 + i * Math.PI) * 0.08 * clamp(sp / 4, 0, 1));
  });
  v.inner.rotation.z = fl ? Math.sin(t * 24) * 0.25 : 0;
  // blink
  const blink = (t % 2.9) < 0.1 ? 0.15 : 1;
  v.eyes.forEach((e) => (e.scale.y = (grabbed ? 1.4 : 1) * blink));
}
function dampAngle(a, b, l, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-l * dt));
}

// ======================================================================
// sync visuals
// ======================================================================
const _seg = new THREE.Vector3(), _tmp = new THREE.Vector3(), _ph = new THREE.Vector3();
function occludes(pos, r) {
  // is this doll between the camera and the player?
  _ph.copy(player.view.group.position);
  _ph.y += 0.3;
  _seg.subVectors(_ph, camera.position);
  const len2 = _seg.lengthSq();
  const t = _tmp.subVectors(pos, camera.position).dot(_seg) / len2;
  if (t < 0.02 || t > 0.93) return false;
  _tmp.copy(camera.position).addScaledVector(_seg, t);
  return _tmp.distanceTo(pos) < r + 0.45;
}
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3(0, 5, -6);
function syncDolls(dt) {
  for (const d of dolls) {
    if (d.gone) continue;
    const p = d.body.position;
    d.view.group.position.set(p.x, p.y, p.z);
    if (!d.isPlayer) d.view.group.quaternion.set(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w);
    // fade near camera
    if (!d.isPlayer) {
      const near = camera.position.distanceTo(d.view.group.position) < 2.4 || occludes(d.view.group.position, d.r);
      const op = near ? 0.28 : 1;
      d.view.mats.forEach((m) => (m.opacity = damp(m.opacity, op, 10, dt)));
      d.view.outlines.forEach((o) => (o.visible = !near));
    }
    if (d.leaving && p.y < -4) {
      d.gone = true;
      world.removeBody(d.body);
      machine.remove(d.view.group);
      G.taken++;
    }
    if (!d.isPlayer && !d.leaving && !d.kin && p.y < -2) d.leaving = true; // fell in by accident
  }
}

function updateClawVisual(t) {
  clawG.position.set(claw.x, claw.y, claw.z);
  const sw = G.grabbed ? Math.sin(t * 9) * 0.04 * claw.carryWobble : 0;
  clawG.rotation.z = sw;
  prongs.forEach((pv) => (pv.rotation.x = -0.15 + claw.open * 0.75));
  crossBar.position.set(0, 12.9, claw.z);
  carriage.position.set(claw.x, 12.65, claw.z);
  const top = 12.35, bot = claw.y + 0.45;
  cable.position.set(claw.x, (top + bot) / 2, claw.z);
  cable.scale.y = Math.max(0.01, top - bot);
  // ground indicators
  const showRing = ['aim', 'warn', 'drop'].includes(claw.state) && G.phase === 'play';
  const surface = surfaceAt(claw.x, claw.z, 0.9);
  ringMesh.position.set(claw.x, surface + 0.04, claw.z);
  discMesh.position.set(claw.x, surface + 0.03, claw.z);
  const flash = claw.state === 'warn' ? (Math.sin(t * 40) > 0 ? 1 : 0.3) : 0.75;
  ringMat.opacity = damp(ringMat.opacity, showRing ? flash : 0, 14, 1 / 60);
  ringMat.color.setHex(claw.state === 'aim' ? 0xff8fb6 : 0xff4f7f);
  const h = clamp((HOME.y - claw.y) / (HOME.y - surface - 1), 0, 1);
  discMat.opacity = showRing ? 0.12 + h * 0.3 : 0;
  discMesh.scale.setScalar(0.7 + h * 0.6);
  ringMesh.scale.setScalar(1 + (claw.state === 'aim' ? Math.sin(t * 5) * 0.06 : 0));
}

function updateCamera(dt) {
  const p = player.view.group.position;
  if (G.phase === 'photo') return;
  if (G.phase === 'win' && G.winT > 2.2) {
    camTarget.lerp(new THREE.Vector3(p.x, p.y + 0.6, p.z), 1 - Math.exp(-4 * dt));
    const want = new THREE.Vector3(p.x - 0.4, p.y + 3.4, p.z + 3.8);
    want.z = Math.min(want.z, 5.4);
    camPos.lerp(want, 1 - Math.exp(-2.5 * dt));
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    return;
  }
  const grabbed = G.grabbed === player;
  // camera may slip behind the back panel (its back face is culled, so the view stays clear)
  let want = new THREE.Vector3(p.x * 0.85, p.y + (grabbed ? 1.4 : 2.5), p.z - (grabbed ? 6.8 : 6.0));
  want.z = Math.max(want.z, -9.5);
  want.x = clamp(want.x, -5.2, 5.2);
  camPos.lerp(want, 1 - Math.exp(-5 * dt));
  camTarget.lerp(new THREE.Vector3(p.x * 0.9, p.y + (grabbed ? 0.6 : 0.1), p.z + (grabbed ? 3 : 9)), 1 - Math.exp(-6 * dt));
  camera.position.copy(camPos);
  if (G.shake > 0) {
    camera.position.x += rand(-1, 1) * G.shake * 0.4;
    camera.position.y += rand(-1, 1) * G.shake * 0.4;
  }
  camera.lookAt(camTarget);
}

// ======================================================================
// slap event (annoyed customer bangs the glass)
// ======================================================================
const slap = { on: false, t: 0, x: 0, y: 0, hit: false };
function startSlap() {
  slap.on = true;
  slap.t = 0;
  slap.hit = false;
  slap.x = rand(-3.2, 3.2);
  slap.y = rand(5, 8.5);
  slapHand.visible = true;
  slapHand.rotation.set(0, Math.PI, rand(-0.3, 0.3));
  setExpr('annoyed');
}
function updateSlap(dt) {
  if (!slap.on) return;
  slap.t += dt;
  const t = slap.t;
  let z;
  if (t < 0.35) z = lerp(11, 9.5, t / 0.35);
  else if (t < 0.45) z = lerp(9.5, HALF + 0.35, (t - 0.35) / 0.1);
  else if (t < 1.1) z = HALF + 0.35;
  else z = lerp(HALF + 0.35, 12, (t - 1.1) / 0.4);
  slapHand.position.set(slap.x, slap.y, z);
  const sq = t > 0.45 && t < 0.6 ? 0.6 : 1;
  slapHand.scale.set(1.1, 1.1, sq);
  if (!slap.hit && t >= 0.45) {
    slap.hit = true;
    G.shake = 0.9;
    S.thud();
    say('에잇!!', 1.2);
    shakeAllDolls(4.2);
    drawPalm(glassFrontTex, 0.5 - slap.x / 12, 1 - slap.y / 14);
  }
  if (t > 1.6) {
    slap.on = false;
    slapHand.visible = false;
  }
}

// ======================================================================
// phases
// ======================================================================
function resetGame() {
  if (player && player.view.group.parent === scene) scene.remove(player.view.group);
  G.photoSetup = false;
  G.photoFlash = false;
  spawnAll();
  Object.assign(G, { phase: 'play', attempt: 0, timeScale: 1, slowT: 0, shake: 0, conceal: 0, hiddenTime: 0, escapes: 0, taken: 0, crouch: 0, struggle: 0, grabbed: null, idleT: 0, annoyed: false, photoT: 0, winT: 0 });
  Object.assign(claw, { x: HOME.x, y: HOME.y, z: HOME.z, state: 'home', t: 0, open: 0.35, openT: 0.35, decided: false, slipChecked: false });
  faceG.position.copy(FACE_HOME);
  faceG.visible = true;
  machine.visible = true;
  glassFront.visible = true;
  photoProps.visible = false;
  setExpr('expect');
  coinsUI();
  $('end').classList.add('hide');
  $('polaroid').style.display = 'none';
  document.querySelectorAll('.hud').forEach((h) => (h.style.display = ''));
  $('struggle').style.display = 'none';
  // settle the pile
  for (let i = 0; i < 160; i++) world.step(1 / 60);
  camPos.set(0, 3.2, -7.5);
  if (music) music.rate = 1;
}

function startWin() {
  G.phase = 'win';
  G.winT = 0;
  setExpr('giveup');
  say('에이… 안 뽑혀. 집에 갈래', 2.6);
  S.win();
}

const photoProps = new THREE.Group();
scene.add(photoProps);
photoProps.visible = false;
{
  const h1 = makeHand();
  h1.position.set(1.6, 2.6, 7.6);
  h1.rotation.set(0.2, Math.PI, 0.6);
  const h2 = makeHand();
  h2.position.set(4.6, 2.8, 7.8);
  h2.rotation.set(0.2, Math.PI, -0.7);
  const v = makeHand(true);
  v.position.set(-4.2, 4.3, 8.4);
  v.rotation.set(0, Math.PI, 0.25);
  v.scale.setScalar(0.95);
  photoProps.add(h1, h2, v);
}

function startPhoto() {
  if (G.phase !== 'play') return;
  G.phase = 'photo';
  G.photoT = 0;
  S.fall();
  setExpr('happy');
  if (motor) motor.set(60, 0);
}
function updatePhoto(dt) {
  G.photoT += dt;
  const t = G.photoT;
  if (t > 0.9 && !G.photoSetup) {
    G.photoSetup = true;
    machine.visible = false;
    photoProps.visible = true;
    document.querySelectorAll('.hud').forEach((h) => (h.style.display = 'none'));
    $('bubble').classList.remove('on');
    // doll cuddled next to the cheek
    machine.remove(player.view.group);
    scene.add(player.view.group);
    player.view.group.position.set(3.1, 4.3, 7.4);
    player.view.group.rotation.set(0, Math.PI + 0.3, -0.25);
    player.view.group.scale.setScalar(2.0);
    player.view.inner.scale.set(1, 1, 1);
    player.view.inner.position.y = 0;
    player.view.inner.rotation.set(0, 0, 0);
    camera.position.set(0.3, 6.5, -12);
    camera.lookAt(0.3, 0.9, 10);
  }
  if (t > 1.3 && !G.photoFlash) {
    G.photoFlash = true;
    S.shutter();
    const f = $('flash');
    f.style.transition = 'none';
    f.style.opacity = '1';
    requestAnimationFrame(() => {
      f.style.transition = 'opacity .8s';
      f.style.opacity = '0';
    });
    $('polaroid').style.display = 'flex';
    const d = new Date();
    $('polaroidSub').textContent = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} · 동전 ${G.attempt}개 만에`;
    S.sad();
  }
  if (G.photoSetup) {
    // tiny breathing so the photo feels alive
    lookTarget.set(0.6, 6.2, -2.8);
  }
}

// ======================================================================
// main loop
// ======================================================================
let last = performance.now();
let elapsed = 0;
const FAST = location.hash.includes('fast');
let frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(FAST ? 0.2 : 0.05, (now - last) / 1000) * (FAST ? 2.5 : 1);
  frames++;
  last = now;
  elapsed += rdt;
  if (G.slowT > 0) {
    G.slowT -= rdt;
    if (G.slowT <= 0) G.timeScale = 1;
  }
  const dt = rdt * G.timeScale;
  G.shake = Math.max(0, G.shake - rdt * 2);

  if (keys.hit('KeyM')) {
    sfx.setMuted(!sfx.muted);
  }
  if (keys.hit('KeyR') && G.phase !== 'title') resetGame();

  if (G.phase === 'play') {
    updatePlayer(dt, elapsed);
    updateClaw(dt);
    updateSlap(dt);
    world.step(1 / 60, dt, FAST ? 40 : 4);
    G.conceal = damp(G.conceal, computeConceal(), 6, dt);
    if (G.conceal > 0.6) G.hiddenTime += dt;
    // UI
    const c = G.conceal;
    $('hideBar').style.width = Math.round(c * 100) + '%';
    $('hideBar').style.background = c > 0.72 ? '#7ad7a8' : c > 0.35 ? '#ffd166' : '#ff8fb1';
    $('hideLabel').textContent = c > 0.72 ? '완전히 숨음' : c > 0.35 ? '반쯤 숨음' : '들킴';
    if (claw.state === 'home') {
      G.idleT += dt;
      if (G.idleT > 0.6 && (G.annoyed || G.attempt >= 3) && !G.slapped && G.attempt >= 2 && Math.random() < 0.6) {
        G.slapped = true;
        startSlap();
      } else if (G.idleT > 0.6 && !G.slapped) G.slapped = true;
      if (G.idleT > (slap.on ? 2.6 : 1.4) && G.attempt < G.maxAttempts) startAttempt();
      lookTarget.copy(player.view.group.position);
    } else if (claw.state === 'coin') lookTarget.copy(player.view.group.position);
    if (player.body.position.y < -2.5 && G.grabbed !== player) startPhoto();
    syncDolls(dt);
  } else if (G.phase === 'photo') {
    if (!G.photoSetup) {
      world.step(1 / 60, dt, FAST ? 40 : 4);
      syncDolls(dt);
    }
    updatePhoto(rdt);
  } else if (G.phase === 'win') {
    G.winT += rdt;
    world.step(1 / 60, dt, FAST ? 40 : 4);
    syncDolls(dt);
    // customer leaves, player celebrates
    if (G.winT > 1.6) {
      faceG.position.z = damp(faceG.position.z, 40, 1.2, rdt);
      faceG.position.y = damp(faceG.position.y, 4, 1.2, rdt);
    }
    const b = player.body;
    if (playerGrounded() && G.winT > 1) {
      b.velocity.y = 8;
      S.jump();
    }
    b.velocity.x = damp(b.velocity.x, 0, 6, rdt);
    b.velocity.z = damp(b.velocity.z, 0, 6, rdt);
    player.view.group.rotation.y = dampAngle(player.view.group.rotation.y, 0, 6, rdt);
    player.view.arms.forEach((a, i) => (a.rotation.z = (i ? 1 : -1) * (2.2 + Math.sin(elapsed * 14) * 0.4)));
    if (G.winT > 4.4 && $('end').classList.contains('hide')) showEnd();
  } else if (G.phase === 'title') {
    // idle bob for the title background
    world.step(1 / 60, rdt, 2);
    syncDolls(rdt);
    lookTarget.copy(player.view.group.position);
  }

  updateClawVisual(elapsed);
  updateFace(rdt, elapsed);
  updateCamera(rdt);
  // bulbs chase
  bulbs.forEach((b, i) => b.material.color.setHex(Math.floor(elapsed * 6 + i) % 4 === 0 ? 0xffffff : i % 2 ? 0xffd1e3 : 0xfff3b0));
  // speech bubble follows the face
  if (bubbleT > 0) {
    bubbleT -= rdt;
    if (bubbleT <= 0) $('bubble').classList.remove('on');
  }
  const bp = faceG.localToWorld(new THREE.Vector3(-3.6, 3.4, -4.5)).project(camera);
  const bx = clamp((bp.x * 0.5 + 0.5) * innerWidth, 160, innerWidth - 160);
  const by = clamp((-bp.y * 0.5 + 0.5) * innerHeight, 120, innerHeight * 0.45);
  $('bubble').style.left = bx + 'px';
  $('bubble').style.top = by + 'px';

  renderer.render(scene, camera);
  keys.endFrame();
}

function showEnd() {
  $('endTag').textContent = '버티기 성공';
  $('endTitle').textContent = '손님이 포기했어요!';
  $('endLead').textContent = '한정판 말랑곰의 자존심을 지켰다.';
  $('endStats').innerHTML = `<div><b>${G.hiddenTime.toFixed(1)}초</b>숨어 있던 시간</div><div><b>${G.escapes}번</b>집게 탈출</div><div><b>${G.taken}명</b>대신 뽑혀간 친구</div>`;
  $('end').classList.remove('hide');
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
const again = () => {
  initAudio();
  G.photoSetup = false;
  G.photoFlash = false;
  if (player && player.view.group.parent === scene) {
    scene.remove(player.view.group);
  }
  resetGame();
};
$('againBtn').onclick = again;
$('photoAgain').onclick = again;

// title background
spawnAll();
for (let i = 0; i < 160; i++) world.step(1 / 60);
coinsUI();
requestAnimationFrame(frame);

// debug hooks for automated checks
window.__game = { get frames() { return frames; }, releaseGrab, forceGrab() {
  const q = player.body.position; claw.x = q.x; claw.z = q.z; claw.y = q.y + CLAW_REACH + 0.3; claw.state = 'lift'; claw.t = 0;
  G.grabbed = player; setKinematic(player, true); G.struggle = 0; setExpr('excited'); say('잡았다!!', 1.5); }, G, claw, dolls, startPhoto, startWin, resetGame, get player() { return player; } };
