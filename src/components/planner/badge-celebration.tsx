import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerType } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { evaluateBadges, type Badge } from '@/lib/badges';
import { subscribeTimetable } from '@/lib/timetable';

const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

/** 기록이 바뀔 때마다(디바운스) 배지를 판정해, 새로 얻으면 축하 카드를 띄운다. 루트에 1개. */
export function BadgeCelebration() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const reduced = useReducedMotion();
  const [queue, setQueue] = useState<Badge[]>([]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () =>
      void evaluateBadges()
        .then((fresh) => fresh.length && setQueue((q) => [...q, ...fresh]))
        .catch(() => {});
    check(); // 첫 판정(이미 달성한 배지는 조용히 기록)
    const unsub = subscribeTimetable(() => {
      clearTimeout(timer);
      timer = setTimeout(check, 1500);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  const badge = queue[0];
  useEffect(() => {
    if (badge) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [badge]);

  if (!badge) return null;
  const close = () => setQueue((q) => q.slice(1));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Animated.View
          key={badge.id}
          style={[
            styles.cardWrap,
            {
              animationName: {
                from: { opacity: 0, transform: [{ scale: reduced ? 1 : 0.92 }] },
                to: { opacity: 1, transform: [{ scale: 1 }] },
              },
              animationDuration: 260,
              animationTimingFunction: EASE_OUT,
            },
          ]}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Animated.View
              style={[
                styles.medal,
                !reduced && {
                  animationName: {
                    '0%': { transform: [{ scale: 0.6 }, { rotate: '-12deg' }] },
                    '60%': { transform: [{ scale: 1.08 }, { rotate: '4deg' }] },
                    '100%': { transform: [{ scale: 1 }, { rotate: '0deg' }] },
                  },
                  animationDuration: 520,
                  animationDelay: 80,
                  animationTimingFunction: EASE_OUT,
                  animationFillMode: 'backwards',
                },
              ]}>
              <Ionicons name={badge.icon} size={40} color={theme.amber} />
            </Animated.View>
            <Text style={styles.kicker}>새 배지 획득</Text>
            <Text style={styles.title}>{badge.title}</Text>
            <Text style={styles.desc}>{badge.desc}</Text>
            <Pressable style={styles.btn} onPress={close} accessibilityRole="button">
              <Text style={styles.btnText}>
                {queue.length > 1 ? `다음 (${queue.length - 1})` : '좋아요'}
              </Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    cardWrap: { width: '100%', maxWidth: 320 },
    card: {
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.card,
      padding: 24,
      alignItems: 'center',
      gap: 6,
    },
    medal: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: theme.amberSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    kicker: { ...PlannerType.labelStrong, fontSize: 12, color: theme.amber },
    title: { ...PlannerType.titleM, fontSize: 22, color: theme.ink },
    desc: { ...PlannerType.body, color: theme.textSecondary, textAlign: 'center' },
    btn: {
      alignSelf: 'stretch',
      marginTop: 14,
      backgroundColor: theme.accent,
      borderRadius: PlannerRadius.md,
      paddingVertical: 13,
      alignItems: 'center',
    },
    btnText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
  });
