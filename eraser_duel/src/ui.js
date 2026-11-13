// 화면 글자와 버튼, 개발자 패널
import { SETTING_DEFS, APPLY_NOTE, defaultSettings, validateSettings, SETTINGS_VERSION } from './config.js';
import { PHASE, PHASE_KO } from './game.js';
import { PLAYER } from './view.js';
import { SUCCESS_PRESET } from './preset.js';
import { yawQuat } from './sim.js';
import { initialLayout } from './config.js';

const $ = (id) => document.getElementById(id);
const deg = (r) => (r * 180) / Math.PI, rad = (d) => (d * Math.PI) / 180;
const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); kids.forEach((k) => e.append(k)); return e; };

export class UI {
  constructor(game, view, input) {
    this.game = game; this.view = view; this.input = input;
    $('fire').addEventListener('click', () => input.press());
    $('again').addEventListener('click', () => input.restart());
    $('retryBtn').addEventListener('click', () => { game.retryTurn(); input.clear(); });
    for (const [id, dir] of [['left', -1], ['right', 1]]) {
      const b = $(id);
      const on = (e) => { input.hold = dir; e.preventDefault(); };
      const off = () => { if (input.hold === dir) input.hold = 0; };
      b.addEventListener('pointerdown', on);
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => b.addEventListener(t, off));
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter') { game.turn(dir, 0.05); } });
    }
    $('devBtn').addEventListener('click', () => this.toggleDev());
    this._buildDev();
  }
  toggleDev(open = $('dev').hidden) {
    $('dev').hidden = !open;
    document.body.classList.toggle('dev-open', open);
    $('devBtn').setAttribute('aria-expanded', String(open));
    $('devBtn').textContent = open ? '패널 닫기' : '개발자 패널';
    $('devBtn').style.right = open ? `calc(min(380px, 100vw) + 14px)` : '14px';
    this.view.debug = open && this.dbgDraw.checked;
  }

  // ---------- 개발자 패널 ----------
  _buildDev() {
    const g = this.game, root = $('dev');
    this.inputs = {}; this.rows = {};
    root.append(el('div', { className: 'head' }, [el('b', { textContent: '개발자 패널' }), el('button', { textContent: '닫기', onclick: () => this.toggleDev(false) })]));

    root.append(el('h3', { textContent: `물리 설정 (${APPLY_NOTE})` }));
    for (const [k, name, , min, max, step, desc] of SETTING_DEFS) {
      const inp = el('input', { type: 'number', id: 'set_' + k, min, max, step, value: g.pending[k] });
      const now = el('div', { className: 'now' });
      const row = el('div', { className: 'row' }, [el('label', { htmlFor: 'set_' + k, textContent: name }), inp, el('small', { textContent: `${desc} (${min}~${max})` }), now]);
      inp.addEventListener('input', () => {
        const v = inp.value === '' ? NaN : Number(inp.value);
        const bad = !Number.isFinite(v) || v < min || v > max;
        inp.classList.toggle('bad', bad);
        if (!bad) g.pending[k] = v;
        this.setMsg(bad ? `${name}: ${min}~${max} 사이의 숫자를 넣어 주세요.` : '', bad);
      });
      this.inputs[k] = inp; this.rows[k] = { row, now };
      root.append(row);
    }
    this.msg = el('div');
    const io = el('textarea', { id: 'jsonBox', placeholder: '설정 JSON을 붙여 넣고 [가져오기]', spellcheck: false });
    const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
    file.addEventListener('change', async () => { if (file.files[0]) { io.value = await file.files[0].text(); this.importJson(io.value); file.value = ''; } });
    root.append(el('div', { className: 'btns' }, [
      el('button', { textContent: '기본값으로', onclick: () => { this.setPending(defaultSettings()); this.setMsg('기본값으로 되돌렸습니다. 다음 발사부터 적용됩니다.'); } }),
      el('button', { textContent: 'JSON 복사', onclick: () => this.copyJson(io) }),
      el('button', { textContent: 'JSON 내려받기', onclick: () => this.download() }),
      el('button', { textContent: '가져오기', onclick: () => this.importJson(io.value) }),
      el('button', { textContent: '파일에서 가져오기', onclick: () => file.click() }),
    ]), io, file, this.msg);

    root.append(el('h3', { textContent: '발사 재현' }));
    this.dAngle = el('input', { type: 'number', id: 'dbgAngle', step: 0.5, value: 0 });
    this.dPower = el('input', { type: 'number', id: 'dbgPower', step: 1, min: 0, max: 100, value: 55 });
    root.append(el('div', { className: 'two' }, [
      el('div', {}, [el('label', { htmlFor: 'dbgAngle', textContent: '방향(도)' }), this.dAngle]),
      el('div', {}, [el('label', { htmlFor: 'dbgPower', textContent: '파워(%)' }), this.dPower]),
    ]));
    root.append(el('div', { className: 'btns' }, [
      el('button', { textContent: '지금 방향 가져오기', onclick: () => { this.dAngle.value = deg(g.aim[g.player]).toFixed(1); } }),
      el('button', { id: 'dbgFire', textContent: '이 값으로 발사', onclick: () => this.debugFire() }),
    ]));
    root.append(el('div', { className: 'btns' }, [
      el('button', { id: 'dbgSave', textContent: '발사 전 상태 저장', onclick: () => {
        if (g.phase !== PHASE.AIM) return this.setMsg2('조준 중일 때만 저장할 수 있습니다.', true);
        g.savedShot = g.snapshot(rad(Number(this.dAngle.value) || 0), (Number(this.dPower.value) || 0) / 100);
        this.setMsg2('지금 상태를 저장했습니다(방향·파워·설정 포함).');
      } }),
      el('button', { id: 'dbgRestore', textContent: '발사 전 상태 복원', onclick: () => {
        const s = g.savedShot || g.lastShot;
        if (!s) return this.setMsg2('저장된 상태가 없습니다.', true);
        g.restore(s); this.afterRestore(s); this.setMsg2(g.savedShot ? '저장한 상태로 되돌렸습니다.' : '마지막 발사 직전으로 되돌렸습니다.');
      } }),
      el('button', { id: 'dbgReplay', textContent: '같은 조건으로 다시 발사', onclick: () => {
        if (!g.lastShot) return this.setMsg2('아직 발사한 적이 없습니다.', true);
        const s = g.lastShot; g.replayLast(); this.afterRestore(s, false); this.input.clear(); this.setMsg2('마지막 발사를 같은 조건으로 다시 실행했습니다.');
      } }),
      el('button', { id: 'dbgPreset', textContent: '성공 재현 프리셋 불러오기', onclick: () => { this.loadPreset(); this.setMsg2('프리셋을 불러왔습니다. [이 값으로 발사]를 누르면 1P가 올라탑니다.'); } }),
      el('button', { id: 'dbgPresetFire', textContent: '프리셋 바로 발사', onclick: () => { this.loadPreset(); this.debugFire(); } }),
    ]));
    this.msg2 = el('div');
    this.dbgDraw = el('input', { type: 'checkbox', id: 'dbgDraw' });
    this.dbgDraw.addEventListener('change', () => { this.view.debug = this.dbgDraw.checked; });
    root.append(this.msg2, el('label', { style: 'display:block;margin-top:8px;font-weight:700' }, [this.dbgDraw, ' 충돌체 윤곽·접촉 법선 표시']));

    root.append(el('h3', { textContent: '지금 상태' }));
    this.readout = el('pre'); root.append(this.readout);
  }
  setMsg(t, bad = false) { this.msg.className = bad ? 'err' : 'ok'; this.msg.textContent = t; }
  setMsg2(t, bad = false) { this.msg2.className = bad ? 'err' : 'ok'; this.msg2.textContent = t; }
  setPending(s) {
    this.game.pending = { ...s };
    for (const [k] of SETTING_DEFS) { this.inputs[k].value = s[k]; this.inputs[k].classList.remove('bad'); }
  }
  exportJson() { return JSON.stringify({ ...this.game.pending, version: SETTINGS_VERSION }, null, 2); }
  async copyJson(io) {
    const t = this.exportJson(); io.value = t;
    try { await navigator.clipboard.writeText(t); this.setMsg('설정 JSON을 복사했습니다.'); }
    catch { io.select(); this.setMsg('복사 권한이 없어 아래 칸에 넣었습니다. 직접 복사해 주세요.'); }
  }
  download() {
    const a = el('a', { href: URL.createObjectURL(new Blob([this.exportJson()], { type: 'application/json' })), download: 'eraser-duel-settings.json' });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    this.setMsg('eraser-duel-settings.json 으로 내려받았습니다.');
  }
  importJson(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return this.setMsg('JSON 형식이 아닙니다: ' + e.message, true); }
    const r = validateSettings(obj);
    if (!r.ok) return this.setMsg('가져오지 못했습니다.\n- ' + r.errors.join('\n- '), true);
    this.setPending(r.settings);
    this.setMsg('설정을 가져왔습니다. 다음 발사부터 적용됩니다.');
  }
  debugFire() {
    const g = this.game, a = Number(this.dAngle.value), p = Number(this.dPower.value);
    if (!Number.isFinite(a) || !Number.isFinite(p) || p < 0 || p > 100) return this.setMsg2('방향은 숫자, 파워는 0~100으로 넣어 주세요.', true);
    if (g.phase !== PHASE.AIM && g.phase !== PHASE.POWER) return this.setMsg2('조준 중일 때만 발사할 수 있습니다. 복원하거나 다시 시작하세요.', true);
    g.fire(rad(a), p / 100); this.input.clear();
    this.setMsg2(`${PLAYER[g.player].name}: 방향 ${a}도, 파워 ${p}%로 발사했습니다.`);
  }
  loadPreset() {
    const g = this.game, L = initialLayout();
    const snap = { state: { bodies: L.bodies.map((b) => ({ p: b.p, q: yawQuat(b.yaw) })) }, player: 0, aim: [...L.aim], angle: rad(SUCCESS_PRESET.angleDeg), power: SUCCESS_PRESET.power, settings: { ...SUCCESS_PRESET.settings } };
    g.restore(snap); this.afterRestore(snap);
  }
  afterRestore(s, resetCam = true) {
    this.setPending(this.game.pending);
    this.dAngle.value = +deg(s.angle).toFixed(2);
    if (s.power != null) this.dPower.value = +(s.power * 100).toFixed(1);
    this.input.clear();
    if (resetCam) this.view.resetCamera();
  }

  // ---------- 매 프레임 표시 ----------
  update() {
    const g = this.game, pl = PLAYER[g.player];
    document.documentElement.style.setProperty('--p', pl.css);
    $('turnText').textContent = g.phase === PHASE.RESULT ? '경기 끝' : `${pl.name} 차례`;
    const T = g.timers, S = g.applied;
    let main = '', sub = '';
    if (g.phase === PHASE.AIM) { main = '방향을 정하고 게이지를 시작하세요'; sub = '상대 지우개 위에 올라타면 승리'; }
    else if (g.phase === PHASE.POWER) { main = '원하는 세기에서 튕기세요'; sub = '너무 세면 책상 밖으로 날아갑니다'; }
    else if (g.phase === PHASE.PHYSICS) {
      if (g.sim.fallen[0] || g.sim.fallen[1]) main = '떨어졌습니다…';
      else if (g.info.upper !== null && T.perch > 0.05) { main = '걸침 확인 중…'; sub = `${PLAYER[g.info.upper].name}가 위 · ${T.perch.toFixed(1)} / ${S.perchHold.toFixed(1)}초`; }
      else main = '지우개가 멈추기를 기다리는 중';
    } else main = '결과';
    $('statusText').textContent = main; $('statusSub').textContent = sub;

    const pw = g.phase === PHASE.POWER ? g.gauge.value : g.phase === PHASE.PHYSICS || g.phase === PHASE.RESULT ? (g.shotPower ?? 0) : 0;
    $('gaugeFill').style.width = (pw * 100).toFixed(1) + '%';
    $('gaugeNum').textContent = g.phase === PHASE.AIM ? '' : Math.round(pw * 100) + '%';
    $('gauge').setAttribute('aria-valuenow', Math.round(pw * 100));
    const canAct = g.phase === PHASE.AIM || g.phase === PHASE.POWER;
    $('fire').disabled = !canAct;
    $('fire').textContent = g.phase === PHASE.POWER ? '튕기기!' : '게이지 시작';
    $('left').disabled = $('right').disabled = g.phase !== PHASE.AIM;

    const res = $('result');
    if (g.phase === PHASE.RESULT) {
      const { winner, reason } = g.result;
      $('resultTitle').textContent = winner === null ? '무승부' : `${PLAYER[winner].name} 승리!`;
      $('resultTitle').style.color = winner === null ? '' : PLAYER[winner].css;
      $('resultWhy').textContent = reason === 'perch' ? '상대 위에 올라탔습니다' : reason === 'fell' ? '상대가 책상 밖으로 떨어졌습니다' : '둘 다 책상 밖으로 떨어졌습니다';
      if (res.hidden) { res.hidden = false; }
    } else if (!res.hidden) res.hidden = true;
    $('retry').hidden = !(g.stuck && g.phase === PHASE.PHYSICS);

    if (!$('dev').hidden) {
      for (const [k] of SETTING_DEFS) {
        const changed = g.pending[k] !== S[k];
        this.rows[k].row.classList.toggle('changed', changed);
        this.rows[k].now.textContent = changed ? `지금 시뮬레이션에 적용된 값: ${S[k]}` : '';
      }
      const v = [0, 1].map((i) => g.sim.speeds(i));
      const f = (n) => n.toFixed(3).padStart(7);
      this.readout.textContent =
        `게임 상태    ${PHASE_KO[g.phase]} (${g.phase}) · ${pl.name} 차례\n` +
        `발사 방향    ${deg(g.aim[g.player]).toFixed(1)}도\n` +
        `1P 선속도 ${f(v[0].lin)}  각속도 ${f(v[0].ang)}${g.sim.fallen[0] ? '  낙하' : ''}\n` +
        `2P 선속도 ${f(v[1].lin)}  각속도 ${f(v[1].ang)}${g.sim.fallen[1] ? '  낙하' : ''}\n` +
        `지우개 접촉  ${g.info.touching ? `있음 (법선 세로성분 ${g.info.normalY.toFixed(2)})` : '없음'}\n` +
        `받침 판단    ${g.info.upper === null ? '없음' : PLAYER[g.info.upper].name + '가 위에서 받쳐짐'}\n` +
        `안정 유지    ${T.stable.toFixed(2)} / ${S.stableHold}초\n` +
        `걸침 유지    ${T.perch.toFixed(2)} / ${S.perchHold}초\n` +
        `물리 진행    ${T.phys.toFixed(2)}초` + (g.launchInfo ? `\n마지막 충격  ${g.launchInfo.J.toFixed(2)} (앞 들림 토크 ${g.launchInfo.torqueNoseUp.toFixed(3)})` : '');
    }
  }
}
