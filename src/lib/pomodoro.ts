import * as Haptics from 'expo-haptics';

import { todayKey } from './date';
import { cancelOverrunNags, notifyPhaseEnd, scheduleOverrunNags, startRepeatingAlarm } from './notify';
import { cellStartMs, completedCellTimes } from './live-fill';
import { getPrefs } from './settings';
import { recordBreakOverrun, recordFocusSession } from './stats';
import { getItem, setItem } from './storage';
import {
  dateToCellIndex,
  FOCUS_CATEGORY,
  timetableDateKey,
  updateTimetable,
  type SubjectId,
} from './timetable';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'overrun';
export type TimerPhase = 'focus' | 'break';

export type PomodoroSettings = {
  focusMinutes: number;
  breakMinutes: number;
};

export type PomodoroState = {
  status: TimerStatus;
  phase: TimerPhase;
  /** epoch ms when the current phase ends — only set while `running` */
  endTime: number | null;
  /** authoritative remaining time; kept fresh by `tick()` while running */
  remainingMs: number;
  settings: PomodoroSettings;
  sessionsDone: number;
  /** date `sessionsDone` was counted for — resets the count on a new day */
  sessionsDate: string;
  /** 완료 알람이 울리는 중 (사용자가 끌 때까지) */
  alarming: boolean;
  /** 휴식 초과 대기 시작 시각 (status==='overrun'일 때) */
  overrunStartTime: number | null;
  /** 현재 휴식 초과 경과(ms) */
  overrunMs: number;
  /** 직전 휴식에서 1분 유예 넘긴 초과(ms) — 잔소리 표시용 */
  lastOverrunMs: number;
  /** 집중 중 격자에 실제(actual)로 채울 과목 */
  focusSubject: SubjectId;
};

const DEFAULT_SETTINGS: PomodoroSettings = { focusMinutes: 25, breakMinutes: 5 };
const SETTINGS_KEY = 'pomodoro:settings';

function sessionsKey(date: string): string {
  return `pomodoro:sessions:${date}`;
}

async function loadSettings(): Promise<PomodoroSettings> {
  const settings = await getItem<PomodoroSettings>(SETTINGS_KEY);
  return settings ?? DEFAULT_SETTINGS;
}

async function saveSettings(settings: PomodoroSettings): Promise<void> {
  await setItem(SETTINGS_KEY, settings);
}

async function loadSessionsDone(date: string): Promise<number> {
  const count = await getItem<number>(sessionsKey(date));
  return count ?? 0;
}

async function saveSessionsDone(date: string, count: number): Promise<void> {
  await setItem(sessionsKey(date), count);
}

export function getPhaseDurationMs(phase: TimerPhase, settings: PomodoroSettings): number {
  return (phase === 'focus' ? settings.focusMinutes : settings.breakMinutes) * 60_000;
}

/*
 * Module-scoped runtime store — deliberately kept outside any component so
 * the countdown survives switching to another tab (the tabs stay mounted,
 * but even if they didn't, this state wouldn't unmount with them). Not
 * persisted across app restarts; only `settings` and `sessionsDone` are
 * (via AsyncStorage), everything else is derived fresh from `endTime`.
 */
let state: PomodoroState = {
  status: 'idle',
  phase: 'focus',
  endTime: null,
  remainingMs: getPhaseDurationMs('focus', DEFAULT_SETTINGS),
  settings: DEFAULT_SETTINGS,
  sessionsDone: 0,
  sessionsDate: todayKey(),
  alarming: false,
  overrunStartTime: null,
  overrunMs: 0,
  lastOverrunMs: 0,
  focusSubject: FOCUS_CATEGORY.id,
};

// ───────── 격자 actual 채우기 ─────────
/** 집중 실행 중 아직 격자에 반영 안 한 구간의 시작 (실행 중이 아니면 null) */
let fillFrom: number | null = null;
/** 이번 실행에서 이미 칠한 칸 `${date}:${idx}` — 같은 칸 재저장 방지 */
const filled = new Set<string>();

/** fillFrom ~ until 사이 칸들을 오늘 타임테이블 actual로 마킹. 새 칸이 생길 때만 저장(≈10분 1회). */
function fillActual(until: number): void {
  if (fillFrom == null) return;
  // 지금 진행 중인 칸(아직 10분이 안 찬 칸)은 저장하지 않는다 — 격자의 비율 오버레이가 담당한다.
  const cutoff = cellStartMs(until); // 현재 칸의 시작 시각 = 완료된 칸까지의 경계
  if (cutoff <= fillFrom) return; // 아직 한 칸도 완료되지 않음
  const firstFill = filled.size === 0;
  const byDate = new Map<string, number[]>();
  for (const t of completedCellTimes(fillFrom, cutoff)) {
    const d = new Date(t);
    const idx = dateToCellIndex(d);
    const dk = timetableDateKey(d);
    if (idx >= 0 && !filled.has(`${dk}:${idx}`)) {
      filled.add(`${dk}:${idx}`);
      byDate.set(dk, [...(byDate.get(dk) ?? []), idx]);
    }
  }
  fillFrom = cutoff;
  // 시작 직후 첫 칸 말고, 새 칸으로 넘어갈 때만 진동
  if (byDate.size && !firstFill)
    void getPrefs().then((p) => {
      if (p.hapticOnFill) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });
  const subject = state.focusSubject;
  byDate.forEach((idxs, dk) => {
    void updateTimetable(dk, (day) => {
      const cells = day.cells.slice();
      for (const i of idxs) cells[i] = { ...cells[i], actual: subject };
      return { ...day, cells };
    });
  });
}

