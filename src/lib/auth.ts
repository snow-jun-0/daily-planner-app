import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';

import { syncGoogleCalendar } from './gcal';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = Linking.createURL('auth/callback');

/** 로그인 때 받은 provider_refresh_token을 Supabase 테이블에 저장 (Edge Function이 사용) */
async function storeRefreshToken(session: Session | null): Promise<void> {
  const rt = session?.provider_refresh_token;
  if (!rt || !session) return;
  const { error } = await supabase
    .from('google_tokens')
    .upsert({ user_id: session.user.id, refresh_token: rt, updated_at: new Date().toISOString() });
  if (error) {
    // 테이블 미설정/RLS 등은 자동 갱신만 비활성 (로그인은 정상). 원인 파악용 로그.
    console.warn('[google_tokens] refresh token 저장 실패:', error.message);
  }
}

/** 구글 OAuth 로그인 (PKCE + 인앱 브라우저) */
export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      scopes:
        'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks',
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
  if (!data.url) return;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    const code = Linking.parse(result.url).queryParams?.code;
    if (code) {
      const { data: exData, error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(String(code));
      if (exchangeError) throw exchangeError;
      // 자동 토큰 갱신용: refresh token을 서버에 저장 (테이블/함수 미설정이면 조용히 무시)
      await storeRefreshToken(exData.session);
      await syncGoogleCalendar().catch(() => {});
    }
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** 현재 로그인 세션을 구독하는 훅 */
export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // 로그인 시 refresh token이 세션에 담겨 오면 저장 (exchange 경로를 놓쳐도 보강)
      if (next?.provider_refresh_token) void storeRefreshToken(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
