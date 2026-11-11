import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { CircularProgress } from './circular-progress';

import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';

type ProgressRingProps = {
  /** 0–100 */
  percent: number;
  size?: number;
  strokeWidth?: number;
};

/**
 * Small circular progress indicator used on the today summary card.
 * Thin wrapper around `CircularProgress` with a centered percent label.
 */
export function ProgressRing({ percent, size = 76, strokeWidth = 7 }: ProgressRingProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <CircularProgress percent={clamped} size={size} strokeWidth={strokeWidth}>
      <Text style={styles.percent}>{clamped}%</Text>
    </CircularProgress>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
  percent: {
    color: theme.ink,
    fontSize: 18,
    fontWeight: '700',
  },
});
