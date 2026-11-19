import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { AppTheme } from '@/constants/theme';
import { PlannerType } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { BLOCKS_PER_CELL, liveFillRange } from '@/lib/live-fill';
import * as pomodoro from '@/lib/pomodoro';
import {
  COLS,
  dateToCellIndex,
  FOCUS_CATEGORY,
  START_HOUR,
  timetableDateKey,
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

export type LiveFill = { dateKey: string; idx: number; from: number; done: number; color: string };

/** 집중 중 '지금 칸'의 1분 블록 채움 상태 (now는 useNow()로 받아 매초 갱신) */
export function liveFillAt(now: number, catMap: Record<SubjectId, Category>): LiveFill | null {
  const start = pomodoro.getLiveFillStart();
  if (start == null) return null;
  const d = new Date(now);
  const idx = dateToCellIndex(d);
  if (idx < 0) return null;
  const subject = pomodoro.getState().focusSubject;
  return {
    dateKey: timetableDateKey(d),
    idx,
    ...liveFillRange(start, now),
    color: catMap[subject]?.color ?? FOCUS_CATEGORY.color,
  };
}

/** 칸 위에 1분 블록 10개: [from, done) 채움, done은 지금 채우는 중(연하게) */
export function LiveFillBlocks({ live }: { live: LiveFill }) {
  return (
    <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]} pointerEvents="none">
      {Array.from({ length: BLOCKS_PER_CELL }).map((_, b) => (
        <Animated.View
          key={b}
          style={{
            flex: 1,
            // 1분마다 한 블록씩 차오를 때 부드럽게
            transitionProperty: 'backgroundColor',
            transitionDuration: 400,
            backgroundColor:
              b >= live.from && b < live.done
                ? live.color
                : b === live.done
                  ? withAlpha(live.color, 0.35)
                  : 'transparent',
          }}
        />
      ))}
    </View>
  );
}

type Props = {
  day: DayTimetable;
  catMap: Record<SubjectId, Category>;
  /** 보여줄 행 (06시 = 0) */
  rows: number[];
  /** 지금 채우는 칸 — 빨간 테두리로 강조 */
  nowIdx?: number;
  showColHeader?: boolean;
  /** 집중 중 진행 칸 (useLiveFill) */
  live?: LiveFill | null;
};

/** 격자 일부(몇 행)만 보여주는 읽기 전용 미니 격자 */
export function MiniGrid({ day, catMap, rows, nowIdx = -1, showColHeader = true, live }: Props) {
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
                ]}>
                {live?.idx === idx && !day.cells[idx]?.actual ? <LiveFillBlocks live={live} /> : null}
              </View>
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
    cell: { flex: 1, height: 22, borderRadius: 4, overflow: 'hidden' },
    cellNow: { borderWidth: 1.5, borderColor: theme.red },
  });
