// 실행: node --experimental-strip-types --no-warnings scripts/streak.check.mjs
import assert from 'node:assert/strict';

import { streakOf } from '../src/lib/date.ts';

const s = (...d) => new Set(d.map((x) => `2026-11-${String(x).padStart(2, '0')}`));
const today = '2026-11-19';

assert.deepEqual(streakOf(s(), today), { current: 0, best: 0 });
// 오늘까지 3일 연속
assert.deepEqual(streakOf(s(17, 18, 19), today), { current: 3, best: 3 });
// 오늘은 아직 비었어도 어제까지 이어지면 유지
assert.deepEqual(streakOf(s(17, 18), today), { current: 2, best: 2 });
// 어제를 빠뜨리면 리셋 (예전 최장은 남는다)
assert.deepEqual(streakOf(s(10, 11, 12, 13, 17), today), { current: 0, best: 4 });
// 하루 빠진 뒤 다시 시작
assert.deepEqual(streakOf(s(1, 2, 3, 5, 18, 19), today), { current: 2, best: 3 });
// 월 경계를 넘는 연속
assert.deepEqual(
  streakOf(new Set(['2026-10-30', '2026-10-31', '2026-11-01']), '2026-11-01'),
  { current: 3, best: 3 },
);
console.log('streak ok');
