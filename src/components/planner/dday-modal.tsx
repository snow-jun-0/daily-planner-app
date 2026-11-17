import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MiniCalendar } from './mini-calendar';

import { Planner, PlannerRadius, PlannerSerif, Spacing } from '@/constants/theme';
import { formatDisplayDate } from '@/lib/date';
import { addDDay, DDAY_COLORS, getDDayCount, loadVisibleDDays, removeDDay, type DDay } from '@/lib/dday';

type Props = {
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
};

export function DDayModal({ visible, onClose, onChanged }: Props) {
  const [list, setList] = useState<DDay[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [color, setColor] = useState(DDAY_COLORS[0]);
  const [showCal, setShowCal] = useState(false);

  const reload = () => {
    void loadVisibleDDays().then(setList);
  };
  useEffect(() => {
    if (visible) reload();
  }, [visible]);

  const canSave = title.trim().length > 0 && date.length > 0;

  const save = async () => {
    if (!canSave) return;
    await addDDay({ title: title.trim(), date, color });
    setTitle('');
    setDate('');
    setColor(DDAY_COLORS[0]);
    setShowCal(false);
    reload();
    onChanged();
  };

  const del = async (id: string) => {
    await removeDDay(id);
    reload();
    onChanged();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.headerRow}>
            <Text style={styles.heading}>D-Day</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={Planner.faint} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {list.length === 0 ? (
              <Text style={styles.empty}>아직 D-Day가 없어요. 아래에서 추가해봐요.</Text>
            ) : (
              list.map((d) => (
                <View key={d.id} style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: d.color }]} />
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {d.title}
                  </Text>
                  <Text style={styles.rowDday}>{getDDayCount(d.date)}</Text>
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push(`/dday-plan?id=${d.id}` as never);
                    }}
                    hitSlop={8}
                    accessibilityLabel="역산 계획">
                    <Ionicons name="analytics-outline" size={16} color={Planner.faint} />
                  </Pressable>
                  <Pressable onPress={() => del(d.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={Planner.faint} />
                  </Pressable>
                </View>
              ))
            )}

            <View style={styles.form}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="이름 (예: 기말고사)"
                placeholderTextColor={Planner.faint}
                style={styles.input}
              />
              <Pressable style={styles.dateBtn} onPress={() => setShowCal((v) => !v)}>
                <Text style={[styles.dateBtnText, { color: date ? Planner.ink : Planner.faint }]}>
                  {date ? formatDisplayDate(date) : '날짜 선택'}
                </Text>
                <Ionicons
                  name={showCal ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={Planner.faint}
                />
              </Pressable>
              {showCal ? (
                <MiniCalendar
                  value={date}
                  onChange={(d) => {
                    setDate(d);
                    setShowCal(false);
                  }}
                />
              ) : null}

              <View style={styles.colorRow}>
                {DDAY_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorSel]}
                  />
                ))}
              </View>

              <Pressable
                onPress={save}
                disabled={!canSave}
                style={[styles.saveBtn, !canSave && styles.saveDisabled]}>
                <Text style={styles.saveText}>추가</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Planner.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.four,
    maxHeight: '85%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  heading: { color: Planner.ink, fontFamily: PlannerSerif, fontSize: 22, fontWeight: '600' },
  empty: { color: Planner.faint, fontSize: 13, paddingVertical: Spacing.three, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Planner.line,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowTitle: { flex: 1, color: Planner.ink, fontSize: 14, fontWeight: '600' },
  rowDday: { color: Planner.accent, fontSize: 13, fontWeight: '700' },
  form: { marginTop: Spacing.three, gap: Spacing.two },
  input: {
    backgroundColor: Planner.paper,
    borderRadius: PlannerRadius.block,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: Planner.line,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 14,
    color: Planner.ink,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Planner.paper,
    borderRadius: PlannerRadius.block,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: Planner.line,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  dateBtnText: { fontSize: 14 },
  colorRow: { flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.one },
  colorDot: { width: 26, height: 26, borderRadius: 13 },
  colorSel: { borderWidth: 3, borderColor: Planner.card },
  saveBtn: {
    backgroundColor: Planner.accent,
    borderRadius: PlannerRadius.block,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  saveDisabled: { opacity: 0.4 },
  saveText: { color: Planner.onAccent, fontSize: 15, fontWeight: '700' },
});
