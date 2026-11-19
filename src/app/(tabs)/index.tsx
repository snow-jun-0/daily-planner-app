import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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
import { addDays, formatHeaderLabel, formatMonthDay } from '@/lib/date';
import { timetableDateKey } from '@/lib/timetable';
import { loadEvents, saveEvents, type Event } from '@/lib/events';
import { loadMemo, saveMemo } from '@/lib/memos';
import { useAuthSession } from '@/lib/auth';
import { getDDayCount, loadVisibleDDays } from '@/lib/dday';
import { isOnboarded } from '@/lib/settings';
import { consumePendingViewDate } from '@/lib/navigation';
import { maybeRestoreOnLogin } from '@/lib/backup';
import { createTask, loadTasks, saveTasks, type Task, type TaskPriority } from '@/lib/tasks';

export default function DailyScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  // '오늘' = 타임테이블 하루(06시~익일 02시). 00~05시엔 아직 어제 날짜를 오늘로 본다
  const [viewDate, setViewDate] = useState(timetableDateKey);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [memo, setMemo] = useState('');
  const [ddays, setDdays] = useState<DDayItem[]>([]);
  const [ddayModal, setDdayModal] = useState(false);
  const { session } = useAuthSession();
  const restoredFor = useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isToday = viewDate === timetableDateKey();
  const doneCount = tasks.filter((t) => t.done).length;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const reloadDdays = useCallback(() => {
    void loadVisibleDDays().then((list) =>
      setDdays(list.map((d) => ({ label: d.title, dday: getDDayCount(d.date) }))),
    );
  }, []);

  // 첫 실행이면 온보딩으로
  useEffect(() => {
    void isOnboarded().then((ok) => {
      if (!ok) router.replace('/onboarding' as never);
    });
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
      // 로그인 세션당 1회: 새 설치면 클라우드 백업 자동 복원
      const uid = session?.user?.id;
      if (uid && restoredFor.current !== uid) {
        restoredFor.current = uid;
        await maybeRestoreOnLogin().catch(() => {});
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
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
  }, [viewDate]);

  function persistTasks(next: Task[]) {
    setTasks(next);
    saveTasks(viewDate, next);
  }

  function handleAdd(text: string, priority: TaskPriority) {
    persistTasks([...tasks, createTask(text, priority)]);
  }

  function handleToggle(id: string) {
    persistTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function handleDelete(id: string) {
    persistTasks(tasks.filter((t) => t.id !== id));
  }

  function persistEvents(next: Event[]) {
    setEvents(next);
    saveEvents(viewDate, next);
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
    setViewDate(timetableDateKey());
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
            onChangeEvents={persistEvents}
            onSelectDate={setViewDate}
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
