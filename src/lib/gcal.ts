import { todayKey } from './date';
import { loadEvents, saveEvents, type Event, type EventColor } from './events';
import { googleFetch } from './google-auth';

type GCalItem = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

function isoToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

const GCAL_COLORS: EventColor[] = ['blue', 'green', 'highlight', 'sage', 'red'];

/** 특정 날짜의 구글 캘린더 '시간 일정'을 Event[]로 변환해 반환 (종일 일정 제외) */
export async function fetchGoogleEventsForDate(dateKey: string): Promise<Event[]> {
  const timeMin = new Date(`${dateKey}T00:00:00`).toISOString();
  const timeMax = new Date(`${dateKey}T23:59:59`).toISOString();
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
    `?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
    `&singleEvents=true&orderBy=startTime`;

  const res = await googleFetch(url);
  if (!res) throw new Error('NO_PROVIDER_TOKEN');
  if (!res.ok) throw new Error(`GCAL_${res.status}`);
  const json = (await res.json()) as { items?: GCalItem[] };
  const items = json.items ?? [];

  return items
    .filter((it) => it.start?.dateTime && it.end?.dateTime)
    .map((it, i) => ({
      id: `gcal-${it.id}`,
      title: it.summary ?? '(제목 없음)',
      start: isoToMinutes(it.start!.dateTime!),
      end: isoToMinutes(it.end!.dateTime!),
      color: GCAL_COLORS[i % GCAL_COLORS.length],
    }));
}

/**
 * 구글 일정을 로컬 이벤트와 병합한다. 기존 구글 일정(gcal- 접두사)은 교체하고,
 * 손으로 추가한 일정은 보존한다. 추가된 구글 일정 개수를 반환.
 */
export async function syncGoogleCalendar(dateKey: string = todayKey()): Promise<number> {
  const gevents = await fetchGoogleEventsForDate(dateKey);
  const local = await loadEvents(dateKey);
  const manual = local.filter((e) => !e.id.startsWith('gcal-'));
  await saveEvents(dateKey, [...manual, ...gevents]);
  return gevents.length;
}
