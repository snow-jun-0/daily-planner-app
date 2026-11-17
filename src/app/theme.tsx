import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { withAlpha } from '@/components/planner/mini-grid';
import { ProBar } from '@/components/planner/pro-lock';
import { SubHeader } from '@/components/planner/settings-ui';
import type { AppTheme } from '@/constants/theme';
import { PlannerRadius, PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { usePrefs } from '@/hooks/use-prefs';
import { usePro } from '@/lib/pro';
import {
  FOCUS_CATEGORY,
  loadCategories,
  PALETTES,
  saveCategories,
  type PaletteId,
} from '@/lib/timetable';

/** J6 — 테마: 과목 색 팔레트 (기본 외 Pro) */
export default function ThemeScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [prefs, updatePrefs] = usePrefs();
  const { isPro } = usePro();
  /** 잠긴 팔레트를 눌렀을 때 미리보기만 */
  const [preview, setPreview] = useState<PaletteId | null>(null);

  async function choose(id: PaletteId) {
    if (id !== 'base' && !isPro) {
      setPreview(id);
      return;
    }
    setPreview(null);
    updatePrefs({ palette: id });
    // 내 과목들을 새 팔레트 순서대로 다시 칠한다 ('집중'은 그대로)
    const cats = await loadCategories();
    const colors = PALETTES[id].colors;
    let i = 0;
    await saveCategories(
      cats.map((c) => (c.id === FOCUS_CATEGORY.id ? c : { ...c, color: colors[i++ % colors.length] })),
    );
  }

  const shown = PALETTES[preview ?? prefs.palette].colors;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SubHeader title="테마" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>과목 색 팔레트</Text>
        <View style={styles.grid}>
          {(Object.keys(PALETTES) as PaletteId[]).map((id) => {
            const on = (preview ?? prefs.palette) === id;
            const locked = id !== 'base' && !isPro;
            return (
              <Pressable
                key={id}
                onPress={() => void choose(id)}
                style={[styles.palette, on && styles.paletteOn]}
                accessibilityState={{ selected: on }}>
                <View style={styles.swatches}>
                  {PALETTES[id].colors.slice(0, 5).map((c) => (
                    <View key={c} style={[styles.swatch, { backgroundColor: c }]} />
                  ))}
                </View>
                <View style={styles.paletteFoot}>
                  <Text style={styles.label}>{PALETTES[id].name}</Text>
                  {locked ? (
                    <View style={styles.lockTag}>
                      <Ionicons name="lock-closed-outline" size={12} color={theme.textSecondary} />
                      <Text style={styles.lockText}>PRO</Text>
                    </View>
                  ) : prefs.palette === id ? (
                    <Ionicons name="checkmark" size={16} color={theme.ink} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.previewCard}>
          <Text style={styles.caption}>
            {preview ? `미리보기 · ${PALETTES[preview].name}` : '지금 팔레트로 칠하면'}
          </Text>
          <View style={styles.previewRow}>
            {shown.slice(0, 6).map((c, i) => (
              <View
                key={c}
                style={[
                  styles.previewCell,
                  i < 3
                    ? { backgroundColor: c }
                    : { backgroundColor: withAlpha(c, 0.25), borderColor: c, borderWidth: 1 },
                ]}
              />
            ))}
          </View>
        </View>

        {isPro ? (
          <Text style={styles.caption}>팔레트를 바꾸면 내 과목 색이 순서대로 바뀌어요.</Text>
        ) : (
          <ProBar
            title="테마는 Pro 전용이에요"
            desc="잠긴 팔레트를 누르면 미리보기만 적용돼요."
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper },
    content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
    label: { ...PlannerType.labelStrong, color: theme.ink },
    caption: { ...PlannerType.caption, color: theme.textSecondary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    palette: {
      width: '48%',
      flexGrow: 1,
      padding: 14,
      gap: 12,
      borderRadius: PlannerRadius.card,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.card,
    },
    paletteOn: { borderWidth: 2, borderColor: theme.ink },
    swatches: { flexDirection: 'row', gap: 4 },
    swatch: { flex: 1, height: 22, borderRadius: 4 },
    paletteFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    lockTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    lockText: { ...PlannerType.labelStrong, fontSize: 11, color: theme.textSecondary },
    previewCard: {
      padding: 14,
      gap: 10,
      borderRadius: PlannerRadius.card,
      backgroundColor: theme.card,
    },
    previewRow: { flexDirection: 'row', gap: 4 },
    previewCell: { flex: 1, height: 24, borderRadius: 4 },
  });
