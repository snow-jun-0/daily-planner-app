import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SubHeader } from '@/components/planner/settings-ui';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerShadow, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { priceOf, usePro } from '@/lib/pro';

/** true = 있음, false = 없음, 문자열 = 그대로 표시 */
const ROWS: [string, boolean | string, boolean | string][] = [
  ['격자 타임테이블 · 계획', true, true],
  ['집중 타이머 · 실시간 채움', true, true],
  ['TOTAL TIME · 과목별 합계', true, true],
  ['일정 레인 · 구글 일정', true, true],
  ['목표 · 연속 기록 · 템플릿', true, true],
  ['클라우드 백업', true, true],
  ['시간대 히트맵', false, true],
  ['계획 대비 달성률 추이', false, true],
  ['공유 카드 스타일', '기본', '전체'],
  ['과목 색 팔레트', '기본', '6종'],
];

/** J2 — 무료 vs Pro */
export default function ProCompareScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { isPro } = usePro();

  const cell = (v: boolean | string, pro: boolean) =>
    typeof v === 'string' ? (
      <Text style={[styles.cellText, pro && styles.proText]}>{v}</Text>
    ) : v ? (
      <Ionicons name="checkmark" size={18} color={pro ? theme.blue : theme.ink} />
    ) : (
      <Text style={styles.dash}>—</Text>
    );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <SubHeader title="무료 vs Pro" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={[styles.row, styles.headRow]}>
            <Text style={[styles.feature, styles.head]}>기능</Text>
            <Text style={[styles.col, styles.head]}>무료</Text>
            <Text style={[styles.col, styles.head, styles.proText]}>Pro</Text>
          </View>
          {ROWS.map(([name, free, pro]) => (
            <View key={name} style={styles.row}>
              <Text style={styles.feature}>{name}</Text>
              <View style={styles.colBox}>{cell(free, false)}</View>
              <View style={styles.colBox}>{cell(pro, true)}</View>
            </View>
          ))}
        </View>
      </ScrollView>
      {isPro ? null : (
        <Pressable style={styles.primary} onPress={() => router.replace('/pro' as never)}>
          <Text style={styles.primaryText}>Pro 시작하기 · 연 {priceOf('annual')}</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper },
    content: { padding: Spacing.three },
    card: {
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.card,
      paddingHorizontal: Spacing.three,
      ...PlannerShadow,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: theme.line,
    },
    headRow: { borderTopWidth: 0 },
    head: { ...PlannerType.labelStrong, color: theme.textSecondary },
    feature: { ...PlannerType.label, color: theme.ink, flex: 1 },
    col: { width: 56, textAlign: 'center' },
    colBox: { width: 56, alignItems: 'center' },
    cellText: { ...PlannerType.caption, color: theme.ink },
    proText: { color: theme.blue, fontWeight: '700' },
    dash: { ...PlannerType.caption, color: theme.textTertiary },
    primary: {
      margin: Spacing.three,
      paddingVertical: 16,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.accent,
      alignItems: 'center',
    },
    primaryText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
  });
