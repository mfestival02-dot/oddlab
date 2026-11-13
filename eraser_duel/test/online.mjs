// 온라인 서버 검증: 실제 서버를 띄우고 WebSocket 손님 여럿으로 방·차례·재접속·재대결을 확인한다.
import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5199, GRACE = 1800;
const srv = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT, GRACE_MS: GRACE, HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res) => srv.stdout.on('data', (d) => { if (String(d).includes('서버')) res(); }));
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '통과' : '실패'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(name, token) {
  const c = { name, msgs: [], last: {}, states: [], errors: [], id: 0 };
  c.open = () => new Promise((res) => {
    c.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    c.ws.on('open', () => { c.send({ t: 'hello', name, token: c.token ?? token }); });
    c.ws.on('message', (raw) => {
      const m = JSON.parse(raw); c.msgs.push(m); c.last[m.t] = m;
      if (m.t === 'welcome') { c.token = m.token; res(m); }
      if (m.t === 'state') c.states.push(m);
      if (m.t === 'error') c.errors.push(m.code);
      if (m.t === 'sping') c.send({ t: 'spong', s: m.s });
    });
    c.ws.on('close', () => { c.closed = true; });
  });
  c.send = (m) => c.ws.readyState === 1 && c.ws.send(JSON.stringify(m));
  c.wait = async (pred, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = pred(); if (v) return v; await sleep(15); } return null; };
  c.state = () => c.states[c.states.length - 1];
  return c;
}

const A = client('가영'), B = client('나은'), C = client('다솜'), D = client('라희');
await Promise.all([A.open(), B.open(), C.open(), D.open()]);

// --- 비공개 방과 초대 ---
A.send({ t: 'create', name: '우리끼리', public: false });
const roomA = await A.wait(() => A.last.room);
C.send({ t: 'list' }); await sleep(120);
check('O1. 비공개 방을 만들면 코드가 나오고 공개 목록에는 안 보인다', !!roomA && roomA.code.length === 5 && !C.last.rooms.rooms.some((r) => r.code === roomA.code), `코드 ${roomA?.code}`);
B.send({ t: 'join', code: roomA.code.toLowerCase() });
await B.wait(() => B.last.room && B.last.room.seats[1]);
check('O2. 친구가 코드로 들어오면 양쪽 화면의 방 상태가 같다', A.last.room.seats[1]?.name === '나은' && B.last.room.seats[0]?.name === '가영' && B.last.room.you === 1 && A.last.room.you === 0);
C.send({ t: 'join', code: roomA.code }); D.send({ t: 'join', code: 'ZZZZZ' });
await C.wait(() => C.errors.length); await D.wait(() => D.errors.length);
check('O3. 세 번째 사람은 "가득 참", 없는 방은 "없는 방"으로 거절한다', C.errors.includes('full') && D.errors.includes('no-room'), `${C.last.error.text} / ${D.last.error.text}`);

// --- 공개 방 ---
C.send({ t: 'create', name: '아무나 한 판', public: true });
await C.wait(() => C.last.room);
D.send({ t: 'list' }); await D.wait(() => D.last.rooms && D.last.rooms.rooms.length);
const pub = D.last.rooms.rooms[0];
check('O4. 공개 방은 목록에 이름·인원·대기 상태와 함께 보인다', pub && pub.name === '아무나 한 판' && pub.count === 1 && pub.waiting === true, JSON.stringify(pub));
D.send({ t: 'join', code: pub.code }); await D.wait(() => D.last.room && D.last.room.seats[1]);
check('O5. 목록에서 공개 방에 들어갈 수 있다', D.last.room.code === pub.code && D.last.room.seats.filter(Boolean).length === 2);

// --- 준비와 시작 ---
A.send({ t: 'type', type: 'jumbo' }); A.send({ t: 'type', type: 'nope' });
A.send({ t: 'ready', ready: true }); await sleep(100);
const notYet = !A.last.match;
B.send({ t: 'ready', ready: true });
await A.wait(() => A.last.match && A.state()); await B.wait(() => B.last.match && B.state());
check('O6. 둘 다 준비해야 시작하고, 고른 지우개가 반영된다', notYet && A.last.match.types[0] === 'jumbo' && A.errors.includes('bad-type') && A.last.room.phase === 'playing');
E_join: { const E = client('마루'); await E.open(); E.send({ t: 'join', code: roomA.code }); await E.wait(() => E.errors.length); check('O7. 이미 시작한 방에는 다른 사람이 들어올 수 없다', E.errors.includes('in-progress')); E.ws.close(); }
let sa = A.state(), sb = B.state();
check('O8. 양쪽 화면의 차례와 턴 번호가 같다', sa.pl === sb.pl && sa.turn === sb.turn && sa.turn === 1 && sa.ph === 'aim', `${sa.pl + 1}P 차례, 턴 ${sa.turn}`);
const dist0 = Math.abs(sa.b[0][0] - sa.b[1][0]);
check('O9. 일반 경기는 멀리 떨어져 시작한다', dist0 > 3.5, `두 지우개 사이 ${(dist0 * 10).toFixed(0)}cm`);

