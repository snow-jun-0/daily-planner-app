function toDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** `YYYY-MM-DD` in local time, e.g. "2026-09-23". */
export function todayKey(): string {
  return toDateKey(new Date());
}

/** `dateKey` shifted by `delta` days (negative moves backward). */
export function addDays(dateKey: string, delta: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
}

/** dateKey가 속한 주(월~일)의 날짜 키 7개 */
export function weekKeys(dateKey: string): string[] {
  const monday = addDays(dateKey, -((parseDateKey(dateKey).getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAYS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** `YYYY-MM-DD` -> "9월 23일 (수)". */
export function formatDisplayDate(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const [, m, d] = dateKey.split('-').map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS_KO[date.getDay()]})`;
}

/** `YYYY-MM-DD` -> "9월 23일" (day-header's large date title). */
export function formatMonthDay(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number);
  return `${m}월 ${d}일`;
}

/** `YYYY-MM-DD` -> "WED · 9월" (day-header's small muted label). */
export function formatHeaderLabel(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const [, m] = dateKey.split('-').map(Number);
  return `${WEEKDAYS_EN[date.getDay()]} · ${m}월`;
}

/**
 * 기록한 날짜 집합으로 연속 기록 계산 (scripts/streak.check.mjs로 검증).
 * current: 오늘(아직 없으면 어제)부터 거꾸로 이어진 날 수, best: 가장 길게 이어진 날 수.
 */
export function streakOf(done: Set<string>, today: string): { current: number; best: number } {
  let k = done.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (done.has(k)) {
    current++;
    k = addDays(k, -1);
  }
  let best = 0;
  for (const d of done) {
    if (done.has(addDays(d, -1))) continue; // 연속 구간의 첫날에서만 센다
    let run = 0;
    for (let x = d; done.has(x); x = addDays(x, 1)) run++;
    best = Math.max(best, run);
  }
  return { current, best };
}
