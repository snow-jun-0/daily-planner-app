// ---------- 격자 타임테이블 (모트모트식) ----------
// 하루 = 06:00 ~ 익일 02:00 (03~05시는 데드존). 10분 칸 120개.
// 새벽 00~02시 기록은 '전날' 타임테이블에 속한다 (06시 기준으로 하루 구분).

import { scheduleAutoBackup } from './backup';
import { getItem, setItem } from './storage';

export type SubjectId = string;

/** 과목/카테고리 (전역 저장) */
export type Category = { id: SubjectId; name: string; color: string };

/** 10분 칸 하나: 계획색 / 실제색 */
export type Cell = { planned?: SubjectId; actual?: SubjectId };

/** 일정 레인 (수업·약속) — 06:00을 0으로 한 분 단위 */
export type ScheduleEvent = { id: string; title: string; startMin: number; endMin: number };

/** 날짜별 타임테이블 */
export type DayTimetable = {
  cells: Cell[]; // 길이 CELL_COUNT
  events: ScheduleEvent[];
  /** 02시를 넘겨 격자 밖에서 집중한 분 — TOTAL에만 합산 */
  overflowMin: number;
};

export const START_HOUR = 6;
export const ROWS = 20; // 06시 ~ 01시 (각 1시간 행)
export const COLS = 6; // 한 시간 = 10분 칸 6개
export const CELL_COUNT = ROWS * COLS; // 120
export const CELL_MIN = 10;

/** 과목 미선택 집중(회색). 항상 존재하는 기본 카테고리 */
export const FOCUS_CATEGORY: Category = { id: 'focus', name: '집중', color: '#9B9B9B' };

// ───────── 칸 ↔ 시각 ─────────

/** 칸 인덱스 → 06:00 기준 분 */
export function cellToMinutes(index: number): number {
  return START_HOUR * 60 + index * CELL_MIN;
}

