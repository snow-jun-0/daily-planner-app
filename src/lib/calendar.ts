import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Event, EventColor } from './events';
import type { Task } from './tasks';

/** A calendar dot is either an event's own color, or `'task'` (has to-dos). */
export type DotColor = EventColor | 'task';

export type MonthDots = Record<string, DotColor[]>;

const MAX_DOTS = 3;

function monthPrefix(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Dots for every date in `year`-`month` that has events and/or tasks.
 * Reads `AsyncStorage.getAllKeys()` once and `multiGet`s only the keys for
 * this month, so it stays cheap regardless of how much history is stored.
 */
export async function loadMonthDots(year: number, month: number): Promise<MonthDots> {
  const eventsPrefix = `events:${monthPrefix(year, month)}`;
  const tasksPrefix = `tasks:${monthPrefix(year, month)}`;

  const allKeys = await AsyncStorage.getAllKeys();
  const relevantKeys = allKeys.filter(
    (key) => key.startsWith(eventsPrefix) || key.startsWith(tasksPrefix),
  );
  const pairs = await AsyncStorage.multiGet(relevantKeys);

  const eventColorsByDate = new Map<string, Set<EventColor>>();
  const hasTasksByDate = new Set<string>();

  for (const [key, raw] of pairs) {
    if (!raw) continue;
    if (key.startsWith(eventsPrefix)) {
      const date = key.slice('events:'.length);
      const events = JSON.parse(raw) as Event[];
      if (events.length > 0) {
        const colors = eventColorsByDate.get(date) ?? new Set<EventColor>();
        for (const ev of events) colors.add(ev.color);
        eventColorsByDate.set(date, colors);
      }
    } else if (key.startsWith(tasksPrefix)) {
      const date = key.slice('tasks:'.length);
      const tasks = JSON.parse(raw) as Task[];
      if (tasks.length > 0) hasTasksByDate.add(date);
    }
  }

  const dots: MonthDots = {};
  const dates = new Set([...eventColorsByDate.keys(), ...hasTasksByDate]);
  for (const date of dates) {
    const dayDots: DotColor[] = Array.from(eventColorsByDate.get(date) ?? []).slice(0, MAX_DOTS);
    if (hasTasksByDate.has(date) && dayDots.length < MAX_DOTS) {
      dayDots.push('task');
    }
    dots[date] = dayDots;
  }
  return dots;
}