/**
 * 진행 중 칸을 채우기 시작한 시각 (집중 실행 중 아니면 null).
 * 완료된 칸은 저장되며 칸 경계로 당겨지므로, 지금 칸 안에서 '세션이 이 칸에 들어온 시각'이 된다.
 */
export function getLiveFillStart(): number | null {
  return state.status === 'running' && state.phase === 'focus' ? fillFrom : null;
}

/** 실행 중 구간을 마저 채우고 채우기를 멈춘다 */
function stopFilling(until = Date.now()): void {
  fillActual(until);
  // 종료 시점에 진행 중이던 칸도 (부분 집중이라도) 1칸으로 기록한다
  if (fillFrom != null) {
    const idx = dateToCellIndex(new Date(until));
    const dk = timetableDateKey(new Date(until));
    if (idx >= 0 && !filled.has(`${dk}:${idx}`)) {
      filled.add(`${dk}:${idx}`);
      const subject = state.focusSubject;
      void updateTimetable(dk, (day) => {
        const cells = day.cells.slice();
        cells[idx] = { ...cells[idx], actual: subject };
        return { ...day, cells };
      });
    }
  }
  fillFrom = null;
}

/** 집중에 쓸 과목 지정 (집중 중이면 지금 칸부터 새 과목으로 덮어씀) */
export function setFocusSubject(id: SubjectId): void {
  if (fillFrom != null) {
    fillActual(Date.now());
    filled.clear();
    fillFrom = Date.now();
  }
  state = { ...state, focusSubject: id };
  if (fillFrom != null) fillActual(Date.now());
  emit();
}

let initialized = false;
const listeners = new Set<() => void>();

let stopAlarmFn: (() => void) | null = null;
function stopAlarmInternal(): void {
  if (stopAlarmFn) {
    stopAlarmFn();
    stopAlarmFn = null;
  }
}

/** 울리는 완료 알람을 끈다 (사용자가 '알람 끄기'를 누를 때). */
export function stopAlarm(): void {
  stopAlarmInternal();
  state = { ...state, alarming: false };
  emit();
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): PomodoroState {
  return state;
}

/** Loads persisted settings/session count once; safe to call from every mount. */
export async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const today = todayKey();
  const [settings, sessionsDone] = await Promise.all([loadSettings(), loadSessionsDone(today)]);
  state = {
    ...state,
    settings,
    sessionsDone,
    sessionsDate: today,
    remainingMs: getPhaseDurationMs(state.phase, settings),
  };
  emit();
}

function rolloverSessionsIfNewDay() {
  const today = todayKey();
  if (state.sessionsDate !== today) {
    state = { ...state, sessionsDate: today, sessionsDone: 0 };
    saveSessionsDone(today, 0);
  }
}

export function start(): void {
  rolloverSessionsIfNewDay();
  if (state.status === 'running') return;
  stopAlarmInternal();
  const remaining =
    state.status === 'paused' ? state.remainingMs : getPhaseDurationMs(state.phase, state.settings);
  state = {
    ...state,
    status: 'running',
    endTime: Date.now() + remaining,
    remainingMs: remaining,
    alarming: false,
  };
  if (state.phase === 'focus') {
    filled.clear();
    fillFrom = Date.now();
    fillActual(fillFrom);
  }
  emit();
}

/** 과목을 정해 집중 시작. minutes를 주면 다이얼(집중 시간)도 그 값으로 맞춘다. */
export function startFocus(subject: SubjectId, minutes?: number): void {
  if (state.status === 'running' && state.phase === 'focus') {
    setFocusSubject(subject);
    return;
  }
  stopAlarmInternal();
  void cancelOverrunNags();
  state = {
    ...state,
    focusSubject: subject,
    phase: 'focus',
    status: 'idle',
    endTime: null,
    remainingMs: getPhaseDurationMs('focus', state.settings),
    alarming: false,
    overrunStartTime: null,
    overrunMs: 0,
  };
  if (minutes) void setFocusMinutes(Math.max(1, Math.min(60, minutes)));
  start();
}

