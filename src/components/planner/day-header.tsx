import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlannerRadius, PlannerSerif, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';

type DayHeaderProps = {
  /** small muted label, e.g. "WED · 9월" */
  label: string;
  /** large serif date, e.g. "9월 2일" */
  title: string;
  /** whether `title` is today — hides the "오늘" chip when true */
  isToday?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
};

export function DayHeader({ label, title, isToday = true, onPrev, onNext, onToday }: DayHeaderProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.titleRow}>
          <Pressable onPress={onPrev} hitSlop={10} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onNext} hitSlop={10} style={styles.navBtn}>
            <Text style={styles.navArrow}>›</Text>
          </Pressable>
        </View>
      </View>

      {!isToday ? (
        <Pressable
          onPress={onToday}
          hitSlop={8}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
          <Text style={styles.chipText}>오늘</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  textCol: {
    gap: Spacing.half,
  },
  label: {
    color: theme.faint,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  navBtn: {
    paddingHorizontal: Spacing.one,
  },
  navArrow: {
    color: theme.faint,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  title: {
    color: theme.ink,
    fontFamily: PlannerSerif,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '600',
  },
  chip: {
    backgroundColor: theme.accent,
    borderRadius: PlannerRadius.chip,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    marginTop: Spacing.two,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    color: theme.onAccent,
    fontSize: 13,
    fontWeight: '700',
  },
});
