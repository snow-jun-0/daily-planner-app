import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PlannerSerif, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';

type PlaceholderScreenProps = {
  /** screen title shown in the middle, e.g. "월간" */
  title: string;
};

/**
 * Temporary stand-in for tabs whose real content hasn't been built yet.
 * Swap for the real screen once it's ready — the route file stays the same.
 */
export function PlaceholderScreen({ title }: PlaceholderScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>준비 중</Text>
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    backgroundColor: theme.paper,
  },
  title: {
    color: theme.ink,
    fontFamily: PlannerSerif,
    fontSize: 22,
    fontWeight: '600',
  },
  subtitle: {
    color: theme.faint,
    fontSize: 14,
    fontWeight: '600',
  },
});
