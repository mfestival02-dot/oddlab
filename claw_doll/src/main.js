import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import hdrBytes from '../assets/warm_bar_1k.hdr';
import { clamp, lerp, damp, rand, rnd, canvasTex } from './util.js';
import { makeDoll, makeHamster } from './dolls.js';
import { makeCustomer, FACE_HOME } from './customer.js';
import { buildMachine, HALF, CHUTE, RAIL_Y } from './machine.js';

const $ = (id) => document.getElementById(id);

async function main() {
  await RAPIER.init();

  // ================= 렌더러 =================
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  $('app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 300);

  // 밤 실내 HDRI: 반사와 유리 밖 배경(흐리게)
  {
    const d = new RGBELoader().parse(hdrBytes.buffer.slice(hdrBytes.byteOffset, hdrBytes.byteOffset + hdrBytes.byteLength));
    const tex = new THREE.DataTexture(d.data, d.width, d.height, THREE.RGBAFormat, d.type);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.flipY = true;
    tex.needsUpdate = true;
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromEquirectangular(tex).texture;
    scene.environment = env;
    scene.background = env;
    scene.backgroundBlurriness = 0.55;
    scene.backgroundIntensity = 0.035;
    scene.environmentIntensity = 0.4;
    scene.backgroundRotation.y = scene.environmentRotation.y = 1.2;
  }

  // ================= 조명: 기계 안은 따뜻하고 밝게 =================
  const top = new THREE.DirectionalLight(0xfff0dc, 2.3);
  top.position.set(1.2, 22, -2.2);
  top.castShadow = true;
  top.shadow.mapSize.set(2048, 2048);
  Object.assign(top.shadow.camera, { left: -7.5, right: 7.5, top: 7.5, bottom: -7.5, near: 4, far: 40 });
  top.shadow.bias = -0.0004;
  top.shadow.normalBias = 0.045;
  top.shadow.radius = 4;
  scene.add(top, top.target);
  scene.add(new THREE.HemisphereLight(0xffe6cc, 0x7a5a9a, 0.22));
  const lamp = new THREE.PointLight(0xffd6a4, 40, 26, 1.6);
  lamp.position.set(0, 11.5, 0);
  scene.add(lamp);
  // 손님 얼굴: 기계 불빛을 아래에서 받고, 뒤에서는 네온이 테두리를 잡는다
  const faceLight = new THREE.SpotLight(0xffe6cc, 62, 40, 0.9, 0.7, 1.5);
  faceLight.position.set(0, 1.0, 6.4);
  faceLight.target.position.copy(FACE_HOME);
  scene.add(faceLight, faceLight.target);
  // 통로 천장등: 매장은 어둑하고 차가운 흰빛
  const rimA = new THREE.PointLight(0xdfe8ff, 520, 80, 1.5);
  rimA.position.set(-14, 22, 20);
  const rimB = new THREE.PointLight(0xdfe8ff, 520, 80, 1.5);
  rimB.position.set(14, 22, 20);
  scene.add(rimA, rimB);

  // ================= 장면 =================
  const machine = buildMachine(scene);
  const customer = makeCustomer(scene);

  // ================= 물리 =================
  const world = new RAPIER.World({ x: 0, y: -22, z: 0 });
  world.timestep = 1 / 60;
  const wall = (hx, hy, hz, x, y, z) => world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(0.9));
  wall(4.5, 0.5, 6, 1.5, -0.5, 0);
  wall(1.5, 0.5, 4.5, -4.5, -0.5, -1.5);
  wall(0.5, 12, 7, 6.5, 8, 0); wall(0.5, 12, 7, -6.5, 8, 0);
  wall(7, 12, 0.5, 0, 8, 6.5); wall(7, 12, 0.5, 0, 8, -6.5);
  wall(7, 0.5, 7, 0, 14, 0);
  wall(0.08, 0.75, 1.5, -3, 0.75, 4.5); wall(1.5, 0.75, 0.08, -4.5, 0.75, 3);

  const COLORS = {
    bear: [0xc98a55, 0xe6c79a, 0x9c6a48, 0xf2dcc0], bunny: [0xf29ab5, 0xfff0ea, 0xc7a8f0, 0xffc2a8],
    cat: [0x9fb0c8, 0xf3e6d2, 0x6f7f9c, 0xf2b98a], chick: [0xf6cf52, 0xffe38a], frog: [0x8fc56a, 0x6fb88c],
  };
  const TYPES = ['bear', 'bunny', 'cat', 'chick', 'frog', 'bear', 'bunny', 'cat'];
  const dolls = [];
  function addDoll(i) {
    const type = TYPES[i % TYPES.length];
    const pal = COLORS[type];
    const r = rand(0.8, 0.96);
    let x, z;
    do { x = rand(-4.9, 4.9); z = rand(-4.9, 4.9); } while (x < -2.2 && z > 2.2);
    const view = makeDoll(type, pal[Math.floor(rnd() * pal.length)], r);
    scene.add(view);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(-0.6, 0.6), rand(0, 6.28), rand(-0.6, 0.6)));
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, rand(2, 11.5), z).setRotation(q)
      .setLinearDamping(0.6).setAngularDamping(2.2));
    const col = (rad, y) => world.createCollider(RAPIER.ColliderDesc.ball(rad * r).setTranslation(0, y * r, 0)
      .setFriction(1.0).setRestitution(0.02).setDensity(0.45), body);
    col(0.73, 0.3); col(0.54, -0.45);
    dolls.push({ body, view, r, type });
  }
  // 바닥이 안 보일 만큼, 여러 번에 나눠 부어서 쌓는다
  for (let b = 0; b < 4; b++) {
    for (let i = 0; i < 36; i++) addDoll(b * 36 + i);
    for (let i = 0; i < 150; i++) world.step();
  }
  for (let i = 0; i < 240; i++) world.step();

  // 주인공
  const PR = 0.76;
  const ham = makeHamster(0.92);
  scene.add(ham);
  const pBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0.5, 9, -1.2).lockRotations().setLinearDamping(1.2));
  const pCol = world.createCollider(RAPIER.ColliderDesc.ball(PR).setFriction(1.0).setRestitution(0).setDensity(1.4), pBody);
  for (let i = 0; i < 90; i++) world.step();

  // '이게 나': 머리 위 표시와 따라다니는 작은 조명
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({
    depthTest: false, transparent: true,
    map: canvasTex(128, 128, (g) => {
      g.fillStyle = '#ffd84a'; g.strokeStyle = '#7a4a10'; g.lineWidth = 8; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(22, 34); g.lineTo(106, 34); g.lineTo(64, 104); g.closePath(); g.stroke(); g.fill();
    }),
  }));
  marker.scale.setScalar(0.62);
  marker.renderOrder = 20;
  scene.add(marker);
  const hamLight = new THREE.PointLight(0xfff2d8, 9, 5, 1.6);
  scene.add(hamLight);

  // ================= 입력 =================
  const keys = {};
  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'Digit1') customer.set('expect');
    if (e.code === 'Digit2') customer.set('annoyed');
    if (e.code === 'Digit3') customer.set('giveup');
    if (e.code === 'KeyQ') setQuality(!hiQ);
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // ================= 햄스터: 엉금엉금 + 파고들기 =================
  const G_DOLL = (0x0001 << 16) | 0xffff, G_PLAYER = (0x0002 << 16) | 0xffff, G_PLAYER_BURROW = (0x0002 << 16) | 0xfffe;
  for (const d of dolls) for (let i = 0; i < d.body.numColliders(); i++) d.body.collider(i).setCollisionGroups(G_DOLL);
  pCol.setCollisionGroups(G_PLAYER);
  const P = { ghost: false, phase: 0, moving: false, heading: 0, burrow: 0, radius: PR, conceal: 0, squash: 0 };
  const _v = new THREE.Vector3();
  function stepPlayer(dt) {
    // 카메라가 +z(유리 쪽)를 보므로 화면 왼쪽이 +x
    let ix = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
    let iz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const len = Math.hypot(ix, iz);
    const burrowing = !!keys.Space;
    P.moving = len > 0;
    const pos = pBody.translation(), vel = pBody.linvel();
    let vx = vel.x, vy = vel.y, vz = vel.z;

    P.burrow = damp(P.burrow, burrowing ? 1 : 0, burrowing ? 10 : 5, dt);
    // 파고드는 동안에는 인형 사이를 비집고 들어간다(인형과의 충돌을 잠시 끈다)
    if (burrowing !== P.ghost) {
      P.ghost = burrowing;
      pCol.setCollisionGroups(burrowing ? G_PLAYER_BURROW : G_PLAYER);
      pBody.wakeUp();
    }

    if (P.moving) {
      ix /= len; iz /= len;
      P.heading = dampAngle(P.heading, Math.atan2(ix, iz), 6, dt);
      P.phase = (P.phase + dt / 0.62) % 1;
      // 한 박자: 몸을 쭉 뻗으며 밀고(0~0.55), 뭉치며 쉰다
      const push = P.phase < 0.55 ? Math.sin((P.phase / 0.55) * Math.PI) : 0;
      const speed = (0.4 + 2.9 * push) * (burrowing ? 0.55 : 1);
      // 밀었는데도 못 나갔으면(앞이 막힘) 몸을 들어 타고 넘는다
      const got = vx * ix + vz * iz;
      if (push > 0.3 && !burrowing && got < speed * 0.5) vy = Math.max(vy, 4.6);
      vx = lerp(vx, ix * speed, 0.3); vz = lerp(vz, iz * speed, 0.3);
      P.squash = damp(P.squash, push, 14, dt);
    } else {
      P.phase = 0;
      P.squash = damp(P.squash, 0, 10, dt);
      vx *= 0.8; vz *= 0.8;
    }
    if (burrowing) {
      // 위에 인형이 충분히 덮일 때까지 천천히 가라앉고, 그 뒤에는 그 깊이에 머문다
      vy = P.conceal < 0.9 ? -2.4 : 0.37;
      for (const d of dolls) {
        const q = d.body.translation();
        if (Math.hypot(q.x - pos.x, q.z - pos.z) < 2.2 && Math.abs(q.y - pos.y) < 2) d.body.wakeUp();
      }
    }
    pBody.setLinvel({ x: vx, y: vy, z: vz }, true);

    // 숨은 정도: 내 위를 덮은 인형 수
    let c = 0;
    for (const d of dolls) {
      const q = d.body.translation();
      const h = Math.hypot(q.x - pos.x, q.z - pos.z);
      if (q.y > pos.y + 0.3 && h < 1.25) c += 0.4;
      else if (q.y > pos.y - 0.1 && h < 1.5) c += 0.07;
    }
    P.conceal = damp(P.conceal, clamp(c, 0, 1), 5, dt);
  }
  function dampAngle(a, b, l, dt) {
    let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return a + d * (1 - Math.exp(-l * dt));
  }

  // ================= 집게 (이 단계에서는 돌아다니며 그림자만) =================
  const C = { x: CHUTE.cx, y: 11.0, z: CHUTE.cz, open: 0.4, state: 'wait', t: 2, tx: 0, tz: 0, floor: 3 };
  function stepClaw(dt) {
    const p = pBody.translation();
    C.t -= dt;
    const move = (tx, tz, sp) => {
      const dx = tx - C.x, dz = tz - C.z, d = Math.hypot(dx, dz), s = Math.min(d, sp * dt);
      if (d > 1e-4) { C.x += (dx / d) * s; C.z += (dz / d) * s; }
      return d;
    };
    let openT = 0.4;
    if (C.state === 'wait') {
      if (C.t <= 0) { C.state = 'aim'; C.t = 4.5; }
    } else if (C.state === 'aim') {
      C.tx = clamp(p.x + Math.sin(performance.now() / 900) * 1.2, -5, 5);
      C.tz = clamp(p.z + Math.cos(performance.now() / 1300) * 1.2, -5, 5);
      move(C.tx, C.tz, 3.2);
      if (C.t <= 0) { C.state = 'hover'; C.t = 0.9; }
    } else if (C.state === 'hover') {
      openT = 1;
      if (C.t <= 0) {
        C.state = 'drop';
        C.floor = 0.4;
        for (const d of dolls) { const q = d.body.translation(); if (Math.hypot(q.x - C.x, q.z - C.z) < 1.0) C.floor = Math.max(C.floor, q.y + d.r); }
        if (Math.hypot(p.x - C.x, p.z - C.z) < 1.0) C.floor = Math.max(C.floor, p.y + PR);
      }
    } else if (C.state === 'drop') {
      openT = 1;
      C.y -= 7 * dt;
      if (C.y <= C.floor + 1.9) { C.state = 'grip'; C.t = 0.7; }
    } else if (C.state === 'grip') {
      openT = 0;
      if (C.t <= 0) C.state = 'rise';
    } else if (C.state === 'rise') {
      openT = 0;
      C.y += 5 * dt;
      if (C.y >= 11.0) { C.y = 11.0; C.state = 'home'; }
    } else if (C.state === 'home') {
      openT = 0;
      if (move(CHUTE.cx, CHUTE.cz, 3.6) < 0.05) { C.state = 'wait'; C.t = 2.5; }
    }
    C.open = damp(C.open, openT, 7, dt);
    machine.claw.position.set(C.x, C.y, C.z);
    machine.prongs.forEach((pv) => { pv.rotation.x = lerp(0.12, -0.62, C.open); });
    machine.carriage.position.set(C.x, RAIL_Y, C.z);
    machine.crossBar.position.z = C.z;
    const top = RAIL_Y - 0.3, bot = C.y + 0.6;
    machine.cable.position.set(C.x, (top + bot) / 2, C.z);
    machine.cable.scale.y = Math.max(0.01, top - bot);
  }

  // ================= 후처리 =================
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.25, samples: 12 });
  gtao.blendIntensity = 1.0;
  // 접촉 음영을 계산할 때 유리 같은 투명한 것과 털 껍질은 빼 둔다
  const skip = [];
  scene.traverse((o) => { if (o.isMesh && (o.material.transparent || o.userData.glass || o.userData.fur)) skip.push(o); });
  const gtaoRender = gtao.render.bind(gtao);
  gtao.render = (...a) => {
    for (const o of skip) o.visible = false;
    gtaoRender(...a);
    for (const o of skip) o.visible = true;
  };
  composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.6, 1.0);
  composer.addPass(bloom);
  const finalPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uFocus: { value: 0.4 }, uBlur: { value: 4 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFocus, uBlur; varying vec2 vUv;
      void main() {
        // 미니어처 느낌: 햄스터 높이만 또렷하고 화면 위아래는 살짝 흐리다
        float d = vUv.y - uFocus;
        float amt = (d > 0.0 ? smoothstep(0.2, 0.62, d) * 0.45 : smoothstep(0.14, 0.42, -d)) * uBlur;
        vec3 c = texture2D(tDiffuse, vUv).rgb; float w = 1.0;
        if (amt > 0.3) {
          for (int i = 0; i < 16; i++) {
            float a = float(i) * 2.39996; float r = sqrt((float(i) + 0.5) / 16.0) * amt;
            c += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r / uRes).rgb; w += 1.0;
          }
        }
        c /= w;
        vec2 q = vUv - 0.5;
        c *= 1.0 - dot(q, q) * 0.62;                                  // 가장자리 어둡게
        c = mix(c, c * vec3(1.03, 1.0, 0.96), 0.6);                  // 따뜻한 색감
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  composer.addPass(finalPass);
  composer.addPass(new OutputPass());

  let hiQ = true;
  function setQuality(on) {
    hiQ = on;
    gtao.enabled = on;
    renderer.setPixelRatio(Math.min(devicePixelRatio, on ? 1.5 : 1));
    resize();
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    finalPass.uniforms.uRes.value.set(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
  }
  addEventListener('resize', resize);
  resize();

  // ================= 카메라 =================
  const camPos = new THREE.Vector3(0, 7, -5), camLook = new THREE.Vector3(0, 1, 2);
  function updateCamera(dt, snap) {
    const p = pBody.translation();
    // 뒷판은 뒤에서 보면 비치므로 카메라는 기계 뒤로 빠져도 된다
    const want = _v.set(clamp(p.x * 0.85, -4.3, 4.3), Math.min(p.y + 4.0, 11.5), p.z - 6.8);
    const k = snap ? 1 : 1 - Math.exp(-3.2 * dt);
    camPos.lerp(want, k);
    camLook.lerp(_v.set(p.x * 0.9, p.y + 1.8, p.z + 3.0), k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    // 또렷하게 볼 높이 = 햄스터의 화면 위치
    _v.set(p.x, p.y, p.z).project(camera);
    finalPass.uniforms.uFocus.value = damp(finalPass.uniforms.uFocus.value, clamp(_v.y * 0.5 + 0.5, 0.2, 0.7), 4, dt);
  }

  // ================= 루프 =================
  const body = ham.userData.body;
  function sync(t) {
    for (const d of dolls) {
      const p = d.body.translation(), q = d.body.rotation();
      d.view.position.set(p.x, p.y, p.z);
      d.view.quaternion.set(q.x, q.y, q.z, q.w);
    }
    const p = pBody.translation();
    ham.position.set(p.x, p.y - (PR - P.radius) * 0.5 - 0.09, p.z);
    marker.position.set(p.x, p.y + 1.75 + Math.sin(t * 3) * 0.1, p.z);
    hamLight.position.set(p.x, p.y + 1.6, p.z - 0.4);
    ham.rotation.y = P.heading;
    const s = P.squash, b = P.burrow;
    const wig = b * Math.sin(t * 22) * 0.07;
    body.scale.set(1 - 0.07 * s + 0.08 * b, 1 - 0.11 * s - 0.16 * b + (P.moving ? 0 : Math.sin(t * 2.2) * 0.012), 1 + 0.2 * s + 0.05 * b);
    body.rotation.set(-0.06 * s, wig, wig * 0.8);
    body.position.y = -0.74 * (0.11 * s + 0.16 * b) * 0.5;
    machine.bulbs.forEach((bl, i) => bl.scale.setScalar(0.8 + 0.3 * Math.max(0, Math.sin(t * 3 - i * 0.52))));
    customer.look.set(lerp(p.x, C.x, 0.5), lerp(p.y, C.y - 2, 0.3), lerp(p.z, C.z, 0.5));
    $('hideFill').style.width = (P.conceal * 100).toFixed(0) + '%';
    $('hideLabel').textContent = P.conceal > 0.72 ? '완전히 숨음' : P.conceal > 0.35 ? '반쯤 숨음' : '드러남';
  }

  let last = performance.now(), acc = 0, time = 0;
  updateCamera(0, true);
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; acc += dt; time += dt;
    let n = 0;
    while (acc >= 1 / 60 && n++ < 3) { stepPlayer(1 / 60); stepClaw(1 / 60); world.step(); acc -= 1 / 60; }
    if (n >= 3) acc = 0;
    sync(time);
    customer.update(dt, time);
    updateCamera(dt, false);
    composer.render(dt);
    requestAnimationFrame(frame);
  }
  $('loading').remove();
  window.__dbg = { P, C, pBody, dolls, customer, camera, setQuality, keys, renderer };
  requestAnimationFrame(frame);
}

main().catch((e) => {
  console.error(e);
  $('loading').textContent = '불러오지 못했습니다: ' + e.message;
});
