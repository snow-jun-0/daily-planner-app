import AsyncStorage from '@react-native-async-storage/async-storage';

/** JSON-serialized async key/value storage — AsyncStorage equivalent of the
 *  web version's `localStorage.getItem`/`setItem`. */
export async function getItem<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw == null) return null;
  return JSON.parse(raw) as T;
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

/** 특정 접두어로 시작하는 모든 키 (역동기화 등 전역 순회용) */
export async function getKeysWithPrefix(prefix: string): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((k) => k.startsWith(prefix));
}
