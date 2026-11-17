import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { priorityMeta } from '@/components/planner/todo-card';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerShadow, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { addDays, formatDisplayDate, todayKey } from '@/lib/date';
import { DEFAULT_TASKLIST, setGTaskStatus } from '@/lib/gtasks';
import { requestViewDate } from '@/lib/navigation';
import { loadAllTaskDays, saveTasks, type Task } from '@/lib/tasks';

type FilterId = 'todo' | 'done' | 'all';
const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'todo', label: '미완료' },
  { id: 'done', label: '완료' },
  { id: 'all', label: '전체' },
];

const EMPTY: Record<FilterId, { title: string; sub: string }> = {
  todo: { title: '남은 할 일이 없어요', sub: '할 일을 모두 끝냈어요. 수고했어요!' },
  done: { title: '완료한 할 일이 없어요', sub: '하나씩 체크하면 여기에 모여요.' },
  all: { title: '아직 할 일이 없어요', sub: '오늘 화면에서 할 일을 추가해 보세요.' },
};

type Item = { date: string; task: Task };

export default function AllTasksScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [days, setDays] = useState<Record<string, Task[]>>({});
  const [filter, setFilter] = useState<FilterId>('todo');

  useFocusEffect(
    useCallback(() => {
      void loadAllTaskDays().then(setDays);
    }, []),
  );

  function toggle(date: string, id: string) {
    const list = days[date] ?? [];
    const target = list.find((t) => t.id === id);
    if (!target) return;
    const next = list.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    setDays((prev) => ({ ...prev, [date]: next }));
    void saveTasks(date, next);
    if (target.googleTaskId)
      void setGTaskStatus(
        target.googleTaskListId ?? DEFAULT_TASKLIST,
        target.googleTaskId,
        !target.done,
      );
  }

  // 할 일 추가는 오늘 화면의 할 일 카드에서
  function goAdd() {
    requestViewDate(todayKey());
    router.navigate('/');
  }

  const today = todayKey();
  const tomorrow = addDays(today, 1);
  const all: Item[] = Object.keys(days)
    .sort()
    .flatMap((date) => (days[date] ?? []).map((task) => ({ date, task })));
  const counts = {
    todo: all.filter((i) => !i.task.done).length,
    done: all.filter((i) => i.task.done).length,
    all: all.length,
  };
  const shown = all.filter((i) =>
    filter === 'todo' ? !i.task.done : filter === 'done' ? i.task.done : true,
  );

  // 미완료 탭에선 지난 날짜를 '지난 할 일' 하나로 묶는다
  const groups: { key: string; label: string; overdue?: boolean; items: Item[] }[] = [];
  for (const it of shown) {
    const overdue = filter === 'todo' && it.date < today;
    const key = overdue ? 'overdue' : it.date;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      const label = overdue
        ? '지난 할 일'
        : it.date === today
          ? `오늘 · ${formatDisplayDate(it.date)}`
          : it.date === tomorrow
            ? `내일 · ${formatDisplayDate(it.date)}`
            : formatDisplayDate(it.date);
      g = { key, label, overdue, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={theme.ink} />
        </Pressable>
        <Text style={styles.title}>전체 할 일</Text>
        <Pressable onPress={goAdd} hitSlop={10} style={styles.plusBtn} accessibilityLabel="할 일 추가">
          <Ionicons name="add" size={22} color={theme.ink} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.tab, on && styles.tabOn]}>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>
                {f.label}
                {f.id === 'all' ? '' : ` ${counts[f.id]}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="checkmark" size={22} color={theme.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>{EMPTY[filter].title}</Text>
          <Text style={styles.emptySub}>{EMPTY[filter].sub}</Text>
          <Pressable style={styles.emptyBtn} onPress={goAdd}>
            <Text style={styles.emptyBtnText}>할 일 추가</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {groups.map((g) => (
            <View key={g.key} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={[styles.groupLabel, g.overdue && { color: theme.red }]}>{g.label}</Text>
                <Text style={[styles.groupLabel, g.overdue && { color: theme.red }]}>
                  {g.items.length}
                </Text>
              </View>
              <View style={styles.card}>
                {g.items.map(({ date, task }) => {
                  const meta = priorityMeta(theme)[task.priority];
                  return (
                    <Pressable
                      key={task.id}
                      onPress={() => toggle(date, task.id)}
                      style={styles.row}>
                      <View style={[styles.check, task.done && styles.checkOn]}>
                        {task.done && (
                          <Ionicons name="checkmark" size={14} color={theme.onAccent} />
                        )}
                      </View>
                      <Text style={[styles.rowText, task.done && styles.rowTextDone]}>
                        {task.text}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
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
    title: { ...PlannerType.titleM, color: theme.ink, flex: 1 },
    plusBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabs: {
      flexDirection: 'row',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      marginBottom: Spacing.two,
    },
    tab: {
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.three,
      borderRadius: PlannerRadius.chip,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.card,
    },
    tabOn: { backgroundColor: theme.accent, borderColor: theme.accent },
    tabText: { ...PlannerType.labelStrong, color: theme.textSecondary },
    tabTextOn: { color: theme.onAccent },
    content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
    group: { gap: Spacing.two },
    groupHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
    groupLabel: { ...PlannerType.labelStrong, color: theme.textSecondary },
    card: {
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.card,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
      ...PlannerShadow,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    check: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: theme.textTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: theme.accent, borderColor: theme.accent },
    rowText: { ...PlannerType.bodyMedium, fontSize: 15, color: theme.ink, flex: 1 },
    rowTextDone: { textDecorationLine: 'line-through', color: theme.textTertiary },
    badge: { borderRadius: PlannerRadius.sm, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { ...PlannerType.labelStrong, fontSize: 12 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    emptyTitle: { ...PlannerType.labelStrong, fontSize: 15, color: theme.ink },
    emptySub: { ...PlannerType.caption, color: theme.textSecondary },
    emptyBtn: {
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.surface,
    },
    emptyBtnText: { ...PlannerType.labelStrong, color: theme.ink },
  });
