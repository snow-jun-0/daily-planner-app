import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CircularProgress } from '@/components/planner/circular-progress';
import { withAlpha } from '@/components/planner/mini-grid';
import { SubHeader } from '@/components/planner/settings-ui';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerShadow, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { usePrefs } from '@/hooks/use-prefs';
import { addDays } from '@/lib/date';
import { loadStreak, loadTimetable, timetableDateKey, totalActualMin } from '@/lib/timetable';

const WEEK_MON = ['월', '화', '수', '목', '금', '토', '일'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function fmtTotal(min: number) {
  return `${Math.floor(min / 60)}H ${pad(min % 60)}M`;
}
/** 월요일=0 */
function weekdayMon(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

type Data = {
  streak: number;
  longest: number;
  /** 최근 1년 날짜별 실제 분 */
  minutes: Record<string, number>;
};

async function loadData(today: string): Promise<Data> {
  const keys = Array.from({ length: 365 }, (_, i) => addDays(today, i - 364));
  const days = await Promise.all(keys.map(loadTimetable));
  const minutes = Object.fromEntries(keys.map((k, i) => [k, totalActualMin(days[i])]));
  let longest = 0;
  let run = 0;
  for (const k of keys) {
    run = minutes[k] ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { streak: await loadStreak(today), longest, minutes };
}

/** I1 — 목표 · 연속 기록 */
export default function GoalsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [prefs, updatePrefs] = usePrefs();
  const today = timetableDateKey();
  const [data, setData] = useState<Data | null>(null);
  const [selDay, setSelDay] = useState(weekdayMon(today));

  useFocusEffect(
    useCallback(() => {
      void loadData(timetableDateKey()).then(setData);
    }, []),
  );

  const goalMin = (key: string) => (prefs.goalHours[weekdayMon(key)] ?? 0) * 60;
  const todayMin = data?.minutes[today] ?? 0;
  const pct = goalMin(today) ? Math.round((todayMin / goalMin(today)) * 100) : 0;
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const hitThisWeek = last7.filter((k) => goalMin(k) && (data?.minutes[k] ?? 0) >= goalMin(k)).length;

  const setGoal = (d: number, h: number) =>
    updatePrefs({ goalHours: prefs.goalHours.map((v, i) => (i === d ? h : v)) });

  // 이번 달 달력 (월요일 시작)
  const [y, m] = today.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const first = `${y}-${pad(m)}-01`;
  const monthCells: (string | null)[] = [
    ...Array<null>(weekdayMon(first)).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`),
  ];
  const shade = (k: string) => {
    const g = goalMin(k);
    const v = data?.minutes[k] ?? 0;
    if (k > today || !v) return theme.surface;
    return withAlpha(theme.ink, 0.25 + 0.75 * Math.min(1, g ? v / g : 1));
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SubHeader title="목표 · 연속 기록" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.todayRow}>
            <CircularProgress percent={pct} size={104} strokeWidth={12}>
              <Text style={styles.pct}>{pct}%</Text>
            </CircularProgress>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.caption}>오늘 목표</Text>
              <Text style={styles.big}>
                {fmtTotal(todayMin)} / {prefs.goalHours[weekdayMon(today)]}H
              </Text>
              <Text style={styles.caption}>
                {todayMin >= goalMin(today)
                  ? '오늘 목표 달성!'
                  : `${Math.floor((goalMin(today) - todayMin) / 60)}시간 ${(goalMin(today) - todayMin) % 60}분 남았어요`}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.goalRow}>
            <Text style={styles.label}>하루 목표</Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepBtn}
                onPress={() => setGoal(selDay, Math.max(0, prefs.goalHours[selDay] - 1))}>
                <Ionicons name="remove" size={18} color={theme.ink} />
              </Pressable>
              <Text style={styles.label}>{prefs.goalHours[selDay]}시간</Text>
              <Pressable
                style={styles.stepBtn}
                onPress={() => setGoal(selDay, Math.min(16, prefs.goalHours[selDay] + 1))}>
                <Ionicons name="add" size={18} color={theme.ink} />
              </Pressable>
            </View>
          </View>
          <View style={styles.dayChips}>
            {WEEK_MON.map((d, i) => {
              const on = i === selDay;
              return (
                <Pressable
                  key={d}
                  onPress={() => setSelDay(i)}
                  style={[styles.dayChip, on && styles.dayChipOn]}>
                  <Text style={[styles.dayChipText, on && styles.dayChipTextOn]}>{d}</Text>
                  <Text style={[styles.dayChipNum, on && styles.dayChipTextOn]}>
                    {prefs.goalHours[i]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.caption}>요일마다 목표를 다르게 둘 수 있어요.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.streakHead}>
            <View>
              <Text style={styles.caption}>연속 기록</Text>
              <Text style={styles.big}>{data?.streak ?? 0}일</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>목표 달성 {hitThisWeek}일</Text>
              </View>
              <Text style={styles.caption}>최장 {data?.longest ?? 0}일</Text>
            </View>
          </View>
          <View style={styles.weekRow}>
            {last7.map((k) => {
              const v = data?.minutes[k] ?? 0;
              const isToday = k === today;
              return (
                <View key={k} style={styles.weekCol}>
                  <View
                    style={[
                      styles.circle,
                      v > 0 && !isToday ? styles.circleOn : null,
                      isToday && styles.circleToday,
                    ]}>
                    {isToday ? (
                      <Text style={styles.circleText}>{pct}</Text>
                    ) : v ? (
                      <Ionicons name="checkmark" size={16} color={theme.onAccent} />
                    ) : null}
                  </View>
                  <Text style={[styles.caption, isToday && styles.label]}>
                    {WEEK_MON[weekdayMon(k)]}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.caption}>
            하루 1칸(10분) 이상 채우면 기록이 이어져요. 오늘은 {pct}% 진행 중.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.streakHead}>
            <Text style={styles.big}>{m}월</Text>
            <Text style={styles.caption}>진할수록 목표에 가까운 날</Text>
          </View>
          <View style={styles.calRow}>
            {WEEK_MON.map((d) => (
              <Text key={d} style={[styles.caption, styles.calHead]}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.calGrid}>
            {monthCells.map((k, i) => (
              <View key={i} style={styles.calCellWrap}>
                {k ? <View style={[styles.calCell, { backgroundColor: shade(k) }]} /> : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper },
    content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
    card: {
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.card,
      padding: Spacing.three,
      gap: 12,
      ...PlannerShadow,
    },
    caption: { ...PlannerType.caption, color: theme.textSecondary },
    label: { ...PlannerType.labelStrong, color: theme.ink },
    big: { ...PlannerType.display, fontSize: 26, lineHeight: 34, color: theme.ink },
    pct: { ...PlannerType.titleM, color: theme.ink },
    todayRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    divider: { height: 1, backgroundColor: theme.line },
    goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    stepBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayChips: { flexDirection: 'row', gap: 6 },
    dayChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: PlannerRadius.sm,
      backgroundColor: theme.surface,
    },
    dayChipOn: { backgroundColor: theme.accent },
    dayChipText: { ...PlannerType.caption, color: theme.textSecondary },
    dayChipNum: { ...PlannerType.labelStrong, color: theme.ink },
    dayChipTextOn: { color: theme.onAccent },
    streakHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    badge: {
      backgroundColor: theme.amberSoft,
      borderRadius: PlannerRadius.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeText: { ...PlannerType.labelStrong, fontSize: 12, color: theme.amber },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
    weekCol: { alignItems: 'center', gap: 6 },
    circle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleOn: { backgroundColor: theme.accent },
    circleToday: { borderWidth: 2, borderColor: theme.ink, backgroundColor: theme.card },
    circleText: { ...PlannerType.labelStrong, fontSize: 12, color: theme.ink },
    calRow: { flexDirection: 'row' },
    calHead: { flex: 1, textAlign: 'center' },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCellWrap: { width: `${100 / 7}%`, padding: 3 },
    calCell: { height: 26, borderRadius: 4 },
  });
