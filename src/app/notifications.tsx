import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Divider,
  SettingsGroup,
  SettingsRow,
  Segmented,
  SubHeader,
  Toggle,
} from '@/components/planner/settings-ui';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { usePrefs } from '@/hooks/use-prefs';
import { cancelDailyReflection, scheduleDailyReflection } from '@/lib/notify';
import {
  getNotifyDaily,
  getNotifyMode,
  setNotifyDaily,
  setNotifyMode,
  type NotifyMode,
} from '@/lib/settings';

const MODE_HINT: Record<NotifyMode, string> = {
  mute: '알림이 와도 소리·진동 없이 조용히 표시돼요.',
  vibrate: '소리 없이 진동으로만 알려요.',
  sound: '소리 모드는 기기의 알람 음량을 사용해요.',
};

/** 휴식 초과 잔소리 단계 — notify.ts scheduleOverrunNags와 같은 시점 */
const NAG_STEPS = ['+1분', '+10분', '+30분', '+60분', '+90분~'];

/** E6 — 알림 설정 */
export default function NotificationsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [prefs, updatePrefs] = usePrefs();
  const [mode, setMode] = useState<NotifyMode>('sound');
  const [daily, setDaily] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getNotifyMode().then(setMode);
      void getNotifyDaily().then(setDaily);
    }, []),
  );

  const applyDaily = (on: boolean, hour: number) =>
    void (on ? scheduleDailyReflection(hour) : cancelDailyReflection());

  const shiftHour = (d: number) => {
    const hour = (prefs.dailyHour + d + 24) % 24;
    updatePrefs({ dailyHour: hour });
    if (daily) applyDaily(true, hour);
  };

  const nagTone = [theme.surface, theme.amberSoft, theme.amberSoft, theme.redSoft, theme.redSoft];
  const nagText = [theme.textSecondary, theme.amber, theme.amber, theme.red, theme.red];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SubHeader title="알림" />
      <ScrollView contentContainerStyle={styles.content}>
        <SettingsGroup label="알림 방식">
          <View style={styles.block}>
            <Segmented
              options={[
                { key: 'mute', label: '무음' },
                { key: 'vibrate', label: '진동' },
                { key: 'sound', label: '소리' },
              ]}
              value={mode}
              onChange={(m) => {
                setMode(m);
                void setNotifyMode(m);
              }}
            />
            <Text style={styles.caption}>{MODE_HINT[mode]}</Text>
          </View>
        </SettingsGroup>

        <SettingsGroup label="타이머">
          <SettingsRow
            icon="stopwatch-outline"
            title="집중 종료 알림"
            subtitle="집중 시간이 끝나면 알려요"
            right={
              <Toggle
                value={prefs.focusEndAlert}
                onChange={(v) => updatePrefs({ focusEndAlert: v })}
              />
            }
          />
          <Divider />
          <SettingsRow
            icon="cafe-outline"
            title="휴식 종료 알림"
            subtitle="휴식이 끝나면 알려요"
            right={
              <Toggle
                value={prefs.breakEndAlert}
                onChange={(v) => updatePrefs({ breakEndAlert: v })}
              />
            }
          />
        </SettingsGroup>

        <SettingsGroup label="휴식 초과 잔소리">
          <SettingsRow
            icon="warning-outline"
            title="잔소리 알림"
            subtitle="복귀가 늦으면 단계별로 알려요 (방해 금지 모드도 뚫어요)"
            right={<Toggle value={prefs.nagAlert} onChange={(v) => updatePrefs({ nagAlert: v })} />}
          />
          <Divider />
          <View style={styles.block}>
            <Text style={styles.caption}>알림 단계</Text>
            <View style={styles.chips}>
              {NAG_STEPS.map((s, i) => (
                <View key={s} style={[styles.chip, { backgroundColor: nagTone[i] }]}>
                  <Text style={[styles.chipText, { color: nagText[i] }]}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        </SettingsGroup>

        <SettingsGroup label="저녁 회고">
          <SettingsRow
            icon="book-outline"
            title="저녁 회고 알림"
            subtitle="하루를 돌아보는 알림"
            right={
              <Toggle
                value={daily}
                onChange={(v) => {
                  setDaily(v);
                  void setNotifyDaily(v);
                  applyDaily(v, prefs.dailyHour);
                }}
              />
            }
          />
          <Divider />
          <SettingsRow
            icon="time-outline"
            title="알림 시간"
            right={
              <View style={styles.stepper}>
                <Pressable hitSlop={6} style={styles.stepBtn} onPress={() => shiftHour(-1)}>
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text style={styles.hour}>{String(prefs.dailyHour).padStart(2, '0')}:00</Text>
                <Pressable hitSlop={6} style={styles.stepBtn} onPress={() => shiftHour(1)}>
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
              </View>
            }
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow
            icon="settings-outline"
            title="시스템 알림 설정 열기"
            subtitle="채널별 소리·진동은 기기 설정에서 바꿀 수 있어요"
            onPress={() => void Linking.openSettings()}
          />
        </SettingsGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper },
    content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
    block: { paddingVertical: 14, gap: 10 },
    caption: { ...PlannerType.caption, color: theme.textSecondary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { borderRadius: PlannerRadius.sm, paddingHorizontal: 8, paddingVertical: 4 },
    chipText: { ...PlannerType.labelStrong, fontSize: 12 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepText: { ...PlannerType.labelStrong, color: theme.ink },
    hour: { ...PlannerType.labelStrong, color: theme.ink },
  });
