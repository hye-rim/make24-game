'use strict';
// 24 만들기: 규칙만 (DOM 없음). 화면·입력·소리는 game.js.
// 카드 네 장의 숫자에 + − × ÷ 를 써서 정확히 24 를 만든다. 두 숫자를 골라 합치는 일을 세 번 해서 하나로 만든다.
// 나눗셈은 분수로 정확히 계산하고, 문제는 만들 때마다 '실제로 풀리는' 것만 고른다.
(function (root) {
  const TARGET = 24;
  const OPS = ['+', '-', '*', '/'];
  const LEVELS = {
    easy: { label: '쉬움', max: 9, time: 150, fractions: false, minSolutions: 3, skip: 8, hint: 6 },
    normal: { label: '보통', max: 13, time: 120, fractions: false, minSolutions: 1, skip: 10, hint: 8 },
    expert: { label: '고수', max: 13, time: 120, fractions: true, minSolutions: 1, skip: 10, hint: 8 },     // 분수를 거쳐야만 풀림
  };
  const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

  // ---------- 분수 ----------
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
  const frac = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
  const isInt = (f) => f.d === 1;
  const eq = (a, b) => a.n === b.n && a.d === b.d;
  const show = (f) => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`);
  function apply(a, b, op) {                      // a op b, 불가능하면(0으로 나눔) null
    if (op === '+') return frac(a.n * b.d + b.n * a.d, a.d * b.d);
    if (op === '-') return frac(a.n * b.d - b.n * a.d, a.d * b.d);
    if (op === '*') return frac(a.n * b.n, a.d * b.d);
    if (op === '/') return b.n === 0 ? null : frac(a.n * b.d, a.d * b.n);
    return null;
  }

  // ---------- 풀이 검색: 숫자 목록에서 하나가 24 가 되는 합치기 순서 찾기 ----------
  // items: [{v, id?}] ; 결과: 단계 목록 [{i, j, op}] (i, j 는 그 시점 목록의 위치) 또는 null
  function findSolution(vals, integerOnly) {
    const memo = new Set();
    const key = (list) => list.map(show).sort().join(',');
    function rec(list) {
      if (list.length === 1) return eq(list[0], frac(TARGET)) ? [] : null;
      const k = key(list);
      if (memo.has(k)) return null;                                        // 풀리지 않는다고 이미 확인한 숫자 모음(순서는 상관없음)
      for (let i = 0; i < list.length; i++) for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        for (const op of OPS) {
          if ((op === '+' || op === '*') && i > j) continue;                  // 교환법칙: 같은 계산을 두 번 안 봄
          const r = apply(list[i], list[j], op);
          if (!r) continue;
          if (integerOnly && !isInt(r)) continue;
          const next = list.filter((_, x) => x !== i && x !== j); next.splice(Math.min(next.length, Math.min(i, j)), 0, r);      // combine() 과 같은 자리에 놓음
          const sub = rec(next);
          if (sub) return [{ i, j, op }, ...sub];
        }
      }
      memo.add(k);
      return null;
    }
    return rec(vals.map((v) => (typeof v === 'number' ? frac(v) : v)));
  }
  // 서로 다른 풀이의 개수(교환법칙으로 같은 것은 하나로), 쉬움 문제 고르기에 씀
  function countSolutions(nums, integerOnly, cap = 50) {
    const seen = new Set();
    function rec(list) {
      if (seen.size >= cap) return;
      if (list.length === 1) { if (eq(list[0].v, frac(TARGET))) seen.add(list[0].s); return; }
      for (let i = 0; i < list.length; i++) for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        for (const op of OPS) {
          if ((op === '+' || op === '*') && i > j) continue;
          const r = apply(list[i].v, list[j].v, op);
          if (!r || (integerOnly && !isInt(r))) continue;
          const [a, b] = (op === '+' || op === '*') && list[i].s > list[j].s ? [list[j], list[i]] : [list[i], list[j]];
          const next = list.filter((_, x) => x !== i && x !== j); next.push({ v: r, s: `(${a.s}${op}${b.s})` });
          rec(next);
        }
      }
    }
    rec(nums.map((n) => ({ v: frac(n), s: String(n) })));
    return seen.size;
  }

  // + 와 × 만으로 24 가 되는가 (되면 비교적 쉬운 문제)
  function solvableByAddMul(nums) {
    const rec = (list) => {
      if (list.length === 1) return eq(list[0], frac(TARGET));
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) for (const op of ['+', '*']) {
        const next = list.filter((_, x) => x !== i && x !== j); next.push(apply(list[i], list[j], op));
        if (rec(next)) return true;
      }
      return false;
    };
    return rec(nums.map((n) => frac(n)));
  }

  // ---------- 문제 모음: 1~13 의 네 숫자 조합을 분류 ----------
  let POOL = null;
  function buildPool() {
    if (POOL) return POOL;
    POOL = { easy: [], normal: [], expert: [] };
    for (let a = 1; a <= 13; a++) for (let b = a; b <= 13; b++) for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) {
      const nums = [a, b, c, d], mx = d;
      const intSol = findSolution(nums, true);
      if (intSol) {
        POOL.normal.push(nums);
        const cnt = countSolutions(nums, true, 6);
        if (mx <= LEVELS.easy.max && cnt >= LEVELS.easy.minSolutions) POOL.easy.push(nums);
        if (cnt <= 3 && !solvableByAddMul(nums)) POOL.expert.push(nums);   // 빼기·나누기를 꼭 써야 하고 풀이가 몇 가지뿐인 어려운 문제도 고수에 포함
      } else if (findSolution(nums, false)) POOL.expert.push(nums);        // 분수를 거쳐야만 풀리는 문제
    }
    return POOL;
  }

  // ---------- 게임 ----------
  function newGame(rand, opts = {}) {
    rand = rand || Math.random;
    const lv = LEVELS[opts.level] ? opts.level : 'normal';
    const st = { rand, level: lv, params: LEVELS[lv], timeLeft: opts.tutorial ? Infinity : LEVELS[lv].time, solved: 0, skipped: 0, hints: 0, over: false, events: [], tutorial: !!opts.tutorial,
      items: [], history: [], nums: [], moves: 0, status: 'play', nextId: 1, lastHint: null, wrongTry: 0 };
    startPuzzle(st, opts.nums);
    return st;
  }
  function pickNums(st) {
    const pool = buildPool()[st.level];
    let nums, tries = 0;
    do { nums = pool[Math.floor(st.rand() * pool.length)]; tries++; } while (st.nums && nums.join() === st.nums.slice().sort((a, b) => a - b).join() && tries < 8);
    // 순서를 섞어 보여 줌
    const a = nums.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(st.rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function startPuzzle(st, forced) {
    st.nums = forced ? forced.slice() : pickNums(st);
    st.items = st.nums.map((n) => ({ id: st.nextId++, v: frac(n) }));
    st.history = []; st.moves = 0; st.status = 'play'; st.lastHint = null;
    st.events.push({ type: 'puzzle', nums: st.nums.slice() });
  }

  // 두 카드를 합친다: i 번째 (op) j 번째 → 결과는 j 자리에 놓임
  function combine(st, i, j, op) {
    if (st.over || st.status !== 'play' || i === j || i < 0 || j < 0 || i >= st.items.length || j >= st.items.length || !OPS.includes(op)) return null;
    const a = st.items[i], b = st.items[j], r = apply(a.v, b.v, op);
    if (!r) { st.events.push({ type: 'invalid', why: 'zero' }); return null; }
    st.history.push(st.items.map((x) => ({ id: x.id, v: x.v })));
    const item = { id: st.nextId++, v: r };
    const items = st.items.filter((_, x) => x !== i && x !== j);
    items.splice(Math.min(items.length, Math.min(i, j)), 0, item);
    st.items = items; st.moves++;
    st.events.push({ type: 'combine', a: a.v, b: b.v, op, result: r, left: items.length });
    if (items.length === 1) {
      if (eq(r, frac(TARGET))) {
        st.status = 'solved'; st.solved++; st.events.push({ type: 'solved', solved: st.solved });
      } else { st.wrongTry++; st.events.push({ type: 'wrong', value: r }); }
    }
    return r;
  }
  function undo(st) {
    if (st.over || !st.history.length || st.status === 'solved') return false;
    st.items = st.history.pop(); st.moves = Math.max(0, st.moves - 1); st.lastHint = null;
    st.events.push({ type: 'undo' }); return true;
  }
  function reset(st) {
    if (st.over || st.status === 'solved') return false;
    st.items = st.nums.map((n) => ({ id: st.nextId++, v: frac(n) })); st.history = []; st.moves = 0; st.lastHint = null;
    st.events.push({ type: 'reset' }); return true;
  }
  // 다음 문제 (풀었을 때 부른다)
  function next(st) { if (st.over) return; startPuzzle(st); }
  function skip(st) {
    if (st.over || st.status === 'solved') return false;
    st.skipped++; if (!st.tutorial) st.timeLeft -= st.params.skip;
    st.events.push({ type: 'skip', cost: st.params.skip });
    if (st.timeLeft <= 0) { endGame(st); return true; }
    startPuzzle(st); return true;
  }
  // 지금 카드 상태에서 이어서 풀 수 있는 다음 한 수를 알려 줌 (풀 수 없는 상태면 null)
  function hint(st) {
    if (st.over || st.status !== 'play') return null;
    const sol = findSolution(st.items.map((x) => x.v), st.level !== 'expert');
    if (!sol || !sol.length) { st.events.push({ type: 'nohint' }); return null; }
    if (!st.tutorial) st.timeLeft -= st.params.hint;
    st.hints++;
    const s = sol[0]; st.lastHint = { i: s.i, j: s.j, op: s.op };
    st.events.push({ type: 'hint', i: s.i, j: s.j, op: s.op, cost: st.params.hint });
    if (st.timeLeft <= 0) endGame(st);
    return st.lastHint;
  }
  function step(st, dt) {
    if (st.over) return;
    if (st.status === 'play' && st.timeLeft !== Infinity) { st.timeLeft -= dt; if (st.timeLeft <= 0) endGame(st); }
  }
  function endGame(st) { st.timeLeft = 0; st.over = true; st.events.push({ type: 'over', solved: st.solved }); }

  const api = { TARGET, OPS, LEVELS, rng, frac, show, eq, apply, findSolution, countSolutions, solvableByAddMul, buildPool, newGame, combine, undo, reset, next, skip, hint, step };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LOGIC_24 = api;
})(typeof window !== 'undefined' ? window : globalThis);
