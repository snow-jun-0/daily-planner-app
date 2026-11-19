import { todayKey } from './date';
import { scheduleAutoBackup } from './backup';
import { getItem, getKeysWithPrefix, setItem } from './storage';
import { syncWidgets } from './widget-sync';

export type TaskPriority = 'high' | 'mid' | 'low';

export type Task = {
  id: string;
  text: string;
  priority: TaskPriority;
  done: boolean;
};

export { todayKey };

function taskId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function tasksKey(date: string): string {
  return `tasks:${date}`;
}

export async function loadTasks(date: string): Promise<Task[]> {
  const tasks = await getItem<Task[]>(tasksKey(date));
  return tasks ?? [];
}

export async function saveTasks(date: string, tasks: Task[]): Promise<void> {
  await setItem(tasksKey(date), tasks);
  if (date === todayKey()) void syncWidgets();
  scheduleAutoBackup();
}

export function createTask(text: string, priority: TaskPriority): Task {
  return { id: taskId(), text, priority, done: false };
}

const TASKS_PREFIX = 'tasks:';

/** 로컬 dateKey("YYYY-MM-DD") → 구글 Tasks due(RFC3339, 날짜만 의미) */
export function dueFromDateKey(key: string): string {
  return `${key}T00:00:00.000Z`;
}
/** 구글 Tasks due → 로컬 dateKey (앞 10글자) */
export function dateKeyFromDue(due: string): string {
  return due.slice(0, 10);
}

/** 모든 날짜의 할 일을 { dateKey: Task[] } 로 읽어온다 (역동기화 전역 순회용) */
export async function loadAllTaskDays(): Promise<Record<string, Task[]>> {
  const keys = await getKeysWithPrefix(TASKS_PREFIX);
  const out: Record<string, Task[]> = {};
  await Promise.all(
    keys.map(async (k) => {
      out[k.slice(TASKS_PREFIX.length)] = (await getItem<Task[]>(k)) ?? [];
    }),
  );
  return out;
}
