import { todayKey, formatMonthDay, formatHeaderLabel } from './date';
import type { Event, EventColor } from './events';
import { getItem } from './storage';
import type { Task } from './tasks';

// Keys mirror tasks.ts / events.ts (duplicated here to avoid an import cycle:
// tasks/events import widget-sync, which imports this module).
const tasksKey = (date: string) => `tasks:${date}`;
const eventsKey = (date: string) => `events:${date}`;

export type WidgetData = {
  dateTitle: string;
  weekdayLabel: string;
  tasks: Task[];
  remainingTasks: number;
  events: Event[];
  nextEvent: Event | null;
};

/** EventColor -> hex, mirrors the schedule block colors in theme.ts. */
export const EVENT_COLORS: Record<EventColor, `#${string}`> = {
  green: '#2F6B4F',
  sage: '#9DB8A4',
  highlight: '#F5D547',
  blue: '#2C5AA0',
  red: '#C0392B',
};

export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Load today's tasks + events for the home-screen widgets. */
export async function loadWidgetData(): Promise<WidgetData> {
  const date = todayKey();
  const tasks = (await getItem<Task[]>(tasksKey(date))) ?? [];
  const events = (await getItem<Event[]>(eventsKey(date))) ?? [];
  events.sort((a, b) => a.start - b.start);

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nextEvent = events.find((e) => e.end > nowMin) ?? events[0] ?? null;

  return {
    dateTitle: formatMonthDay(date),
    weekdayLabel: formatHeaderLabel(date),
    tasks,
    remainingTasks: tasks.filter((t) => !t.done).length,
    events,
    nextEvent,
  };
}
