import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { withAlpha } from '@/components/planner/mini-grid';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerShadow, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { addDays, formatDisplayDate, weekKeys } from '@/lib/date';
import { getDDayCount, loadDDayPlan, loadDDays, saveDDayPlan, type DDay } from '@/lib/dday';
import {
  actualByCategory,
  CELL_COUNT,
  CELL_MIN,
  COLS,
  dateToCellIndex,
  FOCUS_CATEGORY,
  loadCategories,
  loadTimetable,
  timetableDateKey,
  totalActualMin,
  updateTimetable,
  type Category,
  type SubjectId,
} from '@/lib/timetable';

/** 자동 칠하기는 09:00 칸부터 */
const FILL_FROM = 3 * COLS;

function fmtHM(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}시간${m ? ` ${m}분` : ''}` : `${m}분`;
}
function daysBetween(a: string, b: string) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86_400_000);
}

type Stats = {
  filledMin: number;
  avg7: number;
  /** 최근 28일 과목별 실제 분 — 하루 배분 비율로 씀 */
  mix: Record<SubjectId, number>;
  weeks: { label: string; min: number }[];
};

async function loadStats(startDate: string, today: string): Promise<Stats> {
  const span = Math.max(0, daysBetween(startDate, today));
  const sinceStart = Array.from({ length: span + 1 }, (_, i) => addDays(startDate, i));
  const recent = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27));
  const lastWeek = weekKeys(addDays(today, -7));
  const thisWeek = weekKeys(today);
  const [a, b, c, d] = await Promise.all(
    [sinceStart, recent, lastWeek, thisWeek].map((keys) => Promise.all(keys.map(loadTimetable))),
  );
  const mix: Record<SubjectId, number> = {};
  for (const day of b)
    for (const [id, m] of Object.entries(actualByCategory(day))) mix[id] = (mix[id] ?? 0) + m;
  const sum = (days: typeof a) => days.reduce((n, x) => n + totalActualMin(x), 0);
  return {
    filledMin: sum(a),
    avg7: sum(b.slice(21)) / 7,
    mix,
    weeks: [
      { label: '지난주', min: sum(c) },
      { label: '이번 주', min: sum(d) },
    ],
  };
}

/** I7 — D-Day 역산 계획 */
export default function DDayPlanScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = timetableDateKey();
  const [dday, setDday] = useState<DDay | null>(null);
  const [target, setTarget] = useState(100);
  const [startDate, setStartDate] = useState(today);
  const [stats, setStats] = useState<Stats | null>(null);
  const [cats, setCats] = useState<Category[]>([FOCUS_CATEGORY]);

  useEffect(() => {
    void loadDDays().then((l) => setDday(l.find((d) => d.id === id) ?? null));
    void loadCategories().then(setCats);
    void loadDDayPlan(id).then((p) => {
      const start = p?.startDate ?? timetableDateKey();
      if (p) setTarget(p.targetHours);
      // 처음 열면 오늘부터 집계 시작
      else void saveDDayPlan(id, { targetHours: 100, startDate: start });
      setStartDate(start);
      void loadStats(start, timetableDateKey()).then(setStats);
    });
  }, [id]);

  const catMap = useMemo(
    () => Object.fromEntries(cats.map((c) => [c.id, c])) as Record<SubjectId, Category>,
    [cats],
  );

  function changeTarget(h: number) {
    const next = Math.max(10, h);
    setTarget(next);
    void saveDDayPlan(id, { targetHours: next, startDate });
  }

  if (!dday) return <SafeAreaView style={styles.root} />;

  const daysLeft = Math.max(1, daysBetween(today, dday.date));
  const filled = stats?.filledMin ?? 0;
  const remain = Math.max(0, target * 60 - filled);
  const perDay = remain / daysLeft;
  const behind = stats ? stats.avg7 < perDay : false;
  const mixTotal = Object.values(stats?.mix ?? {}).reduce((a, b) => a + b, 0);
  const mix = Object.entries(stats?.mix ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([sid, m]) => ({ sid, share: m / mixTotal }));
  const weekNeed = perDay * 7;
  const weeks = [...(stats?.weeks ?? []), { label: '다음 주', min: 0 }, { label: '시험 주', min: 0 }];

  // 이번 주 남은 날들의 빈 칸을 하루 필요량만큼 과목 비율대로 칠한다
  async function fillThisWeek() {
    const subjects = mix.length ? mix : [{ sid: FOCUS_CATEGORY.id, share: 1 }];
    const days = weekKeys(today).filter((k) => k >= today && k <= dday!.date);
    const need = Math.ceil(perDay / CELL_MIN);
    for (const k of days) {
      const from = k === today ? Math.max(FILL_FROM, dateToCellIndex(new Date()) + 1) : FILL_FROM;
      await updateTimetable(k, (d) => {
        // 과목별 칸 수 (비율대로, 반올림 오차는 첫 과목에)
        const quota = subjects.map((s) => Math.floor(need * s.share));
        quota[0] += need - quota.reduce((a, b) => a + b, 0);
        const cells = d.cells.slice();
        let q = 0;
        for (let i = from; i < CELL_COUNT && q < quota.length; i++) {
          if (cells[i].planned || cells[i].actual) continue;
          while (q < quota.length && quota[q] === 0) q++;
          if (q >= quota.length) break;
          cells[i] = { ...cells[i], planned: subjects[q].sid };
          quota[q]--;
        }
        return { ...d, cells };
      });
    }
    Alert.alert('계획 칠하기', `이번 주 ${days.length}일에 하루 ${fmtHM(need * CELL_MIN)}씩 칠했어요.`, [
      { text: '확인', onPress: () => router.back() },
    ]);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={theme.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>D-Day 계획</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, styles.row]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{dday.title}</Text>
            <Text style={styles.caption}>{formatDisplayDate(dday.date)}</Text>
          </View>
          <Text style={styles.ddayText}>{getDDayCount(dday.date)}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={[styles.label, { flex: 1 }]}>목표 총 시간</Text>
            <Pressable style={styles.stepBtn} onPress={() => changeTarget(target - 10)}>
              <Ionicons name="remove" size={16} color={theme.ink} />
            </Pressable>
            <Text style={styles.label}>{target}시간</Text>
            <Pressable style={styles.stepBtn} onPress={() => changeTarget(target + 10)}>
              <Ionicons name="add" size={16} color={theme.ink} />
            </Pressable>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={[styles.label, { flex: 1 }]}>지금까지 채운 시간</Text>
            <Text style={styles.label}>{Math.floor(filled / 60)}시간</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, (filled / (target * 60)) * 100)}%` }]} />
          </View>
          <Text style={styles.caption}>{formatDisplayDate(startDate)}부터 채운 실제 칸 기준</Text>
        </View>

        <View style={[styles.card, styles.perDay]}>
          <Text style={styles.caption}>하루에</Text>
          <Text style={styles.big}>{fmtHM(perDay)}</Text>
          <Text style={styles.caption}>
            남은 {Math.round(remain / 60)}시간 ÷ {daysLeft}일
          </Text>
        </View>

        {behind ? (
          <View style={styles.warn}>
            <Ionicons name="warning-outline" size={16} color={theme.amber} />
            <Text style={[styles.caption, { color: theme.amber, flex: 1 }]}>
              최근 7일 평균은 {fmtHM(stats!.avg7)}예요. 이대로면 {Math.round((perDay - stats!.avg7) * daysLeft / 60)}
              시간이 부족해요.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>과목별 하루 배분</Text>
          {mix.length === 0 ? (
            <Text style={styles.caption}>최근 기록이 없어 과목 구분 없이 칠해요.</Text>
          ) : null}
          {mix.map(({ sid, share }) => {
            const cat = catMap[sid] ?? FOCUS_CATEGORY;
            return (
              <View key={sid} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: cat.color }]} />
                <Text style={[styles.label, { width: 48 }]}>{cat.name}</Text>
                <View style={[styles.mixTrack, { backgroundColor: withAlpha(cat.color, 0.18) }]}>
                  <View style={{ width: `${share * 100}%`, backgroundColor: cat.color }} />
                </View>
                <Text style={[styles.caption, { width: 72, textAlign: 'right' }]}>
                  {fmtHM(perDay * share)}
                </Text>
              </View>
            );
          })}
          <Text style={styles.caption}>비율은 최근 4주 실제 집중 기준이에요.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={[styles.cardTitle, { flex: 1 }]}>주간 페이스</Text>
            <Text style={styles.caption}>필요 {Math.round((weekNeed / 60) * 10) / 10}시간/주</Text>
          </View>
          <View style={styles.paceRow}>
            {weeks.map((w) => (
              <View key={w.label} style={styles.paceCol}>
                <View style={styles.paceBar}>
                  <View
                    style={[
                      styles.paceFill,
                      { height: `${weekNeed ? Math.min(100, (w.min / weekNeed) * 100) : 0}%` },
                    ]}
                  />
                </View>
                <Text style={styles.caption}>{w.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable style={styles.primaryBtn} onPress={() => void fillThisWeek()}>
          <Text style={styles.primaryText}>이 페이스로 이번 주 계획 칠하기</Text>
        </Pressable>
        <Text style={[styles.caption, { textAlign: 'center' }]}>
          빈 칸에만 칠하고, 이미 있는 계획은 비켜요. (09시부터)
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    headerTitle: { ...PlannerType.titleM, color: theme.ink },
    content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
    card: {
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.card,
      padding: Spacing.three,
      gap: 12,
      ...PlannerShadow,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { ...PlannerType.titleM, color: theme.ink },
    cardTitle: { ...PlannerType.titleS, color: theme.ink },
    ddayText: { ...PlannerType.display, color: theme.ink },
    caption: { ...PlannerType.caption, color: theme.textSecondary },
    label: { ...PlannerType.labelStrong, color: theme.ink },
    big: { ...PlannerType.display, color: theme.ink },
    divider: { height: 1, backgroundColor: theme.line },
    stepBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    track: { height: 8, borderRadius: 4, backgroundColor: theme.surface, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: theme.ink },
    perDay: { alignItems: 'center', gap: 4, backgroundColor: theme.surface },
    warn: {
      flexDirection: 'row',
      gap: 8,
      padding: 12,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.amberSoft,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    mixTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' },
    paceRow: { flexDirection: 'row', justifyContent: 'space-around', height: 120 },
    paceCol: { alignItems: 'center', gap: 6 },
    paceBar: {
      flex: 1,
      width: 36,
      borderRadius: 8,
      backgroundColor: theme.surface,
      overflow: 'hidden',
      justifyContent: 'flex-end',
    },
    paceFill: { backgroundColor: theme.ink },
    primaryBtn: {
      paddingVertical: 16,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.accent,
      alignItems: 'center',
    },
    primaryText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
  });
