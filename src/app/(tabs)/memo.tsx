import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PlannerCard } from '@/components/planner/planner-card';
import { PlannerScreen } from '@/components/planner/planner-screen';
import { PlannerRadius, PlannerSerif, PlannerShadow, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { formatDisplayDate, todayKey } from '@/lib/date';
import { loadAllMemos, type MemoEntry } from '@/lib/memos';

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

  return (
    <PlannerScreen>
      <Text style={styles.title}>메모</Text>

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

      <View style={styles.sortRow}>
        <View style={styles.chips}>
          <SortChip label="최신순" selected={sort === 'latest'} onPress={() => setSort('latest')} />
          <SortChip label="오래된순" selected={sort === 'oldest'} onPress={() => setSort('oldest')} />
        </View>
        <Text style={styles.countText}>메모 {visibleMemos.length}개</Text>
      </View>

      {visibleMemos.length === 0 ? (
        <Text style={styles.emptyText}>{query ? '검색 결과가 없어요' : '아직 메모가 없어요'}</Text>
      ) : (
        visibleMemos.map((memo) => (
          <PlannerCard key={memo.date}>
            <View style={styles.dateRow}>
              <Text style={styles.dateText}>{formatDisplayDate(memo.date)}</Text>
              {memo.date === today ? (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>오늘</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.body} numberOfLines={4}>
              {memo.text}
            </Text>
          </PlannerCard>
        ))
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
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  dateText: {
    color: theme.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  todayBadge: {
    backgroundColor: theme.highlightSoft,
    borderRadius: PlannerRadius.chip,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  todayBadgeText: {
    color: theme.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  body: {
    color: theme.ink,
    fontSize: 14,
    lineHeight: 20,
  },
});
