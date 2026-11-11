'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

// Widgets render to Android RemoteViews, so only react-native-android-widget
// primitives (FlexWidget, TextWidget, ...) work here — not View/Text.
export function HelloWidget() {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
      }}>
      <TextWidget
        text="데일리 플래너"
        style={{ fontSize: 18, fontWeight: '700', color: '#1F1F1F' }}
      />
      <TextWidget
        text="안녕! 위젯 작동 중"
        style={{ fontSize: 12, color: '#6B6B6B', marginTop: 2 }}
      />
    </FlexWidget>
  );
}
