import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerSerif, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import {
  loadMonthFocusStats,
  loadMonthTaskStats,
  type MonthFocusStats,
  type MonthTaskStats,
} from '@/lib/stats';

function fmtDuration(sec: number): string {
  if (sec <= 0) return '0분';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export default function StatsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [focus, setFocus] = useState<MonthFocusStats | null>(null);
  const [tasks, setTasks] = useState<MonthTaskStats | null>(null);

  useEffect(() => {
    void loadMonthFocusStats(ym.y, ym.m).then(setFocus);
    void loadMonthTaskStats(ym.y, ym.m).then(setTasks);
  }, [ym]);

  const prev = () => setYm((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }));
  const next = () => setYm((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.ink} />
          <Text style={styles.backText}>달력</Text>
        </Pressable>
        <Text style={styles.title}>통계</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.monthRow}>
        <Pressable onPress={prev} hitSlop={10}>
          <Ionicons name="chevron-back" size={18} color={theme.faint} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {ym.y}년 {ym.m + 1}월
        </Text>
        <Pressable onPress={next} hitSlop={10}>
          <Ionicons name="chevron-forward" size={18} color={theme.faint} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          <StatCard
            label="집중 시간"
            value={focus ? fmtDuration(focus.totalFocusSeconds) : '-'}
            sub={focus ? `${focus.totalSessions}세션 완주` : ''}
            theme={theme}
          />
          <StatCard
            label="할일 완료율"
            value={tasks ? `${tasks.rate}%` : '-'}
            sub={tasks ? `${tasks.totalDone}/${tasks.totalTasks}건` : ''}
            theme={theme}
          />
          <StatCard
            label="휴식 초과"
            value={focus ? fmtDuration(focus.totalOverrunSeconds) : '-'}
            sub="딴짓한 시간 😇"
            theme={theme}
            danger
          />
          <StatCard
            label="기록한 날"
            value={focus ? `${focus.recordedDays}일` : '-'}
            sub="집중한 날"
            theme={theme}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  sub,
  theme,
  danger,
}: {
  label: string;
  value: string;
  sub: string;
  theme: AppTheme;
  danger?: boolean;
}) {
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, danger ? { color: theme.red } : null]}>{value}</Text>
      {sub ? <Text style={styles.cardSub}>{sub}</Text> : null}
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
    backText: { color: theme.ink, fontSize: 14 },
    title: { color: theme.ink, fontFamily: PlannerSerif, fontSize: 20, fontWeight: '600' },
    headerSpacer: { width: 60 },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.four,
      paddingVertical: Spacing.two,
    },
    monthLabel: { color: theme.ink, fontSize: 16, fontWeight: '700' },
    content: { padding: Spacing.three },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
    card: {
      flexBasis: '47%',
      flexGrow: 1,
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.card,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: theme.line,
      padding: Spacing.three,
      gap: 4,
    },
    cardLabel: { color: theme.faint, fontSize: 13, fontWeight: '600' },
    cardValue: { color: theme.ink, fontSize: 24, fontWeight: '700' },
    cardSub: { color: theme.faint, fontSize: 12 },
  });
