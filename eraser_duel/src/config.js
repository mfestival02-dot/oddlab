import MODELS from './models.json' with { type: 'json' };
// 물리 설정과 형상. 1 단위 = 10cm (지우개 5cm × 2.5cm × 1cm).
export const DT = 1 / 240;                       // 고정 시간 간격(초)
export const SETTINGS_VERSION = 1;

// 지우개 종류. dims는 반치수(길이/두께/폭), fr·re·ang은 마찰·반발·각 감쇠에 곱하는 배율,
// lift·push는 뜨는 힘·나가는 힘 배율, spin은 회전에 더하는 값, round는 충돌체 모서리 반경(작을수록 각지다).
// spots는 손가락으로 누를 수 있는 자리 묶음(아래 SPOT_SETS).
export const TYPES = {
  normal: { name: '보통', dims: [0.25, 0.05, 0.125], mass: 1.0, fr: 1.0, re: 1.0, spots: 'all8', desc: '무난한 기본 지우개' },
  sharp:  { name: '새것', dims: [0.25, 0.055, 0.125], mass: 1.05, fr: 0.95, re: 1.5, round: 0.004, spots: 'all8', desc: '각이 살아 꼭짓점에서 크게 튀어요' },
  worn:   { name: '닳은', dims: [0.21, 0.042, 0.11], mass: 0.7, fr: 0.8, re: 0.7, round: 0.03, spots: 'edges4', desc: '모서리가 닳아 잘 미끄러져요' },
  half:   { name: '반토막', dims: [0.14, 0.05, 0.125], mass: 0.55, fr: 1.0, re: 1.0, ang: 1.6, spots: 'half6', desc: '짧고 가벼워요' },
  flat:   { name: '납작', dims: [0.27, 0.03, 0.14], mass: 0.7, fr: 1.1, re: 0.8, ang: 1.4, spots: 'ends6', desc: '얇아서 올라타이기 쉬워요' },
  square: { name: '정사각', dims: [0.16, 0.06, 0.16], mass: 0.95, fr: 1.0, re: 1.0, spots: 'all8', desc: '어느 쪽으로 밀어도 비슷해요' },
  long:   { name: '길쭉이', dims: [0.36, 0.045, 0.09], mass: 0.9, fr: 1.0, re: 0.9, ang: 1.3, spots: 'long6', desc: '길어서 한번 돌면 크게 돌아요' },
  art:    { name: '미술', dims: [0.33, 0.09, 0.2], mass: 2.4, fr: 1.3, re: 0.5, spots: 'art6', desc: '크고 무겁고 말랑해요' },
  mini:   { name: '꼬마', dims: [0.18, 0.045, 0.105], mass: 0.5, fr: 1.06, re: 0.66, ang: 2.48, lift: 0.83, spin: -0.15, push: 1.05, spots: 'edges4', desc: '작고 가벼워요' },
  jumbo:  { name: '점보', dims: [0.33, 0.065, 0.165], mass: 2.1, fr: 1.2, re: 0.6, spots: 'all8', desc: '무겁고 넓어요' },
  bouncy: { name: '탱탱', dims: [0.23, 0.06, 0.12], mass: 0.8, fr: 1.52, re: 1.69, ang: 2.61, lift: 1.26, spin: -0.2, push: 0.89, spots: 'diag6', desc: '통통 튀어요' },
  // ---- 모양 지우개: parts는 충돌 덩어리이자 그리는 덩어리(box 반치수 h / cyl 반높이 hh·반지름 rad, 축은 y / ball / hull 점들). p는 위치, r은 회전(라디안).
  bear:   { name: '고양이', group: '동물', mass: 0.9, fr: 1.0, re: 0.9, spots: 'animal6', desc: '네모난 몸, 꼬리가 걸려요', tone: 0.0,
    parts: MODELS.bear.parts, model: 'bear' },
  rabbit: { name: '토끼', group: '동물', mass: 0.6, fr: 0.95, re: 1.2, spots: 'animal6', desc: '작고 가벼워요, 긴 귀가 삐죽', tone: 0.35,
    parts: MODELS.rabbit.parts, model: 'rabbit' },
  turtle: { name: '코끼리', group: '동물', mass: 1.7, fr: 1.25, re: 0.45, spots: 'edges4', desc: '크고 묵직해요', tone: -0.25,
    parts: MODELS.turtle.parts, model: 'turtle' },
  wrest1: { name: '레슬러', group: '레슬링', mass: 0.8, fr: 1.05, re: 0.9, spots: 'ends6', desc: '만세 자세, 팔다리가 걸려요', tone: 0.15,
    parts: MODELS.wrest1.parts, model: 'wrest1' },
  wrest2: { name: '덩치', group: '레슬링', mass: 1.5, fr: 1.15, re: 0.6, spots: 'all8', desc: '두툼하고 힘이 세요', tone: -0.1,
    parts: MODELS.wrest2.parts, model: 'wrest2' },
  roll:   { name: '육각', group: '특이', mass: 0.75, fr: 1.1, re: 0.7, ang: 1.6, spots: 'edges4', desc: '옆으로 누르면 데굴데굴 구르다 면으로 멈춰요', tone: 0.25,
    parts: [{ s: 'hull', pts: [-0.19, 0.19].flatMap((x) => [0, 1, 2, 3, 4, 5].map((i) => [x, Math.cos((i * Math.PI) / 3 + Math.PI / 6) * 0.078, Math.sin((i * Math.PI) / 3 + Math.PI / 6) * 0.078])) }] },
  prism:  { name: '삼각', group: '특이', mass: 0.8, fr: 1.1, re: 0.8, spots: 'edges4', desc: '뾰족해서 위에 얹히기 어려워요', tone: -0.35,
    parts: [{ s: 'hull', pts: [[0.2, -0.07, 0.1], [0.2, -0.07, -0.1], [0.2, 0.085, 0], [-0.2, -0.07, 0.1], [-0.2, -0.07, -0.1], [-0.2, 0.085, 0]] }] },
};
// 모양 정보: 덩어리들의 무게중심을 원점으로 옮기고, 전체를 감싸는 반치수(dims)를 구해 둔다.
const eul = ([x, y, z]) => { const c = Math.cos, s2 = Math.sin, cx = c(x / 2), sx = s2(x / 2), cy = c(y / 2), sy = s2(y / 2), cz = c(z / 2), sz = s2(z / 2); return { x: sx * cy * cz + cx * sy * sz, y: cx * sy * cz - sx * cy * sz, z: cx * cy * sz + sx * sy * cz, w: cx * cy * cz - sx * sy * sz }; };
const qrot = (q, v) => { const { x, y, z, w } = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]); return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]; };
const shapes = {};
export function shapeOf(type) {
  if (shapes[type]) return shapes[type];
  const T = TYPES[type];
  if (!T.parts) return (shapes[type] = { plain: true, parts: [{ s: 'box', h: T.dims, p: [0, 0, 0], q: eul([0, 0, 0]), round: T.round, vol: 1 }], decor: [], dims: T.dims });
  const parts = T.parts.map((pt) => {
    const q = pt.q || eul(pt.r || [0, 0, 0]);
    let vol, corners, c = pt.p ? [...pt.p] : [0, 0, 0];
    if (pt.s === 'box') { vol = 8 * pt.h[0] * pt.h[1] * pt.h[2]; corners = [-1, 1].flatMap((a) => [-1, 1].flatMap((b) => [-1, 1].map((d) => [a * pt.h[0], b * pt.h[1], d * pt.h[2]]))); }
    else if (pt.s === 'cyl') { vol = 2 * pt.hh * Math.PI * pt.rad ** 2; corners = [-1, 1].flatMap((a) => [-1, 1].flatMap((b) => [-1, 1].map((d) => [a * pt.rad, b * pt.hh, d * pt.rad]))); }
    else if (pt.s === 'ball') { vol = (4 / 3) * Math.PI * pt.rad ** 3; corners = [-1, 1].flatMap((a) => [-1, 1].flatMap((b) => [-1, 1].map((d) => [a * pt.rad, b * pt.rad, d * pt.rad]))); }
    else { corners = pt.pts; const n = pt.pts.length; c = [0, 1, 2].map((k) => pt.pts.reduce((a, v) => a + v[k], 0) / n); vol = 0.02; }
    return { ...pt, q, vol, c, corners: pt.s === 'hull' ? pt.pts : corners.map((v) => qrot(q, v).map((x, k) => x + c[k])) };
  });
  const tot = parts.reduce((a, p) => a + p.vol, 0), com = [0, 1, 2].map((k) => parts.reduce((a, p) => a + p.c[k] * p.vol, 0) / tot);
  const dims = [0, 0, 0];
  for (const p of parts) {
    if (p.s === 'hull') p.pts = p.pts.map((v) => v.map((x, k) => x - com[k])); else p.p = p.c.map((x, k) => x - com[k]);
    for (const v of p.corners) for (let k = 0; k < 3; k++) dims[k] = Math.max(dims[k], Math.abs(v[k] - com[k]));
    p.vol /= tot;
  }
  const decor = (T.decor || []).map((d) => ({ ...d, p: d.p.map((x, k) => x - com[k]) }));
  T.dims = dims.map((v) => Math.round(v * 1000) / 1000);
  return (shapes[type] = { plain: false, parts, decor, dims: T.dims, com });
}
for (const k of Object.keys(TYPES)) shapeOf(k);
export { MODELS };
export const TYPE_KEYS = Object.keys(TYPES);
// 누름 자리: 지금 위로 온 면의 긴 방향 s, 짧은 방향 t (-1~1). 지우개는 누른 자리의 반대쪽으로 튀어 나간다.
// 가장자리 가운데(면)는 곧게, 꼭짓점은 대각선 축으로 구르며 튀어 읽기 어렵다.
const E = { end1: [-1, 0, '끝'], end2: [1, 0, '끝'], side1: [0, -1, '옆'], side2: [0, 1, '옆'] };
const C = { c1: [-1, -1, '꼭짓점'], c2: [-1, 1, '꼭짓점'], c3: [1, 1, '꼭짓점'], c4: [1, -1, '꼭짓점'] };
export const SPOT_SETS = {
  all8:   [E.end1, C.c2, E.side2, C.c3, E.end2, C.c4, E.side1, C.c1],
  edges4: [E.end1, E.side2, E.end2, E.side1],
  ends2:  [E.end1, E.end2],
  ends6:  [E.end1, C.c2, C.c3, E.end2, C.c4, C.c1],
  half6:  [E.end1, C.c2, E.side2, E.end2, E.side1, C.c1],
  long6:  [E.end1, [-0.5, 1, '옆'], [0.5, 1, '옆'], E.end2, [0.5, -1, '옆'], [-0.5, -1, '옆']],
  art6:   [E.end1, E.side2, E.end2, E.side1, [-0.5, 0, '안쪽'], [0.5, 0, '안쪽']],
  diag6:  [E.end1, C.c2, E.side2, E.end2, C.c4, E.side1],
  animal6: [E.end1, E.side2, C.c3, E.end2, C.c4, E.side1],
};
export const spotsOf = (type) => SPOT_SETS[TYPES[type].spots];
// 누르는 위치: v는 위로 뜨는 힘, h는 앞으로 가는 힘, spin은 회전에 더하는 값
export const HITS = [
  { key: 'front', name: '앞', v: 0.35, h: 1.12, spin: -0.22, desc: '낮게 미끄러져 밀어내기' },
  { key: 'mid', name: '가운데', v: 1.0, h: 1.0, spin: 0, desc: '기본' },
  { key: 'back', name: '뒤', v: 1.4, h: 0.9, spin: 0.18, desc: '높이 떠서 올라타기' },
];