/** 칸 인덱스 → "HH:MM" 시작 라벨 */
export function cellLabel(index: number): string {
  const total = cellToMinutes(index);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 현재 시각 → 칸 인덱스 (06~02시 범위 밖이면 -1) */
export function dateToCellIndex(d: Date): number {
  let h = d.getHours();
  if (h < START_HOUR) h += 24; // 00~05시는 전날 새벽의 연장
  const total = (h - START_HOUR) * 60 + d.getMinutes();
  const idx = Math.floor(total / CELL_MIN);
  return idx >= 0 && idx < CELL_COUNT ? idx : -1;
}

/** 그 시각이 속한 '타임테이블 하루'의 날짜 키 (06시 기준으로 하루가 바뀜) */
export function timetableDateKey(d: Date = new Date()): string {
  const c = new Date(d);
  if (c.getHours() < START_HOUR) c.setDate(c.getDate() - 1);
  const y = c.getFullYear();
  const mo = String(c.getMonth() + 1).padStart(2, '0');
  const da = String(c.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

// ───────── 저장 ─────────

const TT_PREFIX = 'timetable:';
const CAT_KEY = 'categories';

function emptyDay(): DayTimetable {
  return {
    cells: Array.from({ length: CELL_COUNT }, () => ({}) as Cell),
    events: [],
    overflowMin: 0,
  };
}

export async function loadTimetable(dateKey: string): Promise<DayTimetable> {
  const data = await getItem<DayTimetable>(`${TT_PREFIX}${dateKey}`);
  if (!data) return emptyDay();
  const cells = data.cells ?? [];
  const fixed =
    cells.length === CELL_COUNT
      ? cells
      : Array.from({ length: CELL_COUNT }, (_, i) => cells[i] ?? ({} as Cell));
  return { cells: fixed, events: data.events ?? [], overflowMin: data.overflowMin ?? 0 };
}

export async function saveTimetable(dateKey: string, day: DayTimetable): Promise<void> {
  await setItem(`${TT_PREFIX}${dateKey}`, day);
  scheduleAutoBackup();
}

const ttListeners = new Set<(dateKey: string) => void>();

/** 타임테이블 저장 알림 구독 (타이머가 actual을 채우면 격자가 다시 읽음) */
export function subscribeTimetable(fn: (dateKey: string) => void): () => void {
  ttListeners.add(fn);
  return () => {
    ttListeners.delete(fn);
  };
}

let writeChain: Promise<unknown> = Promise.resolve();

/**
 * 최신 저장본을 읽어 fn으로 병합한 뒤 저장 (쓰기는 직렬화).
 * 격자(planned)와 타이머(actual)가 같은 날짜를 동시에 써도 서로 덮어쓰지 않는다.
 */
export function updateTimetable(
  dateKey: string,
  fn: (latest: DayTimetable) => DayTimetable,
): Promise<void> {
  const p = writeChain.then(async () => {
    await saveTimetable(dateKey, fn(await loadTimetable(dateKey)));
    ttListeners.forEach((l) => l(dateKey));
  });
  writeChain = p.catch(() => {});
  return p;
}

/** idx가 속한, 같은 과목으로 연속 계획된 칸 범위 [start, end] (계획 없으면 null) */
export function plannedBlockAt(
  day: DayTimetable,
  idx: number,
): { start: number; end: number; subject: SubjectId } | null {
  const subject = day.cells[idx]?.planned;
  if (!subject) return null;
  let start = idx;
  let end = idx;
  while (start > 0 && day.cells[start - 1]?.planned === subject) start--;
  while (end < CELL_COUNT - 1 && day.cells[end + 1]?.planned === subject) end++;
  return { start, end, subject };
}

// ───────── 카테고리 ─────────

export async function loadCategories(): Promise<Category[]> {
  const cats = await getItem<Category[]>(CAT_KEY);
  if (!cats || !cats.length) return [FOCUS_CATEGORY];
  // 기본 '집중' 카테고리는 항상 포함
  return cats.some((c) => c.id === FOCUS_CATEGORY.id) ? cats : [FOCUS_CATEGORY, ...cats];
}

export async function saveCategories(cats: Category[]): Promise<void> {
  await setItem(CAT_KEY, cats);
  scheduleAutoBackup();
}

/** 하루의 계획 블록들 (같은 과목 연속 칸 묶음), 시간순 */
export function plannedBlocks(day: DayTimetable): { start: number; end: number; subject: SubjectId }[] {
  const out: { start: number; end: number; subject: SubjectId }[] = [];
  for (let i = 0; i < day.cells.length; i++) {
    const b = plannedBlockAt(day, i);
    if (b) {
      out.push(b);
      i = b.end;
    }
  }
  return out;
}

/** 카테고리 색 팔레트 */
export const CATEGORY_COLORS = [
  '#4C6EF5',
  '#2F9E44',
  '#E8590C',
  '#9C36B5',
  '#1098AD',
  '#E03131',
  '#F08C00',
  '#D6599B',
];

function newCatId(): string {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createCategory(name: string, color: string): Category {
  return { id: newCatId(), name, color };
}

// ───────── 집계 ─────────

/** 실제(actual)로 채운 분 + 범위 밖 집중 분 */
export function totalActualMin(day: DayTimetable): number {
  return day.cells.filter((c) => c.actual).length * CELL_MIN + (day.overflowMin ?? 0);
}

/** 계획(planned)한 분 */
export function totalPlannedMin(day: DayTimetable): number {
  return day.cells.filter((c) => c.planned).length * CELL_MIN;
}

/** 계획 대비 실제 달성률 (0~1), 계획이 없으면 0 */
export function achievementRate(day: DayTimetable): number {
  const planned = day.cells.filter((c) => c.planned).length;
  if (!planned) return 0;
  const done = day.cells.filter((c) => c.planned && c.actual).length;
  return done / planned;
}

/** 과목별 실제 집중 분 */
export function actualByCategory(day: DayTimetable): Record<SubjectId, number> {
  const out: Record<SubjectId, number> = {};
  for (const c of day.cells) if (c.actual) out[c.actual] = (out[c.actual] ?? 0) + CELL_MIN;
  return out;
}
