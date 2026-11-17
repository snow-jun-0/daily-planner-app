import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Divider,
  SettingsGroup,
  SettingsRow,
  SubHeader,
  Toggle,
} from '@/components/planner/settings-ui';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerShadow, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { usePrefs } from '@/hooks/use-prefs';
import { signInWithGoogle, useAuthSession } from '@/lib/auth';
import { backupCounts, getLastBackupAt, restoreFromCloud, uploadBackup } from '@/lib/backup';
import { todayKey } from '@/lib/date';

function fmtWhen(ms: number): string {
  const d = new Date(ms);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const day = key === todayKey() ? '오늘' : `${d.getMonth() + 1}월 ${d.getDate()}일`;
  const h = d.getHours();
  return `${day} ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** E7 — 백업·동기화 (+ E8 복원 확인) */
export default function BackupScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { session } = useAuthSession();
  const [prefs, updatePrefs] = usePrefs();
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const reload = useCallback(() => {
    void getLastBackupAt().then(setLastAt);
    void backupCounts().then(setCounts);
  }, []);
  useFocusEffect(reload);

  const backupNow = async () => {
    if (!session) {
      void signInWithGoogle().catch((e: unknown) =>
        Alert.alert('로그인 실패', e instanceof Error ? e.message : String(e)),
      );
      return;
    }
    setBusy(true);
    const ok = await uploadBackup();
    setBusy(false);
    if (!ok) Alert.alert('백업 실패', '잠시 후 다시 시도해 주세요.');
    reload();
  };

  const restore = async () => {
    setConfirm(false);
    const ok = await restoreFromCloud();
    Alert.alert('백업 복원', ok ? '복원했어요. 앱을 다시 켜면 반영돼요.' : '클라우드에 백업이 없어요.');
    reload();
  };

  const items = counts
    ? [
        { label: '할 일', value: `${counts.tasks}개` },
        { label: '일정', value: `${counts.events}개` },
        { label: '메모', value: `${counts.memos}개` },
        { label: 'D-Day', value: `${counts.ddays}개` },
        { label: '타임테이블', value: `${counts.timetableDays}일` },
      ]
    : [];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SubHeader title="백업·동기화" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              name={session ? 'cloud-done-outline' : 'cloud-offline-outline'}
              size={30}
              color={session ? theme.green : theme.textSecondary}
            />
          </View>
          <Text style={styles.heroTitle}>
            {!session ? '이 기기에만 저장 중' : lastAt ? '모두 백업됨' : '아직 백업 안 됨'}
          </Text>
          <Text style={styles.caption}>
            {!session
              ? '구글로 로그인하면 클라우드에 백업돼요'
              : lastAt
                ? `마지막 백업 · ${fmtWhen(lastAt)}`
                : '지금 백업을 눌러 첫 백업을 만들어요'}
          </Text>
          {session?.user.email ? (
            <View style={styles.account}>
              <Ionicons name="logo-google" size={14} color={theme.textSecondary} />
              <Text style={styles.caption}>{session.user.email}</Text>
            </View>
          ) : null}
          <Pressable style={styles.primaryBtn} onPress={() => void backupNow()} disabled={busy}>
            <Text style={styles.primaryText}>
              {!session ? '구글로 로그인' : busy ? '백업 중…' : '지금 백업'}
            </Text>
          </Pressable>
        </View>

        <SettingsGroup>
          <SettingsRow
            icon="sync-outline"
            title="자동 백업"
            subtitle="데이터가 바뀌면 자동으로 저장해요"
            right={
              <Toggle value={prefs.autoBackup} onChange={(v) => updatePrefs({ autoBackup: v })} />
            }
          />
        </SettingsGroup>

        <SettingsGroup label="백업 항목">
          {items.map((it, i) => (
            <View key={it.label}>
              {i > 0 ? <Divider /> : null}
              <SettingsRow title={it.label} value={it.value} />
            </View>
          ))}
        </SettingsGroup>

        {session ? (
          <SettingsGroup label="복원">
            <SettingsRow
              icon="cloud-download-outline"
              title="백업에서 복원"
              subtitle="이 기기의 데이터를 백업으로 덮어써요"
              onPress={() => setConfirm(true)}
            />
          </SettingsGroup>
        ) : null}

        <Text style={[styles.caption, styles.center]}>
          앱을 삭제해도 같은 구글 계정으로 로그인하면 복원할 수 있어요.
        </Text>
      </ScrollView>

      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => setConfirm(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <View style={styles.warnIcon}>
              <Ionicons name="warning-outline" size={24} color={theme.red} />
            </View>
            <Text style={styles.dialogTitle}>백업으로 덮어쓸까요?</Text>
            <Text style={[styles.caption, styles.center]}>
              이 기기의 할 일·일정·메모·타임테이블이{' '}
              {lastAt ? `${fmtWhen(lastAt)} ` : ''}백업으로 교체됩니다. 되돌릴 수 없어요.
            </Text>
            <View style={styles.dialogBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setConfirm(false)}>
                <Text style={styles.cancelText}>취소</Text>
              </Pressable>
              <Pressable style={styles.dangerBtn} onPress={() => void restore()}>
                <Text style={styles.dangerText}>복원</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper },
    content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
    caption: { ...PlannerType.caption, color: theme.textSecondary },
    center: { textAlign: 'center' },
    hero: {
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.card,
      padding: Spacing.four,
      alignItems: 'center',
      gap: 6,
      ...PlannerShadow,
    },
    heroIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    heroTitle: { ...PlannerType.titleM, color: theme.ink },
    account: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    primaryBtn: {
      alignSelf: 'stretch',
      marginTop: 14,
      paddingVertical: 15,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.accent,
      alignItems: 'center',
    },
    primaryText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: Spacing.four,
    },
    dialog: {
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.lg,
      padding: Spacing.four,
      alignItems: 'center',
      gap: 8,
    },
    warnIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.redSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    dialogTitle: { ...PlannerType.titleM, color: theme.ink },
    dialogBtns: { flexDirection: 'row', gap: 10, marginTop: 14, alignSelf: 'stretch' },
    cancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.surface,
      alignItems: 'center',
    },
    cancelText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.ink },
    dangerBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.red,
      alignItems: 'center',
    },
    dangerText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
  });