export const GEOM = {
  round: 0.012,                                  // 충돌체 모서리 반경
  desk: { hx: 3.0, hz: 2.0, thick: 0.25 },       // 책상 60cm × 40cm, 윗면이 y=0
  floorY: -7,                                    // 교실 바닥
  fallY: -1.0,                                   // 이 높이 아래로 내려가면 낙하
};

// key, 이름, 기본값, 최소, 최대, 간격, 설명
export const SETTING_DEFS = [
  ['impulse',     '발사 충격량',       16.0,  0.5, 30,  0.1,  '파워 100%일 때의 수평 충격량. 수평 이동 세기.'],
  ['vAssist',     '수직 보조 충격량',  0.38, 0,   1.5, 0.01, '수평 충격량 대비 위쪽 충격 비율. 앞부분 들림과 도약을 돕는다.'],
  ['spinAssist',  '회전 보조 강도',    0.26,  -1,  1,   0.01, '추가 회전 충격. 양수면 앞이 들리는 쪽, 음수면 앞으로 구르는 쪽.'],
  ['hitBack',     '충격 위치(뒤쪽)',   0.32,  0,   1,   0.01, '무게중심에서 발사 반대쪽으로 얼마나 떨어진 곳을 치는가. 1이면 뒤끝.'],
  ['hitSide',     '충격 위치(옆 비낌)', 0.85, 0,   1,   0.01, '비스듬히 놓인 지우개를 칠 때 손가락이 모서리·꼭짓점 쪽으로 비껴 닿는 정도. 0이면 항상 중심선.'],
  ['hitHeight',   '충격 위치(높이)',   -0.7, -1,  1,   0.01, '무게중심 기준 높이. -1이면 바닥 모서리, 1이면 윗면.'],
  ['powerCurve',  '파워 곡선',         1.25, 0.5, 3,   0.05, '게이지 값에 거듭제곱. 클수록 약한 구간이 더 섬세해진다.'],
  ['friction',    '마찰 계수',         0.6, 0,   2,   0.01, '책상과 지우개 접촉 마찰.'],
  ['restitution', '반발 계수',         0.15, 0,   1,   0.01, '충돌 시 튀는 정도.'],
  ['linDamp',     '선형 감쇠',         0.45, 0,   5,   0.01, '이동 속도가 줄어드는 정도.'],
  ['angDamp',     '각 감쇠',           2.25,  0,   8,   0.01, '회전 속도가 줄어드는 정도.'],
  ['gravity',     '중력',              60,   10,  150, 1,    '아래 방향 가속도(단위/초²). 실제 비율은 약 98.'],
  ['stableLin',   '안정 선속도 기준',  0.06, 0.005, 1, 0.005, '이 값보다 느리면 거의 멈춘 것으로 본다.'],
  ['stableAng',   '안정 각속도 기준',  0.35, 0.01, 5,  0.01, '이 값보다 느리게 돌면 거의 멈춘 것으로 본다.'],
  ['stableHold',  '안정 유지 시간',    0.45, 0.05, 3,  0.05, '멈춘 상태가 이만큼 이어지면 턴을 끝낸다(초).'],
  ['perchHold',   '걸침 유지 시간',    0.8,  0.1, 4,   0.05, '걸친 상태가 이만큼 이어지면 승리로 확정한다(초).'],
  ['gaugePeriod', '게이지 왕복 시간',  1.7,  0.5, 5,   0.1,  '(개발용 방향 발사) 파워 게이지가 한 번 왕복하는 시간(초).'],
  ['cornerPop',   '꼭짓점 들림 배율',  1.45, 0.5, 3,   0.05, '꼭짓점을 눌렀을 때 위로 뜨는 힘의 배율. 받치는 면이 작아 더 쉽게 들린다.'],
  ['cornerSpin',  '꼭짓점 비틀림',     0.3,  0,   1.5, 0.05, '꼭짓점을 눌렀을 때 더해지는 회전(대각선 축으로 구르게 한다).'],
  ['pressTime',   '꾹 누르는 시간',    1.3,  0.4, 4,   0.05, '손가락으로 누르는 힘이 0에서 최대까지 차는 시간(초).'],
  ['pressHold',   '최대에서 버티는 시간', 0.6, 0.1, 3,  0.05, '힘이 다 찬 뒤 이만큼 더 누르고 있으면 손가락이 미끄러져 저절로 튕긴다(초).'],
];
export const APPLY_NOTE = '다음 발사부터 적용';

