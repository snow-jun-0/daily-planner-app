import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { PlannerScreen } from '@/components/planner/planner-screen';
import {
  Divider,
  SettingsGroup,
  SettingsRow,
  Segmented,
  Toggle,
} from '@/components/planner/settings-ui';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerSerif, PlannerType, Spacing } from '@/constants/theme';
import { useTheme, useThemeControl } from '@/constants/theme-context';
import { usePrefs } from '@/hooks/use-prefs';
import { signInWithGoogle, signOut, useAuthSession } from '@/lib/auth';
import { cancelDailyReflection, scheduleDailyReflection } from '@/lib/notify';
import * as pomodoro from '@/lib/pomodoro';
import { getNotifyDaily, resetAllData, setNotifyDaily } from '@/lib/settings';
import { FOCUS_CATEGORY, loadCategories } from '@/lib/timetable';
import { syncWidgets } from '@/lib/widget-sync';

export default function SettingsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { isDark, setDark } = useThemeControl();
  const { session } = useAuthSession();
  const [prefs, updatePrefs] = usePrefs();
  const [reviewAlert, setReviewAlert] = useState(false);
  const [catSummary, setCatSummary] = useState('');
  const { settings } = pomodoro.getState();

  useFocusEffect(
    useCallback(() => {
      void getNotifyDaily().then(setReviewAlert);
      void loadCategories().then((cats) => {
        const names = cats.filter((c) => c.id !== FOCUS_CATEGORY.id).map((c) => c.name);
        setCatSummary(
          names.length > 3
            ? `${names.slice(0, 3).join(', ')} 외 ${names.length - 3}개`
            : names.join(', ') || '과목을 추가해 보세요',
        );
      });
    }, []),
  );

  const handleGoogle = () => {
    if (session) {
      Alert.alert('구글 연결 해제', '로그아웃할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '로그아웃', style: 'destructive', onPress: () => void signOut() },
      ]);
    } else {
      void signInWithGoogle().catch((e: unknown) => {
        Alert.alert('로그인 실패', e instanceof Error ? e.message : String(e));
      });
    }
  };

  const handleReviewAlert = (v: boolean) => {
    setReviewAlert(v);
    void (async () => {
      await setNotifyDaily(v);
      if (v) await scheduleDailyReflection(prefs.dailyHour);
      else await cancelDailyReflection();
    })();
  };

  const handleReset = () => {
    Alert.alert('데이터 초기화', '모든 기록과 할 일이 삭제됩니다. 계속할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            await resetAllData();
            await syncWidgets();
            Alert.alert('완료', '데이터가 초기화되었어요.');
          })(),
      },
    ]);
  };

  return (
    <PlannerScreen>
      <Text style={styles.title}>설정</Text>

      <SettingsGroup label="타임테이블">
        <SettingsRow
          icon="time-outline"
          title="시간 범위"
          value="06:00 – 익일 02:00"
          onPress={() => router.push('/timetable-settings' as never)}
        />
        <Divider />
        <SettingsRow icon="grid-outline" title="격자 단위" subtitle="드래그로 칠할 때 최소 단위" />
        <View style={styles.segmentWrap}>
          <Segmented
            options={[
              { key: 1, label: '10분' },
              { key: 3, label: '30분' },
              { key: 6, label: '1시간' },
            ]}
            value={prefs.brushCells}
            onChange={(v) => updatePrefs({ brushCells: v })}
          />
        </View>
        <Divider />
        <SettingsRow
          icon="pencil-outline"
          title="카테고리 · 색"
          subtitle={catSummary}
          onPress={() => router.push('/categories' as never)}
        />
        <Divider />
        <SettingsRow
          icon="play"
          title="계획 칸 탭하면 바로 집중 시작"
          subtitle="끄면 상세 시트를 먼저 보여줘요"
          right={
            <Toggle value={prefs.tapToFocus} onChange={(v) => updatePrefs({ tapToFocus: v })} />
          }
        />
      </SettingsGroup>

      <SettingsGroup label="집중 · 알림">
        <SettingsRow
          icon="stopwatch-outline"
          title="기본 집중 방식"
          value={`뽀모도로 ${settings.focusMinutes} · ${settings.breakMinutes}`}
          onPress={() => router.navigate('/timer' as never)}
        />
        <Divider />
        <SettingsRow
          icon="notifications-outline"
          title="알림 설정"
          subtitle="소리 · 휴식 초과 잔소리"
          onPress={() => router.push('/notifications' as never)}
        />
        <Divider />
        <SettingsRow
          icon="book-outline"
          title="하루 마감 알림"
          subtitle={`매일 ${prefs.dailyHour}:00에 오늘 집중률 요약`}
          right={<Toggle value={reviewAlert} onChange={handleReviewAlert} />}
        />
      </SettingsGroup>

      <SettingsGroup label="표시">
        <SettingsRow
          icon="moon-outline"
          title="다크 모드"
          right={<Toggle value={isDark} onChange={setDark} />}
        />
      </SettingsGroup>

      <SettingsGroup label="데이터">
        <SettingsRow
          icon="cloud-upload-outline"
          title="백업 · 동기화"
          subtitle={session ? (session.user.email ?? '로그인됨') : '이 기기에만 저장 중'}
          onPress={() => router.push('/backup' as never)}
        />
        <Divider />
        <SettingsRow
          icon="trash-outline"
          title="데이터 초기화"
          subtitle="모든 기록과 할 일을 삭제합니다"
          danger
          onPress={handleReset}
        />
      </SettingsGroup>

      <SettingsGroup label="연동 (선택)">
        <SettingsRow
          icon="logo-google"
          title="Google 캘린더 일정 읽어오기"
          subtitle={
            session
              ? `${session.user.email ?? '연결됨'} · 일정이 타임테이블에 표시돼요`
              : '연결하면 오늘 일정이 타임테이블에 연하게 표시돼요'
          }
          right={
            <Pressable style={styles.connectBtn} onPress={handleGoogle}>
              <Text style={styles.connectText}>{session ? '해제' : '연결'}</Text>
            </Pressable>
          }
        />
      </SettingsGroup>

      <SettingsGroup label="정보">
        <SettingsRow
          icon="information-circle-outline"
          title="버전"
          value={Constants.expoConfig?.version ?? '-'}
        />
      </SettingsGroup>
    </PlannerScreen>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    title: {
      color: theme.ink,
      fontFamily: PlannerSerif,
      fontSize: 28,
      fontWeight: '600',
      paddingHorizontal: Spacing.one,
    },
    segmentWrap: { paddingBottom: 14 },
    connectBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.surface,
    },
    connectText: { ...PlannerType.labelStrong, color: theme.ink },
  });
