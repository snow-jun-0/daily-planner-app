import type { ReactNode } from 'react';
import { useRef } from 'react';
import { PanResponder, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useTheme } from '@/constants/theme-context';

type Props = {
  size: number;
  /** 설정된 분 (파이 크기 기준) */
  minutes: number;
  /** 남은 비율 0~1 (작동 중엔 줄어듦, idle이면 1) */
  remainingRatio: number;
  /** 드래그로 수정 가능 (멈춰있을 때만 true) */
  editable: boolean;
  onChangeMinutes?: (min: number) => void;
  maxMinutes?: number;
  /** 남은 시간 파이 색 (Time Timer 빨강) */
  pieColor: string;
  children?: ReactNode;
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180; // 12시 = 0도, 시계방향
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** 12시에서 시계방향으로 ratio(0~1)만큼 채운 파이(부채꼴) path */
function piePath(cx: number, cy: number, r: number, ratio: number): string {
  const angle = Math.max(0, Math.min(360, ratio * 360));
  if (angle <= 0.001) return '';
  if (angle >= 359.999) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
  }
  const start = polar(cx, cy, r, 0);
  const end = polar(cx, cy, r, angle);
  const largeArc = angle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export function TimeTimerDial({
  size,
  minutes,
  remainingRatio,
  editable,
  onChangeMinutes,
  maxMinutes = 60,
  pieColor,
  children,
}: Props) {
  const theme = useTheme();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 20;

  // PanResponder가 최신 props를 보도록 ref에 저장
  const ref = useRef({ editable, onChangeMinutes, cx, cy, maxMinutes });
  ref.current = { editable, onChangeMinutes, cx, cy, maxMinutes };

  function handle(e: GestureResponderEvent) {
    const cur = ref.current;
    if (!cur.editable || !cur.onChangeMinutes) return;
    const { locationX, locationY } = e.nativeEvent;
    let deg = (Math.atan2(locationY - cur.cy, locationX - cur.cx) * 180) / Math.PI + 90;
    deg = (deg + 360) % 360;
    let min = Math.round((deg / 360) * cur.maxMinutes);
    if (min <= 0) min = cur.maxMinutes;
    cur.onChangeMinutes(Math.max(1, Math.min(cur.maxMinutes, min)));
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => ref.current.editable,
      onMoveShouldSetPanResponder: () => ref.current.editable,
      onPanResponderGrant: handle,
      onPanResponderMove: handle,
    }),
  ).current;

  const shownRatio = (minutes * Math.max(0, Math.min(1, remainingRatio))) / maxMinutes;
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      {...pan.panHandlers}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} fill={theme.card} stroke={theme.line} strokeWidth={2} />
        <Path d={piePath(cx, cy, r - 3, shownRatio)} fill={pieColor} opacity={0.92} />
        {ticks.map((deg) => {
          const outer = polar(cx, cy, r, deg);
          const inner = polar(cx, cy, r - 8, deg);
          return (
            <Line
              key={deg}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={theme.faint}
              strokeWidth={1.5}
            />
          );
        })}
      </Svg>
      {children ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.center}>{children}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
