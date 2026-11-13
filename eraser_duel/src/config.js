// 물리 설정과 형상. 1 단위 = 10cm (지우개 5cm × 2.5cm × 1cm).
export const DT = 1 / 120;                       // 고정 시간 간격(초)
export const SETTINGS_VERSION = 1;

export const GEOM = {
  hx: 0.25, hy: 0.05, hz: 0.125,                 // 지우개 반치수: 길이 / 두께 / 폭
  round: 0.012,                                  // 충돌체 모서리 반경
  desk: { hx: 3.0, hz: 2.0, thick: 0.25 },       // 책상 60cm × 40cm, 윗면이 y=0
  floorY: -7,                                    // 교실 바닥
  fallY: -1.0,                                   // 이 높이 아래로 내려가면 낙하
};

// key, 이름, 기본값, 최소, 최대, 간격, 설명
export const SETTING_DEFS = [
  ['impulse',     '발사 충격량',       19.6,  0.5, 30,  0.1,  '파워 100%일 때의 수평 충격량. 수평 이동 세기.'],
  ['vAssist',     '수직 보조 충격량',  0.38, 0,   1.5, 0.01, '수평 충격량 대비 위쪽 충격 비율. 앞부분 들림과 도약을 돕는다.'],
  ['spinAssist',  '회전 보조 강도',    0.26,  -1,  1,   0.01, '추가 회전 충격. 양수면 앞이 들리는 쪽, 음수면 앞으로 구르는 쪽.'],
  ['hitBack',     '충격 위치(뒤쪽)',   0.32,  0,   1,   0.01, '무게중심에서 발사 반대쪽으로 얼마나 떨어진 곳을 치는가. 1이면 뒤끝.'],
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
  ['gaugePeriod', '게이지 왕복 시간',  1.7,  0.5, 5,   0.1,  '파워 게이지가 한 번 왕복하는 시간(초).'],
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
export function initialLayout() {
  return {
    bodies: [
      { p: [-0.75, GEOM.hy + 0.002, 0.04], yaw: 0.10 },
      { p: [0.75, GEOM.hy + 0.002, -0.04], yaw: Math.PI - 0.14 },
    ],
    aim: [0, Math.PI],          // 각 플레이어의 기본 발사 방향(상대 쪽)
  };
}