// --- 입력 검증 ---
const first = sa.pl === 0 ? A : B, second = sa.pl === 0 ? B : A;
second.errors.length = 0;
second.send({ t: 'gaugeStart', turn: 1, id: ++second.id }); second.send({ t: 'aim', turn: 1, a: 1, h: 1 });
await second.wait(() => second.errors.length >= 2);
check('O10. 상대 차례에는 조준도 발사도 거절한다', second.errors.every((e) => e === 'not-your-turn') && A.state().ph === 'aim');
first.errors.length = 0;
first.send({ t: 'aim', turn: 1, a: 'NaN', h: 1 }); first.send({ t: 'aim', turn: 1, a: 0.1, h: 9 }); first.send({ t: 'aim', turn: 1, a: 1e9, h: 1 }); first.send({ t: 'gaugeStart', turn: 7, id: ++first.id });
await first.wait(() => first.errors.length >= 4);
check('O11. 숫자가 아니거나 범위를 벗어난 값, 지난 턴 번호는 거절한다', first.errors.filter((e) => e === 'bad-value').length === 3 && first.errors.includes('stale-turn'), first.errors.join(', '));
// 개발자용 조작은 서버에 아예 없다
const before = JSON.stringify(A.state().b);
for (const t of ['fire', 'restore', 'settings', 'setState', 'win', 'restart']) first.send({ t, turn: 1, angle: 0, power: 1, winner: 0, settings: { gravity: 1 }, b: [[0, 0, 0]] });
await sleep(250);
check('O12. 설정 변경·상태 복원·임의 발사·승패 변경 같은 요청은 서버가 받지 않는다', JSON.stringify(A.state().b) === before && A.state().ph === 'aim' && !A.last.room.result);
// 게이지
const aimA = first === A ? 0 : Math.PI;
first.send({ t: 'aim', turn: 1, a: aimA, h: 1 });
first.errors.length = 0;
const gid = ++first.id;
first.send({ t: 'gaugeStart', turn: 1, id: gid }); first.send({ t: 'gaugeStart', turn: 1, id: gid });
await first.wait(() => first.state().ph === 'power');
first.send({ t: 'gaugeStop', turn: 1, id: ++first.id, gt: 0.5 });       // 시작하자마자
await first.wait(() => first.errors.length >= 2);
check('O13. 같은 요청을 두 번 보내도 한 번만 처리하고, 게이지를 시작하자마자는 튕길 수 없다', first.errors.includes('duplicate') && first.errors.includes('too-early') && first.state().ph === 'power', first.errors.join(', '));
// 지연 보정: 화면에서 본 게이지 시간을 보내면 한도 안에서만 되돌려 준다
await first.wait(() => first.state().gt > 0.9);
const gtServer = first.state().gt;
first.send({ t: 'gaugeStop', turn: 1, id: ++first.id, gt: 0.1 });       // 1초 가까이 전에 눌렀다고 우긴다
await first.wait(() => first.state().ph === 'physics');
const sp = first.state().sp, period = first.last.match.settings.gaugePeriod;
const at = (t) => { const u = (t / period) % 1; return u < 0.5 ? u * 2 : 2 - u * 2; };
const claimed = at(0.1), lo = Math.min(at(gtServer - 0.3), at(gtServer + 0.2)), hi = Math.max(at(gtServer - 0.3), at(gtServer + 0.2), 1);
check('O14. 파워는 서버의 게이지로 정하고, 지연 보정은 0.25초 한도 안에서만 한다', Math.abs(sp - claimed) > 0.2 && sp >= lo - 0.05 && sp <= hi + 0.05, `우긴 값 ${(claimed * 100).toFixed(0)}% → 실제 적용 ${(sp * 100).toFixed(0)}% (서버 게이지 ${gtServer.toFixed(2)}초 시점)`);

// --- 물리 진행 중 끊김과 재접속 ---
const tokenB = B.token;
B.ws.close(); await sleep(200);
check('O15. 끊기면 상대 화면에 끊김과 남은 유예 시간이 표시된다', A.last.room.seats[1].connected === false && A.last.room.seats[1].graceLeft > 0);
const X = client('나은', 'deadbeefdeadbeefdeadbeefdeadbeef'); await X.open(); await sleep(150);
check('O16. 이름과 방 코드를 알아도 토큰이 다르면 그 자리로 들어올 수 없다', X.last.welcome.resumed === false && !X.last.room && A.last.room.seats[1].connected === false);
X.ws.close();
const B2 = client('아무이름', tokenB); await B2.open(); await B2.wait(() => B2.state());
check('O17. 같은 토큰으로 다시 붙으면 같은 자리로 돌아와 전체 상태를 받는다', B2.last.welcome.resumed === true && B2.last.room.you === 1 && B2.last.welcome.name === '나은' && B2.state().m === A.state().m && A.last.room.seats[1].connected === true);
// 발사가 끝날 때까지 기다려 양쪽 결과 비교
await A.wait(() => A.state().ph !== 'physics', 20000); await sleep(300);
sa = A.state(); sb = B2.state();
const same = (x, y) => x.b.every((b, i) => b.every((v, k) => Math.abs(v - y.b[i][k]) < 1e-6));
check('O18. 발사가 끝난 뒤 양쪽이 받은 위치·차례가 같다(끊겨 있던 동안에도 서버는 계속 계산)', sa.n === sb.n && same(sa, sb) && sa.pl === sb.pl && sa.turn === sb.turn, `${sa.ph}, 턴 ${sa.turn}, ${sa.pl + 1}P 차례`);

