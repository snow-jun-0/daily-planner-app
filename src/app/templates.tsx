import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { withAlpha } from '@/components/planner/mini-grid';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerShadow, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import {
  applyTemplate,
  CELL_MIN,
  COLS,
  FOCUS_CATEGORY,
  loadCategories,
  loadTemplates,
  loadTimetable,
  ROWS,
  saveTemplates,
  templateFromDay,
  timetableDateKey,
  updateTimetable,
  type Category,
  type PlanTemplate,
  type SubjectId,
} from '@/lib/timetable';

const WEEK_MON = ['월', '화', '수', '목', '금', '토', '일'];

function fmtHM(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}시간${m ? ` ${m}분` : ''}` : `${m}분`;
}
function weekdayMon(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** I5 — 시간표(요일) 템플릿 */
export default function TemplatesScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [list, setList] = useState<PlanTemplate[]>([]);
  const [cats, setCats] = useState<Category[]>([FOCUS_CATEGORY]);
  const [editId, setEditId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadTemplates().then(setList);
      void loadCategories().then(setCats);
    }, []),
  );

  const catMap = useMemo(
    () => Object.fromEntries(cats.map((c) => [c.id, c])) as Record<SubjectId, Category>,
    [cats],
  );

  function persist(next: PlanTemplate[]) {
    setList(next);
    void saveTemplates(next);
  }

  async function saveToday() {
    const today = timetableDateKey();
    const day = await loadTimetable(today);
    if (!day.cells.some((c) => c.planned)) {
      Alert.alert('템플릿 저장', '오늘 칠한 계획이 없어요. 먼저 격자에 계획을 칠해 주세요.');
      return;
    }
    const tpl = templateFromDay(`${WEEK_MON[weekdayMon(today)]}요일 시간표`, [weekdayMon(today)], day);
    persist([...list, tpl]);
    setEditId(tpl.id);
  }

  function apply(tpl: PlanTemplate) {
    void updateTimetable(timetableDateKey(), (d) => applyTemplate(d, tpl)).then(() => router.back());
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={theme.ink} />
        </Pressable>
        <Text style={styles.title}>시간표 템플릿</Text>
        <Pressable style={styles.plusBtn} onPress={() => void saveToday()} accessibilityLabel="템플릿 추가">
          <Ionicons name="add" size={22} color={theme.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.caption}>
          매주 반복되는 공부 계획을 저장해 두고 한 번에 칠해요. 요일을 정해 두면 그 요일 빈 격자에
          적용 버튼이 떠요.
        </Text>

        {list.length === 0 ? (
          <Text style={[styles.caption, styles.empty]}>아직 템플릿이 없어요.</Text>
        ) : null}

        {list.map((tpl) => {
          const editing = editId === tpl.id;
          const planned = tpl.planned.filter(Boolean).length * CELL_MIN;
          return (
            <View key={tpl.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.preview}>
                  {Array.from({ length: ROWS }).map((_, r) => (
                    <View key={r} style={styles.previewRow}>
                      {Array.from({ length: COLS }).map((_, c) => {
                        const sub = tpl.planned[r * COLS + c];
                        const color = sub ? (catMap[sub]?.color ?? FOCUS_CATEGORY.color) : null;
                        return (
                          <View
                            key={c}
                            style={[
                              styles.previewCell,
                              { backgroundColor: color ? withAlpha(color, 0.6) : 'transparent' },
                            ]}
                          />
                        );
                      })}
                    </View>
                  ))}
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  {editing ? (
                    <TextInput
                      value={tpl.name}
                      onChangeText={(name) =>
                        persist(list.map((t) => (t.id === tpl.id ? { ...t, name } : t)))
                      }
                      style={styles.nameInput}
                    />
                  ) : (
                    <Text style={styles.name}>{tpl.name}</Text>
                  )}
                  <Text style={styles.caption}>계획 {fmtHM(planned)}</Text>
                  <View style={styles.days}>
                    {WEEK_MON.map((d, i) => {
                      const on = tpl.days.includes(i);
                      return (
                        <Pressable
                          key={d}
                          disabled={!editing}
                          onPress={() =>
                            persist(
                              list.map((t) =>
                                t.id === tpl.id
                                  ? {
                                      ...t,
                                      days: on ? t.days.filter((x) => x !== i) : [...t.days, i],
                                    }
                                  : t,
                              ),
                            )
                          }
                          style={[styles.day, on && styles.dayOn]}>
                          <Text style={[styles.dayText, on && styles.dayTextOn]}>{d}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
              <View style={styles.btns}>
                {editing ? (
                  <>
                    <Pressable
                      style={styles.ghostBtn}
                      onPress={() => {
                        persist(list.filter((t) => t.id !== tpl.id));
                        setEditId(null);
                      }}>
                      <Text style={[styles.btnText, { color: theme.red }]}>삭제</Text>
                    </Pressable>
                    <Pressable style={styles.outlineBtn} onPress={() => setEditId(null)}>
                      <Text style={styles.btnText}>완료</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable style={styles.ghostBtn} onPress={() => apply(tpl)}>
                      <Text style={styles.btnText}>오늘에 적용</Text>
                    </Pressable>
                    <Pressable style={styles.outlineBtn} onPress={() => setEditId(tpl.id)}>
                      <Text style={styles.btnText}>편집</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          );
        })}

        <Pressable style={styles.primaryBtn} onPress={() => void saveToday()}>
          <Text style={styles.primaryText}>오늘 시간표를 템플릿으로 저장</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    title: { ...PlannerType.titleM, color: theme.ink, flex: 1 },
    plusBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
    caption: { ...PlannerType.caption, color: theme.textSecondary },
    empty: { textAlign: 'center', paddingVertical: Spacing.five },
    card: {
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.card,
      padding: Spacing.three,
      gap: 14,
      ...PlannerShadow,
    },
    cardTop: { flexDirection: 'row', gap: 14 },
    preview: {
      width: 64,
      padding: 4,
      gap: 1,
      borderRadius: PlannerRadius.sm,
      backgroundColor: theme.surface,
    },
    previewRow: { flexDirection: 'row', gap: 1 },
    previewCell: { flex: 1, height: 2.5, borderRadius: 1 },
    name: { ...PlannerType.labelStrong, fontSize: 16, color: theme.ink },
    nameInput: {
      ...PlannerType.labelStrong,
      fontSize: 16,
      color: theme.ink,
      borderBottomWidth: 1,
      borderBottomColor: theme.line,
      paddingVertical: 2,
    },
    days: { flexDirection: 'row', gap: 4 },
    day: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayOn: { backgroundColor: theme.accent },
    dayText: { ...PlannerType.caption, fontSize: 11, color: theme.textTertiary },
    dayTextOn: { color: theme.onAccent, fontWeight: '700' },
    btns: { flexDirection: 'row', gap: 8 },
    ghostBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.surface,
      alignItems: 'center',
    },
    outlineBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: PlannerRadius.md,
      borderWidth: 1,
      borderColor: theme.line,
      alignItems: 'center',
    },
    btnText: { ...PlannerType.labelStrong, color: theme.ink },
    primaryBtn: {
      marginTop: 4,
      paddingVertical: 16,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.accent,
      alignItems: 'center',
    },
    primaryText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
  });
