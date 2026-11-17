import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PlannerCard } from '@/components/planner/planner-card';
import { PlannerScreen } from '@/components/planner/planner-screen';
import { PlannerRadius, PlannerSerif, PlannerShadow, PlannerType, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { formatDisplayDate, todayKey } from '@/lib/date';
import { loadAllMemos, type MemoEntry } from '@/lib/memos';
import { requestViewDate } from '@/lib/navigation';

type SortOrder = 'latest' | 'oldest';

export default function MemoScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [sort, setSort] = useState<SortOrder>('latest');
  const [query, setQuery] = useState('');
  const [memos, setMemos] = useState<MemoEntry[]>([]);
  const today = todayKey();

  // reload every time this tab gains focus, so a memo just written on the
  // "오늘" tab shows up here without needing an app restart
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadAllMemos().then((loaded) => {
        if (!cancelled) setMemos(loaded);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const visibleMemos = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? memos.filter(
          (memo) =>
            memo.text.toLowerCase().includes(q) ||
            formatDisplayDate(memo.date).toLowerCase().includes(q),
        )
      : memos;

    return [...matched].sort((a, b) =>
      sort === 'latest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
    );
  }, [memos, query, sort]);

  // 메모는 하루 화면의 메모 카드에서 쓴다
  function openDay(date: string) {
    requestViewDate(date);
    router.navigate('/');
  }

  return (
    <PlannerScreen>
      <View style={styles.headerRow}>
        <Text style={styles.title}>메모</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => openDay(today)}
          accessibilityLabel="오늘 메모 쓰기">
          <Ionicons name="add" size={24} color={theme.onAccent} />
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={theme.faint} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="메모 검색"
          placeholderTextColor={theme.faint}
        />
      </View>

      {memos.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={22} color={theme.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>아직 메모가 없어요</Text>
          <Text style={styles.emptySub}>하루 화면에서 메모를 남기면 여기에 날짜별로 모여요</Text>
          <Pressable style={styles.emptyBtn} onPress={() => openDay(today)}>
            <Text style={styles.emptyBtnText}>메모 쓰기</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.sortRow}>
            <View style={styles.chips}>
              <SortChip label="최신순" selected={sort === 'latest'} onPress={() => setSort('latest')} />
              <SortChip label="오래된순" selected={sort === 'oldest'} onPress={() => setSort('oldest')} />
            </View>
            <Text style={styles.countText}>메모 {visibleMemos.length}개</Text>
          </View>

          {visibleMemos.length === 0 ? (
            <Text style={styles.emptyText}>검색 결과가 없어요</Text>
          ) : (
            visibleMemos.map((memo) => (
              <Pressable key={memo.date} onPress={() => openDay(memo.date)}>
                <PlannerCard>
                  <View style={styles.dateRow}>
                    <Text style={styles.dateText}>{formatDisplayDate(memo.date)}</Text>
                    {memo.date === today ? <Text style={styles.todayText}>오늘</Text> : null}
                  </View>
                  <Text style={styles.body} numberOfLines={4}>
                    {memo.text}
                  </Text>
                </PlannerCard>
              </Pressable>
            ))
          )}
        </>
      )}
    </PlannerScreen>
  );
}

function SortChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      hitSlop={6}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 120 },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { ...PlannerType.labelStrong, fontSize: 15, color: theme.ink },
  emptySub: { ...PlannerType.caption, color: theme.textSecondary, textAlign: 'center' },
  emptyBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: PlannerRadius.md,
    backgroundColor: theme.surface,
  },
  emptyBtnText: { ...PlannerType.labelStrong, color: theme.ink },
  title: {
    color: theme.ink,
    fontFamily: PlannerSerif,
    fontSize: 28,
    fontWeight: '600',
    paddingHorizontal: Spacing.one,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: theme.card,
    borderColor: theme.line,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: PlannerRadius.block,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    ...PlannerShadow,
  },
  searchInput: {
    flex: 1,
    color: theme.ink,
    fontSize: 15,
    padding: 0,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: PlannerRadius.chip,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.line,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one,
  },
  chipSelected: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  chipText: {
    color: theme.faint,
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: theme.onAccent,
  },
  countText: {
    color: theme.faint,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    color: theme.faint,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  dateText: {
    color: theme.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  todayText: { ...PlannerType.caption, color: theme.textSecondary },
  body: {
    color: theme.ink,
    fontSize: 14,
    lineHeight: 20,
  },
});
