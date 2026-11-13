import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { fabric, plastic, chrome, glow, toon } from './materials.js';
import { canvasTex, roundRect, rand, FONT } from './util.js';

// 기계 안: x,z는 -6~6, 바닥 y=0. 출구 구멍은 x[-6,-3] z[3,6]. 정면 유리는 z=+6.
export const HALF = 6;
export const CHUTE = { x0: -6, x1: -3, z0: 3, z1: 6, cx: -4.5, cz: 4.5 };
export const RAIL_Y = 12.9;
const PINK = 0xff7b6b;   // 코랄
const MINT = 0x7fdcc8, CREAM = 0xfff3dc, YEL = 0xffd24a;

export function buildMachine(scene) {
  const m = new THREE.Group();
  scene.add(m);
  const add = (geo, mat, x, y, z, o = {}) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = o.receive ?? true;
    mesh.castShadow = o.cast ?? false;
    m.add(mesh);
    return mesh;
  };

  // 바닥 (벨벳), 구멍 뚫린 모양
  const carpet = toon(0xbdeee2);
  add(new THREE.BoxGeometry(9, 1, 12), carpet, 1.5, -0.5, 0);
  add(new THREE.BoxGeometry(3, 1, 9), carpet, -4.5, -0.5, -1.5);
  const tube = add(new THREE.BoxGeometry(3, 8, 3), toon(0x4a3a6a, { side: THREE.BackSide }), CHUTE.cx, -4, CHUTE.cz);
  tube.receiveShadow = false;
  // 출구 칸막이 (아크릴)
  const acr = new THREE.MeshBasicMaterial({ color: 0xbff3ff, transparent: true, opacity: 0.3, depthWrite: false });
  add(new THREE.BoxGeometry(0.12, 1.5, 3), acr, -3, 0.75, 4.5).userData.glass = true;
  add(new THREE.BoxGeometry(3, 1.5, 0.12), acr, -4.5, 0.75, 3).userData.glass = true;
  const edge = plastic(YEL);
  add(new RoundedBoxGeometry(0.22, 0.16, 3.1, 2, 0.06), edge, -3, 1.55, 4.5);
  add(new RoundedBoxGeometry(3.1, 0.16, 0.22, 2, 0.06), edge, -4.5, 1.55, 3);
  const sign = add(new THREE.PlaneGeometry(1.6, 0.55), new THREE.MeshBasicMaterial({
    transparent: true,
    map: canvasTex(256, 88, (g, w, h) => {
      roundRect(g, 4, 4, w - 8, h - 8, 30); g.fillStyle = '#ffd95a'; g.fill();
      g.fillStyle = '#4a3350'; g.font = `900 52px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('출구', w / 2, h / 2 + 3);
    }),
  }), -4.5, 1.05, 2.92);
  sign.rotation.y = Math.PI;

  // 뒷판
  const backTex = canvasTex(1024, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#fff0d0'); gr.addColorStop(1, '#ffe2c0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,170,120,0.28)';
    for (let y = 30; y < h; y += 84) for (let x = (y / 84) % 2 ? 72 : 30; x < w; x += 84) { g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); }
    g.save(); g.translate(w / 2, 270);
    roundRect(g, -330, -112, 660, 224, 112); g.fillStyle = '#fff8ee'; g.fill();
    g.fillStyle = '#ff6b5a'; g.font = `900 122px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('말랑 캐치', 0, -10);
    g.fillStyle = '#35b79c'; g.font = `800 34px ${FONT}`; g.fillText('MALLANG CATCH', 0, 76);
    g.restore();
    // 스티커
    const star = (x, y, r, c, rot) => {
      g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = '#fff'; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = (i % 2 ? r * 0.5 : r) + 9; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.fillStyle = c; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.5 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.restore();
    };
    const heart = (x, y, s, c, rot) => {
      g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
      for (const [col, k] of [['#fff', 1.22], [c, 1]]) {
        g.fillStyle = col; g.save(); g.scale(k, k); g.beginPath(); g.moveTo(0, 30);
        g.bezierCurveTo(-60, -10, -30, -55, 0, -22); g.bezierCurveTo(30, -55, 60, -10, 0, 30); g.fill(); g.restore();
      }
      g.restore();
    };
    star(150, 520, 58, '#ffd24a', -0.2); star(880, 600, 46, '#7fdcc8', 0.3); star(700, 470, 30, '#ff7b6b', 0.1);
    heart(330, 640, 1.5, '#ff7b6b', 0.2); heart(560, 560, 1.0, '#ffd24a', -0.25); heart(930, 420, 1.1, '#ff9fc0', -0.1);
  });
  add(new THREE.PlaneGeometry(12, 14), toon(0xffffff, { map: backTex }), 0, 7, -HALF);

  // 기둥, 테두리, 지붕
  const post = plastic(MINT);
  for (const x of [-HALF, HALF]) for (const z of [-HALF, HALF]) add(new RoundedBoxGeometry(0.95, 16, 0.95, 3, 0.28), post, x, 6, z, { cast: false });
  const trim = plastic(PINK);
  for (const [w, d, x, z] of [[12.4, 0.5, 0, -HALF], [12.4, 0.5, 0, HALF], [0.5, 12.4, -HALF, 0], [0.5, 12.4, HALF, 0]])
    add(new RoundedBoxGeometry(w, 0.5, d, 2, 0.15), trim, x, 0.1, z);
  add(new RoundedBoxGeometry(13.6, 1.6, 13.6, 4, 0.4), plastic(MINT), 0, 14.6, 0, { receive: false });
  // 천장 조명판 + 전구
  add(new THREE.BoxGeometry(10.5, 0.1, 10.5), glow(0xfff6e0, 1.0), 0, 13.75, 0, { receive: false });
  const bulbs = [];
  const bulbGeo = new THREE.SphereGeometry(0.15, 12, 8);
  for (let i = 0; i < 48; i++) {
    const side = Math.floor(i / 12), t = (i % 12) / 12 - 0.5 + 1 / 24;
    const [x, z] = side === 0 ? [t * 11.4, -5.6] : side === 1 ? [5.6, t * 11.4] : side === 2 ? [-t * 11.4, 5.6] : [-5.6, -t * 11.4];
    const b = add(bulbGeo, glow(YEL, 1.5), x, 13.6, z, { receive: false });
    bulbs.push(b);
  }

  // 유리
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xd8f6ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
  const smudge = (front) => canvasTex(1024, 1024, (g, w, h) => {
    const streak = (x, wd, a) => {
      g.save(); g.translate(x, 0); g.rotate(-0.42);
      const gr = g.createLinearGradient(0, 0, wd, 0);
      gr.addColorStop(0, 'rgba(255,240,220,0)'); gr.addColorStop(0.5, `rgba(255,240,220,${a})`); gr.addColorStop(1, 'rgba(255,240,220,0)');
      g.fillStyle = gr; g.fillRect(0, -400, wd, 2200); g.restore();
    };
    streak(130, 170, 0.1); streak(340, 46, 0.08); streak(730, 120, 0.07);
    // 천장 전구가 유리에 비친 점들
    for (let i = 0; i < 12; i++) {
      const x = 60 + i * 82, y = 46;
      const gr = g.createRadialGradient(x, y, 0, x, y, 26);
      gr.addColorStop(0, 'rgba(255,225,170,0.55)'); gr.addColorStop(1, 'rgba(255,225,170,0)');
      g.fillStyle = gr; g.fillRect(x - 26, y - 26, 52, 52);
    }
    for (let i = 0; i < (front ? 8 : 4); i++) {
      g.save(); g.translate(rand(150, 870), rand(430, 900)); g.rotate(rand(-1, 1));
      g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 2;
      for (let r = 4; r < 26; r += 4) { g.beginPath(); g.ellipse(0, 0, r, r * 1.3, 0, 0, 7); g.stroke(); }
      g.restore();
    }
    if (front) {
      // 입김
      const gr = g.createRadialGradient(512, 700, 20, 512, 700, 210);
      gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(280, 480, 470, 440);
      // 안에서 보면 뒤집혀 보이는 스티커
      g.save(); g.translate(800, 150); g.rotate(0.07);
      roundRect(g, -150, -56, 300, 112, 40); g.fillStyle = 'rgba(255, 221, 110, 0.92)'; g.fill();
      g.fillStyle = '#d9457a'; g.font = `900 46px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('한정판 입고!', 0, -12);
      g.fillStyle = '#5d4763'; g.font = `800 26px ${FONT}`; g.fillText('1회 500원', 0, 30);
      g.restore();
    }
  });
  const panes = [[0, HALF, 0, true], [HALF, 0, Math.PI / 2, false], [-HALF, 0, -Math.PI / 2, false]];
  for (const [x, z, ry, front] of panes) {
    const p = add(new THREE.PlaneGeometry(12, 14), glassMat, x, 7, z, { receive: false });
    p.rotation.y = ry; p.userData.glass = true; p.renderOrder = 5;
    const s = add(new THREE.PlaneGeometry(12, 14), new THREE.MeshBasicMaterial({ map: smudge(front), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), x * 0.998, 7, z * 0.998, { receive: false });
    s.rotation.y = ry; s.userData.glass = true; s.renderOrder = 6;
  }

  // 집게 레일
  const metal = chrome();
  for (const x of [-5.4, 5.4]) add(new THREE.CylinderGeometry(0.12, 0.12, 12, 12), metal, x, RAIL_Y, 0, { cast: false }).rotation.x = Math.PI / 2;
  const crossBar = add(new THREE.CylinderGeometry(0.12, 0.12, 11, 12), metal, 0, RAIL_Y, 0);
  crossBar.rotation.z = Math.PI / 2;
  const carriage = add(new RoundedBoxGeometry(1.1, 0.6, 1.1, 3, 0.16), plastic(PINK), 0, RAIL_Y, 0);
  const cable = add(new THREE.CylinderGeometry(0.045, 0.045, 1, 8), toon(0x5a5670), 0, 0, 0);

  // 집게
  const claw = new THREE.Group();
  m.add(claw);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.66, 0.8, 24), plastic(YEL));
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.52, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), plastic(PINK));
  capTop.position.y = 0.36;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.12, 10, 28), plastic(PINK));
  ring.rotation.x = Math.PI / 2; ring.position.y = -0.3;
  hub.castShadow = capTop.castShadow = true;
  claw.add(hub, capTop, ring);
  const prongs = [];
  for (let i = 0; i < 3; i++) {
    const yaw = new THREE.Group();
    yaw.rotation.y = (i / 3) * Math.PI * 2;
    yaw.position.y = -0.32;
    const pivot = new THREE.Group();
    pivot.position.z = 0.46;
    const upper = new THREE.Mesh(new RoundedBoxGeometry(0.34, 1.1, 0.24, 3, 0.1), metal);
    upper.position.y = -0.5;
    const elbow = new THREE.Group();
    elbow.position.y = -1.0; elbow.rotation.x = -0.75;
    const lower = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.8, 0.22, 3, 0.1), metal);
    lower.position.y = -0.33;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), plastic(PINK));
    tip.position.y = -0.7;
    elbow.add(lower, tip); pivot.add(upper, elbow); yaw.add(pivot); claw.add(yaw);
    upper.castShadow = lower.castShadow = tip.castShadow = true;
    prongs.push(pivot);
  }

  buildArcade(scene);
  return { group: m, claw, prongs, cable, carriage, crossBar, bulbs };
}

// ---------- 유리 밖: 밤의 인형뽑기장. 흰 기계가 통로 양쪽으로 늘어서 있고, 우리는 그중 한 대 안에 있다 ----------
const WHITE = toon(0xe6e3f0);
const DARK = toon(0x3a3550);
const THEMES = [
  { name: '말랑 캐치', bg: '#ffd6e6', fg: '#e8457c', plush: [0x7fb4ff, 0x5a8fe8, 0xb6d4ff, 0xf7f0ff] },
  { name: 'PRIZE', bg: '#fff0b8', fg: '#e08a1c', plush: [0xffd84a, 0xffe98a, 0xf2b63c, 0xfff6d0] },
  { name: '인형뽑기', bg: '#d8f3ff', fg: '#2f8fd0', plush: [0xff8fb8, 0xffc4dc, 0xf06f9f, 0xfff0f5] },
  { name: 'LUCKY', bg: '#e2dcff', fg: '#7a5ad8', plush: [0x8fd88a, 0xc6efb0, 0x5fb873, 0xf3ffe6] },
  { name: '뽑기왕', bg: '#d9ffe9', fg: '#2fa56f', plush: [0xff9a5a, 0xffc79a, 0xe8743a, 0xfff0e0] },
  { name: 'CATCH!', bg: '#ffe0d2', fg: '#e8603a', plush: [0xc79aff, 0xe4ccff, 0x9a6be8, 0xf8f0ff] },
];
// 위는 밝고 아래는 어두운 공: 조명 없이도 봉제인형 더미처럼 보인다
const plushGeo = (() => {
  const g = new THREE.SphereGeometry(1, 14, 10);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const k = 0.5 + 0.5 * (g.attributes.position.getY(i) * 0.5 + 0.5); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
})();

function cabinet(theme) {
  const g = new THREE.Group();
  const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  put(new RoundedBoxGeometry(13.4, 7, 13.4, 3, 0.35), WHITE, 0, -3.6, 0);
  put(new RoundedBoxGeometry(13.4, 1.4, 13.4, 3, 0.35), WHITE, 0, 14.5, 0);
  for (const x of [-HALF, HALF]) for (const z of [-HALF, HALF]) put(new RoundedBoxGeometry(0.7, 15, 0.7, 2, 0.2), WHITE, x, 6.6, z);
  // 기둥의 LED 띠
  for (const x of [-5.55, 5.55]) put(new THREE.BoxGeometry(0.14, 13.4, 0.14), glow(0xffffff, 1.3), x, 7, 6.2);
  // 안쪽: 밝은 뒷판과 천장등, 인형 더미
  put(new THREE.PlaneGeometry(12, 14), glow(theme.bg, 0.8), 0, 7, -5.9);
  put(new THREE.PlaneGeometry(12, 12), glow(0xf2e9dc, 0.8), 0, 0.02, 0).rotation.x = -Math.PI / 2;
  put(new THREE.BoxGeometry(10.5, 0.1, 10.5), glow(0xffffff, 1.1), 0, 13.7, 0);
  const N = 46;
  const inst = new THREE.InstancedMesh(plushGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const x = rand(-4.8, 4.8), z = rand(-4.8, 4.8), r = rand(0.95, 1.35);
    const y = r * 0.8 + rand(0, 1) * (2.6 - Math.hypot(x, z) * 0.3);
    m4.compose(new THREE.Vector3(x, Math.max(r * 0.8, y), z), q, new THREE.Vector3(r, r * 0.9, r));
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, col.set(theme.plush[i % theme.plush.length]).multiplyScalar(0.82));
  }
  g.add(inst);
  put(new THREE.PlaneGeometry(12, 14), new THREE.MeshBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.07, depthWrite: false }), 0, 7, 6.02);
  // 간판
  const tex = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = theme.bg; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    for (let x = 20; x < w; x += 46) { c.beginPath(); c.arc(x, 18, 7, 0, 7); c.fill(); c.beginPath(); c.arc(x + 23, h - 18, 7, 0, 7); c.fill(); }
    c.fillStyle = theme.fg; c.font = `900 66px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(theme.name, w / 2, h / 2 + 4);
  });
  put(new THREE.BoxGeometry(13.4, 2.8, 0.5), WHITE, 0, 16.4, 6.45);
  put(new THREE.PlaneGeometry(12.6, 2.3), new THREE.MeshBasicMaterial({ map: tex }), 0, 16.4, 6.72);
  // 조작대, 상품 출구, 동전 투입구
  put(new RoundedBoxGeometry(8.6, 1.0, 2.4, 2, 0.3), WHITE, 1.6, -1.2, 7.4);
  put(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 8), DARK, 0.2, -0.35, 7.6);
  put(new THREE.SphereGeometry(0.3, 12, 10), plastic(0xe23b4e), 0.2, 0.2, 7.6);
  put(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 16), glow(0xffd84a, 1.6), 2.6, -0.62, 7.6);
  put(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 16), glow(0x5fd0ff, 1.6), 3.9, -0.62, 7.6);
  put(new RoundedBoxGeometry(3.8, 2.9, 0.2, 2, 0.08), DARK, -3.7, -4.7, 6.72);
  put(new RoundedBoxGeometry(2.2, 3.2, 0.2, 2, 0.08), DARK, 3.6, -4.3, 6.72);
  put(new THREE.BoxGeometry(1.2, 0.25, 0.1), glow(0xff5a6a, 2), 3.6, -3.3, 6.85);
  return g;
}

