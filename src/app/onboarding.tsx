import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MiniGrid, withAlpha } from '@/components/planner/mini-grid';
import { TimeTimerDial } from '@/components/planner/time-timer-dial';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerSerif, PlannerShadow, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { signInWithGoogle } from '@/lib/auth';
import { setOnboarded } from '@/lib/settings';
import {
  CATEGORY_COLORS,
  CELL_COUNT,
  COLS,
  createCategory,
  FOCUS_CATEGORY,
  saveCategories,
  type Category,
  type Cell,
  type DayTimetable,
  type SubjectId,
} from '@/lib/timetable';

const SLIDES = [
  { title: '하루를 10분 칸으로 색칠', body: '칸을 손가락으로 쓱 드래그하면\n그 시간이 계획으로 칠해져요.' },
  { title: '집중하면 칸이 차오릅니다', body: '타이머를 켜고 집중하는 동안\n지금 시각의 칸이 실시간으로 채워져요.' },
  { title: '일정과 공부를 한 화면에', body: '수업·약속은 왼쪽 레인에, 공부는 색칠 칸에.\n빈 시간이 바로 보여요.' },
  { title: 'TOTAL TIME이 쌓여요', body: '실제로 채운 칸만 합산해요.\n과목별 시간과 달성률도 한눈에.' },
];

const PICKS = ['수학', '영어', '전공', '코딩', '독서', '운동', '자격증', '기타'];

/** 예시 하루 — 행(06시=0)별로 [과목 인덱스, 계획/실제] 칸을 채운 가짜 타임테이블 */
function sampleDay(rows: Record<number, ('a' | 'p' | null)[]>, subjects: SubjectId[]): DayTimetable {
  const cells: Cell[] = Array.from({ length: CELL_COUNT }, () => ({}));
  Object.entries(rows).forEach(([r, marks], ri) =>
    marks.forEach((m, c) => {
      const sub = subjects[ri % subjects.length];
      if (m) cells[Number(r) * COLS + c] = m === 'a' ? { actual: sub, planned: sub } : { planned: sub };
    }),
  );
  return { cells, events: [], overflowMin: 0 };
}

