'use strict';
// 오락실 튜토리얼이 '진짜로 일어난 일'을 알아채는 신호 (튜토리얼이 아니면 아무도 안 듣는다)
const tutorialSignal = (type) => window.dispatchEvent(new CustomEvent('arcade:tutorial', { detail: { type } }));

// 24 만들기: 화면·입력·소리. 규칙은 logic.js (LOGIC_24).
const L = LOGIC_24;
const $ = (id) => document.getElementById(id);

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
};

// ---------- 소리 ----------
let audio = null;
let muted = store.get('make24Muted') === '1';
function tone(freq, dur, type = 'triangle', vol = 0.05, slide = 0) {
  if (muted) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur);
  } catch (_) {}
}
const sfx = {
  tap: () => tone(560, 0.04, 'square', 0.025),
  combine: () => tone(720, 0.08, 'triangle', 0.05, 200),
  solved: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.13, 'triangle', 0.06), i * 80)),
  wrong: () => tone(200, 0.25, 'sawtooth', 0.05, -80),
  invalid: () => tone(150, 0.12, 'square', 0.04),
  tick: () => tone(900, 0.05, 'square', 0.03),
  over: () => { tone(330, 0.2, 'sawtooth', 0.05, -120); setTimeout(() => tone(196, 0.35, 'sawtooth', 0.05, -80), 180); },
  best: () => [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.13, 'triangle', 0.06), i * 90)),
};

// ---------- 상태 ----------
let G = null;
let state = 'title';                    // title · play · paused · over
let level = 'normal', tut = false, selA = null, selOp = null, hintShow = null, hintUntil = 0, newBest = false, lastSec = 999, nextTimer = null, popId = -1;
const BEST_KEY = { easy: 'make24BestEasy', normal: 'make24Best', expert: 'make24BestExpert' };
const best = { easy: Number(store.get('make24BestEasy')) || 0, normal: Number(store.get('make24Best')) || 0, expert: Number(store.get('make24BestExpert')) || 0 };

/* @test-hooks:start */
window.__m24 = { get G() { return G; }, get state() { return state; }, L, step: (dt) => tick(dt), clickCard: (i) => onCard(i), clickOp: (o) => onOp(o) };
/* @test-hooks:end */

// ---------- 흐름 ----------
function showOverlay(html) {
  const o = $('overlay'); o.innerHTML = html; o.classList.remove('hidden');
  o.querySelectorAll('button[data-level]').forEach((b) => { b.onclick = () => start(b.dataset.level); });
  o.querySelectorAll('button[data-resume]').forEach((b) => { b.onclick = resume; });
  o.querySelectorAll('button[data-quit]').forEach((b) => { b.onclick = () => { hideOverlay(); showTitle(); }; });
}
function hideOverlay() { $('overlay').classList.add('hidden'); }
const lvButtons = () => `<div class="lv"><button data-level="easy">쉬움<small>1~9 · 150초</small></button><button data-level="normal">보통<small>1~13 · 120초 · 기록</small></button><button data-level="expert">고수<small>어려운 문제 · 분수도</small></button></div>`;
function showTitle() {
  state = 'title'; clearTimeout(nextTimer);
  const bs = [['쉬움', best.easy], ['보통', best.normal], ['고수', best.expert]].filter((b) => b[1]).map((b) => `${b[0]} ${b[1]}`).join(' · ');
  showOverlay(`<h1>24 만들기</h1><p>네 숫자에 <b>+ − × ÷</b> 를 써서<br>정확히 <b>24</b> 를 만드세요!</p>
    <p class="help">숫자 → 연산 → 숫자 순서로 눌러 하나로 합쳐 가요.<br>제한 시간 안에 최대한 많이! 모든 문제는 풀 수 있어요.<br>나눗셈은 분수로 계산해요 (예: 8÷3 = 8/3)</p>
    ${bs ? `<div class="big">최고 ${bs}</div>` : ''}${lvButtons()}<p class="note"><span class="pc">숫자 1~4 키 · + − * / 키 · Backspace 되돌리기</span><span class="touch">숫자 카드와 연산 버튼을 차례로 톡톡</span></p>`);
}
function start(lv) {
  tut = /[?&]tutorial=1/.test(location.search);
  if (tut) lv = 'easy';
  level = L.LEVELS[lv] ? lv : 'normal';
  clearTimeout(nextTimer);
  G = L.newGame(Math.random, { level, tutorial: tut, nums: tut ? [1, 2, 3, 4] : undefined });
  selA = null; selOp = null; hintShow = null; newBest = false; lastSec = 999; popId = -1;
  state = 'play'; hideOverlay(); G.events.length = 0; render(); msg('');
}
function gameOver() {
  state = 'over'; sfx.over(); clearTimeout(nextTimer);
  if (!tut && G.solved > best[level]) { best[level] = G.solved; store.set(BEST_KEY[level], String(G.solved)); newBest = true; }
  setTimeout(() => {
    if (state !== 'over') return;
    showOverlay(`<h2>시간 끝!</h2><div class="big">${G.solved}문제 해결</div><p>건너뛴 문제 ${G.skipped}개 · 힌트 ${G.hints}번${newBest ? '<br>🎉 새 최고 기록!' : `<br>최고 ${best[level]}문제`}</p>${lvButtons()}`);
  }, 700);
}
function pause() { if (state !== 'play') return; state = 'paused'; showOverlay(`<h2>일시정지</h2><button data-resume="1">계속하기</button><button data-quit="1" style="background:rgba(255,255,255,.14);color:#fff;box-shadow:none;font-size:14px;padding:9px 22px">그만하고 처음으로</button>`); }
function resume() { if (state !== 'paused') return; state = 'play'; hideOverlay(); }
function toggleMute() { muted = !muted; store.set('make24Muted', muted ? '1' : '0'); $('muteBtn').textContent = muted ? '🔇' : '🔊'; }