export function defaultSettings() {
  const s = { version: SETTINGS_VERSION };
  for (const [k, , v] of SETTING_DEFS) s[k] = v;
  return s;
}
// 가져온 설정을 검사한다. 반환: { ok, settings, errors[] }
export function validateSettings(input) {
  const errors = [];
  const out = defaultSettings();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, settings: out, errors: ['설정은 객체(JSON {…})여야 합니다.'] };
  if (input.version !== undefined && input.version !== SETTINGS_VERSION) errors.push(`버전이 다릅니다(파일 ${input.version}, 현재 ${SETTINGS_VERSION}).`);
  const known = new Set(SETTING_DEFS.map((d) => d[0]));
  for (const k of Object.keys(input)) if (k !== 'version' && !known.has(k)) errors.push(`알 수 없는 항목: ${k}`);
  for (const [k, name, , min, max] of SETTING_DEFS) {
    if (!(k in input)) { errors.push(`${name}(${k}) 값이 없습니다.`); continue; }
    const v = input[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) { errors.push(`${name}(${k})는 숫자여야 합니다.`); continue; }
    if (v < min || v > max) { errors.push(`${name}(${k})는 ${min}~${max} 사이여야 합니다(입력 ${v}).`); continue; }
    out[k] = v;
  }
  return { ok: errors.length === 0, settings: out, errors };
}

