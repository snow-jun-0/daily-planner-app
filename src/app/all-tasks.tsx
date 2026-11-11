import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppTheme } from '@/constants/theme';
import { PlannerSerif, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { formatMonthDay, todayKey } from '@/lib/date';
import { DEFAULT_TASKLIST, setGTaskStatus } from '@/lib/gtasks';
import { loadAllTaskDays, saveTasks, type Task } from '@/lib/tasks';

type FilterId = 'todo' | 'done' | 'all';
const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'todo', label: '미완료' },
  { id: 'done', label: '완료' },
  { id: 'all', label: '전체' },
];

export default function AllTasksScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [days, setDays] = useState<Record<string, Task[]>>({});
  const [filter, setFilter] = useState<FilterId>('todo');

  const reload = useCallback(() => {
    void loadAllTaskDays().then(setDays);
  }, []);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
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

  const today = todayKey();
  const groups = Object.keys(days)
    .sort()
    .map((date) => ({
      date,
      items: (days[date] ?? []).filter((t) =>
        filter === 'todo' ? !t.done : filter === 'done' ? t.done : true,
      ),
    }))
    .filter((g) => g.items.length > 0);
  const total = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.ink} />
          <Text style={styles.backText}>뒤로</Text>
        </Pressable>
        <Text style={styles.title}>전체 할 일</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.tab, on && styles.tabOn]}>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {total === 0 ? (
          <Text style={styles.empty}>해당하는 할 일이 없어요</Text>
        ) : (
          groups.map(({ date, items }) => (
            <View key={date} style={styles.group}>
              <Text style={styles.groupLabel}>
                {date === today ? '오늘 · ' : ''}
                {formatMonthDay(date)}
              </Text>
              {items.map((task) => (
                <Pressable key={task.id} onPress={() => toggle(date, task.id)} style={styles.row}>
                  <View style={[styles.check, task.done && styles.checkOn]}>
                    {task.done && <Ionicons name="checkmark" size={14} color={theme.onAccent} />}
                  </View>
                  <Text style={[styles.rowText, task.done && styles.rowTextDone]}>{task.text}</Text>
                </Pressable>
              ))}
            </View>
          ))
        )}
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
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
    backText: { color: theme.ink, fontSize: 14 },
    title: { color: theme.ink, fontFamily: PlannerSerif, fontSize: 20, fontWeight: '600' },
    headerSpacer: { width: 60 },
    tabs: {
      flexDirection: 'row',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      marginBottom: Spacing.two,
    },
    tab: {
      paddingVertical: Spacing.one + 2,
      paddingHorizontal: Spacing.three,
      borderRadius: 999,
      backgroundColor: theme.card,
    },
    tabOn: { backgroundColor: theme.accent },
    tabText: { fontSize: 13, color: theme.faint, fontWeight: '600' },
    tabTextOn: { color: theme.onAccent },
    content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
    group: { gap: Spacing.two },
    groupLabel: { fontSize: 13, fontWeight: '700', color: theme.faint, marginBottom: 2 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      paddingVertical: Spacing.one + 2,
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.faint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: theme.accent, borderColor: theme.accent },
    rowText: { fontSize: 15, color: theme.ink, flex: 1 },
    rowTextDone: { textDecorationLine: 'line-through', color: theme.faint },
    empty: { textAlign: 'center', color: theme.faint, marginTop: 40 },
  });
