// 물리 시뮬레이션. 화면과 무관하게 돌아가므로 Node에서도 같은 코드로 검증한다.
import { DT, GEOM } from './config.js';

const rot = (q, v) => {            // 쿼터니언으로 벡터 회전
  const { x, y, z, w } = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
};
const len = (v) => Math.hypot(v.x, v.y, v.z);
export const yawQuat = (a) => ({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) });

export class Sim {
  // state.bodies[i] = { p:[x,y,z], q:{x,y,z,w}, lv:[..], av:[..], fallen }
  constructor(RAPIER, state, settings) {
    this.R = RAPIER;
    this.S = { ...settings };
    this.time = 0;
    const world = this.world = new RAPIER.World({ x: 0, y: -this.S.gravity, z: 0 });
    world.timestep = DT;
    world.numSolverIterations = 8;
    const D = GEOM.desk;
    this.deskCol = world.createCollider(RAPIER.ColliderDesc.cuboid(D.hx, D.thick / 2, D.hz).setTranslation(0, -D.thick / 2, 0)
      .setFriction(this.S.friction).setRestitution(this.S.restitution));
    this.floorCol = world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, GEOM.floorY - 0.5, 0).setFriction(1).setRestitution(0.1));
    this.bodies = []; this.cols = []; this.fallen = [];
    const r = GEOM.round;
    state.bodies.forEach((b) => {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(b.p[0], b.p[1], b.p[2]).setRotation(b.q)
        .setLinvel(...(b.lv || [0, 0, 0])).setAngvel({ x: (b.av || [0, 0, 0])[0], y: (b.av || [0, 0, 0])[1], z: (b.av || [0, 0, 0])[2] })
        .setLinearDamping(this.S.linDamp).setAngularDamping(this.S.angDamp).setCcdEnabled(true).setCanSleep(true));
      const col = world.createCollider(RAPIER.ColliderDesc.roundCuboid(GEOM.hx - r, GEOM.hy - r, GEOM.hz - r, r)
        .setMass(1).setFriction(this.S.friction).setRestitution(this.S.restitution), body);
      this.bodies.push(body); this.cols.push(col); this.fallen.push(!!b.fallen);
    });
  }
  free() { this.world.free(); }

  // 현재 상태를 그대로 꺼낸다(저장·복원·반복 실행용)
  getState() {
    return {
      bodies: this.bodies.map((b, i) => {
        const p = b.translation(), q = b.rotation(), v = b.linvel(), w = b.angvel();
        return { p: [p.x, p.y, p.z], q: { x: q.x, y: q.y, z: q.z, w: q.w }, lv: [v.x, v.y, v.z], av: [w.x, w.y, w.z], sleeping: b.isSleeping(), fallen: this.fallen[i] };
      }),
    };
  }

  // 지우개가 지금 자세에서 주어진 방향으로 차지하는 반길이
  extent(i, dir) {
    const q = this.bodies[i].rotation();
    const ax = rot(q, [1, 0, 0]), ay = rot(q, [0, 1, 0]), az = rot(q, [0, 0, 1]);
    const dot = (a) => Math.abs(a[0] * dir[0] + a[1] * dir[1] + a[2] * dir[2]);
    return dot(ax) * GEOM.hx + dot(ay) * GEOM.hy + dot(az) * GEOM.hz;
  }

  // 튕기기: 무게중심에서 벗어난 점에 충격을 줘서 이동과 회전이 함께 생긴다.
  // 충격 위치는 지우개 자세와 무관하게 '발사 방향 기준 뒤쪽, 아래쪽'으로 잡으므로 뒤집혀 있어도 계산이 같다.
  launch(i, angle, power) {
    const S = this.S, body = this.bodies[i];
    const d = [Math.cos(angle), 0, Math.sin(angle)];
    const J = S.impulse * Math.pow(Math.min(1, Math.max(0, power)), S.powerCurve);
    const c = body.translation();
    const back = S.hitBack * this.extent(i, d), up = S.hitHeight * this.extent(i, [0, 1, 0]);
    const point = { x: c.x - d[0] * back, y: c.y + up, z: c.z - d[2] * back };
    const imp = { x: d[0] * J, y: J * S.vAssist, z: d[2] * J };
    body.applyImpulseAtPoint(imp, point, true);
    // 회전 보조: 축 d×y 는 '앞이 들리는' 방향. 토크 = r × J 와 같은 축이라 부호를 그대로 비교할 수 있다.
    if (S.spinAssist !== 0) {
      const k = J * S.spinAssist * GEOM.hx;
      body.applyTorqueImpulse({ x: -d[2] * k, y: 0, z: d[0] * k }, true);
    }
    // r × J 의 '앞 들림' 성분(진단용): 양수면 기본 충격만으로 앞이 들린다
    const torqueNoseUp = (-back) * (J * S.vAssist) - up * J;
    return { J, point, imp, torqueNoseUp };
  }

  step() {
    this.world.step();
    this.time += DT;
    this.bodies.forEach((b, i) => { if (!this.fallen[i] && b.translation().y < GEOM.fallY) this.fallen[i] = true; });
  }

  speeds(i) { const b = this.bodies[i]; return { lin: len(b.linvel()), ang: len(b.angvel()) }; }

  // 두 지우개 사이의 실제 접촉을 보고, 한쪽이 다른 쪽을 받치고 있는지 판단한다.
  // 반환: { touching, upper(받쳐진 쪽 번호 또는 null), normalY, points }
  contact() {
    const out = { touching: false, upper: null, normalY: 0, points: 0 };
    const c0 = this.bodies[0].translation(), c1 = this.bodies[1].translation();
    this.world.contactPair(this.cols[0], this.cols[1], (m) => {
      const n = m.numSolverContacts();
      if (n === 0) return;
      let py = 0, deep = false;
      for (let k = 0; k < n; k++) { py += m.solverContactPoint(k).y; if (m.solverContactDist(k) < 0.004) deep = true; }
      py /= n;
      if (!deep) return;                         // 닿을 듯 말 듯한 예측 접촉은 제외
      out.touching = true; out.points = n;
      const ny = Math.abs(m.normal().y);
      out.normalY = ny;
      // 받침: 접촉면이 위아래를 향하고(법선이 세로에 가까움), 접촉점이 위쪽 물체의 중심보다 아래·아래쪽 물체의 중심보다 위에 있다
      if (ny < 0.6) return;
      if (c0.y > py && c1.y < py) out.upper = 0;
      else if (c1.y > py && c0.y < py) out.upper = 1;
    });
    return out;
  }
}
