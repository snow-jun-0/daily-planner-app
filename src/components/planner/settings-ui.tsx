import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerShadow, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** 설정 화면들이 공유하는 그룹·행·세그먼트·토글 */

function useStyles() {
  const theme = useTheme();
  return { theme, styles: useMemo(() => makeStyles(theme), [theme]) };
}

export function SubHeader({ title }: { title: string }) {
  const { theme, styles } = useStyles();
  return (
    <View style={styles.subHeader}>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="뒤로">
        <Ionicons name="chevron-back" size={22} color={theme.ink} />
      </Pressable>
      <Text style={styles.subTitle}>{title}</Text>
    </View>
  );
}

export function SettingsGroup({ label, children }: { label?: string; children: ReactNode }) {
  const { styles } = useStyles();
  return (
    <View style={styles.group}>
      {label ? <Text style={styles.groupLabel}>{label}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function Divider() {
  const { styles } = useStyles();
  return <View style={styles.divider} />;
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  danger,
  right,
  onPress,
}: {
  icon?: IoniconName;
  title: string;
  subtitle?: string;
  /** 오른쪽 회색 값 텍스트 */
  value?: string;
  danger?: boolean;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const { theme, styles } = useStyles();
  const color = danger ? theme.red : theme.ink;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {icon ? <Ionicons name={icon} size={20} color={color} /> : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {right}
      {onPress && !right ? (
        <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
      ) : null}
    </Pressable>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { theme } = useStyles();
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: theme.line, true: theme.accent }}
      thumbColor={theme.card}
      ios_backgroundColor={theme.line}
    />
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { styles } = useStyles();
  return (
    <View style={styles.segments}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={String(o.key)}
            onPress={() => onChange(o.key)}
            style={[styles.segment, on && styles.segmentOn]}>
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    subHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    subTitle: { ...PlannerType.titleM, color: theme.ink },
    group: { gap: Spacing.two },
    groupLabel: { ...PlannerType.labelStrong, color: theme.textSecondary, paddingHorizontal: 4 },
    card: {
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.card,
      paddingHorizontal: Spacing.three,
      ...PlannerShadow,
    },
    divider: { height: 1, backgroundColor: theme.line },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
    rowPressed: { opacity: 0.6 },
    rowText: { flex: 1, gap: 2 },
    rowTitle: { ...PlannerType.bodyMedium, fontSize: 15, fontWeight: '700' },
    rowSub: { ...PlannerType.caption, color: theme.textSecondary },
    rowValue: { ...PlannerType.label, color: theme.textSecondary },
    segments: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: PlannerRadius.md,
      padding: 3,
    },
    segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: PlannerRadius.sm },
    segmentOn: { backgroundColor: theme.accent },
    segmentText: { ...PlannerType.labelStrong, color: theme.textSecondary },
    segmentTextOn: { color: theme.onAccent },
  });
