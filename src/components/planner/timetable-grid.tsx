import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NewCategorySheet } from '@/components/planner/category-form';
import { FocusSheet, type PlanBlock } from '@/components/planner/focus-sheet';
import { PlanSheet } from '@/components/planner/plan-sheet';
import { WeekGrid } from '@/components/planner/week-grid';
import { cellColor, withAlpha } from '@/components/planner/mini-grid';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerShadow, PlannerType } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { usePrefs } from '@/hooks/use-prefs';
import { startFocus } from '@/lib/pomodoro';
import {
  achievementRate,
  actualByCategory,
  CATEGORY_COLORS,
  CELL_COUNT,
  CELL_MIN,
  cellLabel,
  COLS,
  dateToCellIndex,
  FOCUS_CATEGORY,
  loadCategories,
  loadTimetable,
  plannedBlockAt,
  saveCategories,
  remainingPlanMin,
  ROWS,
  START_HOUR,
  subscribeTimetable,
  totalActualMin,
  totalPlannedMin,
  updateTimetable,
  type Category,
  type DayTimetable,
  type SubjectId,
} from '@/lib/timetable';

const CELL_H = 26;

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
  /** 주간 뷰에서 날짜 탭 */
  onSelectDate?: (dateKey: string) => void;
};

export function TimetableGrid({
  dateKey,
  isToday,
  onStartFocus,
  events = [],
  onSelectDate,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [day, setDay] = useState<DayTimetable | null>(null);
  const [cats, setCats] = useState<Category[]>([FOCUS_CATEGORY]);
  const [catsLoaded, setCatsLoaded] = useState(false);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<SubjectId>(FOCUS_CATEGORY.id);
  const [erase, setErase] = useState(false);
  /** 집중 시트: undefined=닫힘, null=바로 집중, 블록=계획 칸 탭 */
  const [sheet, setSheet] = useState<PlanBlock | null | undefined>(undefined);
  const [editing, setEditing] = useState<{ block: PlanBlock; isNew: boolean } | null>(null);
  const [prefs] = usePrefs();
  /** 사용자가 탭으로 레인을 접었다/폈다 한 값 — 없으면 설정의 기본 상태 */
  const [laneToggled, setLaneToggled] = useState<boolean | null>(null);
  const laneOpen = laneToggled ?? prefs.laneMode === 'open';
  const [mode, setMode] = useState<'day' | 'week'>('day');

  const dayRef = useRef<DayTimetable | null>(null);
  const gridW = useRef(0);
  const painted = useRef<Set<number>>(new Set());
  const activeCatRef = useRef(activeCat);
  const eraseRef = useRef(erase);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapIdx = useRef(-1); // 계획 칸에서 시작한 터치 — 움직이지 않고 떼면 시트를 연다
  const moved = useRef(false);
  const prefsRef = useRef(prefs);
  /** 계획 칸 탭 처리 — 최신 props/설정을 쓰도록 매 렌더 갱신 */
  const onTapPlanned = useRef<(block: PlanBlock) => void>(() => {});
  activeCatRef.current = activeCat;
  eraseRef.current = erase;
  prefsRef.current = prefs;
  onTapPlanned.current = (block) => {
    const d = dayRef.current;
    if (!prefs.tapToFocus || !d) {
      setSheet(block);
      return;
    }
    const nowIdx = isToday ? dateToCellIndex(new Date()) : -1;
    startFocus(block.subject, remainingPlanMin(d, block, nowIdx) || undefined);
    onStartFocus?.();
  };

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

  // 카테고리 화면(G9)에서 돌아오면 다시 읽는다
  useFocusEffect(
    useCallback(() => {
      void loadCategories().then((c) => {
        setCats(c);
        setCatsLoaded(true);
      });
    }, []),
  );

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

  /** idx가 속한 격자 단위(10분/30분/1시간) 묶음을 칠한다 */
  function paintIndex(idx: number) {
    const d = dayRef.current;
    if (!d || idx < 0 || idx >= d.cells.length) return;
    const n = prefsRef.current.brushCells;
    const base = idx - (idx % n);
    const targets: number[] = [];
    for (let i = base; i < Math.min(base + n, d.cells.length); i++)
      if (!painted.current.has(i)) targets.push(i);
    if (!targets.length) return;
    const cells = d.cells.slice();
    for (const i of targets) {
      painted.current.add(i);
      cells[i] = eraseRef.current
        ? { ...cells[i], planned: undefined }
        : { ...cells[i], planned: activeCatRef.current };
    }
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
        const block = tapIdx.current >= 0 && !moved.current && d ? plannedBlockAt(d, tapIdx.current) : null;
        if (block) onTapPlanned.current(block);
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

  const modeToggle = (
    <View style={styles.toggle}>
      {(['day', 'week'] as const).map((m) => (
        <Pressable
          key={m}
          onPress={() => setMode(m)}
          style={[styles.toggleItem, mode === m && styles.toggleItemOn]}>
          <Text style={[styles.toggleText, mode === m && styles.toggleTextOn]}>
            {m === 'day' ? '일' : '주'}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  if (mode === 'week') {
    return (
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle}>타임테이블</Text>
          {modeToggle}
        </View>
        <WeekGrid
          dateKey={dateKey}
          cats={cats}
          onSelectDate={(k) => {
            setMode('day');
            onSelectDate?.(k);
          }}
        />
      </View>
    );
  }

  if (!day) {
    return (
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle}>타임테이블</Text>
          <Text style={styles.hint}>불러오는 중…</Text>
        </View>
        <View>
          {Array.from({ length: ROWS }).map((_, r) => (
            <View key={r} style={[styles.gridRow, styles.skeletonRow]}>
              {Array.from({ length: COLS }).map((_, c) => (
                <View key={c} style={styles.skeletonCell} />
              ))}
            </View>
          ))}
        </View>
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
  const lane = (prefs.laneMode === 'hidden' ? [] : events)
    .map((e) => ({
      ...e,
      top: Math.max(0, toGridMin(e.start)),
      bottom: Math.min(ROWS * 60, toGridMin(e.end <= e.start ? e.end + 1440 : e.end)),
    }))
    .filter((e) => e.bottom > e.top);
  // H7: 아직 내 과목이 없으면 첫 사용 안내
  const needsFirstCat = catsLoaded && !cats.some((c) => c.id !== FOCUS_CATEGORY.id);
  const subjectAt = (i: number) => day.cells[i]?.actual ?? day.cells[i]?.planned;
  /** H4 색+라벨: 같은 과목 묶음의 첫 칸(또는 행의 첫 칸)에 과목 첫 글자 */
  const labelAt = (i: number) => {
    const sub = subjectAt(i);
    if (prefs.a11yMode !== 'label' || !sub) return '';
    if (i % COLS !== 0 && subjectAt(i - 1) === sub) return '';
    return (catMap[sub]?.name ?? FOCUS_CATEGORY.name).slice(0, 1);
  };
  const a11yAt = (i: number) => {
    const c = day.cells[i] ?? {};
    const sub = c.actual ?? c.planned;
    const state = c.actual ? '실제' : c.planned ? '계획' : '빈 칸';
    return `${cellLabel(i)}, ${sub ? `${catMap[sub]?.name ?? '집중'}, ` : ''}${state}`;
  };

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
        <View style={styles.titleRight}>
          <Pressable style={styles.addPlan} onPress={openNewPlan} hitSlop={6}>
            <Text style={styles.addPlanText}>+ 계획</Text>
          </Pressable>
          {modeToggle}
        </View>
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
        <Pressable style={styles.catChip} onPress={() => router.push('/categories' as never)}>
          <Text style={styles.catName}>+ 과목 관리</Text>
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

      {needsFirstCat ? (
        <View style={styles.onboard}>
          <View style={styles.onboardHead}>
            <View style={styles.onboardSwatches}>
              {CATEGORY_COLORS.slice(0, 3).map((c) => (
                <View key={c} style={[styles.onboardSwatch, { backgroundColor: c }]} />
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.onboardTitle}>먼저 과목을 만들어요</Text>
              <Text style={styles.hint}>과목마다 색이 정해지고, 그 색으로 칸을 칠해요.</Text>
            </View>
          </View>
          <View style={styles.onboardBtns}>
            <Pressable style={styles.onboardPrimary} onPress={() => setNewCatOpen(true)}>
              <Text style={styles.focusBtnText}>과목 만들기</Text>
            </Pressable>
            <Pressable style={styles.onboardGhost} onPress={() => setSheet(null)}>
              <Text style={styles.onboardGhostText}>과목 없이 집중</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>드래그로 계획 칠하기 · 계획 칸 탭하면 집중</Text>
      )}

      <View style={styles.colHeadRow}>
        <View style={styles.axis} />
        {lane.length ? (
          <Text
            style={[
              styles.colHead,
              laneOpen ? [styles.laneOpen, { width: prefs.laneWidth }] : styles.laneClosed,
            ]}>
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
            style={laneOpen ? [styles.laneOpen, { width: prefs.laneWidth }] : styles.laneClosed}
            onPress={() => setLaneToggled(!laneOpen)}
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
                const label = labelAt(idx);
                const sub = subjectAt(idx);
                return (
                  <View
                    key={c}
                    accessible
                    accessibilityLabel={a11yAt(idx)}
                    style={[
                      styles.cell,
                      {
                        backgroundColor:
                          !sub && eventCell.has(idx)
                            ? theme.line
                            : cellColor(day.cells[idx] ?? {}, catMap, theme),
                      },
                    ]}>
                    {label ? (
                      <Text
                        style={[
                          styles.cellLabel,
                          {
                            color: day.cells[idx]?.actual
                              ? theme.card
                              : (catMap[sub!]?.color ?? FOCUS_CATEGORY.color),
                          },
                        ]}>
                        {label}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
          {nowRow >= 0 ? <View style={[styles.nowLine, { top: nowRow * CELL_H }]} /> : null}
        </View>
      </View>

      {needsFirstCat ? (
        <Text style={[styles.hint, { textAlign: 'center' }]}>
          1 과목 만들기 → 2 칸을 드래그해 계획 → 3 집중 시작
        </Text>
      ) : null}

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

      {newCatOpen ? (
        <NewCategorySheet
          onClose={() => setNewCatOpen(false)}
          onCreate={(cat) => {
            const next = [...cats, cat];
            setCats(next);
            void saveCategories(next);
            setActiveCat(cat.id);
            setErase(false);
            setNewCatOpen(false);
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

    </View>
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
    titleRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    toggle: {
      flexDirection: 'row',
      padding: 2,
      borderRadius: PlannerRadius.sm,
      backgroundColor: theme.surface,
    },
    toggleItem: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 6 },
    toggleItemOn: { backgroundColor: theme.card },
    toggleText: { ...PlannerType.labelStrong, color: theme.textTertiary },
    toggleTextOn: { color: theme.ink },
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
    skeletonRow: { gap: 3, height: CELL_H - 3, marginBottom: 3 },
    skeletonCell: { flex: 1, borderRadius: 4, backgroundColor: theme.surface },
    onboard: {
      backgroundColor: theme.surface,
      borderRadius: PlannerRadius.md,
      padding: 16,
      gap: 14,
    },
    onboardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    onboardSwatches: { flexDirection: 'row', gap: 3 },
    onboardSwatch: { width: 16, height: 22, borderRadius: 4 },
    onboardTitle: { ...PlannerType.labelStrong, fontSize: 15, color: theme.ink },
    onboardBtns: { flexDirection: 'row', gap: 8 },
    onboardPrimary: {
      flex: 1,
      backgroundColor: theme.accent,
      borderRadius: PlannerRadius.md,
      paddingVertical: 12,
      alignItems: 'center',
    },
    onboardGhost: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    onboardGhostText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.ink },
    cellLabel: {
      ...PlannerType.caption,
      fontSize: 10,
      lineHeight: CELL_H - 2,
      fontWeight: '700',
      textAlign: 'center',
    },
  });
