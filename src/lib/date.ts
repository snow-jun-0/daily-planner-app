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
