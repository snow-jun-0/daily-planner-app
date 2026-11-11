import AsyncStorage from '@react-native-async-storage/async-storage';

import { todayKey } from './date';
import { getItem, setItem } from './storage';

const PREFIX = 'memo:';

export { todayKey };

export type MemoEntry = {
  date: string;
  text: string;
};

function memoKey(date: string): string {
  return `${PREFIX}${date}`;
}

/** One free-text memo per date — mirrors the web version's `DayData.memo`. */
export async function loadMemo(date: string): Promise<string> {
  const memo = await getItem<string>(memoKey(date));
  return memo ?? '';
}

export async function saveMemo(date: string, text: string): Promise<void> {
  await setItem(memoKey(date), text);
}

/** Every non-empty memo across all dates, for the "메모" tab's full list. */
export async function loadAllMemos(): Promise<MemoEntry[]> {
  const keys = await AsyncStorage.getAllKeys();
  const memoKeys = keys.filter((key) => key.startsWith(PREFIX));
  const pairs = await AsyncStorage.multiGet(memoKeys);

  const entries: MemoEntry[] = [];
  for (const [key, raw] of pairs) {
    if (!raw) continue;
    const text = JSON.parse(raw) as string;
    if (text.trim().length > 0) {
      entries.push({ date: key.slice(PREFIX.length), text });
    }
  }
  return entries;
}
