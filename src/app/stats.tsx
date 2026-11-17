import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CircularProgress } from '@/components/planner/circular-progress';
import { withAlpha } from '@/components/planner/mini-grid';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerShadow, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { addDays, todayKey } from '@/lib/date';
import { loadMonthFocusStats } from '@/lib/stats';
import {
  CELL_MIN,
  COLS,
  FOCUS_CATEGORY,
  loadCategories,
  loadStreak,
  loadTimetable,
  ROWS,
  START_HOUR,
  timetableDateKey,
  type Category,
  type DayTimetable,
  type SubjectId,
} from '@/lib/timetable';

const WEEK_MON = ['월', '화', '수', '목', '금', '토', '일'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function fmtTotal(min: number) {
  return `${Math.floor(min / 60)}H ${pad(min % 60)}M`;
}
function fmtHM(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}시간 ${m ? `${m}분` : ''}`.trim() : `${m}분`;
}
function hours(min: number) {
  return Math.round((min / 60) * 10) / 10;
}
function monthKeys(y: number, m0: number): string[] {
  const n = new Date(y, m0 + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${y}-${pad(m0 + 1)}-${pad(i + 1)}`);
}
/** 월요일=0 */
function weekdayMon(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** 칸 단위 집계 (분) */
function aggregate(days: DayTimetable[]) {
  const a = {
    actual: 0,
    planned: 0,
    hit: 0, // 계획대로 채움
    missed: 0, // 못 채운 계획
    outside: 0, // 계획 밖 집중
    actualBy: {} as Record<SubjectId, number>,
    plannedBy: {} as Record<SubjectId, number>,
  };
  for (const d of days) {
    a.actual += (d.overflowMin ?? 0);
    for (const c of d.cells) {
      if (c.actual) {
        a.actual += CELL_MIN;
        a.actualBy[c.actual] = (a.actualBy[c.actual] ?? 0) + CELL_MIN;
      }
      if (c.planned) {
        a.planned += CELL_MIN;
        a.plannedBy[c.planned] = (a.plannedBy[c.planned] ?? 0) + CELL_MIN;
      }
      if (c.planned && c.actual) a.hit += CELL_MIN;
      else if (c.planned) a.missed += CELL_MIN;
      else if (c.actual) a.outside += CELL_MIN;
    }
  }
  return a;
}
type Agg = ReturnType<typeof aggregate>;
const rateOf = (a: Agg) => (a.planned ? Math.round((a.hit / a.planned) * 100) : 0);

type Data = {
  month: Agg;
  prevRate: number | null;
  days: number;
  streak: number;
  overrunMin: number;
  /** [요일][시간행] 실제 칸 수 (최근 4주) */
  heat: number[][];
  last7: { key: string; planned: number; actual: number; hit: number }[];
};

async function loadData(y: number, m0: number): Promise<Data> {
  const keys = monthKeys(y, m0);
  const prev = new Date(y, m0 - 1, 1);
  const prevKeys = monthKeys(prev.getFullYear(), prev.getMonth());
  const today = timetableDateKey();
  const recent = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27));

  const [monthDays, prevDays, recentDays, focus] = await Promise.all([
    Promise.all(keys.map(loadTimetable)),
    Promise.all(prevKeys.map(loadTimetable)),
    Promise.all(recent.map(loadTimetable)),
    loadMonthFocusStats(y, m0),
  ]);

  const streak = await loadStreak(today);

  const heat = Array.from({ length: 7 }, () => Array<number>(ROWS).fill(0));
  recentDays.forEach((d, i) => {
    const w = weekdayMon(recent[i]);
    d.cells.forEach((c, idx) => {
      if (c.actual) heat[w][Math.floor(idx / COLS)]++;
    });
  });

  const prevAgg = aggregate(prevDays);
  const isCurrent = keys.includes(todayKey());
  return {
    month: aggregate(monthDays),
    prevRate: prevAgg.planned ? rateOf(prevAgg) : null,
    days: isCurrent ? new Date().getDate() : keys.length,
    streak,
    overrunMin: Math.round(focus.totalOverrunSeconds / 60),
    heat,
    last7: recentDays.slice(21).map((d, i) => {
      const a = aggregate([d]);
      return { key: recent[21 + i], planned: a.planned, actual: a.actual, hit: a.hit };
    }),
  };
}

