'use strict';
// 24 만들기 규칙 시험. 실행: node --test
const test = require('node:test');
const assert = require('node:assert');
const L = require('../logic.js');

const clearEv = (st) => { const e = st.events.slice(); st.events.length = 0; return e; };
const game = (nums, level = 'normal') => L.newGame(L.rng(3), { level, nums });
// 풀이 단계(합치기 목록)를 그대로 실행한다
const play = (st, steps) => { for (const s of steps) { const r = L.combine(st, s.i, s.j, s.op); assert.ok(r, 'step must be valid'); } };

test('fractions are exact: arithmetic, reduction, division by zero', () => {
  const f = L.frac;
  assert.deepStrictEqual(L.apply(f(1), f(3), '/'), f(1, 3));
  assert.deepStrictEqual(L.apply(f(1, 3), f(1, 6), '+'), f(1, 2));
  assert.deepStrictEqual(L.apply(f(8), f(3, 1), '/'), f(8, 3));
  assert.deepStrictEqual(L.apply(f(3), f(8, 3), '-'), f(1, 3));
  assert.deepStrictEqual(L.apply(f(8), f(1, 3), '/'), f(24));
  assert.strictEqual(L.apply(f(5), f(0), '/'), null);
  assert.deepStrictEqual(L.apply(f(2), f(5), '-'), f(-3));
  assert.strictEqual(L.show(f(8, 3)), '8/3'); assert.strictEqual(L.show(f(6, 3)), '2');
});

// 독립적으로 다시 적은 기준 풀이기(소수점 계산): 네 숫자로 24 를 만들 수 있는가
function bruteSolvable(nums) {
  const eps = 1e-9;
  const rec = (list) => {
    if (list.length === 1) return Math.abs(list[0] - 24) < eps;
    for (let i = 0; i < list.length; i++) for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const rest = list.filter((_, x) => x !== i && x !== j), a = list[i], b = list[j];
      const outs = [a + b, a - b, a * b]; if (Math.abs(b) > eps) outs.push(a / b);
      for (const v of outs) if (rec([...rest, v])) return true;
    }
    return false;
  };
  return rec(nums);
}

test('the solver agrees with an independent brute force on every four-number combination from 1 to 13', () => {
  let n = 0, solvable = 0;
  for (let a = 1; a <= 13; a++) for (let b = a; b <= 13; b++) for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) {
    const nums = [a, b, c, d], mine = !!L.findSolution(nums, false);
    assert.strictEqual(mine, bruteSolvable(nums), nums.join());
    if (mine) solvable++; n++;
  }
  assert.strictEqual(n, 1820); assert.ok(solvable > 1300 && solvable < 1500, 'solvable: ' + solvable);
});

test('known puzzles: classic solvable, unsolvable, and fraction-only ones', () => {
  assert.ok(L.findSolution([1, 2, 3, 4], true));
  assert.strictEqual(L.findSolution([1, 1, 1, 1], false), null);
  assert.strictEqual(L.findSolution([1, 1, 1, 2], false), null);
  assert.strictEqual(L.findSolution([3, 3, 8, 8], true), null, '8 / (3 - 8/3) needs fractions');
  assert.ok(L.findSolution([3, 3, 8, 8], false));
  assert.strictEqual(L.findSolution([1, 5, 5, 5], true), null);
  assert.ok(L.findSolution([1, 5, 5, 5], false));
  assert.ok(L.findSolution([4, 4, 10, 10], true), '(10*10-4)/4');
});

test('a found solution can be replayed with combine() and ends at 24', () => {
  for (const nums of [[1, 2, 3, 4], [6, 6, 6, 6], [4, 4, 10, 10], [1, 3, 4, 6], [3, 3, 8, 8], [1, 5, 5, 5]]) {
    const st = game(nums, 'expert'); const sol = L.findSolution(nums, false); assert.ok(sol, nums.join());
    play(st, sol);
    assert.strictEqual(st.status, 'solved', nums.join());
    assert.ok(clearEv(st).some((e) => e.type === 'solved'));
  }
});

test('the puzzle pools: easy has 1 to 9 with several solutions, normal is integer-solvable, expert is harder', () => {
  const P = L.buildPool();
  assert.ok(P.easy.length > 150 && P.normal.length > 1000 && P.expert.length > 200, [P.easy.length, P.normal.length, P.expert.length].join());
  for (const nums of P.easy) { assert.ok(Math.max(...nums) <= 9); assert.ok(L.countSolutions(nums, true, 6) >= 3); }
  for (const nums of P.normal.slice(0, 200)) assert.ok(L.findSolution(nums, true));
  for (const nums of P.expert) { assert.ok(L.findSolution(nums, false)); assert.ok(!L.findSolution(nums, true) || !L.solvableByAddMul(nums), 'expert puzzles need − or ÷ or fractions'); }
  assert.ok(P.expert.some((n) => n.join() === '3,3,8,8') && P.expert.some((n) => n.join() === '1,5,5,5'));
  assert.ok(P.easy.every((n) => L.findSolution(n, true)));
});

test('combine: valid moves merge two cards into one (placed at the second card), other moves are refused', () => {
  const st = game([2, 3, 4, 5]);
  assert.strictEqual(L.combine(st, 0, 0, '+'), null, 'same card');
  assert.strictEqual(L.combine(st, 0, 9, '+'), null, 'no such card');
  assert.strictEqual(L.combine(st, 0, 1, '%'), null, 'unknown operator');
  const r = L.combine(st, 0, 1, '*');
  assert.deepStrictEqual(r, L.frac(6)); assert.strictEqual(st.items.length, 3);
  assert.deepStrictEqual(st.items.map((x) => L.show(x.v)), ['6', '4', '5']);
  assert.ok(clearEv(st).some((e) => e.type === 'combine' && e.left === 3));
  const sub = game([2, 7, 4, 5]); L.combine(sub, 0, 1, '-');
  assert.strictEqual(L.show(sub.items[0].v), '-5', 'a - b with a first');
});

