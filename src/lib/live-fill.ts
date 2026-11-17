// 집중 중 '지금 칸'을 1분 블록으로 채우는 범위 계산 (의존성 없음 — scripts/live-fill.check.mjs로 검증)

export const BLOCKS_PER_CELL = 10; // 10분 칸 = 1분 블록 10개

/** now가 속한 10분 칸의 시작 시각(ms) — 칸은 시계의 10분 경계와 정렬돼 있다 */
export function cellStartMs(nowMs: number): number {
  const d = new Date(nowMs);
  d.setMinutes(d.getMinutes() - (d.getMinutes() % BLOCKS_PER_CELL), 0, 0);
  return d.getTime();
}

/**
 * 진행 중 칸의 1분 블록 범위.
 * - from: 세션이 이 칸에 들어온 분 (45분에 시작했으면 5). 이 칸 이전부터 집중 중이면 0
 * - done: 다 채운 분 경계. 블록 [from, done)은 채움, 블록 done은 지금 채우는 중
 */
export function liveFillRange(startMs: number, nowMs: number): { from: number; done: number } {
  const cell = cellStartMs(nowMs);
  const from = startMs > cell ? Math.min(BLOCKS_PER_CELL - 1, Math.floor((startMs - cell) / 60_000)) : 0;
  const done = Math.max(from, Math.min(BLOCKS_PER_CELL, Math.floor((nowMs - cell) / 60_000)));
  return { from, done };
}

/**
 * from ~ cutoff(진행 중 칸의 시작) 사이에서 '다 지난' 칸마다 그 칸 안의 시각 하나씩.
 * 10분 간격으로 걸으니 백그라운드였던 구간도 칸을 건너뛰지 않는다. cutoff가 속한 진행 중 칸은 넣지 않는다.
 */
export function completedCellTimes(fromMs: number, cutoffMs: number): number[] {
  const out: number[] = [];
  for (let t = fromMs; t < cutoffMs; t = Math.min(t + BLOCKS_PER_CELL * 60_000, cutoffMs)) out.push(t);
  return out;
}