export default function StatsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [data, setData] = useState<Data | null>(null);
  const [cats, setCats] = useState<Category[]>([FOCUS_CATEGORY]);

  useEffect(() => {
    let alive = true;
    void loadData(ym.y, ym.m).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [ym]);
  useEffect(() => {
    void loadCategories().then(setCats);
  }, []);

  const shift = (delta: number) =>
    setYm((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const catMap = useMemo(
    () => Object.fromEntries(cats.map((c) => [c.id, c])) as Record<SubjectId, Category>,
    [cats],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={theme.ink} />
        </Pressable>
        <Text style={styles.title}>통계</Text>
      </View>

      <View style={styles.monthRow}>
        <Pressable onPress={() => shift(-1)} hitSlop={10}>
          <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {ym.y}년 {ym.m + 1}월
        </Text>
        <Pressable onPress={() => shift(1)} hitSlop={10}>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      {data ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Summary data={data} styles={styles} theme={theme} />
          <SubjectBars data={data} catMap={catMap} styles={styles} />
          <Heatmap heat={data.heat} styles={styles} theme={theme} />
          <Last7 rows={data.last7} styles={styles} theme={theme} />
          <PlanFill agg={data.month} styles={styles} theme={theme} />
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

type SP = { styles: ReturnType<typeof makeStyles>; theme: AppTheme };

function Summary({ data, styles, theme }: { data: Data } & SP) {
  const rate = rateOf(data.month);
  const diff = data.prevRate == null ? null : rate - data.prevRate;
  const cards = [
    {
      label: 'TOTAL TIME',
      value: fmtTotal(data.month.actual),
      sub: `하루 평균 ${fmtHM(Math.round(data.month.actual / Math.max(1, data.days)))}`,
    },
    {
      label: '계획 달성률',
      value: data.month.planned ? `${rate}%` : '-',
      sub: diff == null ? '계획한 칸 중 채운 칸' : `지난달보다 ${diff >= 0 ? '+' : ''}${diff}%`,
    },
    { label: '연속 기록', value: `${data.streak}일`, sub: '하루 1칸 이상 채운 날' },
    { label: '휴식 초과', value: `${data.overrunMin}분`, sub: '딴짓한 시간', danger: true },
  ];
  return (
    <View style={styles.statGrid}>
      {cards.map((c) => (
        <View key={c.label} style={[styles.card, styles.statCard]}>
          <Text style={styles.statLabel}>{c.label}</Text>
          <Text style={[styles.statValue, c.danger && { color: theme.red }]}>{c.value}</Text>
          <Text style={styles.caption}>{c.sub}</Text>
        </View>
      ))}
    </View>
  );
}

function SubjectBars({
  data,
  catMap,
  styles,
}: { data: Data; catMap: Record<SubjectId, Category> } & Omit<SP, 'theme'>) {
  const { actualBy, plannedBy } = data.month;
  const ids = Array.from(new Set([...Object.keys(plannedBy), ...Object.keys(actualBy)])).sort(
    (a, b) => (actualBy[b] ?? 0) - (actualBy[a] ?? 0),
  );
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>과목별 집중 시간</Text>
        <Text style={styles.caption}>실제 / 계획</Text>
      </View>
      {ids.length === 0 ? <Text style={styles.caption}>아직 기록이 없어요.</Text> : null}
      {ids.map((id) => {
        const cat = catMap[id] ?? FOCUS_CATEGORY;
        const a = actualBy[id] ?? 0;
        const p = plannedBy[id] ?? 0;
        return (
          <View key={id} style={styles.subjectRow}>
            <View style={[styles.dot, { backgroundColor: cat.color }]} />
            <Text style={styles.subjectName} numberOfLines={1}>
              {cat.name}
            </Text>
            <View style={[styles.track, { backgroundColor: withAlpha(cat.color, 0.18) }]}>
              <View
                style={{
                  width: `${Math.min(1, p ? a / p : 1) * 100}%`,
                  backgroundColor: cat.color,
                }}
              />
            </View>
            <Text style={styles.subjectVal}>
              {hours(a)} / {hours(p)}시간
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Heatmap({ heat, styles, theme }: { heat: number[][] } & SP) {
  const max = Math.max(1, ...heat.flat());
  let best = { w: 0, r: 0, v: 0 };
  heat.forEach((col, w) => col.forEach((v, r) => v > best.v && (best = { w, r, v })));
  const level = (v: number) => (v === 0 ? 0 : Math.ceil((v / max) * 4));
  const shade = (lv: number) => (lv === 0 ? theme.surface : withAlpha(theme.ink, 0.15 + lv * 0.2));
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>시간대별 집중 히트맵</Text>
        <Text style={styles.caption}>06 – 익일 02시</Text>
      </View>
      <Text style={styles.caption}>
        타임테이블의 실제(진한) 칸을 요일 × 시간으로 모았어요 · 최근 4주
      </Text>
      <View style={styles.heatRow}>
        <View style={styles.heatAxis} />
        {WEEK_MON.map((d, i) => (
          <Text
            key={d}
            style={[
              styles.heatHead,
              i === 5 && { color: theme.blue },
              i === 6 && { color: theme.red },
            ]}>
            {d}
          </Text>
        ))}
      </View>
      {Array.from({ length: ROWS }).map((_, r) => (
        <View key={r} style={styles.heatRow}>
          <Text style={[styles.heatAxis, styles.heatAxisText]}>
            {r % 3 === 0 ? pad((START_HOUR + r) % 24) : ''}
          </Text>
          {heat.map((col, w) => (
            <View key={w} style={[styles.heatCell, { backgroundColor: shade(level(col[r])) }]} />
          ))}
        </View>
      ))}
      <View style={styles.heatLegend}>
        <Text style={styles.caption}>적음</Text>
        {[0, 1, 2, 3, 4].map((lv) => (
          <View key={lv} style={[styles.heatLegendBox, { backgroundColor: shade(lv) }]} />
        ))}
        <Text style={styles.caption}>많음</Text>
      </View>
      {best.v > 0 ? (
        <View style={styles.insight}>
          <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
          <Text style={[styles.caption, { flex: 1 }]}>
            {WEEK_MON[best.w]}요일 {pad((START_HOUR + best.r) % 24)}시에 가장 잘 집중해요.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Last7({ rows, styles, theme }: { rows: Data['last7'] } & SP) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.planned, r.actual)));
  const today = timetableDateKey();
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>계획 대비 달성률</Text>
        <Text style={styles.caption}>최근 7일</Text>
      </View>
      <View style={styles.barRow}>
        {rows.map((r) => {
          const isToday = r.key === today;
          return (
            <View key={r.key} style={styles.barCol}>
              <Text style={[styles.caption, isToday && styles.strong]}>
                {r.planned ? `${Math.round((r.hit / r.planned) * 100)}%` : ''}
              </Text>
              <View style={styles.barArea}>
                <View
                  style={[
                    styles.bar,
                    { height: `${(r.planned / max) * 100}%`, backgroundColor: theme.line },
                  ]}
                />
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${(r.actual / max) * 100}%`,
                      backgroundColor: isToday ? theme.ink : theme.textSecondary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.caption, isToday && styles.strong]}>
                {WEEK_MON[weekdayMon(r.key)]}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legendRow}>
        <View style={[styles.legendBox, { backgroundColor: theme.ink }]} />
        <Text style={styles.caption}>실제(진한 칸)</Text>
        <View style={[styles.legendBox, { backgroundColor: theme.line }]} />
        <Text style={styles.caption}>계획(연한 칸)</Text>
      </View>
    </View>
  );
}

function PlanFill({ agg, styles, theme }: { agg: Agg } & SP) {
  const items = [
    { label: '계획대로 채움', min: agg.hit, color: theme.ink },
    { label: '못 채운 계획', min: agg.missed, color: theme.line },
    { label: '계획 밖 집중', min: agg.outside, color: theme.textTertiary },
  ];
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>계획한 칸은 얼마나 채웠나</Text>
        <Text style={styles.caption}>이번 달</Text>
      </View>
      <View style={styles.fillRow}>
        <CircularProgress percent={rateOf(agg)} size={84} strokeWidth={12}>
          <Text style={styles.strong}>{rateOf(agg)}%</Text>
        </CircularProgress>
        <View style={{ flex: 1, gap: 8 }}>
          {items.map((it) => (
            <View key={it.label} style={styles.fillItem}>
              <View style={[styles.dot, { backgroundColor: it.color }]} />
              <Text style={[styles.subjectName, { flex: 1 }]}>{it.label}</Text>
              <Text style={styles.strong}>{fmtTotal(it.min)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
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
    title: { ...PlannerType.titleM, color: theme.ink },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.four,
      paddingVertical: Spacing.two,
    },
    monthLabel: { ...PlannerType.labelStrong, fontSize: 16, color: theme.ink },
    content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
    card: {
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.card,
      padding: Spacing.three,
      gap: 10,
      ...PlannerShadow,
    },
    cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    cardTitle: { ...PlannerType.titleS, color: theme.ink },
    caption: { ...PlannerType.caption, color: theme.textSecondary },
    strong: { ...PlannerType.labelStrong, color: theme.ink },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
    statCard: { flexBasis: '45%', flexGrow: 1, gap: 2 },
    statLabel: { ...PlannerType.caption, fontWeight: '700', color: theme.textSecondary },
    statValue: { ...PlannerType.display, fontSize: 26, lineHeight: 32, color: theme.ink },
    subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    subjectName: { ...PlannerType.label, color: theme.ink, width: 44 },
    track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' },
    subjectVal: { ...PlannerType.caption, color: theme.textSecondary, width: 82, textAlign: 'right' },
    heatRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    heatAxis: { width: 22 },
    heatAxisText: { ...PlannerType.caption, fontSize: 10, color: theme.textTertiary },
    heatHead: { flex: 1, textAlign: 'center', ...PlannerType.caption, color: theme.textSecondary },
    heatCell: { flex: 1, height: 9, borderRadius: 2 },
    heatLegend: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
    },
    heatLegendBox: { width: 12, height: 10, borderRadius: 2 },
    insight: {
      flexDirection: 'row',
      gap: 6,
      padding: 12,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.surface,
    },
    barRow: { flexDirection: 'row', gap: 8, height: 150 },
    barCol: { flex: 1, alignItems: 'center', gap: 4 },
    barArea: { flex: 1, width: '100%', justifyContent: 'flex-end' },
    bar: { position: 'absolute', bottom: 0, left: 4, right: 4, borderRadius: 4 },
    legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    legendBox: { width: 10, height: 10, borderRadius: 2, marginLeft: 8 },
    fillRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
    fillItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  });