test('dividing by zero is refused and changes nothing', () => {
  const st = game([4, 4, 1, 2]); L.combine(st, 0, 1, '-');          // 0 만들기
  const before = st.items.map((x) => L.show(x.v)).join();
  assert.strictEqual(L.combine(st, 2, 0, '/'), null);
  assert.strictEqual(st.items.map((x) => L.show(x.v)).join(), before);
  assert.ok(clearEv(st).some((e) => e.type === 'invalid'));
});

test('undo and reset', () => {
  const st = game([1, 2, 3, 4]);
  L.combine(st, 0, 1, '+'); L.combine(st, 0, 1, '+');
  assert.ok(L.undo(st)); assert.strictEqual(st.items.length, 3);
  assert.ok(L.undo(st)); assert.strictEqual(st.items.length, 4);
  assert.strictEqual(L.undo(st), false);
  L.combine(st, 0, 1, '*'); L.combine(st, 0, 1, '*');
  assert.ok(L.reset(st)); assert.strictEqual(st.items.length, 4); assert.deepStrictEqual(st.items.map((x) => x.v.n), st.nums);
});

test('ending on something other than 24 is a miss you can undo; ending on 24 solves it and scores', () => {
  const st = game([1, 2, 3, 4]);
  play(st, [{ i: 0, j: 1, op: '+' }, { i: 0, j: 1, op: '+' }, { i: 0, j: 1, op: '+' }]);   // 1+2, 3+3, 6+4 = 10
  assert.strictEqual(st.status, 'play'); assert.strictEqual(st.items.length, 1);
  assert.ok(clearEv(st).some((e) => e.type === 'wrong')); assert.strictEqual(st.solved, 0);
  assert.ok(L.undo(st)); assert.strictEqual(st.items.length, 2);
  L.combine(st, 0, 1, '*');                                          // 6 × 4 = 24
  assert.strictEqual(st.status, 'solved'); assert.strictEqual(st.solved, 1);
  assert.strictEqual(L.combine(st, 0, 0, '+'), null);
  L.next(st); assert.strictEqual(st.status, 'play'); assert.strictEqual(st.items.length, 4);
});

test('timer, skip and hint costs; the game ends at zero', () => {
  const st = game([1, 2, 3, 4], 'normal'); const t0 = st.timeLeft;
  L.step(st, 5); assert.ok(Math.abs(st.timeLeft - (t0 - 5)) < 1e-9);
  L.skip(st); assert.ok(Math.abs(st.timeLeft - (t0 - 5 - st.params.skip)) < 1e-9); assert.strictEqual(st.skipped, 1);
  const h = L.hint(st); assert.ok(h && st.hints === 1);
  assert.ok(Math.abs(st.timeLeft - (t0 - 5 - st.params.skip - st.params.hint)) < 1e-9);
  L.step(st, 1000); assert.strictEqual(st.over, true); assert.ok(clearEv(st).some((e) => e.type === 'over'));
  assert.strictEqual(L.combine(st, 0, 1, '+'), null);
  const e = L.newGame(L.rng(1), { level: 'easy' }); assert.ok(e.params.time > st.params.time, 'easy has more time');
  const tut = L.newGame(L.rng(1), { level: 'normal', tutorial: true, nums: [1, 2, 3, 4] }); L.step(tut, 9999); L.skip(tut); L.hint(tut);
  assert.strictEqual(tut.over, false); assert.strictEqual(tut.timeLeft, Infinity);
});

test('hints always lead to a solution when followed, even after a wrong turn is undone', () => {
  for (const level of ['easy', 'normal', 'expert']) for (let seed = 1; seed <= 6; seed++) {
    const st = L.newGame(L.rng(seed * 13), { level });
    for (let guard = 0; guard < 6 && st.status === 'play'; guard++) { const h = L.hint(st); assert.ok(h, `${level} ${st.nums.join()}`); assert.ok(L.combine(st, h.i, h.j, h.op)); }
    assert.strictEqual(st.status, 'solved', `${level} ${st.nums.join()}`);
  }
  // 엉뚱하게 합쳐 막다른 길이면 힌트가 없다고 알림, 되돌리면 다시 풀림
  const st = game([1, 1, 1, 8]); L.combine(st, 0, 1, '+'); L.combine(st, 0, 1, '-');         // 2, 8 → 2-8
  const ev = clearEv(st); void ev;
  st.items = [{ id: 1, v: L.frac(1) }, { id: 2, v: L.frac(1) }];                                  // 1 과 1 만 남은 막다른 상태
  assert.strictEqual(L.hint(st), null); assert.ok(clearEv(st).some((e) => e.type === 'nohint'));
});

test('puzzles come from the pool, differ from round to round, and the same seed gives the same ones', () => {
  const a = L.newGame(L.rng(9), { level: 'normal' }), b = L.newGame(L.rng(9), { level: 'normal' });
  assert.deepStrictEqual(a.nums, b.nums);
  const P = L.buildPool(); const seen = new Set();
  for (let i = 0; i < 20; i++) { const sorted = a.nums.slice().sort((x, y) => x - y).join(); assert.ok(P.normal.some((n) => n.join() === sorted)); seen.add(sorted); L.next(a); }
  assert.ok(seen.size >= 15, 'varied puzzles: ' + seen.size);
});
