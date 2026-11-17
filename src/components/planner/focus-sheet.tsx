import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MiniGrid, withAlpha } from '@/components/planner/mini-grid';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerType } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { getState } from '@/lib/pomodoro';
import {
  cellLabel,
  CELL_MIN,
  COLS,
  FOCUS_CATEGORY,
  type Category,
  type DayTimetable,
  type SubjectId,
} from '@/lib/timetable';

export type PlanBlock = { start: number; end: number; subject: SubjectId };

/** 열려 있는 동안만 마운트한다 (열 때마다 상태 초기화) */
type Props = {
  onClose: () => void;
  day: DayTimetable;
  cats: Category[];
  /** 탭한 계획 블록 — null이면 '바로 집중' (과목 고르기) */
  block: PlanBlock | null;
  /** 지금 칸 (오늘이 아니면 -1) */
  nowIdx: number;
  onStart: (subject: SubjectId, minutes?: number) => void;
  onRecord?: (block: PlanBlock) => void;
  onClearPlan?: (block: PlanBlock) => void;
};

function fmtHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

/** G7 — 계획 칸 탭 → 집중 시작 시트 */
export function FocusSheet({
  onClose,
  day,
  cats,
  block,
  nowIdx,
  onStart,
  onRecord,
  onClearPlan,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const catMap = useMemo(
    () => Object.fromEntries(cats.map((c) => [c.id, c])) as Record<SubjectId, Category>,
    [cats],
  );
  const [subject, setSubject] = useState<SubjectId>(
    () => block?.subject ?? getState().focusSubject,
  );
  const [byPlan, setByPlan] = useState(true);

  const cat = catMap[subject] ?? FOCUS_CATEGORY;
  const { settings } = getState();

  let remainingMin = 0;
  let filledMin = 0;
  let rows: number[] = [];
  if (block) {
    for (let i = block.start; i <= block.end; i++) {
      if (day.cells[i]?.actual) filledMin += CELL_MIN;
      else if (i >= nowIdx) remainingMin += CELL_MIN;
    }
    const r0 = Math.floor(block.start / COLS);
    const r1 = Math.floor(block.end / COLS);
    rows = Array.from({ length: r1 - r0 + 1 }, (_, k) => r0 + k);
  }
  const totalMin = block ? (block.end - block.start + 1) * CELL_MIN : 0;
  const useRemaining = block != null && byPlan && remainingMin > 0;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={[styles.colorBar, { backgroundColor: cat.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{block ? cat.name : '바로 집중'}</Text>
              <Text style={styles.sub}>
                {block
                  ? `계획 ${cellLabel(block.start)} – ${cellLabel(block.end + 1)} · ${fmtHM(totalMin)} 중 ${fmtHM(filledMin)} 채움`
                  : '집중하는 동안 지금 칸이 과목색으로 채워져요'}
              </Text>
            </View>
          </View>

          {block ? (
            <MiniGrid day={day} catMap={catMap} rows={rows} nowIdx={nowIdx} showColHeader={false} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              {cats.map((c) => {
                const on = c.id === subject;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setSubject(c.id)}
                    style={[
                      styles.chip,
                      on && { borderColor: c.color, backgroundColor: withAlpha(c.color, 0.12) },
                    ]}>
                    <View style={[styles.dot, { backgroundColor: c.color }]} />
                    <Text style={[styles.chipText, on && { color: c.color }]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {block && remainingMin > 0 ? (
            <>
              <Text style={styles.label}>집중 방식</Text>
              <View style={styles.modeRow}>
                <Pressable
                  style={[styles.mode, byPlan && styles.modeOn]}
                  onPress={() => setByPlan(true)}>
                  <Text style={styles.modeTitle}>남은 계획만큼</Text>
                  <Text style={styles.modeSub}>{fmtHM(remainingMin)} · 다이얼 자동 설정</Text>
                </Pressable>
                <Pressable
                  style={[styles.mode, !byPlan && styles.modeOn]}
                  onPress={() => setByPlan(false)}>
                  <Text style={styles.modeTitle}>뽀모도로</Text>
                  <Text style={styles.modeSub}>
                    {settings.focusMinutes}분 집중 · {settings.breakMinutes}분 휴식
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}

          <Pressable
            style={styles.startBtn}
            onPress={() => onStart(subject, useRemaining ? remainingMin : undefined)}>
            <Text style={styles.startText}>집중 시작</Text>
          </Pressable>

          {block ? (
            <>
              <View style={styles.actionRow}>
                <Pressable style={styles.action} onPress={() => onRecord?.(block)}>
                  <Ionicons name="checkmark" size={18} color={theme.ink} />
                  <Text style={styles.actionText}>직접 기록</Text>
                </Pressable>
                <Pressable style={styles.action} onPress={() => onClearPlan?.(block)}>
                  <Ionicons name="trash-outline" size={18} color={theme.red} />
                  <Text style={[styles.actionText, { color: theme.red }]}>계획 지우기</Text>
                </Pressable>
              </View>
              <Text style={styles.footHint}>
                직접 기록: 타이머를 못 켰을 때 이 계획 칸을 실제로 칠해요.
              </Text>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: PlannerRadius.lg,
      borderTopRightRadius: PlannerRadius.lg,
      padding: 20,
      paddingTop: 10,
      gap: 14,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.line,
      marginBottom: 6,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    colorBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
    title: { ...PlannerType.titleM, color: theme.ink },
    sub: { ...PlannerType.caption, color: theme.textSecondary },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 12,
      marginRight: 6,
      borderRadius: PlannerRadius.chip,
      borderWidth: 1,
      borderColor: theme.line,
    },
    chipText: { ...PlannerType.label, color: theme.textSecondary },
    dot: { width: 8, height: 8, borderRadius: 4 },
    label: { ...PlannerType.label, color: theme.textSecondary },
    modeRow: { flexDirection: 'row', gap: 8, marginTop: -6 },
    mode: {
      flex: 1,
      padding: 12,
      borderRadius: PlannerRadius.md,
      borderWidth: 1,
      borderColor: theme.line,
      gap: 2,
    },
    modeOn: { borderWidth: 2, borderColor: theme.ink },
    modeTitle: { ...PlannerType.labelStrong, color: theme.ink },
    modeSub: { ...PlannerType.caption, color: theme.textSecondary },
    startBtn: {
      backgroundColor: theme.accent,
      borderRadius: PlannerRadius.md,
      paddingVertical: 15,
      alignItems: 'center',
    },
    startText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
    actionRow: { flexDirection: 'row', gap: 8 },
    action: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 12,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.surface,
    },
    actionText: { ...PlannerType.label, color: theme.ink },
    footHint: { ...PlannerType.caption, color: theme.textTertiary, textAlign: 'center' },
  });