// ---------- 그리기 ----------
function cardHtml(f) {
  return f.d === 1 ? String(f.n) : `<span class="fr"><span>${f.n < 0 ? '−' + Math.abs(f.n) : f.n}</span><i></i><span>${f.d}</span></span>`;
}
function render() {
  if (!G) return;
  $('level').textContent = tut ? '연습' : L.LEVELS[level].label; $('solved').textContent = G.solved;
  $('best').textContent = !tut && best[level] ? `최고 ${best[level]}` : '';
  $('hintCost').textContent = tut ? '' : `−${G.params.hint}초`; $('skipCost').textContent = tut ? '' : `−${G.params.skip}초`;
  const box = $('cards'); box.innerHTML = '';
  G.items.forEach((it, i) => {
    const c = document.createElement('button'); c.type = 'button'; c.className = 'card' + (i === selA ? ' sel' : '') + (hintShow && (hintShow.i === i || hintShow.j === i) ? ' hint' : '') + (it.id === popId ? ' pop' : '');
    c.innerHTML = cardHtml(it.v); c.dataset.i = i; c.setAttribute('aria-label', `${L.show(it.v)}`);
    c.onclick = () => onCard(i); box.appendChild(c);
  });
  document.querySelectorAll('.op').forEach((b) => { b.classList.toggle('sel', b.dataset.op === selOp); b.classList.toggle('hint', !!hintShow && hintShow.op === b.dataset.op); });
  updateBar();
}
function updateBar() {
  if (!G) return;
  const f = G.timeLeft === Infinity ? 1 : Math.max(0, G.timeLeft / G.params.time);
  $('barFill').style.width = `${f * 100}%`; $('bar').classList.toggle('low', f < 0.2);
}
function msg(text, cls = '') { const m = $('msg'); m.textContent = text; m.className = cls; }

