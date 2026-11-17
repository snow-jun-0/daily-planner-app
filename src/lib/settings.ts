import AsyncStorage from '@react-native-async-storage/async-storage';

import { getItem, setItem } from './storage';

// v1 lib.ts의 설정 함수들을 AsyncStorage 버전으로 이식.
export type NotifyMode = 'mute' | 'vibrate' | 'sound';
export type TimetableRange = { startHour: number; endHour: number };

const K = {
  notifyMode: 'settings:notifyMode',
  notifyDaily: 'settings:notifyDaily',
  notifyDailyLast: 'settings:notifyDailyLast',
  timetableRange: 'settings:timetableRange',
  darkMode: 'settings:darkMode',
  autoSyncCalendar: 'settings:autoSyncCalendar',
} as const;

/** 뽀모도로 완료 등에 쓸 알림 방식. 기본값 'sound' (v1과 동일) */
export async function getNotifyMode(): Promise<NotifyMode> {
  const v = await getItem<NotifyMode>(K.notifyMode);
  return v === 'mute' || v === 'vibrate' || v === 'sound' ? v : 'sound';
}
export async function setNotifyMode(mode: NotifyMode): Promise<void> {
  await setItem(K.notifyMode, mode);
}

/** 저녁 회고 알림 on/off (기본 off) */
export async function getNotifyDaily(): Promise<boolean> {
  return (await getItem<boolean>(K.notifyDaily)) ?? false;
}
export async function setNotifyDaily(v: boolean): Promise<void> {
  await setItem(K.notifyDaily, v);
}

/** 저녁 회고 알림을 오늘 이미 보냈는지 (같은 날 중복 방지) */
export async function wasDailyFiredToday(todayKey: string): Promise<boolean> {
  return (await getItem<string>(K.notifyDailyLast)) === todayKey;
}
export async function markDailyFired(todayKey: string): Promise<void> {
  await setItem(K.notifyDailyLast, todayKey);
}

/** 시간표 표시 범위(시 단위). 기본 06~24 */
export async function getTimetableRange(): Promise<TimetableRange> {
  return (await getItem<TimetableRange>(K.timetableRange)) ?? { startHour: 6, endHour: 24 };
}
export async function setTimetableRange(r: TimetableRange): Promise<void> {
  await setItem(K.timetableRange, r);
}

/** 다크모드 저장값. null = 미설정(시스템 설정을 따름) */
export async function getDarkModeStored(): Promise<boolean | null> {
  return (await getItem<boolean>(K.darkMode)) ?? null;
}
export async function setDarkModeStored(v: boolean): Promise<void> {
  await setItem(K.darkMode, v);
}

/** 시간표 자동 동기화(구글 캘린더) on/off, 기본 off */
export async function getAutoSyncCalendar(): Promise<boolean> {
  return (await getItem<boolean>(K.autoSyncCalendar)) ?? false;
}
export async function setAutoSyncCalendar(v: boolean): Promise<void> {
  await setItem(K.autoSyncCalendar, v);
}

/** 화면 설정 묶음 (D5·E6·E7·H1). 새 설정은 여기에 필드만 추가한다. */
export type Prefs = {
  /** 드래그로 칠할 때 최소 단위(칸 수): 10분·30분·1시간 */
  brushCells: 1 | 3 | 6;
  /** 계획 칸 탭 → 시트 없이 바로 집중 시작 */
  tapToFocus: boolean;
  laneMode: 'open' | 'closed' | 'hidden';
  laneWidth: 56 | 68 | 84;
  /** 타이머가 새 칸을 채울 때 진동 */
  hapticOnFill: boolean;
  focusEndAlert: boolean;
  breakEndAlert: boolean;
  /** 휴식 초과 잔소리 알림 */
  nagAlert: boolean;
  /** 저녁 회고 알림 시각(시) */
  dailyHour: number;
  autoBackup: boolean;
  /** 색각 보조: 색만 / 색 + 라벨(블록 첫 칸에 과목 첫 글자) */
  a11yMode: 'color' | 'label';
  /** 요일별 하루 목표(시간), 월요일부터 */
  goalHours: number[];
  /** 과목 색 팔레트 (J6) */
  palette: 'base' | 'pastel' | 'mono' | 'forest' | 'sunset' | 'candy';
};

export const DEFAULT_PREFS: Prefs = {
  brushCells: 1,
  tapToFocus: false,
  laneMode: 'open',
  laneWidth: 56,
  hapticOnFill: true,
  focusEndAlert: true,
  breakEndAlert: true,
  nagAlert: true,
  dailyHour: 21,
  autoBackup: true,
  a11yMode: 'color',
  goalHours: [8, 8, 8, 8, 8, 4, 4],
  palette: 'base',
};

const PREFS_KEY = 'settings:prefs';

export async function getPrefs(): Promise<Prefs> {
  return { ...DEFAULT_PREFS, ...(await getItem<Partial<Prefs>>(PREFS_KEY)) };
}
export async function setPrefs(patch: Partial<Prefs>): Promise<void> {
  await setItem(PREFS_KEY, { ...(await getPrefs()), ...patch });
}

/** 이 앱이 쓰는 모든 로컬 데이터 삭제 (v1 resetAllData의 RN 버전) */
export async function resetAllData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const mine = keys.filter(
    (k) =>
      k.startsWith('tasks:') ||
      k.startsWith('events:') ||
      k.startsWith('memo:') ||
      k.startsWith('pomodoro') ||
      k.startsWith('dday') ||
      k.startsWith('stats:') ||
      k.startsWith('timetable:') ||
      k === 'categories' ||
      k === 'templates' ||
      k.startsWith('settings:'),
  );
  if (mine.length) await AsyncStorage.multiRemove(mine);
}

const ONBOARDED_KEY = 'settings:onboarded';

/** 온보딩을 봤는지. 과목을 이미 만든 기존 사용자도 본 것으로 친다 */
export async function isOnboarded(): Promise<boolean> {
  if (await getItem<boolean>(ONBOARDED_KEY)) return true;
  return (await AsyncStorage.getItem('categories')) != null;
}
export async function setOnboarded(): Promise<void> {
  await setItem(ONBOARDED_KEY, true);
}
