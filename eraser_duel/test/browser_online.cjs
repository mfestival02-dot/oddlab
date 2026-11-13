// 실제 브라우저 두 개(서로 다른 세션)로 온라인 한 판을 진행한다(스크린샷만, 영상 없음).  실행: node test/browser_online.cjs  (먼저 npm run build)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..'), out = path.join(ROOT, 'shots'), PORT = 5198, BASE = `http://127.0.0.1:${PORT}`;
let srv;
(async () => {
  srv = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT, GRACE_MS: 20000, HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res) => srv.stdout.on('data', (d) => { if (String(d).includes('서버')) res(); }));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mk = async () => { const ctx = await b.newContext({ viewport: { width: 1100, height: 660 } }); ctx.setDefaultTimeout(60000); const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); }); return p; };
  const A = await mk(), B = await mk();
  let pass = 0, fail = 0;
  const log = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '통과' : '실패'}  ${n}${d ? '  — ' + d : ''}`); };
  const g = (p, f) => p.evaluate(f);
  const st = (p) => p.evaluate(() => { const x = __game.game; return { online: !!x.online, phase: x.phase, player: x.player, seat: x.mySeat, turn: x.turnNo, can: x.online ? x.canAct() : null, m: x.matchId, res: x.result, b: x.curr.map((c) => c.p.map((v) => +v.toFixed(4))), fire: document.getElementById('fire').disabled, status: document.getElementById('statusText').textContent, dev: document.getElementById('devBtn').hidden, chip: document.getElementById('netChip').textContent }; });

  // 비공개 방 만들기 → 초대 링크로 입장
  await A.goto(BASE); await A.waitForFunction(() => window.__game);
  await A.click('#onlineBtn'); await A.fill('#nick', '가영'); await A.waitForFunction(() => __game.net.status === 'online');
  await A.screenshot({ path: path.join(out, '20_online_menu.png') });
  await A.click('#mkPrivate'); await A.waitForSelector('#netRoom:not([hidden])');
  const invite = await A.inputValue('#invite');
  log('N1. 비공개 방을 만들면 지금 접속한 주소 기준의 초대 링크가 나온다', invite.startsWith(BASE) && /room=[A-Z0-9]{5}/.test(invite) && !invite.includes('localhost'), invite);
  await B.goto(invite.replace('가영', '')); await B.waitForFunction(() => window.__game);
  await B.waitForSelector('#netRoom:not([hidden])');
  await A.waitForFunction(() => document.querySelectorAll('#seats .seat em:not(.no), #seats .seat em.no').length === 2 && !document.getElementById('seats').textContent.includes('빈자리'));
  await A.screenshot({ path: path.join(out, '21_online_room.png') });
  log('N2. 친구가 초대 링크를 열면 같은 방에 들어오고 양쪽에 두 사람이 보인다', (await B.textContent('#roomTitle')).includes('비공개') && (await A.textContent('#seats')).includes('가영') && (await B.textContent('#seats')).includes('(나)'));
  // 준비 → 시작
  await B.click('#netCards .card:has-text("점보")'); await A.click('#readyBtn'); await A.waitForTimeout(300);
  const early = (await st(A)).online;
  await B.waitForFunction(() => document.querySelector('#netCards .card.sel')?.textContent.includes('점보')); await B.click('#readyBtn');
  await A.waitForFunction(() => __game.game.online && __game.game.seqNo > 0); await B.waitForFunction(() => __game.game.online && __game.game.seqNo > 0);
  await A.waitForTimeout(1800);
  let a = await st(A), bb = await st(B);
  log('N3. 둘 다 준비하면 시작하고, 고른 지우개와 차례가 양쪽에서 같다', !early && a.m === 1 && bb.m === 1 && a.player === bb.player && a.turn === 1 && (await g(A, () => __game.game.types[1])) === 'jumbo' && a.seat === 0 && bb.seat === 1, `${a.player + 1}P 차례 / A: "${a.status}" / B: "${bb.status}"`);
  log('N4. 온라인에서는 개발자 패널이 숨겨지고, 차례가 아닌 쪽은 버튼이 잠긴다', a.dev && bb.dev && a.fire !== bb.fire && (a.can ? !a.fire && bb.fire : a.fire && !bb.fire));
  await A.screenshot({ path: path.join(out, '22_online_my_turn.png') }); await B.screenshot({ path: path.join(out, '23_online_wait.png') });
  const first = a.can ? A : B, second = a.can ? B : A;
  // 상대 차례에 입력
  await second.keyboard.down('Space'); await second.waitForTimeout(300); await second.keyboard.up('Space'); await second.keyboard.press('ArrowRight');
  await second.evaluate(() => { __game.net.send({ t: 'down', turn: 1, id: Date.now() }); __game.game.fireSpot(0, 1); });
  await second.waitForTimeout(300);
  log('N5. 상대 차례에 키를 누르거나 직접 요청을 보내도 게임이 움직이지 않는다', (await st(first)).phase === 'aim' && (await st(second)).phase === 'aim');
  // 내 차례: 고른 누름 자리가 상대 화면에도 보이고, 꾹 눌렀다 떼면 튕긴다
  const spot0 = await g(second, () => __game.game.spot);
  await first.keyboard.press('ArrowRight'); await second.waitForFunction((v) => __game.game.spot !== v, spot0);
  const spot1 = await g(second, () => __game.game.spot);
  log('N6. 내가 누름 자리를 바꾸면 상대 화면의 표시도 바뀐다', spot1 !== spot0 && spot1 === (await g(first, () => __game.game.spot)), `자리 ${spot0} → ${spot1}`);
  await first.keyboard.press('ArrowLeft'); await first.waitForTimeout(300);
  await first.keyboard.down('Space');
  await first.waitForFunction(() => __game.game.phase === 'power'); await second.waitForFunction(() => __game.game.phase === 'power');
  await first.waitForFunction(() => __game.game.gauge.value > 0.3, null, { polling: 'raf' });
  const gauges = [await g(first, () => __game.game.gauge.value), await g(second, () => __game.game.gauge.value)];
  const shown = await g(first, () => __game.game.gauge.value);
  await first.keyboard.up('Space');
  await first.waitForFunction(() => __game.game.phase === 'physics' || __game.game.turnNo > 1 || __game.game.result);
  const used = await g(first, () => __game.game.shotPower);
  log('N7. 누르는 힘은 서버가 재고 양쪽에 같이 보이며, 화면에서 뗀 순간의 힘과 실제 힘이 비슷하다', Math.abs(gauges[0] - gauges[1]) < 0.35 && Math.abs(used - shown) < 0.2, `화면 ${(shown * 100).toFixed(0)}% → 적용 ${(used * 100).toFixed(0)}% (상대 화면 ${(gauges[1] * 100).toFixed(0)}%)`);
  await A.waitForFunction(() => __game.game.turnNo === 2 && __game.game.phase === 'aim'); await B.waitForFunction(() => __game.game.turnNo === 2 && __game.game.phase === 'aim');
  await A.waitForTimeout(600);
  a = await st(A); bb = await st(B);
  const same = a.b.every((p, i) => p.every((v, k) => Math.abs(v - bb.b[i][k]) < 1e-3));
  log('N8. 발사가 끝난 뒤 양쪽 화면의 지우개 위치와 차례가 같다', same && a.player === bb.player && a.turn === 2, JSON.stringify(a.b));
  // 새로 고침 → 같은 자리로 복귀
  await B.reload(); await B.waitForFunction(() => window.__game && __game.game.online && __game.game.seqNo > 0, null, { timeout: 30000 });
  await B.waitForTimeout(500);
  bb = await st(B);
  log('N9. 경기 중 새로 고침해도 같은 자리로 돌아와 이어서 한다', bb.online && bb.seat === 1 && bb.turn === 2 && bb.m === 1 && bb.b.every((p, i) => p.every((v, k) => Math.abs(v - a.b[i][k]) < 1e-3)), `B: "${bb.status}" / ${bb.chip}`);
  // 끝까지: 차례인 쪽이 끝까지 눌러 최대 힘으로 튕기기를 승부가 날 때까지 반복
  for (let k = 0; k < 16 && !(await st(A)).res; k++) {
    const sNow = await st(A), me = sNow.can ? A : B;
    await me.keyboard.down('Space');
    await A.waitForFunction((t) => __game.game.result || __game.game.phase === 'physics' || __game.game.turnNo > t, sNow.turn, { timeout: 30000 });
    await me.keyboard.up('Space');
    await A.waitForFunction((t) => __game.game.result || (__game.game.turnNo > t && __game.game.phase === 'aim'), sNow.turn, { timeout: 40000 });
    await A.waitForTimeout(250);
  }
  await A.waitForFunction(() => __game.game.result); await B.waitForFunction(() => __game.game.result); await A.waitForTimeout(900);
  a = await st(A); bb = await st(B);
  const ta = await A.textContent('#resultTitle'), tb = await B.textContent('#resultTitle');
  log('N10. 서버가 정한 승패가 양쪽 화면에 같게 나온다', JSON.stringify(a.res) === JSON.stringify(bb.res) && ta === tb && ta.includes('승리'), `${ta} / ${await A.textContent('#resultWhy')}`);
  await A.screenshot({ path: path.join(out, '24_online_result.png') });
  // 재대결
  await A.click('#again'); await B.waitForFunction(() => document.getElementById('resultExtra').textContent.includes('재대결을 원해요'));
  await A.waitForFunction(() => document.getElementById('resultExtra').textContent.includes('기다리는'));
  const waitTxt = await A.textContent('#resultExtra');
  await B.click('#again');
  await A.waitForFunction(() => __game.game.matchId === 2 && __game.game.seqNo > 0); await B.waitForFunction(() => __game.game.matchId === 2 && __game.game.seqNo > 0); await A.waitForTimeout(700);
  a = await st(A); bb = await st(B);
  log('N11. 둘 다 재대결을 눌러야 새 판이 시작되고, 이전 판 상태가 남지 않는다', /기다리는/.test(waitTxt) && !a.res && !bb.res && a.turn === 1 && Math.abs(a.b[0][0] - a.b[1][0]) > 3.5 && (await A.isHidden('#result')), `${waitTxt} → 경기 ${a.m}, 선공 ${a.player + 1}P`);
  // 방 나가기 → 공개 방 목록으로 다시 만나기
  await B.click('#fire').catch(() => {});
  await A.evaluate(() => __game.net.send({ t: 'leave' })); await A.waitForSelector('#netMenu:not([hidden])');
  await B.waitForFunction(() => __game.game.result && __game.game.result.reason === 'forfeit-left'); await B.waitForTimeout(700);
  const leftWhy = await B.textContent('#resultWhy');
  await B.click('#change'); await B.waitForSelector('#netMenu:not([hidden])');
  await A.click('#mkPublic'); await A.waitForSelector('#netRoom:not([hidden])');
  await B.click('#netRefresh'); await B.waitForFunction(() => document.querySelector('#roomList button'));
  const row = await B.textContent('#roomList li');
  await B.screenshot({ path: path.join(out, '25_online_public_list.png') });
  await B.click('#roomList button'); await B.waitForSelector('#netRoom:not([hidden])');
  log('N12. 상대가 나가면 이유가 표시되고, 공개 방은 목록에서 골라 들어갈 수 있다', /나갔습니다/.test(leftWhy) && /가영의 방/.test(row) && /1\/2명/.test(row) && (await B.textContent('#seats')).includes('가영'), `${leftWhy} / 목록: ${row}`);
  log('N13. 두 브라우저 모두 오류가 없다', A.errs.length === 0 && B.errs.length === 0, [...A.errs, ...B.errs].slice(0, 3).join(' | '));
  await A.context().close(); await B.context().close(); await b.close(); srv.kill('SIGTERM');
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); if (srv) srv.kill('SIGKILL'); process.exit(1); });
