import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProBadge } from '@/components/planner/pro-lock';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerSerif, PlannerShadow, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { addDays, todayKey } from '@/lib/date';
import { priceOf, purchasePro, restorePro, setDevPro, usePro, type ProPlan } from '@/lib/pro';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** 실제로 잠그는 기능만 적는다 (무료와 차이 없는 항목은 넣지 않음) */
const PRO_FEATURES: { icon: IoniconName; title: string; desc: string }[] = [
  { icon: 'stats-chart-outline', title: '고급 통계', desc: '시간대 히트맵 · 계획 대비 달성률 추이' },
  { icon: 'share-outline', title: '공유 카드 스타일', desc: '어둡게 · 브랜드 블루 톤으로 공유' },
  { icon: 'color-palette-outline', title: '테마', desc: '과목 색 팔레트 5종 추가' },
];

function fmtDate(key: string) {
  const [y, m, d] = key.split('-');
  return `${y}. ${Number(m)}. ${Number(d)}.`;
}

/** J1 소개·가격 → J3 구독 확인 시트 → J4 결제 완료 */
export default function ProScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const pro = usePro();
  const [plan, setPlan] = useState<ProPlan>('annual');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const annual = pro.packages.annual?.product;
  const monthly = pro.packages.monthly?.product;
  const saving =
    annual && monthly ? Math.round((1 - annual.price / (monthly.price * 12)) * 100) : null;
  const nextBilling = fmtDate(addDays(todayKey(), plan === 'annual' ? 365 : 30));
  const store = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

  async function buy() {
    setBusy(true);
    const r = await purchasePro(plan);
    setBusy(false);
    setConfirm(false);
    if (r.ok) setDone(true);
    else if (!r.cancelled) Alert.alert('결제하지 못했어요', r.message);
  }

  async function restore() {
    const ok = await restorePro();
    Alert.alert('구매 복원', ok ? 'Pro를 복원했어요.' : '복원할 구매 내역이 없어요.');
  }

  // ── J4: 결제 완료 ──
  if (done) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={34} color={theme.green} />
          </View>
          <Text style={styles.title}>Pro가 시작됐어요</Text>
          <Text style={styles.caption}>
            {plan === 'annual' ? '연간' : '월간'}
            {pro.renewsAt ? ` · 다음 결제 ${fmtDate(pro.renewsAt.slice(0, 10))}` : ''}
          </Text>
          <View style={styles.doneList}>
            {PRO_FEATURES.map((f) => (
              <View key={f.title} style={styles.doneRow}>
                <Ionicons name="checkmark" size={16} color={theme.green} />
                <Text style={styles.label}>{f.title}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.bottom}>
          <Pressable style={styles.primary} onPress={() => router.replace('/stats' as never)}>
            <Text style={styles.primaryText}>고급 통계 보러 가기</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.linkBtn}>
            <Text style={styles.caption}>나중에</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── J1: 소개·가격 ──
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="닫기">
          <Ionicons name="close" size={24} color={theme.textSecondary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.appIcon}>
            <Ionicons name="grid" size={30} color={theme.onAccent} />
          </View>
          <ProBadge />
        </View>
        <Text style={styles.title}>데일리 플래너 Pro</Text>
        <Text style={[styles.caption, styles.centerText]}>기록은 그대로, 분석과 꾸미기를 더해요.</Text>

        {pro.isPro ? (
          <View style={styles.activeBox}>
            <Ionicons name="checkmark-circle" size={18} color={theme.green} />
            <Text style={[styles.label, { flex: 1 }]}>
              Pro 사용 중{pro.renewsAt ? ` · 다음 결제 ${fmtDate(pro.renewsAt.slice(0, 10))}` : ''}
            </Text>
            {pro.manageUrl ? (
              <Pressable onPress={() => void Linking.openURL(pro.manageUrl!)}>
                <Text style={styles.label}>관리</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          {PRO_FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={18} color={theme.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{f.title}</Text>
                <Text style={styles.caption}>{f.desc}</Text>
              </View>
            </View>
          ))}
          <Pressable onPress={() => router.push('/pro-compare' as never)}>
            <Text style={[styles.caption, styles.centerText, styles.underline]}>
              무료 vs Pro 자세히 비교
            </Text>
          </Pressable>
        </View>

        {pro.isPro ? null : (
          <>
            {(['annual', 'monthly'] as const).map((p) => {
              const on = plan === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPlan(p)}
                  style={[styles.plan, on && styles.planOn]}
                  accessibilityState={{ selected: on }}>
                  <View style={[styles.radio, on && styles.radioOn]}>
                    {on ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.planHead}>
                      <Text style={styles.label}>{p === 'annual' ? '연간' : '월간'}</Text>
                      {p === 'annual' && saving && saving > 0 ? (
                        <View style={styles.saveBadge}>
                          <Text style={styles.saveText}>{saving}% 절약</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.caption}>
                      {p === 'annual'
                        ? `${annual?.pricePerMonthString ? `월 ${annual.pricePerMonthString}꼴 · ` : ''}1년마다 결제`
                        : '매월 결제'}
                    </Text>
                  </View>
                  <Text style={styles.price}>{priceOf(p)}</Text>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>

      {pro.isPro ? null : (
        <View style={styles.bottom}>
          <Pressable style={styles.primary} onPress={() => setConfirm(true)}>
            <Text style={styles.primaryText}>
              {plan === 'annual' ? '연간' : '월간'}으로 Pro 시작하기
            </Text>
          </Pressable>
          <Pressable onPress={() => void restore()} style={styles.linkBtn}>
            <Text style={styles.caption}>언제든 해지할 수 있어요 · 구매 복원</Text>
          </Pressable>
          <Text style={[styles.caption, styles.centerText, { color: theme.textTertiary }]}>
            타임테이블·타이머·기록은 무료에서도 제한 없이 쓸 수 있어요.
          </Text>
          {__DEV__ ? (
            <Pressable onPress={() => setDevPro(true)} style={styles.linkBtn}>
              <Text style={[styles.caption, { color: theme.red }]}>[개발용] 결제 없이 Pro 켜기</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      {__DEV__ && pro.isPro ? (
        <Pressable onPress={() => setDevPro(false)} style={styles.linkBtn}>
          <Text style={[styles.caption, { color: theme.red }]}>[개발용] Pro 끄기</Text>
        </Pressable>
      ) : null}

      {/* J3: 구독 확인 — 실제 결제창은 이 다음 스토어가 띄운다 */}
      <Modal visible={confirm} transparent animationType="slide" onRequestClose={() => setConfirm(false)}>
        <Pressable style={styles.backdrop} onPress={() => setConfirm(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>구독 확인</Text>
            <View style={styles.productRow}>
              <View style={[styles.appIcon, styles.appIconSmall]}>
                <Ionicons name="grid" size={20} color={theme.onAccent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>데일리 플래너 Pro · {plan === 'annual' ? '연간' : '월간'}</Text>
                <Text style={styles.caption}>{plan === 'annual' ? '1년' : '1개월'}마다 자동 갱신</Text>
              </View>
              <Text style={styles.price}>{priceOf(plan)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.kv}>
              <Text style={styles.caption}>결제 수단</Text>
              <Text style={styles.label}>스토어 결제 ({store})</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.caption}>다음 결제일</Text>
              <Text style={styles.label}>{nextBilling}</Text>
            </View>
            <Text style={[styles.caption, { color: theme.textTertiary }]}>
              결제하면 이용약관과 개인정보 처리방침에 동의하게 됩니다. 실제 결제창은 스토어가 띄워요.
            </Text>
            <Pressable style={styles.primary} onPress={() => void buy()} disabled={busy}>
              <Text style={styles.primaryText}>
                {busy ? '결제 진행 중…' : `${priceOf(plan)} 결제하고 시작`}
              </Text>
            </Pressable>
            <Text style={[styles.caption, styles.centerText]}>스토어 › 구독에서 언제든 해지</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper },
    topBar: { alignItems: 'flex-end', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    content: { padding: Spacing.three, gap: Spacing.three },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: Spacing.four },
    centerText: { textAlign: 'center' },
    underline: { textDecorationLine: 'underline' },
    hero: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6 },
    appIcon: {
      width: 64,
      height: 64,
      borderRadius: 16,
      backgroundColor: theme.blue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appIconSmall: { width: 40, height: 40, borderRadius: 10 },
    title: {
      fontFamily: PlannerSerif,
      fontSize: 26,
      lineHeight: 34,
      fontWeight: '600',
      color: theme.ink,
      textAlign: 'center',
    },
    caption: { ...PlannerType.caption, color: theme.textSecondary },
    label: { ...PlannerType.labelStrong, fontSize: 14, color: theme.ink },
    price: { ...PlannerType.titleM, color: theme.ink },
    activeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 14,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.surface,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.card,
      padding: Spacing.three,
      gap: 14,
      ...PlannerShadow,
    },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    featureIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    plan: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: PlannerRadius.card,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.card,
    },
    planOn: { borderWidth: 2, borderColor: theme.ink },
    planHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.textTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: theme.ink },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.ink },
    saveBadge: {
      backgroundColor: theme.surface,
      borderRadius: PlannerRadius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    saveText: { ...PlannerType.labelStrong, fontSize: 11, color: theme.green },
    bottom: { gap: 6, padding: Spacing.three },
    primary: {
      paddingVertical: 16,
      borderRadius: PlannerRadius.md,
      backgroundColor: theme.accent,
      alignItems: 'center',
    },
    primaryText: { ...PlannerType.bodyMedium, fontWeight: '700', color: theme.onAccent },
    linkBtn: { alignItems: 'center', paddingVertical: 6 },
    doneIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    doneList: { alignSelf: 'stretch', gap: 12, marginTop: 20, paddingHorizontal: 8 },
    doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: PlannerRadius.lg,
      borderTopRightRadius: PlannerRadius.lg,
      padding: 20,
      paddingTop: 10,
      gap: 14,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.line,
      marginBottom: 6,
    },
    sheetTitle: { ...PlannerType.titleM, color: theme.ink },
    productRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    divider: { height: 1, backgroundColor: theme.line },
    kv: { flexDirection: 'row', justifyContent: 'space-between' },
  });