// ---------- 입력 ----------
function onCard(i) {
  if (state !== 'play' || !G || G.status !== 'play' || i < 0 || i >= G.items.length) return;
  hintShow = null; sfx.tap();
  if (selA === null) { selA = i; tutorialSignal('select'); msg(''); }
  else if (i === selA) { selA = null; selOp = null; }
  else if (selOp === null) { selA = i; }                                  // 다른 숫자로 바꿔 잡음
  else { doCombine(selA, i, selOp); return; }
  render();
}
function onOp(op) {
  if (state !== 'play' || !G || G.status !== 'play') return;
  hintShow = null; sfx.tap();
  if (selA === null) { msg('먼저 숫자 카드를 고르세요', 'bad'); return; }
  selOp = selOp === op ? null : op; msg(''); render();
}
function doCombine(a, b, op) {
  const r = L.combine(G, a, b, op);
  selA = null; selOp = null;
  if (r) { const it = G.items.find((x) => x.v === r); popId = it ? it.id : -1; sfx.combine(); tutorialSignal('combine'); }
  handle();
  render();
}
function handle() {
  for (const ev of G.events) {
    if (ev.type === 'solved') { sfx.solved(); tutorialSignal('solved'); msg('24 완성! 🎉', 'ok'); clearTimeout(nextTimer); nextTimer = setTimeout(() => { if (state === 'play' && G.status === 'solved') { L.next(G); G.events.length = 0; selA = selOp = null; hintShow = null; msg(''); render(); } }, 900); }
    else if (ev.type === 'wrong') { sfx.wrong(); msg(`${L.show(ev.value)} 이에요. 24가 아니에요! 되돌려 보세요`, 'bad'); }
    else if (ev.type === 'invalid') { sfx.invalid(); msg('0으로는 나눌 수 없어요', 'bad'); }
    else if (ev.type === 'hint') { hintShow = { i: ev.i, j: ev.j, op: ev.op }; tutorialSignal('hint'); msg(''); }
    else if (ev.type === 'nohint') { msg('이 상태에서는 풀 수 없어요. 되돌리기를 눌러 보세요', 'bad'); }
    else if (ev.type === 'skip') { msg(`건너뛰었어요 (−${ev.cost}초)`, ''); }
    else if (ev.type === 'undo') { tutorialSignal('undo'); }
    else if (ev.type === 'over') gameOver();
  }
  G.events.length = 0;
}
document.querySelectorAll('.op').forEach((b) => { b.onclick = () => onOp(b.dataset.op); });
$('undoBtn').onclick = () => { if (state === 'play' && L.undo(G)) { selA = selOp = null; hintShow = null; msg(''); handle(); render(); } };
$('resetBtn').onclick = () => { if (state === 'play' && L.reset(G)) { selA = selOp = null; hintShow = null; msg(''); handle(); render(); } };
$('hintBtn').onclick = () => { if (state === 'play') { L.hint(G); selA = selOp = null; handle(); render(); } };
$('skipBtn').onclick = () => { if (state === 'play' && G.status === 'play' && L.skip(G)) { selA = selOp = null; hintShow = null; handle(); render(); } };
addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') { if (!e.repeat) state === 'paused' ? resume() : pause(); return; }
  if (e.code === 'KeyM') { if (!e.repeat) toggleMute(); return; }
  if (state !== 'play' || e.repeat) return;
  const dm = /^(Digit|Numpad)([1-4])$/.exec(e.code); if (dm) { onCard(Number(dm[2]) - 1); return; }
  const opMap = { Equal: '+', NumpadAdd: '+', Minus: '-', NumpadSubtract: '-', NumpadMultiply: '*', NumpadDivide: '/', Slash: '/' };
  if (opMap[e.code]) { e.preventDefault(); onOp(opMap[e.code]); return; }
  if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') { e.preventDefault(); onOp(e.key); return; }
  if (e.code === 'Backspace') { e.preventDefault(); $('undoBtn').click(); } else if (e.code === 'KeyR') $('resetBtn').click(); else if (e.code === 'KeyH') $('hintBtn').click(); else if (e.code === 'KeyN') $('skipBtn').click();
});
$('muteBtn').onclick = (e) => { e.currentTarget.blur(); toggleMute(); };
$('pauseBtn').onclick = (e) => { e.currentTarget.blur(); state === 'paused' ? resume() : pause(); };
addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
$('muteBtn').textContent = muted ? '🔇' : '🔊';

// ---------- 시간 ----------
function tick(dt) {
  if (state !== 'play' || !G) return;
  L.step(G, dt);
  const sec = Math.ceil(G.timeLeft);
  if (!tut && sec <= 10 && sec !== lastSec && sec > 0) sfx.tick();
  lastSec = sec;
  handle(); updateBar();
}
let last = performance.now();
function frame(now) { const dt = Math.min(0.1, (now - last) / 1000); last = now; tick(dt); requestAnimationFrame(frame); }
showTitle();
setTimeout(() => L.buildPool(), 80);                // 시작 화면에 있는 동안 문제 모음을 미리 만들어 둠 (처음 시작할 때 멈칫하지 않게)
requestAnimationFrame(frame);
