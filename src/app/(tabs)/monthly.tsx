import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlannerCard } from '@/components/planner/planner-card';
import { PlannerScreen } from '@/components/planner/planner-screen';
import { PlannerRadius, PlannerSerif, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { loadMonthDots, type DotColor, type MonthDots } from '@/lib/calendar';
import { todayKey } from '@/lib/date';
import { formatDisplayDate } from '@/lib/date';
import { loadEvents, type Event } from '@/lib/events';
import { requestViewDate } from '@/lib/navigation';
import { loadTasks, type Task } from '@/lib/tasks';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const dotColor = (theme: AppTheme): Record<DotColor, string> => ({
  highlight: theme.highlight,
  green: theme.green,
  blue: theme.blue,
  red: theme.red,
  sage: theme.sage,
  task: theme.accent,
});

type DayCell = {
  day: number;
  inMonth: boolean;
  dateKey?: string;
  isToday?: boolean;
  dots?: DotColor[];
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function dateKeyFor(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function buildMonthGrid(year: number, month: number, dots: MonthDots, today: string): DayCell[] {
  const cells: DayCell[] = [];

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ day: prevMonthDays - firstWeekday + 1 + i, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = dateKeyFor(year, month, day);
    cells.push({ day, inMonth: true, dateKey: key, isToday: key === today, dots: dots[key] });
  }

  let nextMonthDay = 1;
  while (cells.length < 42) {
    cells.push({ day: nextMonthDay++, inMonth: false });
  }

  return cells;
}

export default function MonthlyScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dots, setDots] = useState<MonthDots>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ events: Event[]; tasks: Task[] } | null>(null);
  const today = todayKey();

  // reload dots whenever the visible month changes, and whenever this tab
  // regains focus (so a task/event just added on 오늘 shows up without a
  // full app restart)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadMonthDots(year, month).then((loaded) => {
        if (!cancelled) setDots(loaded);
      });
      return () => {
        cancelled = true;
      };
    }, [year, month]),
  );

  const grid = useMemo(() => buildMonthGrid(year, month, dots, today), [year, month, dots, today]);

  function handlePrevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  }

  function handleNextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  }

  function openDay(dateKey: string) {
    requestViewDate(dateKey);
    router.navigate('/');
  }

  function handleDayPress(dateKey: string) {
    if (selectedDate === dateKey) {
      openDay(dateKey);
    } else {
      setSelectedDate(dateKey);
      void Promise.all([loadEvents(dateKey), loadTasks(dateKey)]).then(([e, t]) =>
        setPreview({ events: e, tasks: t }),
      );
    }
  }

  return (
    <PlannerScreen>
      <View style={styles.headerRow}>
        <View style={styles.selectors}>
          <Pressable onPress={handlePrevMonth} hitSlop={10} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.ink} />
          </Pressable>
          <Text style={styles.selectorText}>
            {year}년 {month}월
          </Text>
          <Pressable onPress={handleNextMonth} hitSlop={10} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={theme.ink} />
          </Pressable>
        </View>

        <Pressable style={styles.statsBtn} hitSlop={8} onPress={() => router.push('/stats' as never)}>
          <Ionicons name="bar-chart-outline" size={18} color={theme.accent} />
        </Pressable>
      </View>

      <PlannerCard style={styles.calendarCard}>
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((label, i) => (
            <Text
              key={label}
              style={[
                styles.weekdayText,
                i === 0 && styles.sunText,
                i === 6 && styles.satText,
              ]}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {grid.map((cell, i) => {
            const col = i % 7;
            const dayColor = !cell.inMonth
              ? theme.faint
              : col === 0
                ? theme.red
                : col === 6
                  ? theme.blue
                  : theme.ink;

            const content = (
              <>
                {cell.isToday ? (
                  <View style={styles.todayBadge}>
                    <Text style={styles.todayText}>{cell.day}</Text>
                  </View>
                ) : (
                  <Text
                    style={[styles.dayText, { color: dayColor }, !cell.inMonth && styles.outOfMonth]}>
                    {cell.day}
                  </Text>
                )}

                <View style={styles.dotRow}>
                  {cell.dots?.map((color, di) => (
                    <View key={di} style={[styles.dot, { backgroundColor: dotColor(theme)[color] }]} />
                  ))}
                </View>
              </>
            );

            if (!cell.inMonth || !cell.dateKey) {
              return (
                <View key={i} style={styles.cell}>
                  {content}
                </View>
              );
            }

            return (
              <Pressable
                key={i}
                style={({ pressed }) => [
                  styles.cell,
                  pressed && styles.cellPressed,
                  cell.dateKey === selectedDate && styles.cellSelected,
                ]}
                onPress={() => handleDayPress(cell.dateKey!)}>
                {content}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.blue }]} />
            <Text style={styles.legendText}>일정</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.green }]} />
            <Text style={styles.legendText}>할 일</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.amber }]} />
            <Text style={styles.legendText}>메모</Text>
          </View>
        </View>
      </PlannerCard>

      {selectedDate && preview ? (
        <Pressable style={styles.previewCard} onPress={() => openDay(selectedDate)}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewDate}>{formatDisplayDate(selectedDate)}</Text>
            <Text style={styles.previewOpen}>열기 →</Text>
          </View>
          <Text style={styles.previewSummary}>
            일정 {preview.events.length}개 · 할일 {preview.tasks.length}개
          </Text>
        </Pressable>
      ) : null}
    </PlannerScreen>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  selectors: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  navBtn: {
    padding: Spacing.one,
  },
  selectorText: {
    color: theme.ink,
    fontFamily: PlannerSerif,
    fontSize: 20,
    fontWeight: '600',
  },
  statsBtn: {
    width: 36,
    height: 36,
    borderRadius: PlannerRadius.chip,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: {
    backgroundColor: theme.accentSoft,
    borderRadius: PlannerRadius.block,
  },
  previewCard: {
    backgroundColor: theme.card,
    borderRadius: PlannerRadius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.line,
    padding: Spacing.three,
    marginTop: Spacing.three,
    gap: Spacing.one,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewDate: { color: theme.ink, fontSize: 15, fontWeight: '700' },
  previewOpen: { color: theme.accent, fontSize: 13, fontWeight: '600' },
  previewSummary: { color: theme.faint, fontSize: 13 },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { color: theme.textSecondary, fontSize: 11 },
  calendarCard: {
    padding: Spacing.two,
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.two,
  },
  weekdayText: {
    flexBasis: `${100 / 7}%`,
    textAlign: 'center',
    color: theme.faint,
    fontSize: 12,
    fontWeight: '700',
  },
  sunText: {
    color: theme.red,
  },
  satText: {
    color: theme.blue,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    flexBasis: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  cellPressed: {
    opacity: 0.6,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  outOfMonth: {
    opacity: 0.45,
  },
  todayBadge: {
    width: 26,
    height: 26,
    borderRadius: PlannerRadius.chip,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayText: {
    color: theme.onAccent,
    fontSize: 14,
    fontWeight: '700',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 3,
    height: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: PlannerRadius.chip,
  },
});
