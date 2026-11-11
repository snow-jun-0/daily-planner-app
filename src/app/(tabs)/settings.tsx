import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useState, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { PlannerCard } from '@/components/planner/planner-card';
import { PlannerScreen } from '@/components/planner/planner-screen';
import { PlannerRadius, PlannerSerif, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useTheme, useThemeControl } from '@/constants/theme-context';
import { restoreFromCloud, uploadBackup } from '@/lib/backup';
import { signInWithGoogle, signOut, useAuthSession } from '@/lib/auth';
import { syncGoogleCalendar } from '@/lib/gcal';
import { cancelDailyReflection, scheduleDailyReflection } from '@/lib/notify';
import {
  getAutoSyncCalendar,
  getNotifyDaily,
  getNotifyMode,
  resetAllData,
  setAutoSyncCalendar,
  setNotifyDaily,
  setNotifyMode,
  type NotifyMode,
} from '@/lib/settings';
import { syncWidgets } from '@/lib/widget-sync';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type AlertMode = 'mute' | 'vibrate' | 'sound';

const ALERT_MODES: { key: AlertMode; label: string }[] = [
  { key: 'mute', label: '무음' },
  { key: 'vibrate', label: '진동' },
  { key: 'sound', label: '소리' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { isDark, setDark } = useThemeControl();
  const switchColors = {
    trackColor: { false: theme.line, true: theme.accent },
    thumbColor: theme.card,
    ios_backgroundColor: theme.line,
  };

  const { session } = useAuthSession();
  const handleGoogle = () => {
    if (session) {
      Alert.alert('구글 연결 해제', '로그아웃할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '로그아웃', style: 'destructive', onPress: () => void signOut() },
      ]);
    } else {
      void signInWithGoogle().catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert('로그인 실패', msg);
      });
    }
  };
  const handleBackup = () => {
    if (!session) {
      Alert.alert('데이터 백업', '먼저 구글 로그인이 필요해요');
      return;
    }
    void uploadBackup().then((ok) =>
      Alert.alert('데이터 백업', ok ? '백업 완료!' : '백업 실패 — 잠시 후 다시 시도해줘'),
    );
  };
  const handleRestore = () => {
    if (!session) {
      Alert.alert('백업 복원', '먼저 구글 로그인이 필요해요');
      return;
    }
    Alert.alert('백업 복원', '클라우드 백업으로 덮어쓸까요? 지금 기기의 데이터는 사라져요', [
      { text: '취소', style: 'cancel' },
      {
        text: '복원',
        style: 'destructive',
        onPress: () =>
          void restoreFromCloud().then((ok) =>
            Alert.alert('백업 복원', ok ? '복원 완료! 앱을 다시 켜줘' : '클라우드에 백업이 없어'),
          ),
      },
    ]);
  };
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [reviewAlert, setReviewAlert] = useState(false);
  const [alertMode, setAlertMode] = useState<AlertMode>('sound');

  useEffect(() => {
    void (async () => {
      setAlertMode(await getNotifyMode());
      setReviewAlert(await getNotifyDaily());
      setSyncEnabled(await getAutoSyncCalendar());
    })();
  }, []);

  const handleAlertMode = (mode: AlertMode) => {
    setAlertMode(mode);
    void setNotifyMode(mode as NotifyMode);
  };

  const handleReviewAlert = (v: boolean) => {
    setReviewAlert(v);
    void (async () => {
      await setNotifyDaily(v);
      if (v) await scheduleDailyReflection();
      else await cancelDailyReflection();
    })();
  };

  const handleAutoSync = (v: boolean) => {
    setSyncEnabled(v);
    void (async () => {
      await setAutoSyncCalendar(v);
      if (v && session) await syncGoogleCalendar().catch(() => {});
    })();
  };

  const handleReset = () => {
    Alert.alert('데이터 초기화', '모든 일정과 할 일이 삭제됩니다. 계속할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await resetAllData();
            await syncWidgets();
            Alert.alert('완료', '데이터가 초기화되었어요.');
          })();
        },
      },
    ]);
  };

  return (
    <PlannerScreen>
      <Text style={styles.title}>설정</Text>

      <SettingsGroup label="계정 연동">
        <SettingsRow
          icon="logo-google"
          title="구글 캘린더"
          subtitle={session ? (session.user.email ?? '연결됨') : '일정 자동 가져오기'}
          right={
            <View style={styles.connectedBadge}>
              <Text style={[styles.connectedBadgeText, session ? { color: theme.accent } : null]}>
                {session ? '연결됨' : '연결 안 됨'}
              </Text>
            </View>
          }
          onPress={handleGoogle}
        />
        <SettingsRow
          icon="cloud-upload-outline"
          title="데이터 백업"
          subtitle={session ? '지금 클라우드에 저장' : '로그인 필요'}
          onPress={handleBackup}
        />
        <SettingsRow
          icon="cloud-download-outline"
          title="백업 복원"
          subtitle="클라우드에서 불러오기"
          onPress={handleRestore}
        />
        <Divider />
        <SettingsRow
          icon="sync-outline"
          title="시간표 자동 동기화"
          subtitle="구글 캘린더 일정을 시간표에 반영"
          right={<Switch value={syncEnabled} onValueChange={handleAutoSync} {...switchColors} />}
        />
      </SettingsGroup>

      <SettingsGroup label="데이터">
        <SettingsRow
          icon="cloud-upload-outline"
          title="백업·동기화"
          subtitle="클라우드에 자동 저장"
          right={<Ionicons name="chevron-forward" size={18} color={theme.faint} />}
          onPress={() => {}}
        />
        <Divider />
        <SettingsRow
          icon="trash-outline"
          iconColor={theme.red}
          title="데이터 초기화"
          titleColor={theme.red}
          subtitle="모든 일정과 할 일을 삭제합니다"
          right={<Ionicons name="chevron-forward" size={18} color={theme.faint} />}
          onPress={handleReset}
        />
      </SettingsGroup>

      <SettingsGroup label="표시">
        <SettingsRow
          icon="time-outline"
          title="시간표 범위"
          right={<Text style={styles.valueText}>06:00 - 24:00</Text>}
        />
        <Divider />
        <SettingsRow
          icon="moon-outline"
          title="다크 모드"
          right={<Switch value={isDark} onValueChange={setDark} {...switchColors} />}
        />
      </SettingsGroup>

      <SettingsGroup label="알림">
        <SettingsRow
          icon="notifications-outline"
          title="알림 방식"
          right={<AlertModeSegments value={alertMode} onChange={handleAlertMode} />}
        />
        <Divider />
        <SettingsRow
          icon="journal-outline"
          title="저녁 회고 알림"
          subtitle="매일 저녁 하루를 되돌아봐요"
          right={<Switch value={reviewAlert} onValueChange={handleReviewAlert} {...switchColors} />}
        />
      </SettingsGroup>
    </PlannerScreen>
  );
}

