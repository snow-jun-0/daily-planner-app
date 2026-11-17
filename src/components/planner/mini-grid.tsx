import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { PlannerType } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import {
  COLS,
  FOCUS_CATEGORY,
  START_HOUR,
  type Category,
  type Cell,
  type DayTimetable,
  type SubjectId,
} from '@/lib/timetable';

export function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** 칸 배경: 실제=진한 과목색, 계획=옅은 과목색, 빈칸=surface */
export function cellColor(
  cell: Cell,
  catMap: Record<SubjectId, Category>,
  theme: AppTheme,
): string {
  if (cell.actual) return catMap[cell.actual]?.color ?? FOCUS_CATEGORY.color;
  if (cell.planned) return withAlpha(catMap[cell.planned]?.color ?? FOCUS_CATEGORY.color, 0.28);
  return theme.surface;
}

type Props = {
  day: DayTimetable;
  catMap: Record<SubjectId, Category>;
  /** 보여줄 행 (06시 = 0) */
  rows: number[];
  /** 지금 채우는 칸 — 빨간 테두리로 강조 */
  nowIdx?: number;
  showColHeader?: boolean;
};

/** 격자 일부(몇 행)만 보여주는 읽기 전용 미니 격자 */
export function MiniGrid({ day, catMap, rows, nowIdx = -1, showColHeader = true }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const nowRow = nowIdx >= 0 ? Math.floor(nowIdx / COLS) : -1;
  return (
    <View style={styles.wrap}>
      {showColHeader ? (
        <View style={styles.row}>
          <View style={styles.axis} />
          {Array.from({ length: COLS }).map((_, c) => (
            <Text key={c} style={styles.colHead}>
              {(c + 1) * 10}
            </Text>
          ))}
        </View>
      ) : null}
      {rows.map((r) => (
        <View key={r} style={styles.row}>
          <Text style={[styles.axis, styles.axisText, r === nowRow && styles.axisNow]}>
            {String((START_HOUR + r) % 24).padStart(2, '0')}
          </Text>
          {Array.from({ length: COLS }).map((_, c) => {
            const idx = r * COLS + c;
            return (
              <View
                key={c}
                style={[
                  styles.cell,
                  { backgroundColor: cellColor(day.cells[idx] ?? {}, catMap, theme) },
                  idx === nowIdx && styles.cellNow,
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: { gap: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    axis: { width: 24 },
    axisText: { ...PlannerType.caption, color: theme.textTertiary },
    axisNow: { color: theme.red, fontWeight: '700' },
    colHead: {
      ...PlannerType.caption,
      flex: 1,
      textAlign: 'center',
      color: theme.textTertiary,
      fontWeight: '700',
    },
    cell: { flex: 1, height: 22, borderRadius: 4 },
    cellNow: { borderWidth: 1.5, borderColor: theme.red },
  });
