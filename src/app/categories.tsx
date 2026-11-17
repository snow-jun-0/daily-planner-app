import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryForm } from '@/components/planner/category-form';
import { withAlpha } from '@/components/planner/mini-grid';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerShadow, PlannerType } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { weekKeys } from '@/lib/date';
import {
  actualByCategory,
  CATEGORY_COLORS,
  createCategory,
  FOCUS_CATEGORY,
  loadCategories,
  loadTimetable,
  saveCategories,
  timetableDateKey,
  type Category,
  type SubjectId,
} from '@/lib/timetable';

function fmtHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

/** G9 — 카테고리(과목) 관리: 이름·색 편집, 추가/삭제 */
export default function CategoriesScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [cats, setCats] = useState<Category[]>([]);
  const [weekMin, setWeekMin] = useState<Record<SubjectId, number>>({});
  /** 편집 중인 카테고리 id — null이면 새 카테고리 */
  const [editId, setEditId] = useState<SubjectId | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);

  useEffect(() => {
    void loadCategories().then(setCats);
    void Promise.all(weekKeys(timetableDateKey()).map(loadTimetable)).then((days) => {
      const sum: Record<SubjectId, number> = {};
      for (const d of days)
        for (const [id, m] of Object.entries(actualByCategory(d))) sum[id] = (sum[id] ?? 0) + m;
      setWeekMin(sum);
    });
  }, []);

  function persist(next: Category[]) {
    setCats(next);
    void saveCategories(next);
  }

  function startNew() {
    setEditId(null);
    setName('');
    setColor(CATEGORY_COLORS[cats.length % CATEGORY_COLORS.length]);
  }

  function startEdit(c: Category) {
    setEditId(c.id);
    setName(c.name);
    setColor(c.color);
  }

  function submit() {
    const n = name.trim();
    if (!n) return;
    if (editId) persist(cats.map((c) => (c.id === editId ? { ...c, name: n, color } : c)));
    else persist([...cats, createCategory(n, color)]);
    startNew();
  }

  function remove() {
    if (!editId) return;
    // 지운 과목으로 칠한 칸은 기본(집중) 색으로 보인다
    persist(cats.filter((c) => c.id !== editId));
    startNew();
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerSide}>
          <Ionicons name="chevron-back" size={22} color={theme.ink} />
        </Pressable>
        <Text style={styles.title}>카테고리</Text>
        <Pressable onPress={startNew} hitSlop={10} style={styles.plusBtn}>
          <Ionicons name="add" size={22} color={theme.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.desc}>
          카테고리마다 색 하나. 왼쪽 칸이 실제(진한 색), 오른쪽 칸이 계획(연한 색 + 테두리)이에요.
        </Text>

        <View style={styles.card}>
          {[...cats.filter((c) => c.id !== FOCUS_CATEGORY.id), FOCUS_CATEGORY].map((c, i) => {
            const locked = c.id === FOCUS_CATEGORY.id;
            const min = weekMin[c.id] ?? 0;
            return (
              <Pressable
                key={c.id}
                disabled={locked}
                onPress={() => startEdit(c)}
                style={[styles.row, i > 0 && styles.rowBorder]}>
                {locked ? (
                  <Ionicons name="lock-closed-outline" size={14} color={theme.textTertiary} />
                ) : (
                  <View style={styles.rowIconSpace} />
                )}
                <Swatches color={c.color} styles={styles} />
                <Text style={[styles.rowName, editId === c.id && { color: c.color }]}>
                  {locked ? '집중 (과목 없음)' : c.name}
                </Text>
                <Text style={styles.rowMeta}>
                  {locked ? '기본색' : `${i === 0 ? '이번 주 ' : ''}${fmtHM(min)}`}
                </Text>
                {locked ? null : (
                  <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.editTitle}>{editId ? '카테고리 편집' : '새 카테고리'}</Text>
          <CategoryForm name={name} onName={setName} color={color} onColor={setColor} />
          <View style={styles.btnRow}>
            <Pressable style={styles.cancelBtn} onPress={editId ? remove : startNew}>
              <Text style={[styles.cancelText, editId ? { color: theme.red } : null]}>
                {editId ? '삭제' : '취소'}
              </Text>
            </Pressable>
            <Pressable style={styles.okBtn} onPress={submit}>
              <Text style={styles.okText}>{editId ? '저장' : '추가'}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Swatches({ color, styles }: { color: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.swatches}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <View
        style={[styles.swatch, { backgroundColor: withAlpha(color, 0.18), borderColor: color }]}
      />
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    headerSide: { width: 28 },
    title: { ...PlannerType.titleM, color: theme.ink, flex: 1 },
    plusBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { padding: 20, paddingTop: 4, gap: 16 },
    desc: { ...PlannerType.caption, color: theme.textSecondary },
    card: {
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.card,
      padding: 16,
      gap: 12,
      ...PlannerShadow,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
    rowBorder: { borderTopWidth: 1, borderTopColor: theme.line, paddingTop: 14 },
    rowIconSpace: { width: 14 },
    rowName: { ...PlannerType.bodyMedium, color: theme.ink, flex: 1 },
    rowMeta: { ...PlannerType.caption, color: theme.textSecondary },
    swatches: { flexDirection: 'row', gap: 2 },
    swatch: { width: 24, height: 22, borderRadius: 5, borderWidth: 1, borderColor: 'transparent' },
    editTitle: { ...PlannerType.titleS, color: theme.ink },
    btnRow: { flexDirection: 'row', gap: 8 },
    cancelBtn: {
      flex: 1,
      paddingVertical: 13,
      alignItems: 'center',
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.surface,
    },
    cancelText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.ink },
    okBtn: {
      flex: 1,
      paddingVertical: 13,
      alignItems: 'center',
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.accent,
    },
    okText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
  });
