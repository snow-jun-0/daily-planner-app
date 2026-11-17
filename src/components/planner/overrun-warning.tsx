import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { withAlpha } from '@/components/planner/mini-grid';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerSerif, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { overrunMessage } from '@/lib/stats';

/** 단계 경계(분) — notify.ts 잔소리 알림과 같은 시점 */
const STEPS = [1, 10, 30, 60];

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `+${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

type Props = {
  visible: boolean;
  /** 휴식 종료 후 경과(ms) — 1분 유예 포함 */
  overrunMs: number;
  onResume: () => void;
  onQuit: () => void;
};

/** E3~E5 — 휴식 초과 경고 (1단계 차분 → 2단계 연빨강 → 3단계 빨강 전면) */
export function OverrunWarning({ visible, overrunMs, onResume, onQuit }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const min = overrunMs / 60_000;
  const level = min >= 60 ? 2 : min >= 10 ? 1 : 0;
  const passed = STEPS.filter((s) => min >= s).length;

  const bg = [theme.paper, theme.redSoft, theme.red][level];
  const fg = level === 2 ? theme.onAccent : level === 1 ? theme.red : theme.ink;
  const sub = level === 2 ? theme.onAccent : theme.textSecondary;
  const graceSec = Math.max(0, Math.round((overrunMs - 60_000) / 1000));

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onResume}>
      <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
        <View style={styles.center}>
          <View style={[styles.icon, { backgroundColor: [theme.surface, theme.card, withAlpha(theme.onAccent, 0.18)][level] }]}>
            <Ionicons
              name={level ? 'warning-outline' : 'cafe-outline'}
              size={26}
              color={level === 2 ? theme.onAccent : level ? theme.red : theme.ink}
            />
          </View>
          <Text style={[styles.overline, { color: fg }]}>{level ? '휴식 초과' : '휴식 종료'}</Text>
          <Text style={[styles.clock, { color: level ? fg : theme.ink }]}>{fmt(overrunMs)}</Text>
          <Text style={[styles.headline, { color: fg }]}>
            {level ? overrunMessage(graceSec) : '쉬는 시간 끝!\n다시 시작해요'}
          </Text>
          <Text style={[styles.sub, { color: sub }]}>
            {level === 0 ? '지금부터 초과 시간이 통계에 기록돼요.' : '초과 시간은 통계에 기록되고 있어요.'}
          </Text>
          <View style={styles.steps}>
            {STEPS.map((s, i) => (
              <View
                key={s}
                style={[
                  styles.step,
                  {
                    backgroundColor:
                      i < passed
                        ? level === 2
                          ? theme.onAccent
                          : level
                            ? theme.red
                            : theme.ink
                        : level === 2
                          ? theme.redSoft
                          : theme.line,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.stepLabel, { color: sub }]}>
            {STEPS.map((s) => `+${s}분`).join('  ·  ')}
          </Text>
        </View>

        <View style={styles.btns}>
          <Pressable
            style={[styles.primary, level === 2 && { backgroundColor: theme.onAccent }]}
            onPress={onResume}>
            <Text style={[styles.primaryText, level === 2 && { color: theme.red }]}>
              집중으로 복귀
            </Text>
          </Pressable>
          <Pressable
            style={[styles.secondary, level === 2 && { borderColor: theme.onAccent, backgroundColor: 'transparent' }]}
            onPress={onQuit}>
            <Text style={[styles.secondaryText, level === 2 && { color: theme.onAccent }]}>
              오늘은 여기까지
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, padding: Spacing.three },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    icon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    overline: { ...PlannerType.labelStrong, fontSize: 12 },
    clock: { fontFamily: PlannerSerif, fontSize: 56, fontWeight: '600' },
    headline: {
      fontFamily: PlannerSerif,
      fontSize: 26,
      lineHeight: 36,
      fontWeight: '600',
      textAlign: 'center',
    },
    sub: { ...PlannerType.body, textAlign: 'center' },
    steps: { flexDirection: 'row', gap: 6, marginTop: 18 },
    step: { width: 44, height: 4, borderRadius: 2 },
    stepLabel: { ...PlannerType.caption },
    btns: { gap: 10, paddingBottom: Spacing.three },
    primary: {
      paddingVertical: 16,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.accent,
      alignItems: 'center',
    },
    primaryText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
    secondary: {
      paddingVertical: 16,
      borderRadius: PlannerRadius.md,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.card,
      alignItems: 'center',
    },
    secondaryText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.ink },
  });