export function pause(): void {
  if (state.status !== 'running' || state.endTime == null) return;
  stopFilling();
  const remaining = Math.max(0, state.endTime - Date.now());
  state = { ...state, status: 'paused', endTime: null, remainingMs: remaining };
  emit();
}

export function reset(): void {
  stopFilling();
  stopAlarmInternal();
  void cancelOverrunNags();
  state = {
    ...state,
    status: 'idle',
    endTime: null,
    remainingMs: getPhaseDurationMs(state.phase, state.settings),
    alarming: false,
    overrunStartTime: null,
    overrunMs: 0,
  };
  emit();
}

/** Manual skip to the next phase — does not count as a completed session. */
export function skip(): void {
  rolloverSessionsIfNewDay();
  const nextPhase: TimerPhase = state.phase === 'focus' ? 'break' : 'focus';
  stopFilling();
  stopAlarmInternal();
  void cancelOverrunNags();
  state = {
    ...state,
    phase: nextPhase,
    status: 'idle',
    endTime: null,
    remainingMs: getPhaseDurationMs(nextPhase, state.settings),
    alarming: false,
    overrunStartTime: null,
    overrunMs: 0,
  };
  emit();
}

/** Countdown reached zero: move to the next phase and stop (no auto-continue yet). */
function completePhase() {
  rolloverSessionsIfNewDay();
  const wasFocus = state.phase === 'focus';
  stopAlarmInternal();
  void notifyPhaseEnd(wasFocus);
  stopAlarmFn = startRepeatingAlarm();

  if (wasFocus) {
    // 집중 완주 → 통계 기록 + 휴식 단계로
    void recordFocusSession(state.settings.focusMinutes * 60);
    const sessionsDone = state.sessionsDone + 1;
    saveSessionsDone(state.sessionsDate, sessionsDone);
    state = {
      ...state,
      phase: 'break',
      status: 'idle',
      endTime: null,
      remainingMs: getPhaseDurationMs('break', state.settings),
      sessionsDone,
      alarming: true,
    };
  } else {
    // 휴식 완료 → 초과 대기(overrun) 진입 + 초과 잔소리 알림 예약
    void scheduleOverrunNags();
    state = {
      ...state,
      status: 'overrun',
      endTime: null,
      overrunStartTime: Date.now(),
      overrunMs: 0,
      alarming: true,
    };
  }
  emit();
}

/** Screen-refresh tick (call every ~200ms–1s). Recomputes remaining time from `endTime`. */
export function tick(): void {
  // 휴식 초과 대기 중엔 초과 시간을 계속 키운다
  if (state.status === 'overrun' && state.overrunStartTime != null) {
    state = { ...state, overrunMs: Date.now() - state.overrunStartTime };
    emit();
    return;
  }
  if (state.status !== 'running' || state.endTime == null) return;
  const remaining = state.endTime - Date.now();
  if (remaining <= 0) {
    stopFilling(state.endTime);
    completePhase();
  } else {
    fillActual(Date.now());
    state = { ...state, remainingMs: remaining };
    emit();
  }
}

/** 휴식 종료(복귀) — 1분 유예를 넘긴 초과 시간을 통계에 저장하고 집중 단계로 */
export function endBreak(): void {
  if (state.status !== 'overrun' || state.overrunStartTime == null) return;
  stopAlarmInternal();
  void cancelOverrunNags();
  const elapsedMs = Date.now() - state.overrunStartTime;
  const overrunMs = Math.max(0, elapsedMs - 60_000);
  if (overrunMs > 0) void recordBreakOverrun(Math.round(overrunMs / 1000));
  state = {
    ...state,
    phase: 'focus',
    status: 'idle',
    endTime: null,
    remainingMs: getPhaseDurationMs('focus', state.settings),
    overrunStartTime: null,
    overrunMs: 0,
    lastOverrunMs: overrunMs,
    alarming: false,
  };
  emit();
}

export async function setFocusMinutes(minutes: number): Promise<void> {
  const settings = { ...state.settings, focusMinutes: minutes };
  state = { ...state, settings };
  if (state.phase === 'focus') {
    const full = getPhaseDurationMs('focus', settings);
    if (state.status === 'running' && state.endTime != null) {
      // 실행 중 드래그: 새 집중 시간으로 남은 시간·종료 시각을 다시 맞춘다
      state = { ...state, remainingMs: full, endTime: Date.now() + full };
    } else if (state.status === 'idle' || state.status === 'paused') {
      state = { ...state, remainingMs: full };
    }
  }
  emit();
  await saveSettings(settings);
}

export async function setBreakMinutes(minutes: number): Promise<void> {
  const settings = { ...state.settings, breakMinutes: minutes };
  state = { ...state, settings };
  if (state.status === 'idle' && state.phase === 'break') {
    state = { ...state, remainingMs: getPhaseDurationMs('break', settings) };
  }
  emit();
  await saveSettings(settings);
}