function SettingsGroup({ label, children }: { label: string; children: ReactNode }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <PlannerCard style={styles.groupCard}>{children}</PlannerCard>
    </View>
  );
}

function Divider() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <View style={styles.divider} />;
}

function SettingsRow({
  icon,
  iconColor,
  title,
  titleColor,
  subtitle,
  right,
  onPress,
}: {
  icon: IoniconName;
  iconColor?: string;
  title: string;
  titleColor?: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const ic = iconColor ?? theme.accent;
  const tc = titleColor ?? theme.ink;
  const content = (
    <>
      <Ionicons name={icon} size={20} color={ic} style={styles.rowIcon} />
      <View style={styles.rowTextCol}>
        <Text style={[styles.rowTitle, { color: tc }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

function AlertModeSegments({
  value,
  onChange,
}: {
  value: AlertMode;
  onChange: (mode: AlertMode) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.segments}>
      {ALERT_MODES.map((mode) => {
        const selected = mode.key === value;
        return (
          <Pressable
            key={mode.key}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => onChange(mode.key)}
            hitSlop={4}>
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {mode.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
  group: {
    gap: Spacing.two,
  },
  groupLabel: {
    color: theme.faint,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    paddingHorizontal: Spacing.one,
  },
  groupCard: {
    padding: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: theme.line,
    marginLeft: Spacing.three + 20 + Spacing.three, // align past the icon column
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowIcon: {
    width: 20,
  },
  rowTextCol: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: theme.faint,
    fontSize: 12.5,
  },
  valueText: {
    color: theme.faint,
    fontSize: 13,
    fontWeight: '600',
  },
  connectedBadge: {
    backgroundColor: theme.accentSoft,
    borderRadius: PlannerRadius.chip,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  connectedBadgeText: {
    color: theme.faint,
    fontSize: 11,
    fontWeight: '700',
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: theme.paper,
    borderRadius: PlannerRadius.chip,
    padding: 2,
    gap: 2,
  },
  segment: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half + 2,
    borderRadius: PlannerRadius.chip,
  },
  segmentSelected: {
    backgroundColor: theme.accent,
  },
  segmentText: {
    color: theme.faint,
    fontSize: 11.5,
    fontWeight: '700',
  },
  segmentTextSelected: {
    color: theme.onAccent,
  },
});
