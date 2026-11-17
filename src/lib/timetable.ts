// ---------- 격자 타임테이블 (모트모트식) ----------
// 하루 = 06:00 ~ 익일 02:00 (03~05시는 데드존). 10분 칸 120개.
// 새벽 00~02시 기록은 '전날' 타임테이블에 속한다 (06시 기준으로 하루 구분).

import { scheduleAutoBackup } from './backup';
import { addDays } from './date';
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

/** 연속 기록: 오늘(아직 비었으면 어제)부터 거꾸로 1칸 이상 채운 날 수 */
export async function loadStreak(today: string = timetableDateKey()): Promise<number> {
  let k = today;
  if (!totalActualMin(await loadTimetable(k))) k = addDays(k, -1);
  let n = 0;
  for (; n < 365; n++, k = addDays(k, -1)) if (!totalActualMin(await loadTimetable(k))) break;
  return n;
}

/** 블록에서 아직 안 채운 계획 분 (nowIdx 이전 칸은 지난 것으로 보고 뺀다, 오늘 아니면 -1) */
export function remainingPlanMin(
  day: DayTimetable,
  block: { start: number; end: number },
  nowIdx: number,
): number {
  let n = 0;
  for (let i = Math.max(block.start, nowIdx); i <= block.end; i++) if (!day.cells[i]?.actual) n++;
  return n * CELL_MIN;
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

/** 과목 색 팔레트 (J6) — base 외에는 Pro */
export const PALETTES = {
  base: { name: '기본', colors: CATEGORY_COLORS },
  pastel: {
    name: '파스텔',
    colors: ['#9DB4F0', '#A8DCC0', '#C9B6F2', '#A8DDE8', '#F5D9A0', '#F2B3B3', '#F2B8D8', '#C9C9C9'],
  },
  mono: {
    name: '모노',
    colors: ['#111111', '#3D3D3D', '#666666', '#8C8C8C', '#B3B3B3', '#5A5A5A', '#2A2A2A', '#A0A0A0'],
  },
  forest: {
    name: '포레스트',
    colors: ['#2F5D50', '#5C8D5A', '#A3B18A', '#D6D2C4', '#B5651D', '#7A8450', '#3E6259', '#8C6A43'],
  },
  sunset: {
    name: '선셋',
    colors: ['#E76F51', '#F4A261', '#E9C46A', '#2A9D8F', '#264653', '#D1495B', '#EDAE49', '#00798C'],
  },
  candy: {
    name: '캔디',
    colors: ['#FF6F91', '#C77DFF', '#4CC9F0', '#80ED99', '#FFD166', '#FF9F1C', '#F15BB5', '#00BBF9'],
  },
} as const;
export type PaletteId = keyof typeof PALETTES;

function newCatId(): string {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createCategory(name: string, color: string): Category {
  return { id: newCatId(), name, color };
}

// ───────── 시간표 템플릿 (I5) ─────────

/** 요일별로 반복할 계획. days: 월요일=0 */
export type PlanTemplate = {
  id: string;
  name: string;
  days: number[];
  planned: (SubjectId | null)[];
};

const TPL_KEY = 'templates';

export async function loadTemplates(): Promise<PlanTemplate[]> {
  return (await getItem<PlanTemplate[]>(TPL_KEY)) ?? [];
}

export async function saveTemplates(list: PlanTemplate[]): Promise<void> {
  await setItem(TPL_KEY, list);
  scheduleAutoBackup();
}

export function templateFromDay(name: string, days: number[], day: DayTimetable): PlanTemplate {
  return { id: newCatId(), name, days, planned: day.cells.map((c) => c.planned ?? null) };
}

/** 템플릿의 계획을 하루에 덮어 칠한다 (템플릿이 빈 칸은 기존 계획 유지) */
export function applyTemplate(day: DayTimetable, tpl: PlanTemplate): DayTimetable {
  return {
    ...day,
    cells: day.cells.map((c, i) => (tpl.planned[i] ? { ...c, planned: tpl.planned[i]! } : c)),
  };
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
