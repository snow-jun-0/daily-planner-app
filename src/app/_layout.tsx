import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  type ErrorBoundaryProps,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BadgeCelebration } from '@/components/planner/badge-celebration';
import { Planner, PlannerDark, PlannerRadius, PlannerType } from '@/constants/theme';
import { PlannerThemeProvider, useThemeControl } from '@/constants/theme-context';
import { initPro } from '@/lib/pro';

SplashScreen.preventAutoHideAsync();

// expo-router(57.0.20~31) 내부 경고: 앱이 URL로 열리면 useLinking.native.js가 아직 마운트 전인
// NavigationContainer에 setState를 한다(dev client는 항상 URL로 실행). 개발 빌드 전용 경고이고 동작 영향 없음.
// expo-router 업데이트 시 해당 코드가 바뀌었으면 이 줄을 지운다.
LogBox.ignoreLogs(["Can't perform a React state update on a component that hasn't mounted yet"]);

export default function RootLayout() {
  return (
    <PlannerThemeProvider>
      <RootNavigator />
    </PlannerThemeProvider>
  );
}

function RootNavigator() {
  const { isDark } = useThemeControl();
  useEffect(() => {
    void initPro();
  }, []);
  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }} />
      <BadgeCelebration />
    </ThemeProvider>
  );
}

/** 앱 크래시 시 하얀 화면 대신 보여줄 폴백 (테마 Provider 바깥이라 색을 직접 고른다) */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const t = useColorScheme() === 'dark' ? PlannerDark : Planner;
  useEffect(() => {
    console.error('[ErrorBoundary]', error);
    void SplashScreen.hideAsync();
  }, [error]);
  return (
    <View style={[styles.errRoot, { backgroundColor: t.paper }]}>
      <Text style={[styles.errTitle, { color: t.ink }]}>문제가 발생했어요</Text>
      <Text style={[styles.errBody, { color: t.textSecondary }]}>
        잠시 후 다시 시도해 주세요.{'\n'}기록은 기기에 안전하게 저장돼 있어요.
      </Text>
      <Pressable
        style={[styles.errBtn, { backgroundColor: t.accent }]}
        onPress={() => void retry()}
        accessibilityRole="button">
        <Text style={[styles.errBtnText, { color: t.onAccent }]}>다시 시도</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  errRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  errTitle: { ...PlannerType.titleM, fontSize: 20 },
  errBody: { ...PlannerType.body, textAlign: 'center', lineHeight: 22 },
  errBtn: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: PlannerRadius.md,
  },
  errBtnText: { ...PlannerType.bodyMedium, fontWeight: '700' },
});
