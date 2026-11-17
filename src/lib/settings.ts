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
      k.startsWith('settings:'),
  );
  if (mine.length) await AsyncStorage.multiRemove(mine);
}