function buildArcade(scene) {
  const out = new THREE.Group();
  scene.add(out);
  // 나무 바닥
  const wood = canvasTex(512, 512, (g, w, h) => {
    for (let y = 0; y < h; y += 64) {
      for (let x = -((y / 64) % 2) * 128; x < w; x += 256) {
        const v = 120 + Math.floor(rand(0, 22));
        g.fillStyle = `rgb(${v + 46},${v + 8},${v - 40})`; g.fillRect(x, y, 256, 64);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y, 256, 2); g.fillRect(x, y, 2, 64);
        g.strokeStyle = 'rgba(60,40,20,0.12)';
        for (let k = 0; k < 5; k++) { g.beginPath(); const yy = y + rand(6, 58); g.moveTo(x, yy); g.bezierCurveTo(x + 80, yy + rand(-5, 5), x + 170, yy + rand(-5, 5), x + 256, yy); g.stroke(); }
      }
    }
  });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(14, 14);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), toon(0xffffff, { map: wood }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -7, 20);
  out.add(floor);
  // 어두운 벽돌 벽과 천장
  const brick = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2a2748'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) for (let x = -((y / 32) % 2) * 48; x < w; x += 96) {
      const v = 52 + Math.floor(rand(0, 14));
      g.fillStyle = `rgb(${v},${v + 2},${v + 34})`; g.fillRect(x + 2, y + 2, 92, 28);
    }
  });
  brick.wrapS = brick.wrapT = THREE.RepeatWrapping; brick.repeat.set(8, 3);
  const wallMat = toon(0xffffff, { map: brick });
  const wall = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 34), wallMat); m.position.set(x, 10, z); m.rotation.y = ry; out.add(m); };
  wall(140, 0, 46, Math.PI); wall(140, 0, -8.5, 0); wall(70, -56, 20, Math.PI / 2); wall(70, 56, 20, -Math.PI / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(140, 70), toon(0x35325a));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 26, 20);
  out.add(ceil);
  for (let i = -3; i <= 3; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.6), glow(0xffffff, 1.3));
    p.rotation.x = Math.PI / 2; p.position.set(i * 15, 25.9, 19);
    out.add(p);
  }
  // 우리 기계의 아랫몸통
  const base = new THREE.Mesh(new RoundedBoxGeometry(13.4, 7, 13.4, 3, 0.35), WHITE);
  base.position.y = -3.6;
  out.add(base);
  // 같은 줄의 옆 기계들, 통로 건너편 줄
  let k = 0;
  for (const i of [-3, -2, -1, 1, 2, 3]) { const c = cabinet(THEMES[k++ % THEMES.length]); c.position.set(i * 13.6, 0, 0); out.add(c); }
  for (let i = -3; i <= 3; i++) { const c = cabinet(THEMES[(k++ + 2) % THEMES.length]); c.position.set(i * 13.6, 0, 38.5); c.rotation.y = Math.PI; out.add(c); }
  // 통로 끝의 동전교환기
  const kiosk = new THREE.Mesh(new RoundedBoxGeometry(5, 14, 4, 2, 0.3), WHITE);
  kiosk.position.set(53, 0, 19);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.2), glow(0x6fd0ff, 1.4));
  screen.position.set(50.4, 3, 19); screen.rotation.y = -Math.PI / 2;
  out.add(kiosk, screen);
}
