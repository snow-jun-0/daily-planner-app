import { requestWidgetUpdate } from 'react-native-android-widget';

import { TodayBigWidget } from '../widgets/today-big-widget';
import { TodayWidget } from '../widgets/today-widget';
import { loadWidgetData } from './widget-data';

/** Push the latest "today" data into both home-screen widgets. Best-effort:
 *  swallows errors so a widget update can never break an app-side save. */
export async function syncWidgets(): Promise<void> {
  try {
    const data = await loadWidgetData();
    await requestWidgetUpdate({
      widgetName: 'Today',
      renderWidget: () => <TodayWidget data={data} />,
      widgetNotFound: () => {},
    });
    await requestWidgetUpdate({
      widgetName: 'TodayBig',
      renderWidget: () => <TodayBigWidget data={data} />,
      widgetNotFound: () => {},
    });
  } catch {
    // ignore — widgets are a best-effort mirror of app data
  }
}
