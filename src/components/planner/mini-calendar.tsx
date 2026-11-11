import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Planner, PlannerRadius } from '@/constants/theme';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function toKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 패키지 없이 쓰는 미니 월 달력. 과거 날짜는 비활성(D-Day는 미래만). */
export function MiniCalendar({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const base = value ? new Date(`${value}T00:00:00`) : new Date();
  const [cursor, setCursor] = useState({ y: base.getFullYear(), m: base.getMonth() });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startPad = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prev = () => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }));
  const next = () => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }));

  return (
    <View style={styles.cal}>
      <View style={styles.header}>
        <Pressable onPress={prev} hitSlop={10}>
          <Text style={styles.nav}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>
          {cursor.y}년 {cursor.m + 1}월
        </Text>
        <Pressable onPress={next} hitSlop={10}>
          <Text style={styles.nav}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (d == null) return <View key={`pad-${i}`} style={styles.cell} />;
          const key = toKey(cursor.y, cursor.m, d);
          const isPast = new Date(cursor.y, cursor.m, d) < today;
          const selected = key === value;
          return (
            <Pressable
              key={key}
              style={styles.cell}
              disabled={isPast}
              onPress={() => onChange(key)}>
              <View style={[styles.dayCircle, selected && styles.daySelected]}>
                <Text
                  style={[
                    styles.dayText,
                    isPast && styles.dayPast,
                    selected && styles.daySelectedText,
                  ]}>
                  {d}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cal: {
    backgroundColor: Planner.paper,
    borderRadius: PlannerRadius.block,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: Planner.line,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  nav: { color: Planner.ink, fontSize: 22, fontWeight: '700', paddingHorizontal: 8 },
  monthLabel: { color: Planner.ink, fontSize: 14, fontWeight: '700' },
  weekRow: { flexDirection: 'row' },
  weekday: {
    flexBasis: '14.2857%',
    textAlign: 'center',
    color: Planner.faint,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    flexBasis: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: Planner.accent },
  dayText: { color: Planner.ink, fontSize: 13, fontWeight: '500' },
  dayPast: { color: Planner.line },
  daySelectedText: { color: Planner.onAccent, fontWeight: '700' },
});
