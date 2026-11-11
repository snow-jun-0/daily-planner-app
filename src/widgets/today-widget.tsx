'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { EVENT_COLORS, minutesToHHMM, type WidgetData } from '../lib/widget-data';

const INK = '#111111';
const FAINT = '#9B9B9B';
const CARD = '#FFFFFF';

// Small 2x2 widget: date, remaining task count, next event.
export function TodayWidget({ data }: { data: WidgetData }) {
  const next = data.nextEvent;
  const taskLine =
    data.remainingTasks > 0
      ? `할일 ${data.remainingTasks}개 남음`
      : data.tasks.length > 0
        ? '할일 모두 완료 ✓'
        : '할일 없음';

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 14,
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
        <TextWidget text={data.dateTitle} style={{ fontSize: 16, fontWeight: '700', color: INK }} />
        <TextWidget text={data.weekdayLabel} style={{ fontSize: 10, color: FAINT }} />
      </FlexWidget>

      <TextWidget
        text={taskLine}
        style={{ fontSize: 13, fontWeight: '600', color: INK, marginTop: 6 }}
      />

      {next ? (
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <FlexWidget
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: EVENT_COLORS[next.color],
              marginRight: 6,
            }}
          />
          <TextWidget
            text={`${minutesToHHMM(next.start)} ${next.title}`}
            style={{ fontSize: 12, color: FAINT }}
            maxLines={1}
          />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ marginTop: 4 }}>
          <TextWidget text="다음 일정 없음" style={{ fontSize: 12, color: FAINT }} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
