// 그리기: 책상, 지우개, 방향 화살표, 카메라, 디버그 표시
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GEOM } from './config.js';
import { PHASE } from './game.js';

export const PLAYER = [
  { name: '1P', color: 0x2f7fe0, css: '#2f7fe0', label: '말랑' },
  { name: '2P', color: 0xf0603f, css: '#f0603f', label: '쫀득' },
];
const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const R = (a, b) => a + rnd() * (b - a);

function woodTexture() {
  return canvasTex(1536, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#dcae74'); gr.addColorStop(0.5, '#d6a467'); gr.addColorStop(1, '#cf9a5c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // 나뭇결
    for (let i = 0; i < 260; i++) {
      const y = R(0, h), amp = R(1, 7), f = R(0.002, 0.008), ph = R(0, 6);
      g.strokeStyle = `rgba(${rnd() < 0.5 ? '120,74,30' : '245,214,160'},${R(0.04, 0.16)})`;
      g.lineWidth = R(0.6, 2.4);
      g.beginPath();
      for (let x = 0; x <= w; x += 24) { const yy = y + Math.sin(x * f + ph) * amp; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
      g.stroke();
    }
    // 옹이
    for (let i = 0; i < 3; i++) {
      const x = R(150, w - 150), y = R(120, h - 120);
      for (let r = 34; r > 3; r -= 4) { g.strokeStyle = `rgba(110,64,24,${0.05 + (34 - r) * 0.004})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, r * 1.9, r, 0.1, 0, 7); g.stroke(); }
    }
    // 연필 홈(먼 쪽 가장자리)
    g.fillStyle = 'rgba(95,58,24,0.33)'; g.beginPath(); g.roundRect(w * 0.2, 46, w * 0.6, 26, 13); g.fill();
    g.fillStyle = 'rgba(255,230,190,0.25)'; g.fillRect(w * 0.2 + 10, 68, w * 0.6 - 20, 3);
    // 흠집
    for (let i = 0; i < 70; i++) {
      const x = R(0, w), y = R(0, h), a = R(0, 6.28), l = R(8, 70);
      g.strokeStyle = `rgba(255,236,205,${R(0.08, 0.3)})`; g.lineWidth = R(0.5, 1.6);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // 연필 낙서
    g.strokeStyle = 'rgba(60,56,60,0.42)'; g.fillStyle = 'rgba(60,56,60,0.5)'; g.lineWidth = 2.2; g.lineCap = 'round';
    g.save(); g.translate(230, 760); g.rotate(-0.12);
    for (const x of [0, 40]) { g.beginPath(); g.moveTo(x + 20, -10); g.lineTo(x + 20, 110); g.stroke(); }
    for (const y of [30, 70]) { g.beginPath(); g.moveTo(-20, y); g.lineTo(100, y); g.stroke(); }
    g.beginPath(); g.arc(0, 10, 12, 0, 7); g.stroke(); g.beginPath(); g.moveTo(32, 40); g.lineTo(50, 60); g.moveTo(50, 40); g.lineTo(32, 60); g.stroke();
    g.restore();
    g.save(); g.translate(1230, 250); g.rotate(0.18); g.font = `700 44px ${FONT}`; g.fillText('3-2', 0, 0); g.restore();
    g.save(); g.translate(1180, 820); g.rotate(-0.2); g.beginPath(); g.moveTo(0, 30);
    g.bezierCurveTo(-60, -10, -30, -55, 0, -22); g.bezierCurveTo(30, -55, 60, -10, 0, 30); g.stroke(); g.restore();
    // 가장자리 닳음
    const e = g.createLinearGradient(0, 0, 0, h);
    e.addColorStop(0, 'rgba(70,40,14,0.28)'); e.addColorStop(0.06, 'rgba(70,40,14,0)'); e.addColorStop(0.94, 'rgba(70,40,14,0)'); e.addColorStop(1, 'rgba(70,40,14,0.28)');
    g.fillStyle = e; g.fillRect(0, 0, w, h);
  });
}
function sleeveTexture(pl) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = pl.css; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillRect(0, 24, w, 16); g.fillRect(0, h - 40, w, 16);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 104px ${FONT}`; g.fillText(pl.label, w / 2 + 44, h / 2 + 6);
    g.beginPath(); g.arc(92, h / 2, 54, 0, 7); g.fill();
    g.fillStyle = pl.css; g.font = `900 58px ${FONT}`; g.fillText(pl.name, 92, h / 2 + 4);
  });
}

export class View {
  constructor(container) {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    container.appendChild(r.domElement);
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcfc4b3);
    scene.fog = new THREE.Fog(0xcfc4b3, 30, 90);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);

    scene.add(new THREE.HemisphereLight(0xfff4e2, 0x8a7a6a, 1.15));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    sun.position.set(-4.5, 7.5, 3.2);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -4.2, right: 4.2, top: 3.2, bottom: -3.2, near: 1, far: 22 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.006; sun.shadow.radius = 2.5;
    scene.add(sun, sun.target);

    this._desk(); this._room();
    this.erasers = PLAYER.map((pl, i) => this._eraser(pl, i));
    // 방향 화살표와 차례 표시
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.035); sh.lineTo(0.62, -0.035); sh.lineTo(0.62, -0.1); sh.lineTo(0.84, 0); sh.lineTo(0.62, 0.1); sh.lineTo(0.62, 0.035); sh.lineTo(0, 0.035); sh.closePath();
    this.arrow = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    this.arrow.rotation.x = -Math.PI / 2;
    this.arrowPivot = new THREE.Group(); this.arrowPivot.add(this.arrow); scene.add(this.arrowPivot);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.4, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; scene.add(this.ring);
    // 디버그: 충돌체 윤곽과 접촉 법선
    this.debug = false;
    this.wires = this.erasers.map(() => {
      const w = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(GEOM.hx * 2, GEOM.hy * 2, GEOM.hz * 2)), new THREE.LineBasicMaterial({ color: 0x00ff88, depthTest: false }));
      w.visible = false; w.renderOrder = 30; scene.add(w); return w;
    });
    this.normalArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.5, 0xff00aa);
    this.normalArrow.visible = false; scene.add(this.normalArrow);

    this.cam = { az: Math.PI, pos: new THREE.Vector3(-3, 2, 0), look: new THREE.Vector3(), init: false };
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // 세로로 긴 화면에서도 책상 폭이 들어오도록 시야각을 넓힌다
    this.camera.fov = w / h < 1 ? 62 : w / h < 1.4 ? 50 : 42;
    this.camera.updateProjectionMatrix();
  }

  _desk() {
    const D = GEOM.desk, s = this.scene;
    const wood = woodTexture();
    const side = new THREE.MeshStandardMaterial({ color: 0xc08d52, roughness: 0.65 });
    const topMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 });
    const top = new THREE.Mesh(new RoundedBoxGeometry(D.hx * 2, D.thick, D.hz * 2, 3, 0.04), [side, side, topMat, side, side, side]);
    top.position.y = -D.thick / 2; top.receiveShadow = true; top.castShadow = true;
    s.add(top);
    const metal = new THREE.MeshStandardMaterial({ color: 0x6f7780, roughness: 0.4, metalness: 0.7 });
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, -GEOM.floorY, 12), metal);
      leg.position.set(x * (D.hx - 0.3), GEOM.floorY / 2 - D.thick, z * (D.hz - 0.3));
      s.add(leg);
    }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(D.hx * 2 - 0.5, 0.06, D.hz * 2 - 0.5), metal);
    shelf.position.y = -1.3; s.add(shelf);
  }
  _room() {
    const s = this.scene;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0xa98a63, roughness: 0.75 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = GEOM.floorY; floor.receiveShadow = true; s.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(160, 60), new THREE.MeshStandardMaterial({ color: 0xe9e2d2, roughness: 0.9 }));
    wall.position.set(0, 14, -34); s.add(wall);
    const board = new THREE.Mesh(new THREE.BoxGeometry(34, 11, 0.4), new THREE.MeshStandardMaterial({ color: 0x2f5a46, roughness: 0.85 }));
    board.position.set(0, 9, -33.6);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(35.2, 12.2, 0.3), new THREE.MeshStandardMaterial({ color: 0xb98a55, roughness: 0.7 }));
    frame.position.set(0, 9, -33.8); s.add(frame, board);
    // 다른 책상과 의자: 단순한 덩어리로만
    const dMat = new THREE.MeshStandardMaterial({ color: 0xc99a5e, roughness: 0.7 }), cMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.8 });
    for (let ix = -2; ix <= 2; ix++) for (let iz = -2; iz <= 1; iz++) {
      if (ix === 0 && iz === 0) continue;
      const d = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 4), dMat);
      d.position.set(ix * 11, -0.125, iz * 9.5);
      const c = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 3.2), cMat);      // 의자 앉는 판만
      c.position.set(ix * 11, -2.6, iz * 9.5 + 3.6);
      s.add(d, c);
    }
  }
  _eraser(pl, i) {
    const g = new THREE.Group();
    const rubber = new THREE.Mesh(new RoundedBoxGeometry(GEOM.hx * 2, GEOM.hy * 2, GEOM.hz * 2, 4, 0.02),
      new THREE.MeshStandardMaterial({ color: i ? 0xfbefe6 : 0xf3f5f8, roughness: 0.82 }));
    const tex = sleeveTexture(pl);
    const paper = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), plain = new THREE.MeshStandardMaterial({ color: pl.color, roughness: 0.7 });
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(GEOM.hx * 2 * 0.62, GEOM.hy * 2 + 0.006, GEOM.hz * 2 + 0.006), [plain, plain, paper, paper, plain, plain]);
    sleeve.position.x = -GEOM.hx * 0.2;
    rubber.castShadow = sleeve.castShadow = true; rubber.receiveShadow = sleeve.receiveShadow = true;
    g.add(rubber, sleeve);
    this.scene.add(g);
    return g;
  }

  // 화면 갱신. bodies는 보간된 자세 목록.
  update(game, bodies, dt) {
    bodies.forEach((b, i) => {
      this.erasers[i].position.set(b.p[0], b.p[1], b.p[2]);
      this.erasers[i].quaternion.set(b.q.x, b.q.y, b.q.z, b.q.w);
      this.wires[i].visible = this.debug;
      this.wires[i].position.copy(this.erasers[i].position); this.wires[i].quaternion.copy(this.erasers[i].quaternion);
    });
    const me = bodies[game.player], aiming = game.phase === PHASE.AIM || game.phase === PHASE.POWER;
    const onDesk = me.p[1] > -0.2;
    this.arrowPivot.visible = this.ring.visible = aiming && onDesk;
    if (aiming) {
      const col = PLAYER[game.player].color;
      this.arrow.material.color.setHex(col); this.ring.material.color.setHex(col);
      this.arrowPivot.position.set(me.p[0], 0.006, me.p[2]);
      this.arrowPivot.rotation.y = -game.aim[game.player];
      const k = game.phase === PHASE.POWER ? 0.45 + game.gauge.value * 1.25 : 1;
      this.arrow.scale.set(k, 1, 1);
      this.ring.position.set(me.p[0], 0.005, me.p[2]);
    }
    this.normalArrow.visible = this.debug && game.info.touching;
    if (this.normalArrow.visible) this.normalArrow.position.set((bodies[0].p[0] + bodies[1].p[0]) / 2, Math.max(bodies[0].p[1], bodies[1].p[1]), (bodies[0].p[2] + bodies[1].p[2]) / 2);
    this._camera(game, bodies, dt);
    this.renderer.render(this.scene, this.camera);
  }
  _camera(game, bodies, dt) {
    const C = this.cam, me = bodies[game.player], op = bodies[1 - game.player];
    const on = (b) => b.p[1] > GEOM.fallY;
    // 시점 방향: 현재 플레이어 뒤에서 상대 쪽을 본다. 발사 뒤에는 방향을 바꾸지 않는다.
    if (game.phase === PHASE.AIM && on(me) && on(op)) {
      const want = Math.atan2(op.p[2] - me.p[2], op.p[0] - me.p[0]);
      let d = ((want - C.az + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      C.az += d * (C.init ? 1 - Math.exp(-3.2 * dt) : 1);
    }
    const pts = [me, op].filter(on);
    const cx = pts.length ? pts.reduce((s, b) => s + b.p[0], 0) / pts.length : 0, cz = pts.length ? pts.reduce((s, b) => s + b.p[2], 0) / pts.length : 0;
    const spread = pts.length === 2 ? Math.hypot(me.p[0] - op.p[0], me.p[2] - op.p[2]) : 1.5;
    const aiming = game.phase === PHASE.AIM || game.phase === PHASE.POWER;
    const narrow = this.camera.aspect < 1 ? 1.35 : 1;
    const dist = (aiming ? 2.3 + spread * 0.55 : 2.8 + spread * 0.75) * narrow;
    const fx = Math.cos(C.az), fz = Math.sin(C.az);
    const focus = aiming && on(me) ? [me.p[0] * 0.55 + cx * 0.45, me.p[2] * 0.55 + cz * 0.45] : [cx, cz];
    const wantPos = new THREE.Vector3(focus[0] - fx * dist, 0.9 + dist * 0.5, focus[1] - fz * dist);
    const wantLook = new THREE.Vector3(focus[0] + fx * 0.35, 0.05, focus[1] + fz * 0.35);
    const k = C.init ? 1 - Math.exp(-(aiming ? 3.5 : 2.2) * dt) : 1;
    C.pos.lerp(wantPos, k); C.look.lerp(wantLook, k); C.init = true;
    this.camera.position.copy(C.pos); this.camera.lookAt(C.look);
  }
  resetCamera() { this.cam.init = false; }
}
