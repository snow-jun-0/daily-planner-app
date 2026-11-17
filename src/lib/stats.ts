import AsyncStorage from '@react-native-async-storage/async-storage';

import { todayKey } from './date';
import { getItem, setItem } from './storage';

/** 하루치 집중/휴식 통계 (키: stats:YYYY-MM-DD) */
export type DayStat = {
  /** 완주한 집중 시간(초) */
  focusSeconds: number;
  /** 완주한 집중 세션 수 */
  focusSessions: number;
  /** 휴식 초과 시간(초) — 유예 1분을 넘긴 만큼 */
  breakOverrunSeconds: number;
};

const EMPTY: DayStat = { focusSeconds: 0, focusSessions: 0, breakOverrunSeconds: 0 };

function statKey(date: string): string {
  return `stats:${date}`;
}

export async function loadDayStat(date: string): Promise<DayStat> {
  return (await getItem<DayStat>(statKey(date))) ?? { ...EMPTY };
}

async function saveDayStat(date: string, s: DayStat): Promise<void> {
  await setItem(statKey(date), s);
}

/** 집중 세션을 완주했을 때 (초 단위) */
export async function recordFocusSession(seconds: number): Promise<void> {
  const date = todayKey();
  const s = await loadDayStat(date);
  s.focusSeconds += Math.max(0, Math.round(seconds));
  s.focusSessions += 1;
  await saveDayStat(date, s);
}

/** 휴식을 초과했을 때 (유예 1분 넘긴 초) */
export async function recordBreakOverrun(seconds: number): Promise<void> {
  if (seconds <= 0) return;
  const date = todayKey();
  const s = await loadDayStat(date);
  s.breakOverrunSeconds += Math.round(seconds);
  await saveDayStat(date, s);
}

/** 휴식 초과 시간(초)에 따른 잔소리 메시지 */
export function overrunMessage(overrunSeconds: number): string {
  const min = overrunSeconds / 60;
  if (min <= 0) return '복귀 완료! 바로 이어가자 💪';
  if (min <= 10) return '적당히 하고 다시 하자 👀';
  if (min <= 30) return '집중 좀 하자... 😤';
  if (min <= 60) return '공부 안 함...? 🫠';
  return '공부 포기했지? 걍 하지 마라 😇';
}

export type MonthFocusStats = {
  totalFocusSeconds: number;
  totalSessions: number;
  totalOverrunSeconds: number;
  /** 날짜(1~31)별 집중 초 */
  byDay: Record<number, number>;
  recordedDays: number;
};

/** 한 달치 집중 통계 집계 */
export async function loadMonthFocusStats(year: number, month: number): Promise<MonthFocusStats> {
  const prefix = `stats:${year}-${String(month + 1).padStart(2, '0')}-`;
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix));
  const result: MonthFocusStats = {
    totalFocusSeconds: 0,
    totalSessions: 0,
    totalOverrunSeconds: 0,
    byDay: {},
    recordedDays: 0,
  };
  if (keys.length === 0) return result;

  const pairs = await AsyncStorage.multiGet(keys);
  for (const [key, raw] of pairs) {
    if (!raw) continue;
    let s: DayStat;
    try {
      s = JSON.parse(raw) as DayStat;
    } catch {
      continue;
    }
    const day = Number(key.slice(prefix.length));
    result.totalFocusSeconds += s.focusSeconds;
    result.totalSessions += s.focusSessions;
    result.totalOverrunSeconds += s.breakOverrunSeconds;
    if (s.focusSeconds > 0 || s.focusSessions > 0) {
      result.byDay[day] = s.focusSeconds;
      result.recordedDays += 1;
    }
  }
  return result;
}
