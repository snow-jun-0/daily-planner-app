import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlannerRadius, PlannerSerif, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';

type SectionHeaderProps = {
  title: string;
  /** optional trailing text next to the title, e.g. "2/3" */
  meta?: string;
  addLabel?: string;
  /** wired up in a later step */
  onAdd?: () => void;
};

export function SectionHeader({ title, meta, addLabel = '+ 추가', onAdd }: SectionHeaderProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.row}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>

      <Pressable
        style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        onPress={onAdd}
        hitSlop={8}>
        <Text style={styles.addText}>{addLabel}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  title: {
    color: theme.ink,
    fontFamily: PlannerSerif,
    fontSize: 19,
    fontWeight: '600',
  },
  meta: {
    color: theme.faint,
    fontSize: 14,
    fontWeight: '600',
  },
  addBtn: {
    backgroundColor: theme.accentSoft,
    borderRadius: PlannerRadius.chip,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one,
  },
  addBtnPressed: {
    opacity: 0.7,
  },
  addText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
