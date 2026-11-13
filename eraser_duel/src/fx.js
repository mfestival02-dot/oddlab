// 연출용 입자: 먼지, 별, 지우개 가루·종이 꽃가루. 물리 결과에는 영향을 주지 않는다.
import * as THREE from 'three';

function tex(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const TEX = {
  soft: () => tex((g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.6, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }),
  star: () => tex((g) => { g.fillStyle = '#fff'; g.translate(32, 32); g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? 9 : 30; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); }),
  bit: () => tex((g) => { g.fillStyle = '#fff'; g.beginPath(); g.roundRect(10, 16, 44, 32, 5); g.fill(); }),
};

class Cloud {
  constructor(scene, kind, max) {
    this.max = max; this.items = [];
    const geo = this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: TEX[kind]() }, uScale: { value: 600 } },
      transparent: true, depthWrite: false,
      vertexShader: 'attribute vec4 aColor; attribute float aSize; uniform float uScale; varying vec4 vC; void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec4 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); if (t.a * vC.a < 0.02) discard; gl_FragColor = vec4(pow(vC.rgb, vec3(0.9)), t.a * vC.a); }',
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = 20;
    scene.add(this.points);
  }
  // o: p[3], v[3], life, size, grow, color(THREE.Color|hex), grav, drag, floor(y), alpha, flutter
  add(o) {
    if (this.items.length >= this.max) this.items.shift();
    const c = new THREE.Color(o.color ?? 0xffffff);
    this.items.push({ p: [...o.p], v: [...(o.v || [0, 0, 0])], t: 0, life: o.life ?? 0.6, size: o.size ?? 0.1, grow: o.grow ?? 0, c, grav: o.grav ?? 0, drag: o.drag ?? 0, floor: o.floor, alpha: o.alpha ?? 1, flutter: o.flutter ?? 0, ph: Math.random() * 6.28 });
  }
  update(dt) {
    const it = this.items;
    for (let i = it.length - 1; i >= 0; i--) {
      const a = it[i]; a.t += dt;
      if (a.t >= a.life) { it.splice(i, 1); continue; }
      a.v[1] -= a.grav * dt;
      const k = Math.exp(-a.drag * dt); a.v[0] *= k; a.v[1] *= a.grav ? 1 : k; a.v[2] *= k;
      if (a.flutter) { a.v[0] += Math.sin(a.t * 9 + a.ph) * a.flutter * dt; a.v[2] += Math.cos(a.t * 7 + a.ph) * a.flutter * dt; a.v[1] = Math.max(a.v[1], -1.3); }
      a.p[0] += a.v[0] * dt; a.p[1] += a.v[1] * dt; a.p[2] += a.v[2] * dt;
      if (a.floor !== undefined && a.p[1] < a.floor) { a.p[1] = a.floor; a.v[1] = Math.abs(a.v[1]) * 0.35; a.v[0] *= 0.6; a.v[2] *= 0.6; if (a.v[1] < 0.25) { a.v[1] = 0; a.grav = 0; a.flutter = 0; a.v[0] = a.v[2] = 0; } }
    }
    for (let i = 0; i < it.length; i++) {
      const a = it[i], u = a.t / a.life;
      this.pos.set(a.p, i * 3);
      this.col[i * 4] = a.c.r; this.col[i * 4 + 1] = a.c.g; this.col[i * 4 + 2] = a.c.b;
      this.col[i * 4 + 3] = a.alpha * (u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3);
      this.size[i] = Math.max(0.001, (a.size + a.grow * a.t) * (a.flutter ? 0.55 + 0.45 * Math.abs(Math.sin(a.t * 11 + a.ph)) : 1));
    }
    this.geo.setDrawRange(0, it.length);
    this.geo.attributes.position.needsUpdate = this.geo.attributes.aColor.needsUpdate = this.geo.attributes.aSize.needsUpdate = true;
  }
}

const R = (a, b) => a + Math.random() * (b - a);
const PAPER = [0xff5a5f, 0xffc93a, 0x4fa8ff, 0x58c97a, 0xb07cff, 0xff8fc0, 0xffffff];

export class Fx {
  constructor(scene) {
    this.dustC = new Cloud(scene, 'soft', 160);
    this.starC = new Cloud(scene, 'star', 60);
    this.bitC = new Cloud(scene, 'bit', 320);
  }
  setScale(px) { for (const c of [this.dustC, this.starC, this.bitC]) c.mat.uniforms.uScale.value = px; }
  update(dt) { this.dustC.update(dt); this.starC.update(dt); this.bitC.update(dt); }
  // 책상 위로 퍼지는 먼지. dir을 주면 그 반대쪽으로 뿜는다
  dust(p, n = 6, power = 1, dir = null) {
    for (let i = 0; i < n; i++) {
      const a = R(0, 6.28), s = R(0.3, 1.1) * power;
      const v = dir ? [-dir[0] * s * 1.2 + Math.cos(a) * 0.3, R(0.1, 0.5), -dir[2] * s * 1.2 + Math.sin(a) * 0.3] : [Math.cos(a) * s, R(0.1, 0.45), Math.sin(a) * s];
      this.dustC.add({ p: [p[0] + R(-0.08, 0.08), Math.max(0.03, p[1] - 0.03), p[2] + R(-0.08, 0.08)], v, life: R(0.35, 0.7), size: R(0.1, 0.18), grow: R(0.25, 0.5), color: 0xf3e6cf, drag: 3.5, alpha: 0.55 });
    }
  }
  trail(p, color) { this.dustC.add({ p: [p[0], p[1], p[2]], life: 0.22, size: 0.13, grow: -0.3, color, alpha: 0.35 }); }
  stars(p, n = 6) {
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + R(-0.3, 0.3), s = R(1.2, 2.4); this.starC.add({ p: [p[0], p[1] + 0.08, p[2]], v: [Math.cos(a) * s, R(0.6, 1.8), Math.sin(a) * s], life: R(0.35, 0.6), size: R(0.12, 0.2), grow: -0.15, color: i % 2 ? 0xffe14a : 0xffffff, drag: 3, grav: 2 }); }
  }
  crumbs(p, n = 5, color = 0xf7f3ea) {
    for (let i = 0; i < n; i++) { const a = R(0, 6.28), s = R(0.5, 2); this.bitC.add({ p: [p[0], p[1], p[2]], v: [Math.cos(a) * s, R(0.8, 2.4), Math.sin(a) * s], life: R(1.2, 2.2), size: R(0.02, 0.045), color, grav: 9, floor: 0.012 }); }
  }
  confetti(center, n = 90) {
    for (let i = 0; i < n; i++) { const a = R(0, 6.28), s = R(0.4, 2.6); this.bitC.add({ p: [center[0] + R(-0.3, 0.3), center[1] + R(0.2, 0.5), center[2] + R(-0.3, 0.3)], v: [Math.cos(a) * s, R(2.2, 5.2), Math.sin(a) * s], life: R(2.6, 4.2), size: R(0.05, 0.085), color: PAPER[i % PAPER.length], grav: 5.5, drag: 0.6, flutter: 3.2, floor: 0.012 }); }
  }
}
