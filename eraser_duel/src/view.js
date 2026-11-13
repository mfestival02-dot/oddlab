// 그리기: 책상, 지우개, 방향 화살표, 카메라, 디버그 표시
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { GEOM, TYPES, shapeOf } from './config.js';
import { Fx } from './fx.js';
import { PHASE } from './game.js';

export const PLAYER = [
  { name: '1P', color: 0x2f7fe0, css: '#2f7fe0', rubber: 0xf3f5f8 },
  { name: '2P', color: 0xf0603f, css: '#f0603f', rubber: 0xfbefe6 },
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
function sleeveTexture(pl, label) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = pl.css; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillRect(0, 24, w, 16); g.fillRect(0, h - 40, w, 16);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 104px ${FONT}`; g.fillText(label, w / 2 + 44, h / 2 + 6);
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
    // 교실은 따로 작게 그려 흐릿한 배경으로 쓴다: 무대(책상)만 또렷하게 보이게
    this.bg = new THREE.Scene(); this.bg.background = new THREE.Color(0xe9dfca);
    this.bg.add(new THREE.HemisphereLight(0xfff4e2, 0x9a8a78, 1.25));
    const bgSun = new THREE.DirectionalLight(0xfff1d6, 1.6); bgSun.position.set(-30, 30, 8); this.bg.add(bgSun);
    // 두 번 줄여 그린 뒤 부드럽게 늘린다(작게 그린 그림을 한 번 더 절반으로 줄여 계단 무늬를 없앤다)
    const rt = () => { const t = new THREE.WebGLRenderTarget(64, 36, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); t.texture.colorSpace = THREE.SRGBColorSpace; return t; };
    this.bgRT0 = rt(); this.bgRT = rt();
    this.blurScene = new THREE.Scene(); this.blurCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.blurMat = new THREE.ShaderMaterial({ uniforms: { map: { value: this.bgRT0.texture }, px: { value: new THREE.Vector2(1 / 64, 1 / 36) } }, depthTest: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D map; uniform vec2 px; varying vec2 vUv; void main(){ vec4 c = vec4(0.0); for (int x = -2; x <= 2; x++) for (int y = -2; y <= 2; y++) c += texture2D(map, vUv + vec2(float(x), float(y)) * px * 1.5); gl_FragColor = c / 25.0; }' });
    this.blurScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurMat));
    scene.background = this.bgRT.texture; scene.backgroundIntensity = 0.78;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 260);

    scene.add(new THREE.HemisphereLight(0xfff4e2, 0x8a7a6a, 1.15));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    sun.position.set(-4.5, 7.5, 3.2);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -4.2, right: 4.2, top: 3.2, bottom: -3.2, near: 1, far: 22 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.006; sun.shadow.radius = 2.5;
    scene.add(sun, sun.target);

    this._desk(); this._room();
    this.erasers = []; this.wires = [];
    this.fx = new Fx(scene);
    this.squash = [{ s: 0, v: 0 }, { s: 0, v: 0 }];
    this.hop = null;                         // 이긴 지우개가 폴짝거린다
    this.cine = { zoom: 0, zoomT: 0, trauma: 0, pulse: 0, fall: null, time: 0 };
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
    this.normalArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.5, 0xff00aa);
    this.normalArrow.visible = false; scene.add(this.normalArrow);

    this.cam = { az: Math.PI, pos: new THREE.Vector3(-3, 2, 0), look: new THREE.Vector3(), init: false };
    this.setTypes(['normal', 'normal']);
    // 책상 위 공책 한 장(납작해서 지우개가 그 위를 지나가도 자연스럽다)
    const paperTex = canvasTex(256, 340, (g, w, h) => { g.fillStyle = '#fbf6e4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b9d3ea'; g.lineWidth = 1.5; for (let y = 34; y < h; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.strokeStyle = '#ef9d98'; g.beginPath(); g.moveTo(30, 0); g.lineTo(30, h); g.stroke(); g.fillStyle = 'rgba(60,56,60,0.75)'; g.font = `700 20px ${FONT}`; g.fillText('오늘의 대진표', 44, 28); g.font = `400 16px ${FONT}`; ['1교시 끝: 나 vs 짝꿍', '2교시 끝: 이긴 사람', '점심: 결승!'].forEach((t, i) => g.fillText(t, 44, 54 + i * 22)); });
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.0), new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.9 }));
    paper.rotation.set(-Math.PI / 2, 0, 0.35); paper.position.set(2.05, 0.004, -0.95); paper.receiveShadow = true; scene.add(paper);
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // 세로로 긴 화면에서도 책상 폭이 들어오도록 시야각을 넓힌다
    this.baseFov = w / h < 1 ? 62 : w / h < 1.4 ? 50 : 42;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.fx.setScale(h * this.renderer.getPixelRatio() / (2 * Math.tan((this.baseFov * Math.PI) / 360)));
    const bw = Math.max(64, Math.round(w / 5)), bh = Math.max(36, Math.round(h / 5));          // 5분의 1 크기로 그려 흐린 뒤 늘리면 초점이 나간 듯 보인다
    this.bgRT0.setSize(bw, bh); this.bgRT.setSize(bw, bh); this.blurMat.uniforms.px.value.set(1 / bw, 1 / bh);
  }

  _desk() {
    const D = GEOM.desk, s = this.scene;
    const wood = woodTexture();
    const side = new THREE.MeshStandardMaterial({ color: 0xc08d52, roughness: 0.65 });
    const top = new THREE.Mesh(new RoundedBoxGeometry(D.hx * 2, D.thick, D.hz * 2, 3, 0.04), side);
    top.position.y = -D.thick / 2; top.receiveShadow = true; top.castShadow = true;
    // 윗면 그림은 따로 얹어서 낙서와 연필 홈의 위치가 정확히 맞게 한다(그림 위쪽이 -z)
    const face = new THREE.Mesh(new THREE.PlaneGeometry(D.hx * 2 - 0.07, D.hz * 2 - 0.07), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 }));
    face.rotation.x = -Math.PI / 2; face.position.y = 0.0012; face.receiveShadow = true;
    s.add(top, face);
    const metal = new THREE.MeshStandardMaterial({ color: 0x6f7780, roughness: 0.4, metalness: 0.7 });
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, -GEOM.floorY, 12), metal);
      leg.position.set(x * (D.hx - 0.3), GEOM.floorY / 2 - D.thick, z * (D.hz - 0.3));
      s.add(leg);
    }
    // 연필 홈에 놓인 연필(장식, 충돌 없음)
    const pen = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5 }));
    const tipWood = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.13, 6), new THREE.MeshStandardMaterial({ color: 0xe6c79c, roughness: 0.7 }));
    tipWood.position.y = 0.815;
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.045, 6), new THREE.MeshStandardMaterial({ color: 0x33302e, roughness: 0.4 }));
    lead.position.y = 0.862;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.3, metalness: 0.8 }));
    band.position.y = -0.79;
    const rub = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0xf09aa2, roughness: 0.8 }));
    rub.position.y = -0.88;
    pen.add(body, tipWood, lead, band, rub);
    pen.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    pen.rotation.set(0, 0.04, Math.PI / 2); pen.position.set(0.5, 0.024, -D.hz + (59 / 1024) * D.hz * 2);
    s.add(pen);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(D.hx * 2 - 0.5, 0.06, D.hz * 2 - 0.5), metal);
    shelf.position.y = -1.3; s.add(shelf);
  }
  // 교실: 우리 책상은 한가운데 줄에 있다. 칠판은 -z 쪽, 창문은 -x 쪽.
  _room() {
    const s = this.bg, F = GEOM.floorY, std = (color, rough = 0.8) => new THREE.MeshStandardMaterial({ color, roughness: rough });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); s.add(m); return m; };
    const W = 46, ZF = -44, ZB = 40, H = 30;                       // 반폭, 앞벽, 뒷벽, 천장 높이(바닥 기준)
    // 바닥(나무 마루)
    const floorTex = canvasTex(512, 512, (g, w, h) => {
      for (let y = 0; y < h; y += 64) for (let x = -((y / 64) % 2) * 128; x < w; x += 256) {
        const v = 150 + Math.floor(R(0, 24)); g.fillStyle = `rgb(${v + 28},${v - 6},${v - 58})`; g.fillRect(x, y, 256, 64);
        g.fillStyle = 'rgba(60,35,10,0.35)'; g.fillRect(x, y, 256, 2); g.fillRect(x, y, 2, 64);
      }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(9, 8);
    const floor = add(new THREE.PlaneGeometry(W * 2, ZB - ZF), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 }), 0, F, (ZF + ZB) / 2);
    floor.rotation.x = -Math.PI / 2;
    // 벽과 천장
    const wall = std(0xf1ead9, 0.95), dado = std(0xc9d8c2, 0.9);
    add(new THREE.PlaneGeometry(W * 2, H), wall, 0, F + H / 2, ZF);
    add(new THREE.PlaneGeometry(W * 2, H), wall, 0, F + H / 2, ZB).rotation.y = Math.PI;
    add(new THREE.PlaneGeometry(ZB - ZF, H), wall, W, F + H / 2, (ZF + ZB) / 2).rotation.y = -Math.PI / 2;
    add(new THREE.PlaneGeometry(ZB - ZF, H), wall, -W, F + H / 2, (ZF + ZB) / 2).rotation.y = Math.PI / 2;
    add(new THREE.PlaneGeometry(W * 2, 8), dado, 0, F + 4, ZF + 0.05);
    add(new THREE.PlaneGeometry(ZB - ZF, 8), dado, W - 0.05, F + 4, (ZF + ZB) / 2).rotation.y = -Math.PI / 2;
    add(new THREE.PlaneGeometry(ZB - ZF, 8), dado, -W + 0.05, F + 4, (ZF + ZB) / 2).rotation.y = Math.PI / 2;
    add(new THREE.PlaneGeometry(W * 2, ZB - ZF), std(0xf6f2e8, 1), 0, F + H, (ZF + ZB) / 2).rotation.x = Math.PI / 2;
    for (const x of [-22, 0, 22]) for (const z of [-24, -2, 20]) add(new THREE.BoxGeometry(12, 0.3, 2.2), new THREE.MeshBasicMaterial({ color: 0xfffbea }), x, F + H - 0.2, z);   // 형광등
    // 칠판, 분필 받침, 교탁, 시계
    const boardTex = canvasTex(1024, 320, (g, w, h) => {
      g.fillStyle = '#2f5a46'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${R(0.02, 0.06)})`; g.fillRect(R(0, w), R(0, h), R(60, 260), R(6, 22)); }
      g.fillStyle = 'rgba(245,245,235,0.9)'; g.font = `700 46px ${FONT}`; g.fillText('오늘의 쉬는 시간: 지우개 따먹기', 60, 90);
      g.font = `700 34px ${FONT}`; g.fillStyle = 'rgba(255,230,150,0.9)'; g.fillText('떠든 사람: 나, 너', 60, 160);
      g.strokeStyle = 'rgba(245,245,235,0.8)'; g.lineWidth = 4; g.strokeRect(760, 60, 200, 200); g.fillStyle = 'rgba(245,245,235,0.9)'; g.fillText('당번', 820, 110);
    });
    add(new THREE.BoxGeometry(46, 15, 0.5), std(0xa9773f, 0.7), 0, F + 16, ZF + 0.3);
    add(new THREE.PlaneGeometry(44, 13), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }), 0, F + 16, ZF + 0.6);
    add(new THREE.BoxGeometry(44, 0.5, 1.2), std(0xa9773f, 0.7), 0, F + 9.2, ZF + 0.9);
    add(new THREE.BoxGeometry(9, 9.5, 5), std(0xb98a55, 0.7), 14, F + 4.75, ZF + 9);
    const clock = add(new THREE.CylinderGeometry(2, 2, 0.3, 32), std(0xfffdf5, 0.5), 30, F + 24, ZF + 0.3); clock.rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.15, 1.5, 0.1), std(0x222222), 30, F + 24.6, ZF + 0.5); add(new THREE.BoxGeometry(1.1, 0.15, 0.1), std(0x222222), 30.5, F + 24, ZF + 0.5);
    // 창문(-x 벽): 밝은 하늘과 창틀
    const sky = canvasTex(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9fd2ff'); gr.addColorStop(0.7, '#e6f5ff'); gr.addColorStop(1, '#cfe8c8'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.9)'; for (const [x, y, r] of [[60, 70, 26], [95, 62, 34], [135, 74, 24], [190, 120, 20], [215, 114, 26]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } });
    for (const z of [-28, -6, 16]) {
      const win = add(new THREE.PlaneGeometry(17, 13), new THREE.MeshBasicMaterial({ map: sky }), -W + 0.1, F + 16, z); win.rotation.y = Math.PI / 2;
      for (const [w2, h2, dy, dz] of [[18, 0.7, 6.6, 0], [18, 0.7, -6.6, 0], [0.7, 13.6, 0, 8.6], [0.7, 13.6, 0, -8.6], [0.5, 13, 0, 0]]) add(new THREE.BoxGeometry(0.4, h2, w2 === 0.7 || w2 === 0.5 ? w2 : w2), std(0xfdfaf2, 0.6), -W + 0.3, F + 16 + dy, z + dz);
    }
    // 뒷벽: 사물함과 게시판
    const locker = std(0xd9c7a2, 0.75);
    for (let i = -6; i <= 6; i++) for (let j = 0; j < 2; j++) { add(new THREE.BoxGeometry(6.2, 5.6, 3.5), locker, i * 6.6, F + 2.9 + j * 5.9, ZB - 1.9); add(new THREE.BoxGeometry(0.5, 0.5, 0.2), std(0x7a6a55), i * 6.6 + 2.2, F + 2.9 + j * 5.9, ZB - 3.7); }
    add(new THREE.BoxGeometry(40, 10, 0.3), std(0x9cc5a1, 0.95), 0, F + 19, ZB - 0.3);
    for (let i = 0; i < 9; i++) add(new THREE.BoxGeometry(3.4, 4.4, 0.1), std([0xfff3b0, 0xffd0d8, 0xcfe6ff, 0xffffff][i % 4], 0.9), -16 + i * 4, F + 19 + (i % 2 ? 0.6 : -0.4), ZB - 0.5).rotation.z = (i % 3 - 1) * 0.06;
    // 문(+x 벽)
    add(new THREE.BoxGeometry(0.4, 20, 9), std(0x9a7446, 0.7), W - 0.2, F + 10, ZF + 12);
    // 책상과 의자 줄: 한 번에 그리는 묶음으로 만든다
    const deskTop = new THREE.BoxGeometry(6, 0.25, 4), leg = new THREE.CylinderGeometry(0.1, 0.1, -F - 0.25, 8);
    const seat = new THREE.BoxGeometry(3.6, 0.3, 3.4), back = new THREE.BoxGeometry(3.6, 2.4, 0.3), cleg = new THREE.CylinderGeometry(0.09, 0.09, 4.2, 8);
    const spots = [];
    for (let ix = -3; ix <= 3; ix++) for (let iz = -2; iz <= 2; iz++) spots.push([ix * 12, iz * 14.5, ix === 0 && iz === 0]);
    const others = spots.filter((p) => !p[2]), n = others.length, m4 = new THREE.Matrix4();
    const inst = (geo, mat, count) => { const im = new THREE.InstancedMesh(geo, mat, count); s.add(im); return im; };
    const tops = inst(deskTop, std(0xd3a468, 0.6), n), legs = inst(leg, std(0x6f7780, 0.45), n * 4);
    const seats = inst(seat, std(0xc08f57, 0.7), spots.length), backs = inst(back, std(0xc08f57, 0.7), spots.length), clegs = inst(cleg, std(0x6f7780, 0.45), spots.length * 4);
    others.forEach(([x, z], i) => {
      tops.setMatrixAt(i, m4.makeTranslation(x, -0.125, z));
      [[-2.7, -1.7], [2.7, -1.7], [-2.7, 1.7], [2.7, 1.7]].forEach(([dx, dz], k) => legs.setMatrixAt(i * 4 + k, m4.makeTranslation(x + dx, (F - 0.25) / 2, z + dz)));
    });
    spots.forEach(([x, z, mine], i) => {
      if (mine) { seats.setMatrixAt(i, m4.makeScale(0, 0, 0)); backs.setMatrixAt(i, m4.makeScale(0, 0, 0)); for (let k = 0; k < 4; k++) clegs.setMatrixAt(i * 4 + k, m4.makeScale(0, 0, 0)); return; }   // 우리 자리 의자는 치워 둔다
      seats.setMatrixAt(i, m4.makeTranslation(x, F + 4.3, z + 5.6)); backs.setMatrixAt(i, m4.makeTranslation(x, F + 6.0, z + 7.2));
      [[-1.6, 4.1], [1.6, 4.1], [-1.6, 7.1], [1.6, 7.1]].forEach(([dx, dz], k) => clegs.setMatrixAt(i * 4 + k, m4.makeTranslation(x + dx, F + 2.1, z + dz)));
    });
    // 옆 책상 위의 물건들
    const stuff = [[0xff8a8a, 3, 0.25, 2.1], [0x8ab6ff, 2.6, 0.35, 1.9], [0xffe08a, 1.9, 0.5, 0.8], [0x9be0a8, 2.8, 0.2, 2.0], [0xd7b8ff, 1.6, 0.6, 0.7]];
    others.forEach(([x, z], i) => { if (i % 3 === 1) return; const [c, w2, h2, d2] = stuff[i % stuff.length]; const m = add(new THREE.BoxGeometry(w2, h2, d2), std(c, 0.7), x + R(-1.2, 1.2), h2 / 2, z + R(-0.6, 0.6)); m.rotation.y = R(-0.5, 0.5); });
    // 가방 몇 개
    for (const i of [2, 7, 13, 20, 26, 33]) { const p = others[i]; if (p) add(new THREE.BoxGeometry(2.6, 3.2, 1.2), std([0x3d6fb5, 0xd95b5b, 0x4a9a6a][i % 3], 0.85), p[0] + 3.6, F + 1.6, p[1] + 1); }
  }
  // 지우개 고르기 화면용 작은 그림
  thumb(type, side) {
    const key = type + side; this._thumbs = this._thumbs || {};
    if (this._thumbs[key]) return this._thumbs[key];
    if (!this._tr) {
      this._tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); this._tr.setSize(200, 130); this._tr.toneMapping = THREE.ACESFilmicToneMapping;
      this._ts = new THREE.Scene(); this._ts.add(new THREE.HemisphereLight(0xffffff, 0x998877, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(-2, 4, 3); this._ts.add(d);
      this._tc = new THREE.PerspectiveCamera(28, 200 / 130, 0.1, 20); this._tc.position.set(0.9, 0.85, 1.25); this._tc.lookAt(0, 0, 0);
    }
    const keep = this.scene; this.scene = this._ts;
    const mesh = this._eraser(PLAYER[side], TYPES[type], type);
    this.scene = keep;
    mesh.rotation.y = 0.5; this._tr.render(this._ts, this._tc);
    this._ts.remove(mesh);
    return (this._thumbs[key] = this._tr.domElement.toDataURL('image/png'));
  }

  // 지우개 종류가 바뀌면 모양을 다시 만든다
  setTypes(types) {
    if (this.types && this.types[0] === types[0] && this.types[1] === types[1]) return;
    this.types = [...types];
    for (const o of [...this.erasers, ...this.wires]) this.scene.remove(o);
    this.erasers = types.map((t, i) => this._eraser(PLAYER[i], TYPES[t], t));
    this.wires = types.map((t) => {
      const [hx, hy, hz] = TYPES[t].dims;
      const w = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2)), new THREE.LineBasicMaterial({ color: 0x00ff88, depthTest: false }));
      w.visible = false; w.renderOrder = 30; this.scene.add(w); return w;
    });
  }
  _eraser(pl, T, type) {
    const [hx, hy, hz] = T.dims, shape = shapeOf(type);
    const g = new THREE.Group(), inner = new THREE.Group();
    if (!shape.plain) {
      // 모양 지우개: 한 가지 색 고무(플레이어 색 계열)로 덩어리들을 빚는다
      const col = new THREE.Color(pl.color).lerp(new THREE.Color(0xffffff), 0.16); const hsl = {}; col.getHSL(hsl); col.setHSL((hsl.h + (T.tone || 0) * 0.035 + 1) % 1, hsl.s, Math.min(0.78, Math.max(0.32, hsl.l + (T.tone || 0) * 0.16)));
      const rubber = new THREE.MeshStandardMaterial({ color: col, roughness: 0.78 });
      for (const pt of shape.parts) {
        let geo;
        if (pt.s === 'box') geo = new RoundedBoxGeometry(pt.h[0] * 2, pt.h[1] * 2, pt.h[2] * 2, 3, Math.min(0.02, Math.min(...pt.h) * 0.45));
        else if (pt.s === 'cyl') geo = new THREE.CylinderGeometry(pt.rad, pt.rad, pt.hh * 2, 28);
        else if (pt.s === 'ball') geo = new THREE.SphereGeometry(pt.rad, 22, 16);
        else geo = new ConvexGeometry(pt.pts.map((v) => new THREE.Vector3(...v)));
        const m = new THREE.Mesh(geo, rubber);
        if (pt.s !== 'hull') { m.position.set(...pt.p); m.quaternion.set(pt.q.x, pt.q.y, pt.q.z, pt.q.w); }
        m.castShadow = m.receiveShadow = true; inner.add(m);
      }
      const ink = new THREE.MeshStandardMaterial({ color: 0x2b2228, roughness: 0.5 });
      for (const d of shape.decor) { const m = new THREE.Mesh(new THREE.SphereGeometry(d.s === 'eye' ? 0.016 : 0.013, 10, 8), ink); m.position.set(d.p[0], d.p[1] + 0.002, d.p[2]); m.scale.y = 0.5; inner.add(m); }
      g.add(inner); g.userData.inner = inner; this.scene.add(g);
      return g;
    }
    const rubber = new THREE.Mesh(new RoundedBoxGeometry(hx * 2, hy * 2, hz * 2, 4, Math.min(0.02, hy * 0.4)),
      new THREE.MeshStandardMaterial({ color: pl.rubber, roughness: 0.82 }));
    const tex = sleeveTexture(pl, T.name);
    const paper = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), plain = new THREE.MeshStandardMaterial({ color: pl.color, roughness: 0.7 });
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 * 0.62, hy * 2 + 0.006, hz * 2 + 0.006), [plain, plain, paper, paper, plain, plain]);
    sleeve.position.x = -hx * 0.2;
    rubber.castShadow = sleeve.castShadow = true; rubber.receiveShadow = sleeve.receiveShadow = true;
    inner.add(rubber, sleeve); g.add(inner);
    g.userData.inner = inner;
    this.scene.add(g);
    return g;
  }
  kick(i, amount) { this.squash[i].v += amount * 22; }           // 눌렸다 튕겨 돌아오는 탄력
  shake(a) { this.cine.trauma = Math.min(1, this.cine.trauma + a); }
  zoomIn(sec) { this.cine.zoomT = Math.max(this.cine.zoomT, sec); }

  // 화면 갱신. bodies는 보간된 자세 목록.
  update(game, bodies, dt) {
    this.setTypes(game.types);
    const C = this.cine; C.time += dt;
    bodies.forEach((b, i) => {
      // 찌그러짐: 스프링으로 흔들리다 가라앉는다(그리기만, 물리와 무관)
      const q = this.squash[i];
      q.v += (-340 * q.s - 15 * q.v) * dt; q.s = Math.max(-0.4, Math.min(0.45, q.s + q.v * dt));
      const inner = this.erasers[i].userData.inner;
      inner.scale.set(1 + q.s * 0.55, 1 - q.s, 1 + q.s * 0.55);
      let lift = 0;
      if (this.hop && this.hop.i === i) { this.hop.t += dt; const u = this.hop.t; lift = Math.abs(Math.sin(u * 7.5)) * 0.13 * Math.exp(-u * 0.9); inner.scale.y *= 1 + Math.sin(u * 15) * 0.1 * Math.exp(-u * 0.9); }
      this.erasers[i].position.set(b.p[0], b.p[1] + lift, b.p[2]);
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
    this.fx.update(dt);
    this._camera(game, bodies, dt);
    const tm = this.renderer.toneMapping; this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setRenderTarget(this.bgRT0); this.renderer.render(this.bg, this.camera);
    this.renderer.setRenderTarget(this.bgRT); this.renderer.render(this.blurScene, this.blurCam);
    this.renderer.setRenderTarget(null); this.renderer.toneMapping = tm;
    this.renderer.render(this.scene, this.camera);
  }
  _camera(game, bodies, dt) {
    const seat = game.viewSeat ?? game.player;                 // 온라인에서는 늘 내 자리에서 본다
    const C = this.cam, K = this.cine, me = bodies[seat], op = bodies[1 - seat];
    const on = (b) => b.p[1] > GEOM.fallY;
    // 시점 방향: 현재 플레이어 뒤에서 상대 쪽을 본다. 발사 뒤에는 방향을 바꾸지 않는다.
    let swing = 0;
    if (game.phase === PHASE.AIM && on(me) && on(op)) {
      const want = Math.atan2(op.p[2] - me.p[2], op.p[0] - me.p[0]);
      const d = ((want - C.az + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      C.az += d * (C.init ? 1 - Math.exp(-3.0 * dt) : 1);
      swing = Math.abs(d);                                  // 차례가 바뀌어 책상을 돌아 넘어가는 중
    }
    const pts = [me, op].filter(on);
    const cx = pts.length ? pts.reduce((s, b) => s + b.p[0], 0) / pts.length : 0, cz = pts.length ? pts.reduce((s, b) => s + b.p[2], 0) / pts.length : 0;
    const spread = pts.length === 2 ? Math.hypot(me.p[0] - op.p[0], me.p[2] - op.p[2]) : 1.5;
    const aiming = game.phase === PHASE.AIM || game.phase === PHASE.POWER;
    const narrow = this.camera.aspect < 1 ? 1.35 : 1;
    // 느린 화면일 때는 두 지우개 쪽으로 바짝 다가간다
    K.zoomT = Math.max(0, K.zoomT - dt);
    K.zoom += ((K.zoomT > 0 ? 1 : 0) - K.zoom) * (1 - Math.exp(-(K.zoomT > 0 ? 9 : 4) * dt));
    // 조준할 때는 누름 자리가 잘 보이도록 내 지우개 쪽으로 다가가고, 튕긴 뒤에는 물러나 둘 다 보여 준다
    const dist = (aiming ? 1.75 + spread * 0.16 : 2.8 + spread * 0.75) * narrow * (1 - 0.42 * K.zoom);
    const fx = Math.cos(C.az), fz = Math.sin(C.az);
    const focus = aiming && on(me) ? [me.p[0] * 0.86 + cx * 0.14, me.p[2] * 0.86 + cz * 0.14] : [cx, cz];
    const wantPos = new THREE.Vector3(focus[0] - fx * dist, (aiming ? 0.55 : 0.9) + dist * (0.5 - 0.14 * K.zoom) + swing * 0.55, focus[1] - fz * dist);
    const ahead = aiming ? 0.9 : 0.35;
    const wantLook = new THREE.Vector3(focus[0] + fx * ahead * (1 - K.zoom), 0.05 + 0.1 * K.zoom, focus[1] + fz * ahead * (1 - K.zoom));
    // 떨어지는 지우개: 책상 가장자리에서 내려다보며 따라간다
    if (K.fall) {
      K.fall.t += dt;
      const f = bodies[K.fall.i].p;
      if (K.fall.t < 2.6 && f[1] < 0.2) {
        const ex = Math.max(-GEOM.desk.hx, Math.min(GEOM.desk.hx, f[0])), ez = Math.max(-GEOM.desk.hz, Math.min(GEOM.desk.hz, f[2]));
        wantPos.set(ex * 0.72 - fx * 0.6, 2.3, ez * 0.72 - fz * 0.6);
        wantLook.set(f[0], f[1], f[2]);
      } else if (K.fall.t >= 2.6) K.fall = null;
    }
    const k = C.init ? 1 - Math.exp(-(K.fall ? 4.5 : K.zoomT > 0 ? 7 : aiming ? 3.5 : 2.2) * dt) : 1;
    C.pos.lerp(wantPos, k); C.look.lerp(wantLook, k); C.init = true;
    this.camera.position.copy(C.pos);
    // 흔들림: 충격이 클수록 세게, 금방 가라앉는다
    K.trauma = Math.max(0, K.trauma - dt * 1.9);
    if (K.trauma > 0) {
      const a = K.trauma * K.trauma * 0.075, t = K.time * 43;
      this.camera.position.x += Math.sin(t) * a; this.camera.position.y += Math.sin(t * 1.31 + 1) * a; this.camera.position.z += Math.sin(t * 0.83 + 2) * a;
    }
    this.camera.lookAt(C.look);
    const fov = this.baseFov - 5 * K.zoom - K.pulse * 1.3;
    if (Math.abs(fov - this.camera.fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }
  resetCamera() { this.cam.init = false; this.cine.fall = null; this.cine.zoomT = 0; this.cine.zoom = 0; this.hop = null; this.squash.forEach((q) => { q.s = q.v = 0; }); }
  // 3D 위치가 화면의 어디인지(걸침 표시용)
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  }
}
