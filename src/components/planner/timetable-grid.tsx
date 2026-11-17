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

import { FocusSheet, type PlanBlock } from '@/components/planner/focus-sheet';
import { PlanSheet } from '@/components/planner/plan-sheet';
import { cellColor, withAlpha } from '@/components/planner/mini-grid';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerShadow, PlannerType } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { startFocus } from '@/lib/pomodoro';
import {
  achievementRate,
  actualByCategory,
  CELL_COUNT,
  CELL_MIN,
  COLS,
  createCategory,
  dateToCellIndex,
  FOCUS_CATEGORY,
  loadCategories,
  loadTimetable,
  plannedBlockAt,
  ROWS,
  START_HOUR,
  saveCategories,
  subscribeTimetable,
  totalActualMin,
  totalPlannedMin,
  updateTimetable,
  type Category,
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

/** 자정 기준 분 → 격자(06:00=0) 기준 분. 00~05시는 전날 새벽 연장 */
function toGridMin(m: number): number {
  return (m < START_HOUR * 60 ? m + 1440 : m) - START_HOUR * 60;
}

type LaneEvent = { id: string; title: string; start: number; end: number };

type Props = {
  dateKey: string;
  isToday: boolean;
  onStartFocus?: () => void;
  /** 일정 레인 (수업·약속) — 자정 기준 분 */
  events?: LaneEvent[];
};

export function TimetableGrid({ dateKey, isToday, onStartFocus, events = [] }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [day, setDay] = useState<DayTimetable | null>(null);
  const [cats, setCats] = useState<Category[]>([FOCUS_CATEGORY]);
  const [activeCat, setActiveCat] = useState<SubjectId>(FOCUS_CATEGORY.id);
  const [erase, setErase] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  /** 집중 시트: undefined=닫힘, null=바로 집중, 블록=계획 칸 탭 */
  const [sheet, setSheet] = useState<PlanBlock | null | undefined>(undefined);
  const [editing, setEditing] = useState<{ block: PlanBlock; isNew: boolean } | null>(null);
  const [laneOpen, setLaneOpen] = useState(true);

  const dayRef = useRef<DayTimetable | null>(null);
  const gridW = useRef(0);
  const painted = useRef<Set<number>>(new Set());
  const activeCatRef = useRef(activeCat);
  const eraseRef = useRef(erase);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapIdx = useRef(-1); // 계획 칸에서 시작한 터치 — 움직이지 않고 떼면 시트를 연다
  const moved = useRef(false);
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
    // 타이머가 actual을 채우면 다시 읽는다. planned는 이 격자가 주인이라 로컬 것을 유지.
    const unsub = subscribeTimetable((dk) => {
      if (dk !== dateKey) return;
      void loadTimetable(dk).then((d) => {
        const cur = dayRef.current;
        const next = cur
          ? { ...d, cells: d.cells.map((c, i) => ({ ...c, planned: cur.cells[i]?.planned })) }
          : d;
        if (alive) {
          setDay(next);
          dayRef.current = next;
        }
      });
    });
    return () => {
      alive = false;
      unsub();
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
    saveTimer.current = setTimeout(() => {
      // 최신 저장본(타이머가 쓴 actual 포함)에 planned만 덮어쓴다
      void updateTimetable(dateKey, (latest) => ({
        ...latest,
        cells: latest.cells.map((c, i) => ({ ...c, planned: next.cells[i]?.planned })),
      }));
    }, 400);
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

  function indexAt(x: number, y: number): number {
    const w = gridW.current;
    if (!w) return -1;
    const col = Math.floor(x / (w / COLS));
    const row = Math.floor(y / CELL_H);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
    return row * COLS + col;
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        painted.current.clear();
        moved.current = false;
        const idx = indexAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
        const planned = idx >= 0 && dayRef.current?.cells[idx]?.planned;
        // 계획 칸에서 시작하면 칠하기를 미룬다 (탭이면 시트, 드래그면 칠하기)
        tapIdx.current = planned && !eraseRef.current ? idx : -1;
        if (tapIdx.current < 0) paintIndex(idx);
      },
      onPanResponderMove: (e) => {
        const idx = indexAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
        if (idx < 0) return;
        if (tapIdx.current >= 0 && idx !== tapIdx.current && !moved.current) {
          moved.current = true;
          paintIndex(tapIdx.current);
        }
        if (tapIdx.current < 0 || moved.current) paintIndex(idx);
      },
      onPanResponderRelease: () => {
        painted.current.clear();
        const d = dayRef.current;
        if (tapIdx.current >= 0 && !moved.current && d) setSheet(plannedBlockAt(d, tapIdx.current));
        tapIdx.current = -1;
      },
      onPanResponderTerminate: () => {
        painted.current.clear();
        tapIdx.current = -1;
      },
    }),
  ).current;

  function setPlanned(block: PlanBlock, planned: SubjectId | undefined, replaces?: PlanBlock) {
    const d = dayRef.current;
    if (!d) return;
    const inside = (b: PlanBlock | undefined, i: number) => b != null && i >= b.start && i <= b.end;
    const cells = d.cells.map((c, i) =>
      inside(block, i) ? { ...c, planned } : inside(replaces, i) ? { ...c, planned: undefined } : c,
    );
    persist({ ...d, cells });
  }

  function recordBlock(block: PlanBlock) {
    void updateTimetable(dateKey, (latest) => ({
      ...latest,
      cells: latest.cells.map((c, i) =>
        i >= block.start && i <= block.end ? { ...c, actual: block.subject } : c,
      ),
    }));
    setSheet(undefined);
  }

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

  function openNewPlan() {
    const start = Math.max(0, nowIdx);
    setEditing({
      block: { start, end: Math.min(start + 5, CELL_COUNT - 1), subject: activeCat },
      isNew: true,
    });
  }

  // 일정 레인: 격자 범위로 자른 일정들 + 일정이 걸친 칸
  const lane = events
    .map((e) => ({
      ...e,
      top: Math.max(0, toGridMin(e.start)),
      bottom: Math.min(ROWS * 60, toGridMin(e.end <= e.start ? e.end + 1440 : e.end)),
    }))
    .filter((e) => e.bottom > e.top);
  const eventCell = new Set<number>();
  for (const e of lane)
    for (let i = Math.floor(e.top / CELL_MIN); i < Math.ceil(e.bottom / CELL_MIN); i++)
      eventCell.add(i);


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
        <Pressable style={styles.addPlan} onPress={openNewPlan} hitSlop={6}>
          <Text style={styles.addPlanText}>+ 계획</Text>
        </Pressable>
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

      <Text style={styles.hint}>드래그로 계획 칠하기 · 계획 칸 탭하면 집중</Text>

      <View style={styles.colHeadRow}>
        <View style={styles.axis} />
        {lane.length ? (
          <Text style={[styles.colHead, laneOpen ? styles.laneOpen : styles.laneClosed]}>
            {laneOpen ? '일정' : ''}
          </Text>
        ) : null}
        {Array.from({ length: COLS }).map((_, c) => (
          <Text key={c} style={[styles.colHead, { flex: 1 }]}>
            {(c + 1) * 10}
          </Text>
        ))}
      </View>

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
        {lane.length ? (
          <Pressable
            style={laneOpen ? styles.laneOpen : styles.laneClosed}
            onPress={() => setLaneOpen((v) => !v)}
            accessibilityLabel={laneOpen ? '일정 레인 접기' : '일정 레인 펼치기'}>
            {lane.map((e) => (
              <View
                key={e.id}
                style={[
                  styles.laneItem,
                  { top: (e.top / 60) * CELL_H, height: ((e.bottom - e.top) / 60) * CELL_H - 2 },
                ]}>
                {laneOpen ? (
                  <Text style={styles.laneText} numberOfLines={1}>
                    {e.title}
                  </Text>
                ) : null}
              </View>
            ))}
          </Pressable>
        ) : null}
        <View
          style={styles.grid}
          onLayout={(e) => (gridW.current = e.nativeEvent.layout.width)}
          {...pan.panHandlers}>
          {Array.from({ length: ROWS }).map((_, r) => (
            <View key={r} style={styles.gridRow}>
              {Array.from({ length: COLS }).map((_, c) => {
                const idx = r * COLS + c;
                return (
                  <View key={c} style={[styles.cell, {
                        backgroundColor:
                          !day.cells[idx]?.planned && !day.cells[idx]?.actual && eventCell.has(idx)
                            ? theme.line
                            : cellColor(day.cells[idx] ?? {}, catMap, theme),
                      }]} />
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
        {lane.length ? (
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: theme.line }]} />
            <Text style={styles.legendText}>일정 시간</Text>
          </View>
        ) : null}
      </View>
      {lane.length && !laneOpen ? (
        <Text style={styles.hint}>일정 레인을 접었어요. 왼쪽 띠를 탭하면 다시 펼쳐져요.</Text>
      ) : null}

      <Pressable style={styles.focusBtn} onPress={() => setSheet(null)}>
        <Text style={styles.focusBtnText}>바로 집중 시작</Text>
      </Pressable>

      {sheet !== undefined ? (
        <FocusSheet
          onClose={() => setSheet(undefined)}
          day={day}
          cats={cats}
          block={sheet ?? null}
          nowIdx={nowIdx}
          onStart={(subject, minutes) => {
            startFocus(subject, minutes);
            setSheet(undefined);
            onStartFocus?.();
          }}
          onRecord={recordBlock}
          onEdit={(block) => {
            setSheet(undefined);
            setEditing({ block, isNew: false });
          }}
          onClearPlan={(block) => {
            setPlanned(block, undefined);
            setSheet(undefined);
          }}
        />
      ) : null}

      {editing ? (
        <PlanSheet
          cats={cats}
          initial={editing.block}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={(block) => {
            setPlanned(block, block.subject, editing.isNew ? undefined : editing.block);
            setEditing(null);
          }}
          onDelete={() => {
            setPlanned(editing.block, undefined);
            setEditing(null);
          }}
        />
      ) : null}

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
    addPlan: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: PlannerRadius.chip,
      backgroundColor: theme.surface,
    },
    addPlanText: { ...PlannerType.labelStrong, color: theme.ink },
    colHeadRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    colHead: {
      ...PlannerType.caption,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
      color: theme.textTertiary,
    },
    laneOpen: { width: 56, marginRight: 4, position: 'relative' },
    laneClosed: { width: 8, marginRight: 4, position: 'relative' },
    laneItem: {
      position: 'absolute',
      left: 0,
      right: 0,
      borderLeftWidth: 3,
      borderLeftColor: theme.textSecondary,
      backgroundColor: theme.card,
      paddingLeft: 4,
      justifyContent: 'center',
    },
    laneText: { ...PlannerType.caption, fontSize: 11, color: theme.ink },
    gridWrap: { flexDirection: 'row' },
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
