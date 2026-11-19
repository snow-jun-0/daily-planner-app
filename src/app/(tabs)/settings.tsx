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
import { usePro } from '@/lib/pro';
import { deleteAccount, signInWithGoogle, signOut, useAuthSession } from '@/lib/auth';
import { openContact } from '@/lib/contact';
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
  const pro = usePro();
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
      Alert.alert('로그아웃', '로그아웃할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '로그아웃', style: 'destructive', onPress: () => void signOut() },
      ]);
    } else {
      void signInWithGoogle().catch((e: unknown) => {
        Alert.alert('로그인 실패', e instanceof Error ? e.message : String(e));
      });
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '계정 탈퇴',
      '계정과 클라우드 백업이 영구 삭제되고 되돌릴 수 없어요.\n\n' +
        '· 이 기기에 저장된 기록은 그대로 남아요 (설정 › 데이터 초기화로 지울 수 있어요)\n' +
        '· Pro 구독은 탈퇴해도 자동 해지되지 않아요. 스토어 › 구독에서 해지해 주세요',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: () =>
            void deleteAccount()
              .then(() => Alert.alert('탈퇴 완료', '계정과 클라우드 백업을 삭제했어요.'))
              .catch((e: unknown) =>
                Alert.alert(
                  '탈퇴하지 못했어요',
                  `잠시 후 다시 시도해 주세요.\n(${e instanceof Error ? e.message : String(e)})`,
                ),
              ),
        },
      ],
    );
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

      <SettingsGroup>
        <SettingsRow
          icon="sparkles-outline"
          title="데일리 플래너 Pro"
          subtitle={pro.isPro ? 'Pro 사용 중' : '고급 통계 · 공유 카드 스타일 · 테마'}
          onPress={() => router.push('/pro' as never)}
        />
      </SettingsGroup>

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
          icon="copy-outline"
          title="시간표 템플릿"
          subtitle="요일마다 반복되는 계획을 한 번에"
          onPress={() => router.push('/templates' as never)}
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
          icon="color-palette-outline"
          title="테마"
          subtitle="과목 색 팔레트"
          onPress={() => router.push('/theme' as never)}
        />
        <Divider />
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

      <SettingsGroup label="계정">
        <SettingsRow
          icon="logo-google"
          title="Google 로그인"
          subtitle={session ? (session.user.email ?? '로그인됨') : '로그인하면 클라우드 백업을 쓸 수 있어요'}
          right={
            <Pressable style={styles.connectBtn} onPress={handleGoogle}>
              <Text style={styles.connectText}>{session ? '로그아웃' : '로그인'}</Text>
            </Pressable>
          }
        />
        {session ? (
          <>
            <Divider />
            <SettingsRow
              icon="person-remove-outline"
              title="계정 탈퇴"
              subtitle="계정과 클라우드 백업을 삭제합니다"
              danger
              onPress={handleDeleteAccount}
            />
          </>
        ) : null}
      </SettingsGroup>

      <SettingsGroup label="정보">
        <SettingsRow
          icon="shield-checkmark-outline"
          title="개인정보처리방침"
          onPress={() => router.push('/legal?doc=privacy' as never)}
        />
        <Divider />
        <SettingsRow
          icon="document-text-outline"
          title="이용약관"
          onPress={() => router.push('/legal?doc=terms' as never)}
        />
        <Divider />
        <SettingsRow
          icon="mail-outline"
          title="문의하기"
          subtitle="버그 제보 · 기능 제안"
          onPress={() => void openContact()}
        />
        <Divider />
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
