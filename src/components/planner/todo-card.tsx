import { useState, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PlannerCard } from './planner-card';
import { SectionHeader } from './section-header';

import { PlannerRadius, PlannerShadow, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import type { Task, TaskPriority } from '@/lib/tasks';

type TodoCardProps = {
  tasks: Task[];
  onAdd: (text: string, priority: TaskPriority) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

const priorityMeta = (theme: AppTheme): Record<TaskPriority, { label: string; color: string }> => ({
  high: { label: '높음', color: theme.red },
  mid: { label: '보통', color: theme.blue },
  low: { label: '낮음', color: theme.faint },
});

const PRIORITY_ORDER: TaskPriority[] = ['high', 'mid', 'low'];

export function TodoCard({ tasks, onAdd, onToggle, onDelete }: TodoCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [modalVisible, setModalVisible] = useState(false);
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('mid');

  const doneCount = tasks.filter((t) => t.done).length;

  function openModal() {
    setText('');
    setPriority('mid');
    setModalVisible(true);
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed, priority);
    setModalVisible(false);
  }

  return (
    <PlannerCard>
      <SectionHeader title="할 일" meta={`${doneCount}/${tasks.length}`} onAdd={openModal} />

      <View style={styles.list}>
        {tasks.map((item) => {
          const meta = priorityMeta(theme)[item.priority];
          return (
            <View key={item.id} style={styles.row}>
              <Pressable
                onPress={() => onToggle(item.id)}
                hitSlop={8}
                style={[styles.check, item.done && styles.checkDone]}>
                {item.done ? <Text style={styles.checkMark}>✓</Text> : null}
              </Pressable>

              <Text
                style={[styles.text, item.done && styles.textDone]}
                numberOfLines={2}>
                {item.text}
              </Text>

              <View style={[styles.tag, { borderColor: meta.color }]}>
                <Text style={[styles.tagText, { color: meta.color }]}>{meta.label}</Text>
              </View>

              <Pressable onPress={() => onDelete(item.id)} hitSlop={8} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>✕</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>할 일 추가</Text>

            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="할 일을 입력하세요"
              placeholderTextColor={theme.faint}
              style={styles.input}
              autoFocus
              onSubmitEditing={submit}
              returnKeyType="done"
            />

            <View style={styles.priorityRow}>
              {PRIORITY_ORDER.map((p) => {
                const m = priorityMeta(theme)[p];
                const selected = priority === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPriority(p)}
                    style={[
                      styles.priorityChip,
                      { borderColor: m.color },
                      selected && { backgroundColor: m.color },
                    ]}>
                    <Text style={[styles.priorityChipText, { color: selected ? theme.onAccent : m.color }]}>
                      {m.label}
                    </Text>
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
                disabled={!text.trim()}
                style={[styles.modalBtn, styles.modalBtnPrimary, !text.trim() && styles.modalBtnDisabled]}>
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
  list: {
    marginTop: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: PlannerRadius.chip,
    borderWidth: 2,
    borderColor: theme.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  checkMark: {
    color: theme.onAccent,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 15,
  },
  text: {
    flex: 1,
    color: theme.ink,
    fontSize: 15,
    fontWeight: '500',
  },
  textDone: {
    color: theme.faint,
    textDecorationLine: 'line-through',
  },
  tag: {
    borderRadius: PlannerRadius.chip,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteBtn: {
    paddingHorizontal: Spacing.one,
  },
  deleteText: {
    color: theme.faint,
    fontSize: 15,
    fontWeight: '700',
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
  priorityRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  priorityChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: PlannerRadius.chip,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: Spacing.two,
  },
  priorityChipText: {
    fontSize: 13,
    fontWeight: '700',
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
