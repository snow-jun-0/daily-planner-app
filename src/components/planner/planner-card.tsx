import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { PlannerRadius, PlannerShadow, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';

type PlannerCardProps = ViewProps & {
  children: ReactNode;
};

/**
 * Shared planner card shell: `card` surface, `line` border, radius 16,
 * soft shadow, inner padding 16. Used by every section on the daily view.
 */
export function PlannerCard({ children, style, ...rest }: PlannerCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderColor: theme.line,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: PlannerRadius.card,
    padding: Spacing.three,
    ...PlannerShadow,
  },
});
