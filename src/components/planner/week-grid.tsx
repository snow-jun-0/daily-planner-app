import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { PlannerType } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { weekKeys } from '@/lib/date';
import {
  COLS,
  FOCUS_CATEGORY,
  loadTimetable,
  ROWS,
  START_HOUR,
  subscribeTimetable,
  totalActualMin,
  type Category,
  type DayTimetable,
  type SubjectId,
} from '@/lib/timetable';

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];
const ROW_H = 16;

/** r행(1시간)에서 실제로 채운 칸의 과목들 — 왼쪽부터 몰아 그릴 때 쓴다 */
export function hourActuals(day: DayTimetable, r: number): SubjectId[] {
  return day.cells
    .slice(r * COLS, r * COLS + COLS)
    .map((c) => c.actual)
    .filter((a): a is SubjectId => !!a);
}

function fmtTotal(min: number): string {
  return `${Math.floor(min / 60)}H ${String(min % 60).padStart(2, '0')}M`;
}

type Props = {
  dateKey: string;
  cats: Category[];
  /** 날짜 탭 → 그날의 10분 격자로 */
  onSelectDate: (dateKey: string) => void;
};

/** G10 — 주간 격자: 한 칸 = 1시간, 채워진 폭 = 그 시간에 실제로 집중한 분 */
export function WeekGrid({ dateKey, cats, onSelectDate }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const keys = useMemo(() => weekKeys(dateKey), [dateKey]);
  const [days, setDays] = useState<DayTimetable[] | null>(null);
  const catMap = useMemo(
    () => Object.fromEntries(cats.map((c) => [c.id, c])) as Record<SubjectId, Category>,
    [cats],
  );

  useEffect(() => {
    let alive = true;
    const load = () =>
      void Promise.all(keys.map(loadTimetable)).then((d) => {
        if (alive) setDays(d);
      });
    load();
    const unsub = subscribeTimetable((dk) => keys.includes(dk) && load());
    return () => {
      alive = false;
      unsub();
    };
  }, [keys]);

  if (!days) return <View style={styles.skeleton} />;

  const totals = days.map(totalActualMin);
  const weekTotal = totals.reduce((a, b) => a + b, 0);
  const best = totals.indexOf(Math.max(...totals));
  const colorOf = (id: SubjectId) => catMap[id]?.color ?? FOCUS_CATEGORY.color;

  return (
    <View style={styles.wrap}>
      <View style={styles.totalRow}>
        <View>
          <Text style={styles.totalLabel}>WEEK TOTAL</Text>
          <Text style={styles.totalValue}>{fmtTotal(weekTotal)}</Text>
        </View>
        <View style={styles.totalRight}>
          <Pressable
            onPress={() => router.push(`/share-week?date=${dateKey}` as never)}
            hitSlop={8}
            style={styles.shareBtn}
            accessibilityLabel="주간 공유">
            <Ionicons name="share-outline" size={16} color={theme.ink} />
          </Pressable>
          <Text style={styles.caption}>하루 평균 {(weekTotal / 7 / 60).toFixed(1)}시간</Text>
          {weekTotal > 0 ? (
            <Text style={styles.best}>가장 많이 한 날 · {DAY_NAMES[best]}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.axis} />
        {keys.map((k, i) => (
          <Pressable key={k} style={styles.dayHead} onPress={() => onSelectDate(k)}>
            <Text
              style={[
                styles.dayName,
                i === 5 && { color: theme.blue },
                i === 6 && { color: theme.red },
              ]}>
              {DAY_NAMES[i]}
            </Text>
            <Text style={[styles.dayNum, k === dateKey && styles.dayNumOn]}>
              {Number(k.slice(8))}
            </Text>
          </Pressable>
        ))}
      </View>

      {Array.from({ length: ROWS }).map((_, r) => (
        <View key={r} style={styles.row}>
          <Text style={styles.axisText}>
            {r % 2 === 0 ? String((START_HOUR + r) % 24).padStart(2, '0') : ''}
          </Text>
          {days.map((d, di) => {
            const filled = hourActuals(d, r);
            return (
              <Pressable key={di} style={styles.hour} onPress={() => onSelectDate(keys[di])}>
                {filled.map((id, k) => (
                  <View key={k} style={[styles.seg, { backgroundColor: colorOf(id) }]} />
                ))}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.row}>
        <View style={styles.axis} />
        {totals.map((t, i) => (
          <Text key={i} style={styles.dayTotal}>
            {(t / 60).toFixed(1)}h
          </Text>
        ))}
      </View>

      <Text style={styles.caption}>
        한 칸 = 1시간. 채워진 폭 = 그 시간에 실제로 집중한 분. 날짜를 탭하면 그날의 10분 격자로
        이동해요.
      </Text>
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: { gap: 3 },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 10,
    },
    totalLabel: { ...PlannerType.overline, color: theme.textTertiary },
    totalValue: { ...PlannerType.display, color: theme.ink },
    totalRight: { alignItems: 'flex-end' },
    shareBtn: { padding: 4, marginBottom: 4 },
    caption: { ...PlannerType.caption, color: theme.textSecondary },
    best: { ...PlannerType.labelStrong, color: theme.ink },
    row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    axis: { width: 22 },
    axisText: { width: 22, ...PlannerType.caption, fontSize: 11, color: theme.textTertiary },
    dayHead: { flex: 1, alignItems: 'center', paddingBottom: 4 },
    dayName: { ...PlannerType.caption, color: theme.textSecondary },
    dayNum: { ...PlannerType.labelStrong, color: theme.ink },
    dayNumOn: { textDecorationLine: 'underline' },
    hour: {
      flex: 1,
      height: ROW_H,
      flexDirection: 'row',
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: theme.surface,
    },
    seg: { width: `${100 / COLS}%`, height: '100%' },
    dayTotal: {
      flex: 1,
      textAlign: 'center',
      ...PlannerType.caption,
      color: theme.textSecondary,
      marginTop: 6,
    },
    skeleton: { height: 420, borderRadius: 12, backgroundColor: theme.surface },
  });
