// ---------- 데이터 백업/복원 (로컬 AsyncStorage ↔ Supabase) ----------
// 앱을 지우거나 기기를 바꿔도 구글 로그인으로 데이터를 되살릴 수 있게 한다.
// - 자동: 데이터 변경 시 디바운스로 업로드 / 새 설치 로그인 시 자동 복원
// - 수동: 설정 화면의 '백업하기' '복원하기' 버튼

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

const BACKUP_PREFIXES = ['tasks:', 'events:', 'memo:', 'dday:', 'stats:', 'pomodoro:', 'settings:'];

async function collectKeys(): Promise<string[]> {
  const all = await AsyncStorage.getAllKeys();
  return all.filter((k) => BACKUP_PREFIXES.some((pfx) => k.startsWith(pfx)));
}

async function snapshot(): Promise<Record<string, string>> {
  const keys = await collectKeys();
  const pairs = await AsyncStorage.multiGet(keys);
  const out: Record<string, string> = {};
  for (const [k, v] of pairs) if (v != null) out[k] = v;
  return out;
}

async function restore(data: Record<string, string>): Promise<void> {
  const pairs = Object.entries(data);
  if (pairs.length) await AsyncStorage.multiSet(pairs);
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** 클라우드에 백업 업로드. 로그인 안 됐거나 실패면 false. */
export async function uploadBackup(): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const data = await snapshot();
  const { error } = await supabase
    .from('user_backups')
    .upsert({ user_id: uid, data, updated_at: new Date().toISOString() });
  return !error;
}

/** 클라우드 백업을 받아 로컬에 복원. 백업 없으면 false. */
export async function restoreFromCloud(): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { data, error } = await supabase
    .from('user_backups')
    .select('data')
    .eq('user_id', uid)
    .single();
  if (error || !data?.data) return false;
  await restore(data.data as Record<string, string>);
  return true;
}

/** 새 설치(로컬에 할일·일정·D-day가 전혀 없을 때)면 클라우드에서 자동 복원 */
export async function maybeRestoreOnLogin(): Promise<boolean> {
  const keys = await collectKeys();
  const hasData = keys.some(
    (k) => k.startsWith('tasks:') || k.startsWith('events:') || k.startsWith('dday:'),
  );
  if (hasData) return false;
  return restoreFromCloud();
}

/** 데이터 변경 시 디바운스 자동 백업 (로그인 상태만, best-effort) */
let autoTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleAutoBackup(): void {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    void uploadBackup();
  }, 4000);
}