/** C2~C7 — 첫 실행 온보딩 */
export default function OnboardingScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>(['수학', '영어', '전공']);
  const [custom, setCustom] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  const names = [...PICKS, ...custom];
  const colorOf = (name: string) => CATEGORY_COLORS[names.indexOf(name) % CATEGORY_COLORS.length];
  // 예시 칠하기용 가짜 카테고리 (선택 과목 → 없으면 기본 팔레트)
  const demoCats: Category[] = (picked.length ? picked : PICKS.slice(0, 3)).map((n) => ({
    id: n,
    name: n,
    color: colorOf(n),
  }));
  const demoMap = Object.fromEntries(demoCats.map((c) => [c.id, c]));
  const demoIds = demoCats.map((c) => c.id);

  async function finish(withGoogle: boolean) {
    const cats = picked.map((n) => createCategory(n, colorOf(n)));
    await saveCategories([FOCUS_CATEGORY, ...cats]);
    await setOnboarded();
    if (withGoogle)
      await signInWithGoogle().catch((e: unknown) =>
        Alert.alert('로그인 실패', e instanceof Error ? e.message : String(e)),
      );
    router.replace('/');
  }

  const skip = () => setStep(SLIDES.length);

  // ── C7: 시작 ──
  if (step === SLIDES.length + 1) {
    return (
      <SafeAreaView style={[styles.root, styles.dark]}>
        <View style={styles.center}>
          <View style={styles.appIcon}>
            <Ionicons name="grid" size={34} color={theme.onAccent} />
          </View>
          <Text style={[styles.title, { color: theme.paper }]}>준비 끝!{'\n'}첫 칸을 채워 볼까요?</Text>
          <Text style={[styles.body, { color: theme.textTertiary }]}>
            계정 없이 바로 쓸 수 있어요.{'\n'}기록은 이 기기에 저장돼요.
          </Text>
        </View>
        <View style={styles.bottom}>
          <Pressable style={[styles.primary, { backgroundColor: theme.paper }]} onPress={() => void finish(false)}>
            <Text style={[styles.primaryText, { color: theme.ink }]}>바로 시작하기</Text>
          </Pressable>
          <Pressable style={styles.googleBtn} onPress={() => void finish(true)}>
            <Ionicons name="logo-google" size={18} color={theme.paper} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.paper }]}>Google 캘린더 일정 가져오기</Text>
              <Text style={[styles.caption, { color: theme.textTertiary }]}>
                수업·약속이 일정 레인에 표시돼요
              </Text>
            </View>
            <Text style={[styles.caption, { color: theme.textTertiary }]}>선택</Text>
          </Pressable>
          <Text style={[styles.caption, styles.centerText, { color: theme.textTertiary }]}>
            나중에 설정 › 연동에서 언제든 연결할 수 있어요.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── C6: 과목 고르기 ──
  if (step === SLIDES.length) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setStep(SLIDES.length + 1)} hitSlop={10}>
            <Text style={styles.caption}>건너뛰기</Text>
          </Pressable>
        </View>
        <View style={styles.pickWrap}>
          <Text style={[styles.title, styles.left]}>무엇으로{'\n'}하루를 칠할까요?</Text>
          <Text style={styles.caption}>자주 하는 것을 골라 주세요. 색과 이름은 언제든 바꿀 수 있어요.</Text>
          <View style={styles.chips}>
            {names.map((n) => {
              const on = picked.includes(n);
              const c = colorOf(n);
              return (
                <Pressable
                  key={n}
                  onPress={() => setPicked((p) => (on ? p.filter((x) => x !== n) : [...p, n]))}
                  style={[styles.chip, on && { borderColor: c, backgroundColor: withAlpha(c, 0.12) }]}>
                  <View style={[styles.dot, { backgroundColor: c }]} />
                  <Text style={[styles.label, on && { color: c }]}>{n}</Text>
                  {on ? <Ionicons name="checkmark" size={14} color={c} /> : null}
                </Pressable>
              );
            })}
            <View style={[styles.chip, styles.addChip]}>
              <Ionicons name="add" size={14} color={theme.textSecondary} />
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="직접 추가"
                placeholderTextColor={theme.textSecondary}
                style={styles.addInput}
                onSubmitEditing={() => {
                  const n = draft.trim();
                  if (n && !names.includes(n)) {
                    setCustom((x) => [...x, n]);
                    setPicked((p) => [...p, n]);
                  }
                  setDraft('');
                }}
              />
            </View>
          </View>
          <View style={styles.previewCard}>
            <Text style={styles.label}>이렇게 칠해져요</Text>
            <MiniGrid
              day={sampleDay(
                {
                  3: ['a', 'a', 'a', 'a', 'p', 'p'],
                  4: ['p', 'p', 'p', 'p', 'p', 'p'],
                  5: ['p', 'p', 'p', null, 'p', 'p'],
                },
                demoIds,
              )}
              catMap={demoMap}
              rows={[3, 4, 5]}
              showColHeader={false}
            />
          </View>
        </View>
        <View style={styles.bottom}>
          <Text style={[styles.caption, styles.centerText]}>{picked.length}개 선택됨</Text>
          <Pressable style={styles.primary} onPress={() => setStep(SLIDES.length + 1)}>
            <Text style={styles.primaryText}>다음</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── C2~C5: 소개 슬라이드 ──
  const slide = SLIDES[step];
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={skip} hitSlop={10}>
          <Text style={styles.caption}>건너뛰기</Text>
        </Pressable>
      </View>
      <View style={styles.center}>
        <View style={styles.halo}>
          <View style={styles.illo}>
            {step === 0 ? (
              <MiniGrid
                day={sampleDay(
                  { 3: ['p', 'p', 'p', 'p', 'p', 'p'], 4: ['p', 'p', 'p', 'p', 'p', 'p'], 5: [null, null, null, 'p', 'p', 'p'] },
                  demoIds,
                )}
                catMap={demoMap}
                rows={[3, 4, 5, 6]}
                showColHeader={false}
              />
            ) : step === 1 ? (
              <View style={{ alignItems: 'center', gap: 10 }}>
                <TimeTimerDial size={130} minutes={25} remainingRatio={0.7} editable={false} pieColor={theme.red} />
                <MiniGrid
                  day={sampleDay({ 8: ['a', 'a', 'p', 'p', 'p', 'p'] }, demoIds)}
                  catMap={demoMap}
                  rows={[8]}
                  nowIdx={8 * COLS + 1}
                  showColHeader={false}
                />
              </View>
            ) : step === 2 ? (
              <MiniGrid
                day={sampleDay(
                  { 3: ['a', 'a', 'a', 'a', 'p', 'p'], 5: [null, null, null, 'a', 'a', 'a'], 7: ['p', 'p', 'p', 'p', 'p', 'p'] },
                  demoIds,
                )}
                catMap={demoMap}
                rows={[3, 4, 5, 6, 7]}
                showColHeader={false}
              />
            ) : (
              <View style={{ gap: 8 }}>
                <Text style={styles.overline}>TOTAL TIME</Text>
                <Text style={styles.total}>10H 05M</Text>
                <View style={styles.stripe}>
                  {demoCats.map((c, i) => (
                    <View key={c.id} style={{ flex: 3 - (i % 3), backgroundColor: c.color }} />
                  ))}
                </View>
                <Text style={styles.caption}>계획 10시간 30분 · 96% 달성</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.pageDot, i === step && styles.pageDotOn]} />
          ))}
        </View>
        <Pressable style={styles.primary} onPress={() => setStep(step + 1)}>
          <Text style={styles.primaryText}>{step === SLIDES.length - 1 ? '시작하기' : '다음'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper, paddingHorizontal: Spacing.four },
    dark: { backgroundColor: theme.ink },
    topBar: { alignItems: 'flex-end', paddingVertical: Spacing.three },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    centerText: { textAlign: 'center' },
    left: { textAlign: 'left' },
    halo: {
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    illo: {
      width: 240,
      padding: 14,
      borderRadius: PlannerRadius.card,
      backgroundColor: theme.card,
      ...PlannerShadow,
    },
    title: {
      fontFamily: PlannerSerif,
      fontSize: 26,
      lineHeight: 36,
      fontWeight: '600',
      color: theme.ink,
      textAlign: 'center',
    },
    body: { ...PlannerType.body, color: theme.textSecondary, textAlign: 'center' },
    caption: { ...PlannerType.caption, color: theme.textSecondary },
    label: { ...PlannerType.labelStrong, color: theme.ink },
    overline: { ...PlannerType.overline, letterSpacing: 2, color: theme.textTertiary },
    total: { ...PlannerType.display, color: theme.ink },
    stripe: { flexDirection: 'row', gap: 3, height: 8 },
    bottom: { gap: 14, paddingBottom: Spacing.three },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
    pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.line },
    pageDotOn: { width: 18, backgroundColor: theme.ink },
    primary: {
      paddingVertical: 16,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.accent,
      alignItems: 'center',
    },
    primaryText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
    pickWrap: { flex: 1, gap: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: PlannerRadius.chip,
      borderWidth: 1,
      borderColor: theme.line,
    },
    addChip: { borderStyle: 'dashed' },
    addInput: { ...PlannerType.labelStrong, color: theme.ink, minWidth: 60, padding: 0 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    previewCard: {
      marginTop: 12,
      padding: Spacing.three,
      gap: 10,
      borderRadius: PlannerRadius.card,
      backgroundColor: theme.card,
      ...PlannerShadow,
    },
    appIcon: {
      width: 72,
      height: 72,
      borderRadius: 18,
      backgroundColor: theme.blue,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    googleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: PlannerRadius.md,
      borderWidth: 1,
      borderColor: theme.textSecondary,
    },
  });
