import { getItem, setItem } from './storage';
import { scheduleAutoBackup } from './backup';

// v1 lib.ts의 D-Day 로직을 AsyncStorage 버전으로 이식.
export type DDay = {
  id: string;
  title: string;
  /** "YYYY-MM-DD" */
  date: string;
  color: string;
};

export const DDAY_COLORS = ['#E8724C', '#F5B94A', '#7EC08A', '#7FB5D9', '#B98AD4'];

const DDAY_KEY = 'dday:list';

function ddayId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 날짜 오름차순(가까운 순)으로 정렬해 반환 */
export async function loadDDays(): Promise<DDay[]> {
  const list = (await getItem<DDay[]>(DDAY_KEY)) ?? [];
  return [...list].sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveDDays(list: DDay[]): Promise<void> {
  await setItem(DDAY_KEY, list);
  scheduleAutoBackup();
}

export async function addDDay(input: { title: string; date: string; color: string }): Promise<DDay> {
  const dday: DDay = { id: ddayId(), ...input };
  const list = await loadDDays();
  await saveDDays([...list, dday]);
  return dday;
}

export async function removeDDay(id: string): Promise<void> {
  const list = await loadDDays();
  await saveDDays(list.filter((d) => d.id !== id));
}

function diffDays(dateStr: string, ref: Date = new Date()): number {
  const r = new Date(ref);
  r.setHours(0, 0, 0, 0);
  const t = new Date(`${dateStr}T00:00:00`);
  return Math.round((t.getTime() - r.getTime()) / 86_400_000);
}

/** "D-DAY" / "D-N" / "D+N" */
export function getDDayCount(dateStr: string): string {
  const d = diffDays(dateStr);
  if (d === 0) return 'D-DAY';
  return d > 0 ? `D-${d}` : `D+${-d}`;
}

/** 어제 이전이면 true (오늘=D-DAY는 아직 유효) */
export function isDDayPast(dateStr: string): boolean {
  return diffDays(dateStr) < 0;
}

/** D-7 이내(오늘 포함, 미래만) → 강조색 적용 여부 */
export function isDDaySoon(dateStr: string): boolean {
  const d = diffDays(dateStr);
  return d >= 0 && d <= 7;
}

/** 지난 D-Day는 제외하고 표시용 목록 반환 */
export async function loadVisibleDDays(): Promise<DDay[]> {
  return (await loadDDays()).filter((d) => !isDDayPast(d.date));
}
