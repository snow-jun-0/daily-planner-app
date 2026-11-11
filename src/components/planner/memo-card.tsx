import { useEffect, useRef, useState, useMemo } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { PlannerCard } from './planner-card';
import { SectionHeader } from './section-header';

import { PlannerRadius, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';

type MemoCardProps = {
  value: string;
  onSave: (text: string) => void;
};

const AUTOSAVE_DELAY = 600;

export function MemoCard({ value, onSave }: MemoCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [text, setText] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // keep in sync when the loaded value arrives (or the date changes) —
  // adjusting state during render instead of an effect, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value);
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleChangeText(next: string) {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(next), AUTOSAVE_DELAY);
  }

  function handleBlur() {
    if (timer.current) clearTimeout(timer.current);
    onSave(text);
  }

  return (
    <PlannerCard>
      <SectionHeader title="메모" />

      <TextInput
        value={text}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        placeholder="오늘 하루를 기록해보세요"
        placeholderTextColor={theme.faint}
        style={styles.input}
        multiline
        textAlignVertical="top"
      />
    </PlannerCard>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
  input: {
    marginTop: Spacing.three,
    minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.line,
    borderRadius: PlannerRadius.block,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    lineHeight: 21,
    color: theme.ink,
  },
});
