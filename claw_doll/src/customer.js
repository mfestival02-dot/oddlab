import * as THREE from 'three';
import { clamp, damp } from './util.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fabric, toon } from './materials.js';
import handL from '../assets/hand_left.glb';
import handR from '../assets/hand_right.glb';

// 유리 너머의 거대한 손님. 얼굴은 기계 쪽(-z)을 보고 있다.
const R = 5.0, SY = 1.06, SZ = 0.92;
export const FACE_HOME = new THREE.Vector3(0, 6.0, 12.6);

// 머리 표면 위의 z (얼굴 쪽)
function surf(x, y, off = 0) {
  const yy = y / SY;
  return -(SZ * Math.sqrt(Math.max(0, R * R - x * x - yy * yy)) + off);
}

export const EXPR = {
  expect:  { smile: 0.8,  open: 0.35, lid: 0.0,  browA: -0.1, browY: 0.3,  blush: 0.7, sweat: 0 },
  focus:   { smile: 0.1,  open: 0.05, lid: 0.25, browA: 0.15, browY: -0.1, blush: 0.4, sweat: 0 },
  annoyed: { smile: -0.6, open: 0.1,  lid: 0.42, browA: 0.5,  browY: -0.35, blush: 1.0, sweat: 1 },
  giveup:  { smile: -0.8, open: 0.15, lid: 0.68, browA: -0.42, browY: -0.05, blush: 0.2, sweat: 1 },
};

