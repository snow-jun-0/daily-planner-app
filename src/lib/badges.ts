// ---------- 배지·업적 ----------
// 타임테이블 실제(actual) 기록에서 계산한다. 획득 날짜만 저장(badges:earned, 백업 대상).
// 처음 판정할 때(저장 기록 없음)는 이미 달성한 배지를 축하 없이 조용히 기록한다.

import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

import { streakOf } from './date';
import { getItem, getKeysWithPrefix, setItem } from './storage';
import {
  actualByCategory,
  FOCUS_CATEGORY,
  loadCategories,
  loadTimetable,
  timetableDateKey,
  totalActualMin,
} from './timetable';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type BadgeStats = {
  totalMin: number;
  focusDays: number;
  bestStreak: number;
  bestDayMin: number;
  /** 과목(집중 제외)별 누적 분 중 최대 */
  bestSubjectMin: number;
  bestSubjectName: string;
};

export type Badge = {
  id: string;
  title: string;
  desc: string;
  icon: IconName;
  /** 진행도 [현재, 목표] */
  progress: (s: BadgeStats) => [number, number];
};

const h = (min: number) => Math.floor(min / 60);

export const BADGES: Badge[] = [
  {
    id: 'first',
    title: '첫 집중',
    desc: '처음으로 한 칸을 채웠어요',
    icon: 'sparkles',
    progress: (s) => [s.totalMin, 10],
  },
  {
    id: 'day-4h',
    title: '몰입의 날',
    desc: '하루 4시간 집중',
    icon: 'sunny',
    progress: (s) => [h(s.bestDayMin), 4],
  },
  {
    id: 'streak-3',
    title: '3일 연속',
    desc: '3일 연속 집중',
    icon: 'flame',
    progress: (s) => [s.bestStreak, 3],
  },
  {
    id: 'streak-7',
    title: '7일 연속',
    desc: '일주일 내내 집중',
    icon: 'flame',
    progress: (s) => [s.bestStreak, 7],
  },
  {
    id: 'streak-30',
    title: '30일 연속',
    desc: '한 달 내내 집중',
    icon: 'bonfire',
    progress: (s) => [s.bestStreak, 30],
  },
  {
    id: 'hours-10',
    title: '10시간',
    desc: '누적 집중 10시간',
    icon: 'time',
    progress: (s) => [h(s.totalMin), 10],
  },
  {
    id: 'hours-50',
    title: '50시간',
    desc: '누적 집중 50시간',
    icon: 'hourglass',
    progress: (s) => [h(s.totalMin), 50],
  },
  {
    id: 'hours-100',
    title: '100시간',
    desc: '누적 집중 100시간',
    icon: 'trophy',
    progress: (s) => [h(s.totalMin), 100],
  },
  {
    id: 'days-30',
    title: '30일 기록',
    desc: '집중한 날 30일',
    icon: 'calendar',
    progress: (s) => [s.focusDays, 30],
  },
  {
    id: 'subject-10h',
    title: '과목 10시간',
    desc: '한 과목 누적 10시간',
    icon: 'book',
    progress: (s) => [h(s.bestSubjectMin), 10],
  },
  {
    id: 'subject-50h',
    title: '과목 마스터',
    desc: '한 과목 누적 50시간',
    icon: 'school',
    progress: (s) => [h(s.bestSubjectMin), 50],
  },
];

export const isEarned = (b: Badge, s: BadgeStats) => {
  const [cur, goal] = b.progress(s);
  return cur >= goal;
};

export async function loadBadgeStats(): Promise<BadgeStats> {
  const keys = (await getKeysWithPrefix('timetable:')).map((k) => k.slice('timetable:'.length));
  const [days, cats] = await Promise.all([Promise.all(keys.map(loadTimetable)), loadCategories()]);
  let totalMin = 0;
  let bestDayMin = 0;
  const done = new Set<string>();
  const bySubject: Record<string, number> = {};
  days.forEach((d, i) => {
    const m = totalActualMin(d);
    totalMin += m;
    bestDayMin = Math.max(bestDayMin, m);
    if (m) done.add(keys[i]);
    for (const [id, min] of Object.entries(actualByCategory(d)))
      if (id !== FOCUS_CATEGORY.id) bySubject[id] = (bySubject[id] ?? 0) + min;
  });
  const [bestId, bestSubjectMin] = Object.entries(bySubject).sort((a, b) => b[1] - a[1])[0] ?? [
    '',
    0,
  ];
  return {
    totalMin,
    focusDays: done.size,
    bestStreak: streakOf(done, timetableDateKey()).best,
    bestDayMin,
    bestSubjectMin,
    bestSubjectName: cats.find((c) => c.id === bestId)?.name ?? '',
  };
}

const EARNED_KEY = 'badges:earned';

/** 배지 id → 획득 날짜 */
export async function loadEarned(): Promise<Record<string, string>> {
  return (await getItem<Record<string, string>>(EARNED_KEY)) ?? {};
}

/** 새로 획득한 배지를 기록하고 반환 (첫 판정이면 조용히 기록하고 빈 배열) */
export async function evaluateBadges(): Promise<Badge[]> {
  const [stats, stored] = await Promise.all([
    loadBadgeStats(),
    getItem<Record<string, string>>(EARNED_KEY),
  ]);
  const earned = stored ?? {};
  const fresh = BADGES.filter((b) => !earned[b.id] && isEarned(b, stats));
  if (!fresh.length && stored) return [];
  const today = timetableDateKey();
  for (const b of fresh) earned[b.id] = today;
  await setItem(EARNED_KEY, earned);
  return stored ? fresh : [];
}
