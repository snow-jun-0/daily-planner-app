import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';
import { useEffect, useState } from 'react';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = Linking.createURL('auth/callback');

/** 로그인 때 받은 provider_refresh_token을 Supabase 테이블에 저장 (Edge Function이 사용) */
async function storeRefreshToken(session: Session | null): Promise<string> {
  if (!session) return 'no-session';
  const rt = session.provider_refresh_token;
  if (!rt) return 'no-refresh-token'; // 구글이 refresh token을 안 줌 (prompt/scope 문제)
  // Edge Function 경유로 저장 (service_role → RLS/세션 타이밍 문제 우회)
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'google-token',
    { body: { refresh_token: rt } },
  );
  if (error) return `invoke: ${error.message}`;
  if (data && data.ok === false) return `store: ${data.error ?? '?'}`;
  return 'ok';
}

/** 구글 OAuth 로그인 (PKCE + 인앱 브라우저) */
export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
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
      // 자동 토큰 갱신용: refresh token을 서버에 저장
      const saveStatus = await storeRefreshToken(exData.session);
      if (saveStatus !== 'ok') {
        Alert.alert('[디버그] 토큰 저장 상태', saveStatus);
      }
    }
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * 계정 탈퇴: 서버의 delete_my_account()로 Supabase 계정 + 클라우드 백업을 지우고 로그아웃.
 * (함수 정의: supabase/delete_account.sql) 기기에 저장된 기록은 지우지 않는다.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  // 계정이 사라져 서버 로그아웃은 실패할 수 있으니 기기 세션만 정리한다
  await supabase.auth.signOut({ scope: 'local' });
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
