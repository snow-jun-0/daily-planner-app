// 실행: node --experimental-strip-types --no-warnings scripts/live-fill.check.mjs
import assert from 'node:assert/strict';

import { completedCellTimes, liveFillRange } from '../src/lib/live-fill.ts';

const at = (h, m, s = 0) => new Date(2026, 10, 18, h, m, s).getTime();

// 14:45에 시작 → 칸(14:40~50) 중간 5분 지점부터
assert.deepEqual(liveFillRange(at(14, 45, 10), at(14, 45, 30)), { from: 5, done: 5 });
assert.deepEqual(liveFillRange(at(14, 45, 10), at(14, 46, 5)), { from: 5, done: 6 });
assert.deepEqual(liveFillRange(at(14, 45, 10), at(14, 49, 59)), { from: 5, done: 9 });
// 이전 칸부터 집중 중 → 이 칸 맨 왼쪽부터
assert.deepEqual(liveFillRange(at(14, 38), at(14, 42, 1)), { from: 0, done: 2 });
// 정각 시작
assert.deepEqual(liveFillRange(at(14, 40), at(14, 40, 59)), { from: 0, done: 0 });
// 자정 넘김(00:03, 칸 00:00~10)
assert.deepEqual(liveFillRange(at(23, 58), at(0, 3, 0) + 86_400_000), { from: 0, done: 3 });

// 완료된 칸: 01:06:34 시작, 진행 중 칸 01:10 → 01:00 칸 하나만 (01:10 칸은 넣지 않음)
assert.deepEqual(completedCellTimes(at(1, 6, 34), at(1, 10)), [at(1, 6, 34)]);
// 백그라운드로 30분 넘게 비었어도 칸마다 하나씩: 01:00, 01:10, 01:20, 01:30
assert.equal(completedCellTimes(at(1, 6, 34), at(1, 40)).length, 4);
// 아직 완료된 칸 없음
assert.deepEqual(completedCellTimes(at(1, 6, 34), at(1, 0)), []);

console.log('live-fill ok');
