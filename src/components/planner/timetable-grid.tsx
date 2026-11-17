import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerShadow, PlannerType } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import {
  achievementRate,
  actualByCategory,
  COLS,
  createCategory,
  dateToCellIndex,
  FOCUS_CATEGORY,
  loadCategories,
  loadTimetable,
  ROWS,
  START_HOUR,
  saveCategories,
  saveTimetable,
  totalActualMin,
  totalPlannedMin,
  type Category,
  type Cell,
  type DayTimetable,
  type SubjectId,
} from '@/lib/timetable';

const CELL_H = 26;
const PALETTE = [
  '#4C6EF5',
  '#2F9E44',
  '#E8590C',
  '#9C36B5',
  '#1098AD',
  '#E03131',
  '#F08C00',
  '#5C7CFA',
];

function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function fmtTotal(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}H ${String(m).padStart(2, '0')}M`;
}
function fmtHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}
function hourLabel(row: number): string {
  const h = (START_HOUR + row) % 24;
  return String(h).padStart(2, '0');
}

type Props = { dateKey: string; isToday: boolean; onStartFocus?: () => void };

export function TimetableGrid({ dateKey, isToday, onStartFocus }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [day, setDay] = useState<DayTimetable | null>(null);
  const [cats, setCats] = useState<Category[]>([FOCUS_CATEGORY]);
  const [activeCat, setActiveCat] = useState<SubjectId>(FOCUS_CATEGORY.id);
  const [erase, setErase] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const dayRef = useRef<DayTimetable | null>(null);
  const gridW = useRef(0);
  const painted = useRef<Set<number>>(new Set());
  const activeCatRef = useRef(activeCat);
  const eraseRef = useRef(erase);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  activeCatRef.current = activeCat;
  eraseRef.current = erase;

  useEffect(() => {
    let alive = true;
    void loadTimetable(dateKey).then((d) => {
      if (alive) {
        setDay(d);
        dayRef.current = d;
      }
    });
    return () => {
      alive = false;
    };
  }, [dateKey]);

  useEffect(() => {
    void loadCategories().then(setCats);
  }, []);

  const catMap = useMemo(
    () => Object.fromEntries(cats.map((c) => [c.id, c])) as Record<SubjectId, Category>,
    [cats],
  );

  function persist(next: DayTimetable) {
    dayRef.current = next;
    setDay(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveTimetable(dateKey, next), 400);
  }

  function paintIndex(idx: number) {
    const d = dayRef.current;
    if (!d || idx < 0 || idx >= d.cells.length || painted.current.has(idx)) return;
    painted.current.add(idx);
    const cells = d.cells.slice();
    const cur = cells[idx] ?? {};
    cells[idx] = eraseRef.current
      ? { ...cur, planned: undefined }
      : { ...cur, planned: activeCatRef.current };
    persist({ ...d, cells });
  }

  function paintAt(x: number, y: number) {
    const w = gridW.current;
    if (!w) return;
    const col = Math.floor(x / (w / COLS));
    const row = Math.floor(y / CELL_H);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    paintIndex(row * COLS + col);
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        painted.current.clear();
        paintAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
      },
      onPanResponderMove: (e) => {
        paintAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
      },
      onPanResponderRelease: () => painted.current.clear(),
      onPanResponderTerminate: () => painted.current.clear(),
    }),
  ).current;

  function addCategory(name: string) {
    const color = PALETTE[cats.length % PALETTE.length];
    const next = [...cats, createCategory(name || `과목 ${cats.length}`, color)];
    setCats(next);
    void saveCategories(next);
  }

  if (!day) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>타임테이블</Text>
        <View style={styles.skeleton} />
      </View>
    );
  }

  const actualMin = totalActualMin(day);
  const plannedMin = totalPlannedMin(day);
  const rate = achievementRate(day);
  const byCat = actualByCategory(day);
  const nowIdx = isToday ? dateToCellIndex(new Date()) : -1;
  const nowRow = nowIdx >= 0 ? Math.floor(nowIdx / COLS) : -1;

  const cellBg = (cell: Cell): string => {
    if (cell.actual) return catMap[cell.actual]?.color ?? FOCUS_CATEGORY.color;
    if (cell.planned)
      return withAlpha(catMap[cell.planned]?.color ?? FOCUS_CATEGORY.color, 0.28);
    return theme.surface;
  };

  return (
    <View style={styles.card}>
      <View style={styles.totalRow}>
        <View>
          <Text style={styles.totalLabel}>TOTAL TIME</Text>
          <Text style={styles.totalValue}>{fmtTotal(actualMin)}</Text>
        </View>
        {plannedMin > 0 ? (
          <View style={styles.rateBox}>
            <Text style={styles.rateText}>{Math.round(rate * 100)}%</Text>
            <Text style={styles.rateSub}>계획 {fmtHM(plannedMin)}</Text>
          </View>
        ) : (
          <Text style={styles.rateSub}>계획 없음</Text>
        )}
      </View>

      {Object.keys(byCat).length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statRow}>
          {Object.entries(byCat).map(([id, min]) => (
            <View key={id} style={styles.statChip}>
              <View
                style={[styles.dot, { backgroundColor: catMap[id]?.color ?? FOCUS_CATEGORY.color }]}
              />
              <Text style={styles.statName}>{catMap[id]?.name ?? '집중'}</Text>
              <Text style={styles.statMin}>{fmtHM(min)}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>타임테이블</Text>
        <Text style={styles.hint}>드래그해서 계획을 칠하세요</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
        {cats.map((c) => {
          const on = activeCat === c.id && !erase;
          return (
            <Pressable
              key={c.id}
              onPress={() => {
                setActiveCat(c.id);
                setErase(false);
              }}
              style={[
                styles.catChip,
                on && { borderColor: c.color, backgroundColor: withAlpha(c.color, 0.12) },
              ]}>
              <View style={[styles.dot, { backgroundColor: c.color }]} />
              <Text style={[styles.catName, on && { color: c.color }]}>{c.name}</Text>
            </Pressable>
          );
        })}
        <Pressable style={styles.catChip} onPress={() => setAddOpen(true)}>
          <Text style={styles.catName}>+ 과목</Text>
        </Pressable>
        <Pressable
          style={[
            styles.catChip,
            erase && { borderColor: theme.ink, backgroundColor: theme.surface },
          ]}
          onPress={() => setErase((v) => !v)}>
          <Text style={[styles.catName, erase && { color: theme.ink }]}>지우개</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.gridWrap}>
        <View style={styles.axis}>
          {Array.from({ length: ROWS }).map((_, r) => (
            <View key={r} style={styles.axisCell}>
              <Text style={[styles.axisText, r === nowRow && styles.axisTextNow]}>
                {hourLabel(r)}
              </Text>
            </View>
          ))}
        </View>
        <View
          style={styles.grid}
          onLayout={(e) => (gridW.current = e.nativeEvent.layout.width)}
          {...pan.panHandlers}>
          {Array.from({ length: ROWS }).map((_, r) => (
            <View key={r} style={styles.gridRow}>
              {Array.from({ length: COLS }).map((_, c) => {
                const idx = r * COLS + c;
                return (
                  <View key={c} style={[styles.cell, { backgroundColor: cellBg(day.cells[idx] ?? {}) }]} />
                );
              })}
            </View>
          ))}
          {nowRow >= 0 ? <View style={[styles.nowLine, { top: nowRow * CELL_H }]} /> : null}
        </View>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: withAlpha(theme.ink, 0.28) }]} />
          <Text style={styles.legendText}>계획</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: theme.ink }]} />
          <Text style={styles.legendText}>실제</Text>
        </View>
      </View>

      <Pressable style={styles.focusBtn} onPress={onStartFocus}>
        <Text style={styles.focusBtnText}>바로 집중 시작</Text>
      </Pressable>

      <AddCategoryModal
        visible={addOpen}
        theme={theme}
        onClose={() => setAddOpen(false)}
        onAdd={(name) => {
          addCategory(name);
          setAddOpen(false);
        }}
      />
    </View>
  );
}

function AddCategoryModal({
  visible,
  theme,
  onClose,
  onAdd,
}: {
  visible: boolean;
  theme: AppTheme;
  onClose: () => void;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBg} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>과목 추가</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="예: 자료구조"
            placeholderTextColor={theme.textTertiary}
            style={styles.modalInput}
            autoFocus
          />
          <View style={styles.modalBtns}>
            <Pressable style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>취소</Text>
            </Pressable>
            <Pressable
              style={styles.modalOk}
              onPress={() => {
                onAdd(name.trim());
                setName('');
              }}>
              <Text style={styles.modalOkText}>추가</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.card,
      padding: 16,
      gap: 12,
      ...PlannerShadow,
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    totalLabel: { ...PlannerType.overline, color: theme.textTertiary },
    totalValue: { ...PlannerType.display, color: theme.ink },
    rateBox: { alignItems: 'flex-end' },
    rateText: { ...PlannerType.titleM, color: theme.ink },
    rateSub: { ...PlannerType.caption, color: theme.textSecondary },
    statRow: { flexGrow: 0 },
    statChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 4,
      paddingHorizontal: 8,
      marginRight: 6,
      borderRadius: PlannerRadius.chip,
      backgroundColor: theme.surface,
    },
    statName: { ...PlannerType.caption, color: theme.ink },
    statMin: { ...PlannerType.caption, color: theme.textSecondary },
    dot: { width: 8, height: 8, borderRadius: 4 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    sectionTitle: { ...PlannerType.titleS, color: theme.ink },
    hint: { ...PlannerType.caption, color: theme.textTertiary },
    catRow: { flexGrow: 0 },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 5,
      paddingHorizontal: 10,
      marginRight: 6,
      borderRadius: PlannerRadius.chip,
      borderWidth: 1,
      borderColor: theme.line,
    },
    catName: { ...PlannerType.label, color: theme.textSecondary },
    gridWrap: { flexDirection: 'row', marginTop: 4 },
    axis: { width: 26 },
    axisCell: { height: CELL_H, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 6 },
    axisText: { ...PlannerType.caption, color: theme.textTertiary, fontSize: 11 },
    axisTextNow: { color: theme.red, fontWeight: '700' },
    grid: { flex: 1, position: 'relative' },
    gridRow: { flexDirection: 'row', height: CELL_H },
    cell: { flex: 1, borderWidth: 0.5, borderColor: theme.line },
    nowLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: theme.red },
    legendRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendBox: { width: 12, height: 12, borderRadius: 3 },
    legendText: { ...PlannerType.caption, color: theme.textSecondary },
    focusBtn: {
      marginTop: 4,
      backgroundColor: theme.accent,
      borderRadius: PlannerRadius.md,
      paddingVertical: 13,
      alignItems: 'center',
    },
    focusBtnText: { ...PlannerType.bodyMedium, color: theme.onAccent },
    skeleton: { height: 400, borderRadius: PlannerRadius.md, backgroundColor: theme.surface },
    modalBg: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: 32,
    },
    modalCard: { backgroundColor: theme.card, borderRadius: PlannerRadius.card, padding: 20, gap: 14 },
    modalTitle: { ...PlannerType.titleS, color: theme.ink },
    modalInput: {
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: PlannerRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.ink,
      ...PlannerType.body,
    },
    modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    modalCancel: { paddingVertical: 10, paddingHorizontal: 16 },
    modalCancelText: { ...PlannerType.bodyMedium, color: theme.textSecondary },
    modalOk: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: PlannerRadius.sm,
      backgroundColor: theme.accent,
    },
    modalOkText: { ...PlannerType.bodyMedium, color: theme.onAccent },
  });
