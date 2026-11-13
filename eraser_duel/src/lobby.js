// 온라인 방 화면: 별명, 방 만들기·들어가기, 공개 방 목록, 준비, 초대 링크, 연결 상태 표시
import { TYPES, TYPE_KEYS } from './config.js';
import { PLAYER } from './view.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); kids.forEach((k) => e.append(k)); return e; };
const STATUS = { connecting: '서버에 연결하는 중…', reconnecting: '연결이 끊겨 다시 붙는 중…', online: '연결됨', off: '연결 안 됨', unavailable: '이 화면은 파일로 열려 있어 온라인을 쓸 수 없어요. 서버 주소(http://…)로 접속해 주세요.' };

export class Lobby {
  constructor(net, netGame, sfx, hooks) {
    this.net = net; this.g = netGame; this.sfx = sfx; this.hooks = hooks; this.room = null; this.inGame = false;
    this.pendingCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
    let saved = ''; try { saved = localStorage.getItem('eraser-duel-nick') || ''; } catch { /* 무시 */ }
    $('nick').value = saved || '손님' + Math.floor(100 + Math.random() * 900);
    $('nick').addEventListener('change', () => this.sendName());
    $('mkPrivate').addEventListener('click', () => { this.sendName(); net.send({ t: 'create', public: false }); });
    $('mkPublic').addEventListener('click', () => { this.sendName(); net.send({ t: 'create', public: true, name: `${this.nick()}의 방` }); });
    $('joinBtn').addEventListener('click', () => this.join($('joinCode').value));
    $('joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.join($('joinCode').value); });
    $('netRefresh').addEventListener('click', () => net.send({ t: 'list' }));
    $('netBack').addEventListener('click', () => this.close());
    $('leaveRoom').addEventListener('click', () => net.send({ t: 'leave' }));
    $('readyBtn').addEventListener('click', () => { const me = this.room && this.room.seats[this.room.you]; if (me) net.send({ t: 'ready', ready: !me.ready }); });
    $('copyInvite').addEventListener('click', async () => {
      const box = $('invite');
      try { await navigator.clipboard.writeText(box.value); this.msg('초대 링크를 복사했어요.', false); } catch { box.select(); this.msg('복사 권한이 없어요. 칸의 주소를 직접 복사해 주세요.'); }
    });
    net.onStatus = (s) => this.status(s);
    net.on('welcome', (m) => {
      this.msg('');
      if (!m.resumed && this.pendingCode) { this.join(this.pendingCode); this.pendingCode = ''; }
    });
    net.on('rooms', (m) => this.renderList(m.rooms));
    net.on('room', (m) => { this.room = m; this.renderRoom(); });
    net.on('left', () => { this.room = null; this.leaveGame(); this.showMenu(); net.send({ t: 'list' }); });
    net.on('match', (m) => { this.inGame = true; $('online').hidden = true; this.hooks.start(m, this.room ? this.room.you : 0); });
    net.on('state', (m) => this.g.onState(m));
    net.on('error', (m) => { if (!this.inGame || $('online').hidden === false) this.msg(m.text); else if (!['not-your-turn', 'duplicate', 'stale-turn', 'bad-phase', 'too-early'].includes(m.code)) this.hooks.notice(m.text); });
    net.on('closed', (m) => { this.room = null; this.leaveGame(); this.showMenu(); this.msg(m.why === 'server' ? '서버가 종료되었습니다.' : '오래 비어 있어 방이 닫혔습니다.'); });
    this.timer = setInterval(() => { if (!$('online').hidden && !$('netMenu').hidden) net.send({ t: 'list' }); this.chip(); }, 1000);
  }
  nick() { return ($('nick').value || '').trim().slice(0, 12) || '손님'; }
  sendName() { try { localStorage.setItem('eraser-duel-nick', this.nick()); } catch { /* 무시 */ } this.net.send({ t: 'name', name: this.nick() }); }
  join(code) { code = String(code || '').trim().toUpperCase(); if (code.length !== 5) return this.msg('방 코드는 5글자예요.'); this.sendName(); this.net.send({ t: 'join', code }); }
  msg(t, bad = true) { for (const id of ['netMsg', 'netMsg2']) { $(id).textContent = t; $(id).style.color = bad ? '' : '#2f8f4e'; } }
  open() { $('start').hidden = true; $('online').hidden = false; this.showMenu(); this.net.open(this.nick()); }
  close() { this.net.close(); this.room = null; $('online').hidden = true; $('netChip').hidden = true; $('start').hidden = false; }
  showMenu() { $('netMenu').hidden = false; $('netRoom').hidden = true; if (!this.inGame) $('online').hidden = $('start').hidden === false; }
  leaveGame() { if (this.inGame) { this.inGame = false; this.hooks.exit(); $('online').hidden = false; } }
  status(s) {
    if (s !== 'online') this.msg(STATUS[s] || '', s !== 'connecting');
    this.chip();
  }
  chip() {
    const c = $('netChip'), r = this.room;
    if (this.net.status === 'off' || (!r && !this.inGame)) { c.hidden = true; return; }
    c.hidden = false;
    const other = r && r.seats[1 - r.you];
    let t = STATUS[this.net.status] || '', bad = this.net.status !== 'online';
    if (!bad && r) {
      t = `온라인 · 방 ${r.code}`;
      if (this.inGame && other && !other.connected) { t += ` · 상대 연결 끊김, ${Math.ceil(other.graceLeft / 1000)}초 기다림`; bad = true; }
      else if (this.inGame && this.g.canAct() && this.g.turnLeft < 15000 && this.g.turnLeft > 0) { t += ` · 남은 시간 ${Math.ceil(this.g.turnLeft / 1000)}초`; bad = true; }
    }
    c.textContent = t; c.classList.toggle('bad', bad);
  }
  renderList(rooms) {
    const ul = $('roomList'); ul.innerHTML = '';
    if (!rooms.length) { ul.append(el('li', {}, [el('small', { textContent: '기다리는 공개 방이 없어요. 직접 만들어 보세요.' })])); return; }
    for (const r of rooms) {
      const b = el('button', { className: 'btn small', textContent: '들어가기', disabled: !r.waiting });
      b.addEventListener('click', () => this.join(r.code));
      ul.append(el('li', {}, [el('span', { textContent: r.name }), el('small', { textContent: `${r.count}/2명 · ${r.waiting ? '기다리는 중' : '가득 참'}` }), b]));
    }
  }
  renderRoom() {
    const r = this.room; if (!r) return;
    this.chip();
    if (r.phase !== 'lobby') { if (!this.inGame) $('online').hidden = false; return; }
    if (this.inGame) { this.inGame = false; this.hooks.exit(); }                 // 경기가 끝나고 대기 상태로 돌아온 경우
    $('online').hidden = false; $('netMenu').hidden = true; $('netRoom').hidden = false;
    $('roomTitle').textContent = `${r.name} ${r.public ? '(공개)' : '(비공개)'} · 코드 ${r.code}`;
    const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('room', r.code);      // 지금 접속한 주소를 기준으로 만든다
    const server = new URLSearchParams(location.search).get('server'); if (server) u.searchParams.set('server', server);
    $('invite').value = u.toString();
    const seats = $('seats'); seats.innerHTML = '';
    r.seats.forEach((s, i) => {
      const box = el('div', { className: 'seat' });
      box.style.borderColor = PLAYER[i].css;
      if (!s) box.append(el('span', { textContent: `${PLAYER[i].name} 빈자리` }), el('em', { className: 'no', textContent: '기다리는 중' }), el('small', { textContent: '초대 링크나 방 코드를 친구에게 알려 주세요.' }));
      else box.append(el('span', { textContent: `${PLAYER[i].name} ${s.name}${i === r.you ? ' (나)' : ''}` }), el('em', { className: s.ready && s.connected ? '' : 'no', textContent: !s.connected ? `연결 끊김 ${Math.ceil(s.graceLeft / 1000)}초` : s.ready ? '준비 완료' : '준비 안 함' }), el('small', { textContent: `${TYPES[s.type].name} 지우개 · ${TYPES[s.type].desc}` }));
      seats.append(box);
    });
    const me = r.seats[r.you], cards = $('netCards'); cards.innerHTML = '';
    for (const k of TYPE_KEYS) {
      const c = el('button', { className: 'card' + (me.type === k ? ' sel' : '') });
      c.style.setProperty('--c', PLAYER[r.you].css);
      c.append(el('i'), TYPES[k].name, el('small', { textContent: TYPES[k].desc }));
      c.addEventListener('click', () => { this.net.send({ t: 'type', type: k }); this.sfx.click(); });
      cards.append(c);
    }
    $('readyBtn').textContent = me.ready ? '준비 취소' : '준비';
    const both = r.seats[0] && r.seats[1];
    if (!$('netMsg2').textContent || $('netMsg2').dataset.auto) { $('netMsg2').dataset.auto = '1'; $('netMsg2').style.color = '#7a6f62'; $('netMsg2').textContent = !both ? '상대를 기다리는 중이에요.' : me.ready ? '상대가 준비하면 바로 시작해요.' : '둘 다 준비하면 시작해요.'; }
  }
}
