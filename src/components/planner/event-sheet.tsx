import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { makeStyles as sheetStyles, TimeField } from '@/components/planner/plan-sheet';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerType } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { createEvent, type Event, type EventColor } from '@/lib/events';
import { ROWS, START_HOUR } from '@/lib/timetable';

const COLORS: EventColor[] = ['highlight', 'green', 'blue', 'red', 'sage'];
const STEP = 10;
const BASE = START_HOUR * 60;
const MAX = ROWS * 60; // 격자 끝(익일 02시)까지

export const eventColor = (theme: AppTheme, c: EventColor) => theme[c];

/** 자정 기준 분 ↔ 격자(06:00=0) 기준 분 */
const toGrid = (m: number) => (m < BASE ? m + 1440 : m) - BASE;
const fromGrid = (g: number) => (g + BASE) % 1440;
const fmt = (g: number) => {
  const m = fromGrid(g);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

type Props = {
  /** 편집할 일정. 없으면 새 일정 */
  event?: Event;
  /** 새 일정 기본 시작 (자정 기준 분) */
  defaultStart: number;
  onClose: () => void;
  onSave: (event: Event) => void;
  onDelete: () => void;
};

/** 오늘만의 특별 일정 — 추가·상세·수정 시트. 열려 있는 동안만 마운트한다. */
export function EventSheet({ event, defaultStart, onClose, onSave, onDelete }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => sheetStyles(theme), [theme]);
  const extra = useMemo(() => makeExtra(theme), [theme]);
  const [title, setTitle] = useState(event?.title ?? '');
  const [memo, setMemo] = useState(event?.memo ?? '');
  const [color, setColor] = useState<EventColor>(event?.color ?? 'blue');
  const initStart = Math.min(MAX - STEP, toGrid(event?.start ?? defaultStart));
  const [start, setStart] = useState(initStart);
  const [end, setEnd] = useState(() => {
    if (!event) return Math.min(MAX, initStart + 60);
    const e = toGrid(event.end);
    return e > initStart ? e : MAX;
  });

  const moveStart = (d: number) => setStart((s) => Math.max(0, Math.min(end - STEP, s + d * STEP)));
  const moveEnd = (d: number) => setEnd((e) => Math.max(start + STEP, Math.min(MAX, e + d * STEP)));

  function save() {
    const t = title.trim();
    if (!t) return;
    const base = event ?? createEvent(t, 0, 0, color);
    onSave({ ...base, title: t, start: fromGrid(start), end: fromGrid(end), color, memo: memo.trim() || undefined });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{event ? '일정' : '오늘 일정 추가'}</Text>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={18} color={theme.ink} />
            </Pressable>
          </View>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="예: 치과 예약"
            placeholderTextColor={theme.textTertiary}
            style={extra.input}
            multiline
            autoFocus={!event}
          />

          <Text style={styles.label}>시간 (10분 단위)</Text>
          <View style={styles.timeRow}>
            <TimeField label={fmt(start)} onStep={moveStart} styles={styles} theme={theme} />
            <TimeField label={fmt(end)} onStep={moveEnd} styles={styles} theme={theme} />
          </View>

          <Text style={styles.label}>색</Text>
          <View style={styles.wrapRow}>
            {COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                accessibilityLabel={`색 ${c}`}
                style={[
                  extra.swatch,
                  { backgroundColor: eventColor(theme, c) },
                  c === color && { borderColor: theme.ink },
                ]}
              />
            ))}
          </View>

          <TextInput
            value={memo}
            onChangeText={setMemo}
            placeholder="메모 (선택)"
            placeholderTextColor={theme.textTertiary}
            style={[extra.input, { minHeight: 64 }]}
            multiline
          />

          <View style={styles.footer}>
            {event ? (
              <Pressable style={styles.deleteBtn} onPress={onDelete} accessibilityLabel="일정 삭제">
                <Ionicons name="trash-outline" size={20} color={theme.red} />
              </Pressable>
            ) : null}
            <Pressable style={[styles.saveBtn, !title.trim() && { opacity: 0.4 }]} onPress={save}>
              <Text style={styles.saveText}>저장</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeExtra = (theme: AppTheme) =>
  StyleSheet.create({
    input: {
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: PlannerRadius.md,
      paddingHorizontal: 16,
      paddingVertical: 12,
      color: theme.ink,
      ...PlannerType.body,
    },
    swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  });