// --- 경기 끝까지: 한쪽이 최대 세기로 날려 떨어뜨린다 ---
async function shoot(c, seat, turn, stopAt) {
  c.send({ t: 'aim', turn, a: seat === 0 ? 0.6 : Math.PI + 0.6, h: 1 });
  c.send({ t: 'gaugeStart', turn, id: ++c.id });
  await c.wait(() => c.state().ph === 'power' && c.state().gt >= stopAt);
  c.send({ t: 'gaugeStop', turn, id: ++c.id, gt: c.state().gt });
  await c.wait(() => c.state().ph === 'physics' || c.state().res);
  await c.wait(() => c.state().ph !== 'physics', 20000);
}
const AA = A, BB = B2;
let guard = 0;
while (!AA.state().res && guard++ < 6) { const s = AA.state(); await shoot(s.pl === 0 ? AA : BB, s.pl, s.turn, period * 0.5 - 0.01); await sleep(200); }
await AA.wait(() => AA.last.room.phase === 'over'); await sleep(200);
const res = AA.state().res;
check('O19. 서버가 승패를 정해 양쪽에 같은 결과를 알린다', !!res && JSON.stringify(res) === JSON.stringify(BB.state().res) && AA.last.room.phase === 'over', JSON.stringify(res));

// --- 재대결 ---
const oldMatch = AA.state().m;
AA.send({ t: 'rematch', yes: true }); await sleep(150);
const waitingOne = AA.last.room.phase === 'over' && BB.last.room.seats[0].rematch === true;
BB.send({ t: 'rematch', yes: true });
await AA.wait(() => AA.state().m === oldMatch + 1); await sleep(150);
sa = AA.state();
check('O20. 둘 다 동의해야 재대결하고, 새 판은 번호·차례·위치·결과가 초기화된다', waitingOne && sa.m === oldMatch + 1 && sa.turn === 1 && sa.ph === 'aim' && !sa.res && Math.abs(sa.b[0][0] - sa.b[1][0]) > 3.5 && sa.pl !== undefined, `경기 ${oldMatch} → ${sa.m}, 선공 ${sa.pl + 1}P`);
{
  const fresh = AA.states.filter((s) => s.m === oldMatch + 1), firstNew = AA.states.findIndex((s) => s.m === oldMatch + 1);
  const noOldAfter = AA.states.slice(firstNew).every((s) => s.m === oldMatch + 1), noRes = fresh.every((s) => !s.res), seqOk = fresh[0].n === 1 && fresh.every((s, i) => i === 0 || s.n > fresh[i - 1].n);
  check('O20b. 새 경기가 시작된 뒤에는 지난 경기의 상태·결과가 섞이지 않고 순번이 1부터 다시 오른다', noOldAfter && noRes && seqOk, `새 경기 상태 ${fresh.length}개, 지난 경기 섞임 ${!noOldAfter}, 결과 남음 ${!noRes}, 순번 ${fresh[0].n}~${fresh[fresh.length - 1].n}`);
}

// --- 유예 시간이 지나면 기권 ---
BB.ws.close();
await AA.wait(() => AA.state().res, GRACE + 6000);
check('O21. 끊긴 사람이 유예 시간 안에 돌아오지 않으면 기권 처리하고 이유를 알린다', AA.state().res?.reason === 'forfeit-timeout' && AA.state().res.winner === 0, JSON.stringify(AA.state().res));

// --- 스스로 나가기, 빈 방 정리 ---
C.send({ t: 'ready', ready: true }); D.send({ t: 'ready', ready: true });
await C.wait(() => C.state());
D.send({ t: 'leave' });
await C.wait(() => C.state().res);
check('O22. 경기 중에 스스로 나가면 곧바로 상대 승리로 끝난다(끊김과 구분)', C.state().res.reason === 'forfeit-left' && C.state().res.winner === 0);
C.send({ t: 'leave' }); AA.send({ t: 'leave' }); await sleep(300);
const health = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
check('O23. 모두 나간 방은 정리되고, 상태 확인 주소가 응답한다', health.ok === true && health.rooms === 0, JSON.stringify(health));
const html = await fetch(`http://127.0.0.1:${PORT}/`);
check('O24. 같은 서버가 게임 화면도 내준다', html.status === 200 && (await html.text()).includes('지우개 따먹기'));

// --- 서버 종료 ---
const Z = client('종료확인'); await Z.open();
srv.kill('SIGTERM');
await Z.wait(() => Z.last.closed || Z.closed, 3000);
check('O25. 서버를 끄면 접속자에게 종료를 알리고 연결을 닫는다', Z.last.closed?.why === 'server' && Z.closed === true);
console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
