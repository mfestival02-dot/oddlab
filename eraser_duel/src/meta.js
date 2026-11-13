// 필통(모은 지우개)과 전적. 이 브라우저에만 저장된다.
import { TYPE_KEYS } from './config.js';
const KEY = 'eraser-duel-save-v1';
const fresh = () => ({ version: 1, erasers: { mini: 0, normal: 1, jumbo: 0, bouncy: 0 }, wins: 0, losses: 0 });
export function loadMeta() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY));
    if (o && o.version === 1 && o.erasers) { const m = fresh(); for (const k of TYPE_KEYS) m.erasers[k] = Math.max(0, Math.floor(Number(o.erasers[k]) || 0)); m.erasers.normal = Math.max(1, m.erasers.normal); m.wins = o.wins | 0; m.losses = o.losses | 0; return m; }
  } catch { /* 저장소를 못 쓰는 환경이면 새로 시작한다 */ }
  return fresh();
}
export function saveMeta(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* 무시 */ } }
// 혼자 하기 결과를 필통에 반영한다. 보통 지우개 하나는 잃지 않는다. 반환: 화면에 보여 줄 한 줄
export function applyResult(m, winner, myType, cpuType, names) {
  if (winner === 0) { m.wins++; m.erasers[cpuType]++; saveMeta(m); return `${names[cpuType]} 지우개를 땄다!`; }
  if (winner === 1) {
    m.losses++;
    const keep = myType === 'normal' && m.erasers.normal <= 1;
    if (!keep) m.erasers[myType] = Math.max(0, m.erasers[myType] - 1);
    saveMeta(m);
    return keep ? '졌지만 마지막 보통 지우개는 지켰다' : `${names[myType]} 지우개를 뺏겼다…`;
  }
  return '비겨서 아무도 못 땄다';
}
