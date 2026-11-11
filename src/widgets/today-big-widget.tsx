'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { EVENT_COLORS, minutesToHHMM, type WidgetData } from '../lib/widget-data';

const INK = '#111111';
const FAINT = '#9B9B9B';
const CARD = '#FFFFFF';

const MAX_EVENTS = 4;
const MAX_TASKS = 5;

// Large 4x4 widget: date header + today's events + today's tasks.
export function TodayBigWidget({ data }: { data: WidgetData }) {
  const events = data.events.slice(0, MAX_EVENTS);
  const moreEvents = data.events.length - events.length;
  const tasks = data.tasks.slice(0, MAX_TASKS);
  const moreTasks = data.tasks.length - tasks.length;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        padding: 16,
        backgroundColor: CARD,
        borderRadius: 16,
      }}>
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
        <TextWidget text={data.dateTitle} style={{ fontSize: 18, fontWeight: '700', color: INK }} />
        <TextWidget text={data.weekdayLabel} style={{ fontSize: 11, color: FAINT }} />
      </FlexWidget>

      <TextWidget
        text="일정"
        style={{ fontSize: 11, fontWeight: '700', color: FAINT, marginTop: 12, marginBottom: 2 }}
      />
      {events.length === 0 ? (
        <TextWidget text="일정 없음" style={{ fontSize: 12, color: FAINT }} />
      ) : (
        events.map((e) => (
          <FlexWidget
            key={e.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              width: 'match_parent',
              marginTop: 3,
            }}>
            <FlexWidget
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: EVENT_COLORS[e.color],
                marginRight: 8,
              }}
            />
            <TextWidget text={minutesToHHMM(e.start)} style={{ fontSize: 12, color: FAINT, width: 44 }} />
            <TextWidget text={e.title} style={{ fontSize: 13, color: INK }} maxLines={1} />
          </FlexWidget>
        ))
      )}
      {moreEvents > 0 ? (
        <TextWidget text={`+${moreEvents}개 더`} style={{ fontSize: 11, color: FAINT, marginTop: 2 }} />
      ) : (
        <FlexWidget style={{ width: 0, height: 0 }} />
      )}

      <TextWidget
        text="할일"
        style={{ fontSize: 11, fontWeight: '700', color: FAINT, marginTop: 12, marginBottom: 2 }}
      />
      {tasks.length === 0 ? (
        <TextWidget text="할일 없음" style={{ fontSize: 12, color: FAINT }} />
      ) : (
        tasks.map((t) => (
          <FlexWidget
            key={t.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              width: 'match_parent',
              marginTop: 3,
            }}>
            <TextWidget
              text={t.done ? '◉' : '○'}
              style={{ fontSize: 13, color: t.done ? INK : FAINT, marginRight: 8 }}
            />
            <TextWidget
              text={t.text}
              style={{ fontSize: 13, color: t.done ? FAINT : INK }}
              maxLines={1}
            />
          </FlexWidget>
        ))
      )}
      {moreTasks > 0 ? (
        <TextWidget text={`+${moreTasks}개 더`} style={{ fontSize: 11, color: FAINT, marginTop: 2 }} />
      ) : (
        <FlexWidget style={{ width: 0, height: 0 }} />
      )}
    </FlexWidget>
  );
}
