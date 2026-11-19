import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = Linking.createURL('auth/callback');

/**
 * 구글 OAuth 로그인 (PKCE + 인앱 브라우저). 인증(이메일·프로필)만 쓰고
 * 구글 API용 토큰은 요청·저장하지 않는다.
 */
export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  if (!data.url) return;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    const code = Linking.parse(result.url).queryParams?.code;
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(String(code));
      if (exchangeError) throw exchangeError;
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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
