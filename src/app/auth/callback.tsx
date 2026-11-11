import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Planner } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

/**
 * 구글 OAuth 리디렉션(dailyplannerapp://auth/callback?code=...)을 받는 화면.
 * code가 있으면 세션으로 교환하고(이미 교환됐으면 조용히 무시) 메인으로 돌아간다.
 */
export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error?: string }>();

  useEffect(() => {
    void (async () => {
      const code = params.code;
      if (code) {
        await supabase.auth.exchangeCodeForSession(String(code)).catch(() => {
          // 이미 교환된 code면 실패하지만 세션은 이미 있으므로 무시
        });
      }
      router.replace('/');
    })();
  }, [params.code]);

  return (
    <View style={styles.center}>
      <ActivityIndicator color={Planner.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Planner.paper,
  },
});
