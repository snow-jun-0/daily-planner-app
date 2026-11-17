import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerType } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { usePro } from '@/lib/pro';

export function ProBadge() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>PRO</Text>
    </View>
  );
}

/** Pro 안내 바: 자물쇠 + 설명 + 'Pro 보기' */
export function ProBar({ title, desc }: { title: string; desc: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.bar}>
      <View style={styles.lockIcon}>
        <Ionicons name="lock-closed-outline" size={16} color={theme.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.barTitle}>{title}</Text>
        <Text style={styles.barDesc}>{desc}</Text>
      </View>
      <Pressable style={styles.barBtn} onPress={() => router.push('/pro' as never)}>
        <Text style={styles.barBtnText}>Pro 보기</Text>
      </Pressable>
    </View>
  );
}

/** J5 — 무료면 내용을 흐리게 미리 보여주고 아래에 Pro 안내 바를 붙인다 */
export function ProLock({ desc, children }: { desc: string; children: ReactNode }) {
  const { isPro } = usePro();
  if (isPro) return <>{children}</>;
  return (
    <View>
      <View style={{ opacity: 0.25 }} pointerEvents="none" accessibilityElementsHidden>
        {children}
      </View>
      <ProBar title="Pro 전용" desc={desc} />
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    badge: {
      backgroundColor: theme.blueSoft,
      borderRadius: PlannerRadius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeText: { ...PlannerType.labelStrong, fontSize: 11, color: theme.blue },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      marginTop: 10,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.surface,
    },
    lockIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    barTitle: { ...PlannerType.labelStrong, color: theme.ink },
    barDesc: { ...PlannerType.caption, color: theme.textSecondary },
    barBtn: {
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.accent,
    },
    barBtnText: { ...PlannerType.labelStrong, color: theme.onAccent },
  });