// 기본 배치: 서로 마주 보고 15cm 떨어져 있다. q는 y축 회전(라디안)으로 준다.
// 'match' 일반 경기: 책상 양쪽에 40cm쯤 떨어져, 매번 조금씩 다른 각도로 놓인다(rnd는 0~1 난수 함수).
// 'near' 개발자 검증: 15cm 거리에 고정 배치. 올라타기와 접촉 판정을 반복 확인하는 용도.
export function initialLayout(types = ['normal', 'normal'], mode = 'near', rnd = Math.random) {
  if (mode === 'match') {
    const r = (a, b) => a + rnd() * (b - a);
    return {
      bodies: [
        { p: [-2.0, TYPES[types[0]].dims[1] + 0.002, r(-0.5, 0.5)], yaw: r(-0.6, 0.6), type: types[0] },
        { p: [2.0, TYPES[types[1]].dims[1] + 0.002, r(-0.5, 0.5)], yaw: Math.PI + r(-0.6, 0.6), type: types[1] },
      ],
      aim: [0, Math.PI],
    };
  }
  return {
    bodies: [
      { p: [-0.75, TYPES[types[0]].dims[1] + 0.002, 0.04], yaw: 0.10, type: types[0] },
      { p: [0.75, TYPES[types[1]].dims[1] + 0.002, -0.04], yaw: Math.PI - 0.14, type: types[1] },
    ],
    aim: [0, Math.PI],          // 각 플레이어의 기본 발사 방향(상대 쪽)
  };
}
