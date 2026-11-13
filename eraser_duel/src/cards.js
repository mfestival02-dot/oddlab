// 지우개 고르기 카드(혼자·둘이·온라인 공통): 3D 미리보기 그림, 이름, 특징, 누름 자리 수, 무게·탄성 막대
import { TYPES, spotsOf } from './config.js';
import { PLAYER } from './view.js';
const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); kids.forEach((k) => e.append(k)); return e; };
import STATS from './stats.json';
// 실제로 잰 능력치 막대(tools/measure_stats.mjs)
export function abilityBars(key, side) {
  const s = STATS[key] || {}, box = el('span', { className: 'abil' });
  box.style.setProperty('--c', PLAYER[side].css);
  for (const [label, v] of [['속도', s.speed], ['튀는 높이', s.hop], ['균형', s.balance], ['무게', s.weight]]) { const b = el('b', {}, [el('i')]); b.firstChild.style.width = Math.round(Math.max(0.06, Math.min(1, v || 0)) * 100) + '%'; box.append(el('span', {}, [label, b])); }
  return box;
}
export function eraserCard(view, key, side, { selected = false, disabled = false, badge = '' } = {}) {
  const T = TYPES[key], spots = spotsOf(key);
  const c = el('button', { className: 'card' + (selected ? ' sel' : ''), disabled, title: T.desc });
  c.style.setProperty('--c', PLAYER[side].css);
  const img = el('img', { alt: '', width: 100, height: 65 }); view.thumbInto(img, key, side);
  const dots = el('span', { className: 'dots' });
  for (const sp of spots) dots.append(el('i', { className: sp[2] === '꼭짓점' ? 'c' : sp[2] === '끝' ? 'e' : sp[2] === '옆' ? 's' : 'n' }));   // 누름 자리 구성을 색 점으로
  c.append(img, el('strong', { textContent: T.name }), dots);
  if (badge) c.append(el('em', { textContent: badge }));
  return c;
}
