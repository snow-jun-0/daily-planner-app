import { scheduleAutoBackup } from './backup';
import { todayKey } from './date';
import { getItem, setItem } from './storage';
import { syncWidgets } from './widget-sync';

export type EventColor = 'highlight' | 'green' | 'blue' | 'red' | 'sage';

export type Event = {
  id: string;
  title: string;
  /** minutes since midnight, e.g. 09:00 = 540 */
  start: number;
  /** minutes since midnight, e.g. 10:30 = 630 */
  end: number;
  color: EventColor;
};

export { todayKey };

function eventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function eventsKey(date: string): string {
  return `events:${date}`;
}

export async function loadEvents(date: string): Promise<Event[]> {
  const events = await getItem<Event[]>(eventsKey(date));
  return events ?? [];
}

export async function saveEvents(date: string, events: Event[]): Promise<void> {
  await setItem(eventsKey(date), events);
  if (date === todayKey()) void syncWidgets();
  scheduleAutoBackup();
}

export function createEvent(title: string, start: number, end: number, color: EventColor): Event {
  return { id: eventId(), title, start, end, color };
}
