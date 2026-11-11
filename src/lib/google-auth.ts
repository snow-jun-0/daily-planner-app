// ---------- 구글 API 토큰 (자동 갱신) ----------
// provider_token(로그인 세션에 포함)은 ~1시간이면 만료된다. 만료되면 구글
// 캘린더/Tasks 호출이 401로 실패하므로, Edge Function 'google-token'에
// 저장해 둔 refresh token으로 새 access token을 받아 재시도한다.
// Edge Function이 아직 배포 안 됐으면 refreshFromServer가 null → 기존처럼
// provider_token만 쓰는 상태로 자연스럽게 degrade (앱은 그대로 동작).

import { supabase } from './supabase';

type Cached = { token: string; expiresAt: number };
let cached: Cached | null = null;

/** Edge Function으로 access token 재발급. 실패/미배포 시 null. */
async function refreshFromServer(): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      access_token?: string;
      expires_in?: number;
    }>('google-token');
    if (error || !data?.access_token) return null;
    cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return cached.token;
  } catch {
    return null;
  }
}

/** 구글 API access token. forceRefresh면 서버 재발급을 우선 시도. */
export async function getGoogleToken(forceRefresh = false): Promise<string | null> {
  if (forceRefresh) return refreshFromServer();
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const { data } = await supabase.auth.getSession();
  const t = data.session?.provider_token;
  if (t) return t;
  return refreshFromServer();
}

function withAuth(init: RequestInit | undefined, token: string): RequestInit {
  return { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } };
}

/**
 * 구글 API 호출 래퍼. provider_token으로 먼저 시도하고, 401이면 Edge Function으로
 * 토큰을 재발급해 1회 재시도한다. 토큰이 아예 없으면 null.
 */
export async function googleFetch(url: string, init?: RequestInit): Promise<Response | null> {
  const token = await getGoogleToken();
  if (!token) return null;
  let res = await fetch(url, withAuth(init, token));
  if (res.status === 401) {
    const fresh = await getGoogleToken(true);
    if (fresh && fresh !== token) res = await fetch(url, withAuth(init, fresh));
  }
  return res;
}
