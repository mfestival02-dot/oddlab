// 거리별로 어느 '누르는 위치'가 올라타기에 유리한지 센다(조정용).
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, PHASE } from '../src/game.js';
import { yawQuat } from '../src/sim.js';
import { defaultSettings, TYPES, HITS } from '../src/config.js';
await RAPIER.init();
const types = (process.argv[2] || 'normal,normal').split(',');
const g = new Game(RAPIER);
console.log('지우개', types.join(' vs '), ' (칸: 올라탐 / 상대를 떨어뜨림 / 내가 떨어짐, 방향 5 × 파워 18 = 90발)');
for (const dist of [0.7, 1.0, 1.5, 2.2, 3.0]) {
  let row = `거리 ${dist.toFixed(1)}  `;
  for (let h = 0; h < 3; h++) {
    let P = 0, f = 0, F = 0, lo = 9, hi = 0;
    for (const a of [-6, -3, 0, 3, 6]) for (let p = 0.15; p <= 1.001; p += 0.05) {
      g.restore({ state: { bodies: [{ p: [-dist / 2, TYPES[types[0]].dims[1] + 0.002, 0], q: yawQuat(0.1), type: types[0] }, { p: [dist / 2, TYPES[types[1]].dims[1] + 0.002, 0], q: yawQuat(3.0), type: types[1] }] }, player: 0, aim: [0, Math.PI], angle: 0, power: null, settings: defaultSettings() });
      g.fire((a * Math.PI) / 180, p, h); g.runUntilSettled(20);
      const r = g.result;
      if (r?.reason === 'perch' && r.winner === 0) { P++; lo = Math.min(lo, p); hi = Math.max(hi, p); } else if (r?.reason === 'fell') (r.winner === 0 ? f++ : F++);
    }
    row += `${HITS[h].name.padEnd(3)} ${String(P).padStart(2)}/${String(f).padStart(2)}/${String(F).padStart(2)}${P ? ` (파워 ${Math.round(lo * 100)}~${Math.round(hi * 100)})` : ''}`.padEnd(30);
  }
  console.log(row);
}
