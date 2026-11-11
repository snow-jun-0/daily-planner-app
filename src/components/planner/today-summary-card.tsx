import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProgressRing } from './progress-ring';

import { PlannerRadius, PlannerShadow, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';

export type DDayItem = {
  label: string;
  /** e.g. "D-1", "D-7" */
  dday: string;
};

type TodaySummaryCardProps = {
  progress: number;
  ddays: DDayItem[];
  onManage?: () => void;
};

/**
 * White card — `accent` (black) is used sparingly, on the progress ring and
 * the D-day badges.
 */
export function TodaySummaryCard({ progress, ddays, onManage }: TodaySummaryCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <ProgressRing percent={progress} />
        <Text style={styles.leftCaption}>오늘 달성률</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.right}>
        <View style={styles.rightTitleRow}>
          <Text style={styles.rightTitle}>다가오는 일정</Text>
          {onManage ? (
            <Pressable onPress={onManage} hitSlop={8}>
              <Ionicons name="add-circle-outline" size={18} color={theme.faint} />
            </Pressable>
          ) : null}
        </View>
        {ddays.length === 0 ? (
          <Pressable onPress={onManage} disabled={!onManage}>
            <Text style={styles.emptyText}>+ D-Day 추가하기</Text>
          </Pressable>
        ) : null}
        {ddays.map((item) => (
          <View key={`${item.label}-${item.dday}`} style={styles.ddayRow}>
            <Text style={styles.ddayLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <View style={styles.ddayBadge}>
              <Text style={styles.ddayBadgeText}>{item.dday}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderColor: theme.line,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: PlannerRadius.card,
    padding: Spacing.three,
    gap: Spacing.three,
    ...PlannerShadow,
  },
  left: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  leftCaption: {
    color: theme.faint,
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: 'stretch',
    backgroundColor: theme.line,
  },
  right: {
    flex: 1,
    gap: Spacing.two,
  },
  rightTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyText: {
    color: theme.faint,
    fontSize: 13,
    paddingVertical: 2,
  },
  rightTitle: {
    color: theme.faint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  ddayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  ddayLabel: {
    flex: 1,
    color: theme.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  ddayBadge: {
    backgroundColor: theme.accentSoft,
    borderRadius: PlannerRadius.chip,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  ddayBadgeText: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: '700',
  },
});