export function makeCustomer(scene) {
  const g = new THREE.Group();
  g.position.copy(FACE_HOME);
  scene.add(g);

  const skin = toon(0xffcfa8);
  const hairMat = toon(0x5a3628);
  const head = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), skin);
  head.scale.set(1, SY, SZ);
  g.add(head);

  // 머리카락: 뒤통수를 덮는 단발 + 앞머리
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 48, 32), hairMat);
  cap.scale.set(1.02, 1.05, 1.0);
  cap.position.set(0, 0.7, 1.15);
  g.add(cap);
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 1.5;
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 14), hairMat);
    b.scale.set(1, 0.7, 0.6);
    b.position.set(x, 4.25 - Math.abs(i - 2.5) * 0.2, surf(x, 4.0, -0.25));
    b.rotation.z = (i - 2.5) * -0.12;
    g.add(b);
  }
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 16), hairMat);
    side.scale.set(0.75, 2.3, 1.5);
    side.position.set(s * 4.65, -0.4, 0.4);
    g.add(side);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(s * R * 0.96, -0.1, -0.9);
    g.add(ear);
  }

  // 눈
  const face = { eyes: [], pupils: [], lids: [], brows: [], blush: [] };
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const iris = new THREE.MeshBasicMaterial({ color: 0x7a4a26 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a0607 });
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const s of [-1, 1]) {
    const eg = new THREE.Group();
    const ex = s * 1.85, ey = 0.7;
    eg.position.set(ex, ey, surf(ex, ey, -0.1));
    const w = new THREE.Mesh(new THREE.SphereGeometry(1.05, 28, 20), white);
    w.scale.set(1, 1.1, 0.5);
    const pg = new THREE.Group();
    const ir = new THREE.Mesh(new THREE.SphereGeometry(0.66, 24, 16), iris);
    ir.scale.set(1, 1.05, 0.35); ir.position.z = -0.36;
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 12), pupilMat);
    pu.scale.z = 0.3; pu.position.z = -0.52;
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), shine);
    h1.position.set(0.24, 0.26, -0.6);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), shine);
    h2.position.set(-0.2, -0.22, -0.6);
    pg.add(ir, pu, h1, h2);
    eg.add(w, pg);
    // 윗눈꺼풀: 반구가 눈을 덮으며 내려온다
    const lid = new THREE.Mesh(new THREE.SphereGeometry(1.12, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), skin);
    lid.scale.set(1.02, 1.12, 0.62);
    eg.add(lid);
    g.add(eg);
    face.eyes.push(eg); face.pupils.push(pg); face.lids.push(lid);

    const br = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.5, 6, 12), hairMat);
    br.rotation.z = Math.PI / 2;
    const bw = new THREE.Group();
    bw.add(br);
    bw.position.set(s * 1.9, 2.45, surf(s * 1.9, 2.45, 0.05));
    g.add(bw);
    face.brows.push(bw);

    const bl = new THREE.Mesh(new THREE.CircleGeometry(0.95, 28),
      new THREE.MeshBasicMaterial({ color: 0xff7f8f, transparent: true, opacity: 0.5, depthWrite: false }));
    bl.position.set(s * 3.0, -1.0, surf(s * 3.0, -1.0, 0.06));
    bl.rotation.y = Math.PI - s * 0.55;
    bl.scale.y = 0.65;
    g.add(bl);
    face.blush.push(bl);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14),
    toon(0xffb48e));
  nose.scale.set(1.05, 0.8, 0.85);
  nose.position.set(0, -0.6, surf(0, -0.6, 0.02));
  g.add(nose);

  face.mouth = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x5a1f2e, side: THREE.DoubleSide }));
  face.mouth.position.set(0, -2.35, surf(0, -2.35, 0.05));
  face.tongue = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: 0xff8f9f, side: THREE.DoubleSide }));
  face.tongue.position.set(0, -2.9, surf(0, -2.35, 0.07));
  face.tongue.scale.y = 0.6;
  g.add(face.mouth, face.tongue);

  face.sweat = new THREE.Group();
  const dropMat = new THREE.MeshBasicMaterial({ color: 0x8fd6ff });
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), dropMat);
  const dropTop = new THREE.Mesh(new THREE.ConeGeometry(0.39, 0.75, 16), dropMat);
  dropTop.position.y = 0.5;
  face.sweat.add(drop, dropTop);
  face.sweat.position.set(3.5, 2.6, surf(3.5, 2.6, 0.3));
  g.add(face.sweat);

  // 후드티
  const hood = toon(0x4f9be8);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), hood);
  torso.scale.set(9, 5.2, 4.6);
  torso.position.set(0, -9.2, 1.6);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(2.9, 1.05, 16, 40), hood);
  collar.rotation.x = Math.PI / 2 - 0.25;
  collar.position.set(0, -4.9, 0.9);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 3, 24), skin);
  neck.position.set(0, -4.6, 0.6);
  g.add(torso, collar, neck);

  // 유리에 붙인 손
  const hands = [];
  for (const s of [-1, 1]) {
    const h = new THREE.Group();
    h.position.set(s * 4.7, 2.2, 6.42);
    h.rotation.set(0, s > 0 ? Math.PI : 0, s * -0.2);
    scene.add(h);
    hands.push(h);
    loadHand(s > 0 ? handR : handL, skin, h);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(1.25, 5, 8, 16), hood);
    sleeve.position.set(s * 5.6, -0.6, 8.4);
    sleeve.rotation.set(-0.5, 0, s * 0.25);
    scene.add(sleeve);
  }

  // 표정
  const cur = { ...EXPR.expect };
  let target = EXPR.expect, mouthKey = '';
  function buildMouth() {
    const key = cur.smile.toFixed(2) + cur.open.toFixed(2);
    if (key === mouthKey) return;
    mouthKey = key;
    const w = 1.55, sm = cur.smile, op = cur.open;
    const sh = new THREE.Shape();
    const cy = sm * 0.5;
    sh.moveTo(-w, cy);
    sh.quadraticCurveTo(0, -sm * 0.15 + 0.14, w, cy);
    sh.quadraticCurveTo(0, -sm * 0.75 - op * 2.3 - 0.2, -w, cy);
    face.mouth.geometry.dispose();
    face.mouth.geometry = new THREE.ShapeGeometry(sh, 24);
    face.tongue.visible = op > 0.3 && sm > 0.3;
    face.tongue.position.y = -2.35 - sm * 0.3 - op * 1.0;
  }
  const look = new THREE.Vector3();
  const local = new THREE.Vector3();
  return {
    group: g, hands, look,
    set(name) { target = EXPR[name]; },
    update(dt, t) {
      for (const k in cur) cur[k] = damp(cur[k], target[k], 7, dt);
      buildMouth();
      const blink = (t % 4.1) < 0.13 ? 1 : 0;
      face.lids.forEach((l) => {
        // 0: 다 뜸(반구가 위로 젖혀짐) ~ 1: 감음
        const k = clamp(cur.lid + blink, 0, 1);
        l.rotation.x = 0.9 - k * 2.3;
      });
      face.brows.forEach((b, i) => {
        const s = i ? 1 : -1;
        b.rotation.z = -s * cur.browA;
        b.position.y = 2.45 + cur.browY;
      });
      face.blush.forEach((b) => { b.material.opacity = 0.18 + cur.blush * 0.32; });
      face.sweat.visible = cur.sweat > 0.5;
      face.sweat.position.y = 2.7 - ((t * 0.5) % 1) * 0.9;
      local.copy(look); g.worldToLocal(local);
      face.pupils.forEach((p, i) => {
        const e = face.eyes[i].position;
        const dx = local.x - e.x, dy = local.y - e.y, len = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, len / 6) * 0.34;
        p.position.x = damp(p.position.x, (dx / len) * k, 10, dt);
        p.position.y = damp(p.position.y, (dy / len) * k * 1.1, 10, dt);
      });
      g.rotation.y = damp(g.rotation.y, clamp(-(look.x - g.position.x) * 0.03, -0.2, 0.2), 3, dt);
      g.rotation.x = damp(g.rotation.x, clamp((look.y - 4) * -0.015, -0.1, 0.1) + 0.06, 3, dt);
      g.position.y = FACE_HOME.y + Math.sin(t * 0.9) * 0.08;
    },
  };
}

// 실제 손 모델(WebXR generic-hand, MIT)을 손목 기준으로 세워서 넣는다
function loadHand(bytes, skin, holder) {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  new GLTFLoader().parse(buf, '', (gltf) => {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const at = (n) => root.getObjectByName(n).getWorldPosition(new THREE.Vector3());
    const wrist = at('wrist');
    const up = at('middle-finger-tip').sub(wrist);
    const len = up.length();
    const Y = up.clone().normalize();
    const X = at('index-finger-phalanx-proximal').sub(at('pinky-finger-phalanx-proximal'));
    X.addScaledVector(Y, -X.dot(Y)).normalize();
    const Z = new THREE.Vector3().crossVectors(X, Y);
    const inv = new THREE.Matrix4().makeBasis(X, Y, Z).invert();
    const fix = new THREE.Group();
    fix.quaternion.setFromRotationMatrix(inv);
    fix.position.copy(wrist).applyMatrix4(inv).multiplyScalar(-1);
    fix.add(root);
    const scaled = new THREE.Group();
    scaled.scale.setScalar(4.3 / len);
    scaled.add(fix);
    root.traverse((o) => { if (o.isMesh) { o.material = skin; o.frustumCulled = false; } });
    holder.add(scaled);
  });
}
