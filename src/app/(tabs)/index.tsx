import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { AppState, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayHeader } from '@/components/planner/day-header';
import { MemoCard } from '@/components/planner/memo-card';
import { TimetableGrid } from '@/components/planner/timetable-grid';
import { DDayModal } from '@/components/planner/dday-modal';
import { TodaySummaryCard, type DDayItem } from '@/components/planner/today-summary-card';
import { TodoCard } from '@/components/planner/todo-card';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { addDays, formatHeaderLabel, formatMonthDay, todayKey } from '@/lib/date';
import { createEvent, loadEvents, saveEvents, type Event, type EventColor } from '@/lib/events';
import { loadMemo, saveMemo } from '@/lib/memos';
import { useAuthSession } from '@/lib/auth';
import { getDDayCount, loadVisibleDDays } from '@/lib/dday';
import { syncGoogleCalendar } from '@/lib/gcal';
import { getAutoSyncCalendar } from '@/lib/settings';
import { consumePendingViewDate } from '@/lib/navigation';
import { DEFAULT_TASKLIST, deleteGTask, insertGTask, setGTaskStatus } from '@/lib/gtasks';
import { maybeRestoreOnLogin } from '@/lib/backup';
import { runReverseSync } from '@/lib/task-sync';
import { createTask, loadTasks, saveTasks, type Task, type TaskPriority } from '@/lib/tasks';

export default function DailyScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [viewDate, setViewDate] = useState(todayKey());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [memo, setMemo] = useState('');
  const [ddays, setDdays] = useState<DDayItem[]>([]);
  const [ddayModal, setDdayModal] = useState(false);
  const { session } = useAuthSession();
  const reverseSyncedFor = useRef<string | null>(null);
  const lastResyncAt = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const isToday = viewDate === todayKey();
  const doneCount = tasks.filter((t) => t.done).length;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const reloadDdays = useCallback(() => {
    void loadVisibleDDays().then((list) =>
      setDdays(list.map((d) => ({ label: d.title, dday: getDDayCount(d.date) }))),
    );
  }, []);

  // jump to whatever date the 월간 tab requested, if any
  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingViewDate();
      if (pending) setViewDate(pending);
      reloadDdays();
    }, [reloadDdays]),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (session) {
        const auto = await getAutoSyncCalendar();
        if (auto) await syncGoogleCalendar(viewDate).catch(() => {});
        // 로그인 세션당 1회: 구글 Tasks 전역 역동기화 (완료/삭제/날짜이동/신규 편입)
        const uid = session.user?.id ?? 'signed-in';
        if (reverseSyncedFor.current !== uid) {
          reverseSyncedFor.current = uid;
          await maybeRestoreOnLogin().catch(() => {});
          await runReverseSync().catch(() => {});
        }
      }
      const [t, e, m] = await Promise.all([
        loadTasks(viewDate),
        loadEvents(viewDate),
        loadMemo(viewDate),
      ]);
      if (!cancelled) {
        setTasks(t);
        setEvents(e);
        setMemo(m);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewDate, session]);

  // 앱이 백그라운드에서 돌아오면(딴 데서 구글 할일 수정하고 복귀 등) 역동기화 다시
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' || !session) return;
      if (Date.now() - lastResyncAt.current < 60_000) return;
      lastResyncAt.current = Date.now();
      void (async () => {
        await runReverseSync().catch(() => {});
        const [t, e, m] = await Promise.all([
          loadTasks(viewDate),
          loadEvents(viewDate),
          loadMemo(viewDate),
        ]);
        setTasks(t);
        setEvents(e);
        setMemo(m);
      })();
    });
    return () => sub.remove();
  }, [session, viewDate]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (session) {
        await syncGoogleCalendar(viewDate).catch(() => {});
        await runReverseSync().catch(() => {});
      }
      const [t, e, m] = await Promise.all([
        loadTasks(viewDate),
        loadEvents(viewDate),
        loadMemo(viewDate),
      ]);
      setTasks(t);
      setEvents(e);
      setMemo(m);
    } finally {
      setRefreshing(false);
    }
  }, [session, viewDate]);

  function persistTasks(next: Task[]) {
    setTasks(next);
    saveTasks(viewDate, next);
  }

  function handleAdd(text: string, priority: TaskPriority) {
    const task = createTask(text, priority);
    const next = [...tasks, task];
    persistTasks(next);
    void insertGTask(text, viewDate, task.id).then((g) => {
      if (g)
        persistTasks(
          next.map((t) =>
            t.id === task.id ? { ...t, googleTaskId: g.id, googleTaskListId: g.taskListId } : t,
          ),
        );
    });
  }

  function handleToggle(id: string) {
    const task = tasks.find((t) => t.id === id);
    persistTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    if (task?.googleTaskId)
      void setGTaskStatus(task.googleTaskListId ?? DEFAULT_TASKLIST, task.googleTaskId, !task.done);
  }

  function handleDelete(id: string) {
    const task = tasks.find((t) => t.id === id);
    persistTasks(tasks.filter((t) => t.id !== id));
    if (task?.googleTaskId) void deleteGTask(task.googleTaskListId ?? DEFAULT_TASKLIST, task.googleTaskId);
  }

  function persistEvents(next: Event[]) {
    setEvents(next);
    saveEvents(viewDate, next);
  }

  function handleAddEvent(title: string, start: number, end: number, color: EventColor) {
    persistEvents([...events, createEvent(title, start, end, color)]);
  }

  function handleDeleteEvent(id: string) {
    persistEvents(events.filter((e) => e.id !== id));
  }

  function handleSaveMemo(text: string) {
    setMemo(text);
    saveMemo(viewDate, text);
  }

  function handlePrevDay() {
    setViewDate((d) => addDays(d, -1));
  }

  function handleNextDay() {
    setViewDate((d) => addDays(d, 1));
  }

  function handleToday() {
    setViewDate(todayKey());
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }>
          <DayHeader
            label={formatHeaderLabel(viewDate)}
            title={formatMonthDay(viewDate)}
            isToday={isToday}
            onPrev={handlePrevDay}
            onNext={handleNextDay}
            onToday={handleToday}
          />

          <TodaySummaryCard progress={progress} ddays={ddays} onManage={() => setDdayModal(true)} />

          <TimetableGrid
            dateKey={viewDate}
            isToday={isToday}
            events={events}
            onStartFocus={() => router.push('/timer' as never)}
          />

          <TodoCard
            tasks={tasks}
            onAdd={handleAdd}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onViewAll={() => router.push('/all-tasks' as never)}
          />

          <MemoCard value={memo} onSave={handleSaveMemo} />
        </ScrollView>
      </SafeAreaView>
      <DDayModal visible={ddayModal} onClose={() => setDdayModal(false)} onChanged={reloadDdays} />
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.paper,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
  },
});
