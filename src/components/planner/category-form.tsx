import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { withAlpha } from '@/components/planner/mini-grid';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerType } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { CATEGORY_COLORS, createCategory, type Category } from '@/lib/timetable';

type FormProps = {
  name: string;
  onName: (v: string) => void;
  color: string;
  onColor: (v: string) => void;
  /** 이름 빠른 선택 칩 */
  presets?: string[];
};

/** 과목 이름·색 입력 + 미리보기 (G9 카테고리 화면, H8 첫 과목 시트 공용) */
export function CategoryForm({ name, onName, color, onColor, presets }: FormProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <>
      <TextInput
        value={name}
        onChangeText={onName}
        placeholder="예: 자격증"
        placeholderTextColor={theme.textTertiary}
        style={styles.input}
      />
      {presets ? (
        <View style={styles.presets}>
          {presets.map((p) => {
            const on = p === name;
            return (
              <Pressable key={p} onPress={() => onName(p)} style={[styles.preset, on && styles.presetOn]}>
                <Text style={[styles.presetText, on && styles.presetTextOn]}>{p}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={styles.paletteRow}>
        {CATEGORY_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => onColor(c)}
            accessibilityLabel={`색 ${c}`}
            style={[styles.paletteRing, color === c && { borderColor: theme.ink }]}>
            <View style={[styles.paletteDot, { backgroundColor: c }]} />
          </Pressable>
        ))}
      </View>
      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>미리보기</Text>
        <View style={styles.previewCells}>
          {[1, 1, 1, 0, 0, 0].map((actual, i) => (
            <View
              key={i}
              style={[
                styles.previewCell,
                actual
                  ? { backgroundColor: color }
                  : { backgroundColor: withAlpha(color, 0.18), borderColor: color },
              ]}
            />
          ))}
        </View>
      </View>
    </>
  );
}

const PRESETS = ['수학', '영어', '국어', '전공', '코딩', '자격증', '독서'];

/** H8 — 첫 과목 만들기 시트. 열려 있는 동안만 마운트한다. */
export function NewCategorySheet({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (cat: Category) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [name, setName] = useState(PRESETS[0]);
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>첫 과목 만들기</Text>
          <Text style={styles.sub}>가장 자주 하는 것 하나만 먼저. 나중에 더 추가할 수 있어요.</Text>
          <CategoryForm
            name={name}
            onName={setName}
            color={color}
            onColor={setColor}
            presets={PRESETS}
          />
          <Pressable
            style={styles.okBtn}
            onPress={() => name.trim() && onCreate(createCategory(name.trim(), color))}>
            <Text style={styles.okText}>만들고 칠하러 가기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (theme: AppTheme) =>
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
    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    preset: {
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: PlannerRadius.chip,
      borderWidth: 1,
      borderColor: theme.line,
    },
    presetOn: { backgroundColor: theme.accent, borderColor: theme.accent },
    presetText: { ...PlannerType.labelStrong, color: theme.textSecondary },
    presetTextOn: { color: theme.onAccent },
    paletteRow: { flexDirection: 'row', justifyContent: 'space-between' },
    paletteRing: {
      padding: 3,
      borderRadius: PlannerRadius.sm,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    paletteDot: { width: 26, height: 26, borderRadius: 6 },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    previewLabel: { ...PlannerType.caption, color: theme.textSecondary, flex: 1 },
    previewCells: { flexDirection: 'row', gap: 3 },
    previewCell: {
      width: 28,
      height: 22,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: PlannerRadius.lg,
      borderTopRightRadius: PlannerRadius.lg,
      padding: 20,
      paddingTop: 10,
      gap: 14,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.line,
      marginBottom: 6,
    },
    title: { ...PlannerType.titleM, color: theme.ink },
    sub: { ...PlannerType.caption, color: theme.textSecondary, marginTop: -10 },
    okBtn: {
      marginTop: 4,
      backgroundColor: theme.accent,
      borderRadius: PlannerRadius.md,
      paddingVertical: 15,
      alignItems: 'center',
    },
    okText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
  });
