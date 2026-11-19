import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { withAlpha } from '@/components/planner/mini-grid';
import { PlannerCard } from '@/components/planner/planner-card';
import { PlannerScreen } from '@/components/planner/planner-screen';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { todayKey } from '@/lib/date';
import { requestViewDate } from '@/lib/navigation';
import * as pomodoro from '@/lib/pomodoro';
import { loadTasks, type Task } from '@/lib/tasks';
import {
  achievementRate,
  actualByCategory,
  cellLabel,
  CELL_MIN,
  dateToCellIndex,
  FOCUS_CATEGORY,
  loadCategories,
  loadTimetable,
  plannedBlocks,
  totalActualMin,
  totalPlannedMin,
  type Category,
  type DayTimetable,
  type SubjectId,
} from '@/lib/timetable';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type DayCell = { day: number; inMonth: boolean; dateKey?: string };

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function buildMonthGrid(year: number, month: number): DayCell[] {
  const cells: DayCell[] = [];
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  for (let i = 0; i < firstWeekday; i++)
    cells.push({ day: prevMonthDays - firstWeekday + 1 + i, inMonth: false });
  for (let day = 1; day <= daysInMonth; day++)
    cells.push({ day, inMonth: true, dateKey: `${year}-${pad(month)}-${pad(day)}` });
  // 마지막 주까지만 채운다 (6주 고정 X)
  let next = 1;
  while (cells.length % 7) cells.push({ day: next++, inMonth: false });
  return cells;
}

/** 하루 집중률 — 계획 대비 달성률, 계획 없이 집중만 했으면 꽉 찬 막대 */
function dayRate(d: DayTimetable): number {
  if (totalPlannedMin(d)) return achievementRate(d);
  return totalActualMin(d) ? 1 : 0;
}

function fmtTotal(min: number): string {
  return `${Math.floor(min / 60)}H ${pad(min % 60)}M`;
}

/** 잔디 농도 단계: 0 / ~1시간 / ~2시간 / ~4시간 / 4시간+ */
const HEAT_ALPHA = [0, 0.3, 0.5, 0.75, 1];
function heatLevel(min: number): number {
  if (!min) return 0;
  if (min < 60) return 1;
  if (min < 120) return 2;
  if (min < 240) return 3;
  return 4;
}

