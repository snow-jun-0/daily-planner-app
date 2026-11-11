import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { loadWidgetData } from '../lib/widget-data';
import { TodayBigWidget } from './today-big-widget';
import { TodayWidget } from './today-widget';

// Keys must match the `name` of each widget in the app.json plugin config.
const nameToWidget = {
  Today: TodayWidget,
  TodayBig: TodayBigWidget,
};

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetName = props.widgetInfo.widgetName as keyof typeof nameToWidget;
  const Widget = nameToWidget[widgetName];
  if (!Widget) return;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await loadWidgetData();
      props.renderWidget(<Widget data={data} />);
      break;
    }
    case 'WIDGET_DELETED':
    case 'WIDGET_CLICK':
    default:
      break;
  }
}
