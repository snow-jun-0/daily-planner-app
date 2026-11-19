import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PlanBlock } from '@/components/planner/focus-sheet';
import { withAlpha } from '@/components/planner/mini-grid';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerType } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { CELL_COUNT, CELL_MIN, cellLabel, type Category } from '@/lib/timetable';

/** 길이 프리셋 (칸 수): 30분 · 1시간 · 2시간 30분 · 3시간 */
const PRESETS = [3, 6, 15, 18];

function fmtLen(cells: number): string {
  const min = cells * CELL_MIN;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

type Props = {
  cats: Category[];
  /** 편집할 블록 (isNew면 새 계획 기본값) */
  initial: PlanBlock;
  isNew: boolean;
  onClose: () => void;
  onSave: (block: PlanBlock) => void;
  onDelete: () => void;
};

/** G8 — 계획 추가·편집 시트. 열려 있는 동안만 마운트한다. */
export function PlanSheet({ cats, initial, isNew, onClose, onSave, onDelete }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [b, setB] = useState(initial);
  const len = b.end - b.start + 1;

  const moveStart = (d: number) =>
    setB((x) => {
      const start = Math.max(0, Math.min(x.end, x.start + d));
      return { ...x, start };
    });
  const moveEnd = (d: number) =>
    setB((x) => ({ ...x, end: Math.max(x.start, Math.min(CELL_COUNT - 1, x.end + d)) }));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{isNew ? '계획 추가' : '계획 편집'}</Text>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={18} color={theme.ink} />
            </Pressable>
          </View>

          <Text style={styles.label}>카테고리</Text>
          <View style={styles.wrapRow}>
            {cats.map((c) => {
              const on = c.id === b.subject;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setB((x) => ({ ...x, subject: c.id }))}
                  style={[
                    styles.chip,
                    on && { borderColor: c.color, backgroundColor: withAlpha(c.color, 0.12) },
                  ]}>
                  <View style={[styles.dot, { backgroundColor: c.color }]} />
                  <Text style={[styles.chipText, on && { color: c.color }]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>시간 (10분 단위)</Text>
          <View style={styles.timeRow}>
            <TimeField label={cellLabel(b.start)} onStep={moveStart} styles={styles} theme={theme} />
            <TimeField label={cellLabel(b.end + 1)} onStep={moveEnd} styles={styles} theme={theme} />
          </View>
          <View style={styles.wrapRow}>
            {PRESETS.map((n) => {
              const on = n === len;
              return (
                <Pressable
                  key={n}
                  style={[styles.preset, on && styles.presetOn]}
                  onPress={() =>
                    setB((x) => ({ ...x, end: Math.min(CELL_COUNT - 1, x.start + n - 1) }))
                  }>
                  <Text style={[styles.presetText, on && styles.presetTextOn]}>{fmtLen(n)}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            {isNew ? null : (
              <Pressable style={styles.deleteBtn} onPress={onDelete}>
                <Ionicons name="trash-outline" size={20} color={theme.red} />
              </Pressable>
            )}
            <Pressable style={styles.saveBtn} onPress={() => onSave(b)}>
              <Text style={styles.saveText}>저장</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function TimeField({
  label,
  onStep,
  styles,
  theme,
}: {
  label: string;
  onStep: (d: number) => void;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
}) {
  return (
    <View style={styles.timeField}>
      <Pressable onPress={() => onStep(-1)} hitSlop={8} accessibilityLabel="10분 앞으로">
        <Ionicons name="remove" size={18} color={theme.textSecondary} />
      </Pressable>
      <Text style={styles.timeText}>{label}</Text>
      <Pressable onPress={() => onStep(1)} hitSlop={8} accessibilityLabel="10분 뒤로">
        <Ionicons name="add" size={18} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

export const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: PlannerRadius.lg,
      borderTopRightRadius: PlannerRadius.lg,
      padding: 20,
      paddingTop: 10,
      gap: 12,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.line,
      marginBottom: 6,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { ...PlannerType.titleM, color: theme.ink },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { ...PlannerType.label, color: theme.textSecondary },
    wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: PlannerRadius.chip,
      borderWidth: 1,
      borderColor: theme.line,
    },
    chipText: { ...PlannerType.label, color: theme.textSecondary },
    dot: { width: 8, height: 8, borderRadius: 4 },
    timeRow: { flexDirection: 'row', gap: 10, marginTop: -4 },
    timeField: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: PlannerRadius.md,
      borderWidth: 1,
      borderColor: theme.line,
    },
    timeText: { ...PlannerType.bodyMedium, fontSize: 16, color: theme.ink },
    preset: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: PlannerRadius.chip,
      borderWidth: 1,
      borderColor: theme.line,
    },
    presetOn: { backgroundColor: theme.accent, borderColor: theme.accent },
    presetText: { ...PlannerType.labelStrong, color: theme.textSecondary },
    presetTextOn: { color: theme.onAccent },
    footer: { flexDirection: 'row', gap: 10, marginTop: 8 },
    deleteBtn: {
      width: 52,
      borderRadius: PlannerRadius.md,
      borderWidth: 1,
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtn: {
      flex: 1,
      backgroundColor: theme.accent,
      borderRadius: PlannerRadius.md,
      paddingVertical: 15,
      alignItems: 'center',
    },
    saveText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
  });
