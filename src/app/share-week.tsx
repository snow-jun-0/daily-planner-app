import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { withAlpha } from '@/components/planner/mini-grid';
import { Segmented, SubHeader, Toggle } from '@/components/planner/settings-ui';
import { hourActuals } from '@/components/planner/week-grid';
import type { AppTheme } from '@/constants/theme';
import { Planner, PlannerDark, PlannerRadius, PlannerSerif, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { weekKeys } from '@/lib/date';
import { usePro } from '@/lib/pro';
import {
  FOCUS_CATEGORY,
  loadCategories,
  loadStreak,
  loadTimetable,
  ROWS,
  timetableDateKey,
  totalActualMin,
  type Category,
  type DayTimetable,
  type SubjectId,
} from '@/lib/timetable';

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

type CardTone = 'light' | 'dark' | 'blue';
/** 공유 이미지는 앱 테마와 상관없이 고른 톤으로 그린다 */
const TONES: Record<CardTone, { bg: string; ink: string; sub: string; empty: string }> = {
  light: { bg: Planner.card, ink: Planner.ink, sub: Planner.textSecondary, empty: Planner.surface },
  dark: { bg: PlannerDark.card, ink: PlannerDark.ink, sub: PlannerDark.textSecondary, empty: PlannerDark.surface },
  blue: {
    bg: Planner.blue,
    ink: Planner.onAccent,
    sub: Planner.onAccentFaint,
    empty: withAlpha(Planner.onAccent, 0.15),
  },
};

/** I4 — 주간 공유 카드 (이미지로 공유) */
export default function ShareWeekScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { date } = useLocalSearchParams<{ date?: string }>();
  const keys = useMemo(() => weekKeys(date ?? timetableDateKey()), [date]);
  const [days, setDays] = useState<DayTimetable[]>([]);
  const [cats, setCats] = useState<Category[]>([FOCUS_CATEGORY]);
  const [streak, setStreak] = useState(0);
  const [tone, setTone] = useState<CardTone>('light');
  const [hideNames, setHideNames] = useState(false);
  const cardRef = useRef<View>(null);
  const { isPro } = usePro();

  useEffect(() => {
    void Promise.all(keys.map(loadTimetable)).then(setDays);
    void loadCategories().then(setCats);
    void loadStreak().then(setStreak);
  }, [keys]);

  const catMap = useMemo(
    () => Object.fromEntries(cats.map((c) => [c.id, c])) as Record<SubjectId, Category>,
    [cats],
  );
  const t = TONES[tone];
  const total = days.reduce((n, d) => n + totalActualMin(d), 0);
  const used = Array.from(new Set(days.flatMap((d) => d.cells.map((c) => c.actual).filter(Boolean)))) as SubjectId[];

  // "11월 2주" — 그 주 목요일이 속한 달 기준
  const [y, m, d0] = keys[3].split('-').map(Number);
  const weekLabel = `${y} · ${m}월 ${Math.ceil(d0 / 7)}주`;

  async function share() {
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('공유', '이 기기에서는 공유를 쓸 수 없어요.');
        return;
      }
      // ponytail: '이미지 저장'도 공유 시트의 사진/파일 저장으로 처리, 갤러리 직접 저장은 expo-media-library 필요할 때
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '이번 주 기록 공유' });
    } catch (e) {
      Alert.alert('공유 실패', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SubHeader title="주간 공유" />
      <ScrollView contentContainerStyle={styles.content}>
        <View ref={cardRef} collapsable={false} style={[styles.card, { backgroundColor: t.bg }]}>
          <Text style={[styles.caption, { color: t.sub }]}>{weekLabel}</Text>
          <Text style={[styles.headline, { color: t.ink }]}>
            이번 주{'\n'}
            {Math.floor(total / 60)}시간 {total % 60}분 집중
          </Text>

          <View style={styles.row}>
            {DAY_NAMES.map((n) => (
              <Text key={n} style={[styles.dayName, { color: t.sub }]}>
                {n}
              </Text>
            ))}
          </View>
          {Array.from({ length: ROWS }).map((_, r) => (
            <View key={r} style={styles.row}>
              {days.map((d, di) => (
                <View key={di} style={[styles.hour, { backgroundColor: t.empty }]}>
                  {hourActuals(d, r).map((id, k) => (
                    <View
                      key={k}
                      style={[styles.seg, { backgroundColor: catMap[id]?.color ?? FOCUS_CATEGORY.color }]}
                    />
                  ))}
                </View>
              ))}
            </View>
          ))}

          {!hideNames && used.length ? (
            <View style={styles.legend}>
              {used.map((id) => (
                <View key={id} style={styles.legendItem}>
                  <View
                    style={[styles.dot, { backgroundColor: catMap[id]?.color ?? FOCUS_CATEGORY.color }]}
                  />
                  <Text style={[styles.caption, { color: t.sub }]}>
                    {catMap[id]?.name ?? FOCUS_CATEGORY.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.footer, { borderTopColor: t.empty }]}>
            <Text style={[styles.caption, { color: t.sub }]}>
              데일리 플래너 · 하루 평균 {(total / 7 / 60).toFixed(1)}시간
              {streak ? ` · ${streak}일 연속` : ''}
            </Text>
          </View>
        </View>

        <Segmented
          options={[
            { key: 'light', label: '밝게' },
            { key: 'dark', label: isPro ? '어둡게' : '어둡게 · Pro' },
            { key: 'blue', label: isPro ? '브랜드 블루' : '블루 · Pro' },
          ]}
          value={tone}
          // 무료는 밝게만 — 다른 톤은 Pro 화면으로
          onChange={(v) => (v === 'light' || isPro ? setTone(v) : router.push('/pro' as never))}
        />
        <View style={styles.toggleRow}>
          <Text style={styles.label}>과목 이름 숨기기</Text>
          <Toggle value={hideNames} onChange={setHideNames} />
        </View>
        <Text style={[styles.caption, { textAlign: 'center' }]}>
          일정 레인(수업·약속)과 메모는 공유 이미지에 들어가지 않아요.
        </Text>
        <View style={styles.btns}>
          <Pressable style={styles.ghostBtn} onPress={() => void share()}>
            <Text style={styles.ghostText}>이미지 저장</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={() => void share()}>
            <Text style={styles.primaryText}>공유하기</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper },
    content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
    card: { borderRadius: PlannerRadius.lg, padding: 22, gap: 3 },
    caption: { ...PlannerType.caption, color: theme.textSecondary },
    label: { ...PlannerType.labelStrong, color: theme.ink },
    headline: {
      fontFamily: PlannerSerif,
      fontSize: 26,
      lineHeight: 34,
      fontWeight: '600',
      marginTop: 6,
      marginBottom: 12,
    },
    row: { flexDirection: 'row', gap: 3 },
    dayName: { flex: 1, textAlign: 'center', ...PlannerType.caption, marginBottom: 4 },
    hour: { flex: 1, height: 8, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
    seg: { width: `${100 / 6}%`, height: '100%' },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    footer: { borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    btns: { flexDirection: 'row', gap: 10 },
    ghostBtn: {
      flex: 1,
      paddingVertical: 15,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.surface,
      alignItems: 'center',
    },
    ghostText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.ink },
    primaryBtn: {
      flex: 1,
      paddingVertical: 15,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.accent,
      alignItems: 'center',
    },
    primaryText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
  });