export default function MonthlyScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const timer = useSyncExternalStore(pomodoro.subscribe, pomodoro.getState, pomodoro.getState);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<Record<string, DayTimetable>>({});
  const [cats, setCats] = useState<Category[]>([FOCUS_CATEGORY]);
  const today = todayKey();
  const [selected, setSelected] = useState(today);
  const [tasks, setTasks] = useState<Task[]>([]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  // 탭에 돌아올 때마다 다시 읽는다 (오늘 화면에서 칠한 계획/집중 반영)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const keys = grid.filter((c) => c.dateKey).map((c) => c.dateKey!);
      void Promise.all(keys.map(loadTimetable)).then((list) => {
        if (!cancelled) setDays(Object.fromEntries(keys.map((k, i) => [k, list[i]])));
      });
      void loadCategories().then((c) => !cancelled && setCats(c));
      return () => {
        cancelled = true;
      };
    }, [grid]),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadTasks(selected).then((t) => !cancelled && setTasks(t));
      return () => {
        cancelled = true;
      };
    }, [selected]),
  );

  const catMap = useMemo(
    () => Object.fromEntries(cats.map((c) => [c.id, c])) as Record<SubjectId, Category>,
    [cats],
  );

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  }

  function openDay(dateKey: string) {
    requestViewDate(dateKey);
    router.navigate('/');
  }

  // 잔디밭: 이 달 일별 실제 집중 분
  const heat = grid.map((c) => (c.dateKey && days[c.dateKey] ? totalActualMin(days[c.dateKey]) : 0));
  const weeks = Array.from({ length: grid.length / 7 }, (_, w) => w);
  const monthMin = heat.reduce((a, b) => a + b, 0);
  const focusDays = heat.filter(Boolean).length;
  const bestMin = Math.max(0, ...heat);
  const heatColor = (lv: number) => (lv ? withAlpha(theme.green, HEAT_ALPHA[lv]) : theme.surface);

  const sel = days[selected];
  const selDate = new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)) - 1, Number(selected.slice(8)));
  const blocks = sel ? plannedBlocks(sel) : [];
  const nowIdx = selected === today ? dateToCellIndex(now) : -1;

  // 과목별 막대: 계획(연한 색) 위에 실제(진한 색)
  const stripe = (() => {
    if (!sel) return [];
    const actual = actualByCategory(sel);
    const planned: Record<SubjectId, number> = {};
    for (const c of sel.cells) if (c.planned) planned[c.planned] = (planned[c.planned] ?? 0) + CELL_MIN;
    const ids = Array.from(new Set([...Object.keys(planned), ...Object.keys(actual)]));
    return ids.map((id) => {
      const total = Math.max(planned[id] ?? 0, actual[id] ?? 0);
      return { id, total, ratio: (actual[id] ?? 0) / total };
    });
  })();

  return (
    <PlannerScreen>
      <View style={styles.headerRow}>
        <View style={styles.selectors}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.ink} />
          </Pressable>
          <Text style={styles.selectorText}>
            {year}년 {month}월
          </Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={theme.ink} />
          </Pressable>
        </View>
        <Pressable
          style={styles.statsBtn}
          hitSlop={8}
          onPress={() => router.push('/stats' as never)}
          accessibilityLabel="통계">
          <Ionicons name="bar-chart-outline" size={18} color={theme.ink} />
        </Pressable>
      </View>

      <PlannerCard style={styles.heatCard}>
        <View style={styles.heatBody}>
          <View style={styles.heatGrid}>
            <View style={styles.heatCol}>
              {WEEKDAYS.map((w, i) => (
                <Text key={w} style={styles.heatWeekday}>
                  {i % 2 ? w : ''}
                </Text>
              ))}
            </View>
            {weeks.map((w) => (
              <View key={w} style={styles.heatCol}>
                {grid.slice(w * 7, w * 7 + 7).map((cell, d) => {
                  const min = heat[w * 7 + d];
                  return cell.dateKey ? (
                    <Pressable
                      key={d}
                      onPress={() => openDay(cell.dateKey!)}
                      hitSlop={2}
                      accessibilityLabel={`${month}월 ${cell.day}일 집중 ${fmtTotal(min)}`}
                      style={[
                        styles.heatSq,
                        { backgroundColor: heatColor(heatLevel(min)) },
                        cell.dateKey === today && styles.heatToday,
                      ]}
                    />
                  ) : (
                    <View key={d} style={[styles.heatSq, styles.heatEmpty]} />
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.heatSummary}>
            <Text style={styles.heatLabel}>이번 달 집중</Text>
            <Text style={styles.heatTotal}>{fmtTotal(monthMin)}</Text>
            <Text style={styles.heatSub}>집중한 날 {focusDays}일</Text>
            {bestMin ? <Text style={styles.heatSub}>최고 {fmtTotal(bestMin)}</Text> : null}
          </View>
        </View>
        <View style={styles.heatLegend}>
          <Text style={styles.legendText}>적게</Text>
          {HEAT_ALPHA.map((_, lv) => (
            <View key={lv} style={[styles.heatLegendSq, { backgroundColor: heatColor(lv) }]} />
          ))}
          <Text style={styles.legendText}>많이</Text>
        </View>
      </PlannerCard>

      <PlannerCard style={styles.calendarCard}>
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((label, i) => (
            <Text
              key={label}
              style={[styles.weekdayText, i === 0 && styles.sunText, i === 6 && styles.satText]}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {grid.map((cell, i) => {
            const col = i % 7;
            const isToday = cell.dateKey === today;
            const color = !cell.inMonth
              ? theme.textTertiary
              : col === 0
                ? theme.red
                : col === 6
                  ? theme.blue
                  : theme.ink;
            const d = cell.dateKey ? days[cell.dateKey] : undefined;
            const hasActual = d ? totalActualMin(d) > 0 : false;
            const hasPlan = d ? totalPlannedMin(d) > 0 : false;
            return (
              <Pressable
                key={i}
                disabled={!cell.dateKey}
                style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
                onPress={() =>
                  cell.dateKey === selected ? openDay(selected) : setSelected(cell.dateKey!)
                }>
                <View
                  style={[
                    styles.dayBadge,
                    isToday && styles.todayBadge,
                    !isToday && cell.dateKey === selected && styles.selectedBadge,
                  ]}>
                  <Text style={[styles.dayText, { color: isToday ? theme.onAccent : color }]}>
                    {cell.day}
                  </Text>
                </View>
                {hasActual ? (
                  <View style={styles.rateTrack}>
                    <View style={[styles.rateFill, { width: `${dayRate(d!) * 100}%` }]} />
                  </View>
                ) : hasPlan ? (
                  <View style={styles.planDot} />
                ) : (
                  <View style={styles.markerSpace} />
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={styles.rateTrack}>
              <View style={[styles.rateFill, { width: '70%' }]} />
            </View>
            <Text style={styles.legendText}>하루 집중률</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.planDot} />
            <Text style={styles.legendText}>계획 있음</Text>
          </View>
        </View>
      </PlannerCard>

      {sel ? (
        <PlannerCard style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewDate}>
              {selDate.getMonth() + 1}월 {selDate.getDate()}일 {WEEKDAYS[selDate.getDay()]}요일
            </Text>
            {selected === today ? (
              <View style={styles.todayChip}>
                <Text style={styles.todayChipText}>오늘</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.previewSummary}>
            TOTAL {fmtTotal(totalActualMin(sel))}
            {totalPlannedMin(sel) ? ` · 달성 ${Math.round(achievementRate(sel) * 100)}%` : ''}
            {tasks.length ? ` · 할 일 ${tasks.filter((t) => t.done).length}/${tasks.length}` : ''}
          </Text>

          {stripe.length ? (
            <View style={styles.stripe}>
              {stripe.map((s) => {
                const c = catMap[s.id]?.color ?? FOCUS_CATEGORY.color;
                return (
                  <View
                    key={s.id}
                    style={[styles.stripeSeg, { flex: s.total, backgroundColor: withAlpha(c, 0.25) }]}>
                    <View style={{ width: `${s.ratio * 100}%`, backgroundColor: c }} />
                  </View>
                );
              })}
            </View>
          ) : null}

          {blocks.map((b) => {
            const cat = catMap[b.subject] ?? FOCUS_CATEGORY;
            const focusing =
              timer.status === 'running' &&
              timer.phase === 'focus' &&
              timer.focusSubject === b.subject &&
              nowIdx >= b.start &&
              nowIdx <= b.end;
            return (
              <View key={b.start} style={styles.blockRow}>
                <View style={[styles.blockDot, { backgroundColor: cat.color }]} />
                <Text style={styles.blockName} numberOfLines={1}>
                  {cat.name}
                </Text>
                <Text style={styles.blockTime}>
                  {cellLabel(b.start)} – {cellLabel(b.end + 1)}
                </Text>
                {focusing ? (
                  <View style={styles.focusChip}>
                    <Text style={styles.focusChipText}>집중 중</Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          <Pressable style={styles.openBtn} onPress={() => openDay(selected)}>
            <Text style={styles.openBtnText}>이 날짜 열기</Text>
          </Pressable>
        </PlannerCard>
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
    selectors: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    navBtn: { padding: Spacing.one },
    selectorText: { ...PlannerType.display, fontSize: 26, color: theme.ink },
    statsBtn: {
      width: 40,
      height: 40,
      borderRadius: PlannerRadius.chip,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heatCard: { padding: Spacing.three, gap: Spacing.two },
    heatBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    heatGrid: { flexDirection: 'row', gap: 4 },
    heatCol: { gap: 4 },
    heatWeekday: {
      ...PlannerType.caption,
      fontSize: 10,
      lineHeight: 20,
      height: 20,
      color: theme.textTertiary,
      marginRight: 2,
    },
    heatSq: { width: 20, height: 20, borderRadius: 5 },
    heatEmpty: { backgroundColor: 'transparent' },
    heatToday: { borderWidth: 1.5, borderColor: theme.ink },
    heatSummary: { flex: 1, gap: 2 },
    heatLabel: { ...PlannerType.caption, color: theme.textSecondary },
    heatTotal: { ...PlannerType.titleM, fontSize: 22, color: theme.ink },
    heatSub: { ...PlannerType.caption, color: theme.textSecondary },
    heatLegend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
    heatLegendSq: { width: 12, height: 12, borderRadius: 3 },
    calendarCard: { padding: Spacing.three },
    weekdayRow: { flexDirection: 'row', paddingBottom: Spacing.two },
    weekdayText: {
      flexBasis: `${100 / 7}%`,
      textAlign: 'center',
      ...PlannerType.labelStrong,
      color: theme.textSecondary,
    },
    sunText: { color: theme.red },
    satText: { color: theme.blue },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { flexBasis: `${100 / 7}%`, alignItems: 'center', paddingVertical: 5, gap: 4 },
    cellPressed: { opacity: 0.6 },
    dayBadge: {
      width: 30,
      height: 30,
      borderRadius: PlannerRadius.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    todayBadge: { backgroundColor: theme.accent },
    selectedBadge: { backgroundColor: theme.surface },
    dayText: { ...PlannerType.bodyMedium, fontSize: 15 },
    rateTrack: {
      width: 20,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.line,
      overflow: 'hidden',
    },
    rateFill: { height: '100%', backgroundColor: theme.ink },
    planDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.textTertiary },
    markerSpace: { height: 4 },
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.four,
      paddingTop: Spacing.three,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendText: { ...PlannerType.caption, color: theme.textSecondary },
    previewCard: { gap: Spacing.two + 2 },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    previewDate: { ...PlannerType.titleM, color: theme.ink },
    todayChip: {
      backgroundColor: theme.blueSoft,
      borderRadius: PlannerRadius.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    todayChipText: { ...PlannerType.labelStrong, fontSize: 12, color: theme.blue },
    previewSummary: { ...PlannerType.caption, color: theme.textSecondary, marginTop: -6 },
    stripe: { flexDirection: 'row', gap: 3, height: 8 },
    stripeSeg: { flexDirection: 'row', borderRadius: 2, overflow: 'hidden' },
    blockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    blockDot: { width: 10, height: 10, borderRadius: 5 },
    blockName: { ...PlannerType.bodyMedium, color: theme.ink, flex: 1 },
    blockTime: { ...PlannerType.caption, color: theme.textSecondary },
    focusChip: {
      backgroundColor: theme.redSoft,
      borderRadius: PlannerRadius.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    focusChipText: { ...PlannerType.labelStrong, fontSize: 12, color: theme.red },
    openBtn: {
      marginTop: Spacing.one,
      backgroundColor: theme.accent,
      borderRadius: PlannerRadius.md,
      paddingVertical: 14,
      alignItems: 'center',
    },
    openBtnText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
  });
