import { useState, useMemo } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PlannerCard } from './planner-card';
import { SectionHeader } from './section-header';

import { PlannerRadius, PlannerShadow, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import type { Event, EventColor } from '@/lib/events';

type ScheduleCardProps = {
  startHour?: number;
  endHour?: number;
  events: Event[];
  onAdd: (title: string, start: number, end: number, color: EventColor) => void;
  onDelete: (id: string) => void;
};

const ROW_HEIGHT = 56;
const GUTTER = 48; // width of the time-label column
const STEP = 10; // minute increment for the add-event time steppers

const blockBg = (theme: AppTheme): Record<EventColor, string> => ({
  highlight: theme.highlight,
  green: theme.green,
  blue: theme.blue,
  red: theme.red,
  sage: theme.sage,
});

const COLOR_META: Record<EventColor, { label: string; onLight: boolean }> = {
  highlight: { label: '노랑', onLight: true },
  green: { label: '초록', onLight: false },
  blue: { label: '파랑', onLight: false },
  red: { label: '빨강', onLight: false },
  sage: { label: '세이지', onLight: true },
};

const COLOR_ORDER: EventColor[] = ['highlight', 'green', 'blue', 'red', 'sage'];

function fmt(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ScheduleCard({
  startHour = 6,
  endHour = 24,
  events,
  onAdd,
  onDelete,
}: ScheduleCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const gridStart = startHour * 60;
  const gridEnd = endHour * 60;

  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(gridStart + 3 * 60);
  const [end, setEnd] = useState(gridStart + 4 * 60);
  const [color, setColor] = useState<EventColor>('highlight');

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = hours.length * ROW_HEIGHT;
  const pxPerMin = ROW_HEIGHT / 60;

  function openModal() {
    setTitle('');
    setStart(gridStart + 3 * 60);
    setEnd(gridStart + 4 * 60);
    setColor('highlight');
    setModalVisible(true);
  }

  function adjustStart(delta: number) {
    setStart((s) => clamp(s + delta, gridStart, end - STEP));
  }

  function adjustEnd(delta: number) {
    setEnd((e) => clamp(e + delta, start + STEP, gridEnd));
  }

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, start, end, color);
    setModalVisible(false);
  }

  function confirmDelete(ev: Event) {
    Alert.alert('일정 삭제', `"${ev.title}" 일정을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => onDelete(ev.id) },
    ]);
  }

  return (
    <PlannerCard>
      <SectionHeader title="시간표" onAdd={openModal} />

      <View style={[styles.grid, { height: gridHeight }]}>
        {/* hour rows */}
        {hours.map((h, i) => (
          <View key={h} style={[styles.row, { top: i * ROW_HEIGHT }]}>
            <Text style={styles.hourLabel}>{fmt(h * 60)}</Text>
            <View style={styles.rowLine} />
          </View>
        ))}

        {/* event blocks */}
        {events.map((ev) => {
          const top = (ev.start - gridStart) * pxPerMin;
          const height = Math.max(28, (ev.end - ev.start) * pxPerMin - 4);
          const onLight = COLOR_META[ev.color].onLight;
          return (
            <Pressable
              key={ev.id}
              onPress={() => confirmDelete(ev)}
              style={[styles.block, { top, height, backgroundColor: blockBg(theme)[ev.color] }]}>
              <Text
                style={[styles.blockTitle, { color: onLight ? theme.ink : theme.onAccent }]}
                numberOfLines={1}>
                {ev.title}
              </Text>
              <Text
                style={[
                  styles.blockTime,
                  { color: onLight ? 'rgba(31,38,35,0.66)' : theme.onAccentFaint },
                ]}>
                {fmt(ev.start)} – {fmt(ev.end)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>일정 추가</Text>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="일정 이름을 입력하세요"
              placeholderTextColor={theme.faint}
              style={styles.input}
              autoFocus
              returnKeyType="done"
            />

            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>시작</Text>
              <View style={styles.stepper}>
                <Pressable onPress={() => adjustStart(-STEP)} style={styles.stepperBtn} hitSlop={8}>
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{fmt(start)}</Text>
                <Pressable onPress={() => adjustStart(STEP)} style={styles.stepperBtn} hitSlop={8}>
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>종료</Text>
              <View style={styles.stepper}>
                <Pressable onPress={() => adjustEnd(-STEP)} style={styles.stepperBtn} hitSlop={8}>
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{fmt(end)}</Text>
                <Pressable onPress={() => adjustEnd(STEP)} style={styles.stepperBtn} hitSlop={8}>
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.colorRow}>
              {COLOR_ORDER.map((c) => {
                const meta = COLOR_META[c];
                const selected = color === c;
                return (
                  <Pressable key={c} onPress={() => setColor(c)} style={styles.colorItem}>
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: blockBg(theme)[c] },
                        selected && styles.colorSwatchSelected,
                      ]}>
                      {selected ? (
                        <Text style={[styles.colorCheck, { color: meta.onLight ? theme.ink : theme.onAccent }]}>
                          ✓
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.colorLabel}>{meta.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={[styles.modalBtn, styles.modalBtnGhost]}>
                <Text style={styles.modalBtnGhostText}>취소</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!title.trim()}
                style={[styles.modalBtn, styles.modalBtnPrimary, !title.trim() && styles.modalBtnDisabled]}>
                <Text style={styles.modalBtnPrimaryText}>추가</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </PlannerCard>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
  grid: {
    marginTop: Spacing.three,
    position: 'relative',
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourLabel: {
    width: GUTTER,
    color: theme.faint,
    fontSize: 12,
    fontWeight: '600',
    marginTop: -6,
  },
  rowLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: theme.line,
  },
  block: {
    position: 'absolute',
    left: GUTTER + Spacing.one,
    right: 0,
    borderRadius: PlannerRadius.block,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    justifyContent: 'center',
    gap: 2,
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  blockTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.card,
    borderRadius: PlannerRadius.card,
    padding: Spacing.four,
    gap: Spacing.three,
    ...PlannerShadow,
  },
  modalTitle: {
    color: theme.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.line,
    borderRadius: PlannerRadius.block,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    color: theme.ink,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeLabel: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: PlannerRadius.chip,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    color: theme.ink,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  stepperValue: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 52,
    textAlign: 'center',
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  colorItem: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: PlannerRadius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 2,
    borderColor: theme.accent,
  },
  colorCheck: {
    fontSize: 14,
    fontWeight: '900',
  },
  colorLabel: {
    color: theme.faint,
    fontSize: 11,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: PlannerRadius.block,
    paddingVertical: Spacing.two + 2,
  },
  modalBtnGhost: {
    backgroundColor: theme.accentSoft,
  },
  modalBtnGhostText: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  modalBtnPrimary: {
    backgroundColor: theme.accent,
  },
  modalBtnDisabled: {
    opacity: 0.4,
  },
  modalBtnPrimaryText: {
    color: theme.onAccent,
    fontSize: 14,
    fontWeight: '700',
  },
});
