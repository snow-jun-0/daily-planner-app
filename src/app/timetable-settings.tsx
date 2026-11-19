import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Divider,
  SettingsGroup,
  SettingsRow,
  Segmented,
  SubHeader,
  Toggle,
} from '@/components/planner/settings-ui';
import type { AppTheme } from '@/constants/theme';
import { PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { usePrefs } from '@/hooks/use-prefs';
import { ROWS, START_HOUR } from '@/lib/timetable';

/** H1 — 설정 > 타임테이블 상세 */
export default function TimetableSettingsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [prefs, updatePrefs] = usePrefs();

  const endHour = (START_HOUR + ROWS) % 24;
  // 24시간 막대에서 06시~익일 02시 구간 (자정을 넘으므로 두 조각)
  const segs = [
    { from: START_HOUR, to: 24 },
    { from: 0, to: endHour },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SubHeader title="타임테이블" />
      <ScrollView contentContainerStyle={styles.content}>
        <SettingsGroup label="하루 범위">
          <SettingsRow title="하루 시작" value={`${String(START_HOUR).padStart(2, '0')}:00`} />
          <Divider />
          <SettingsRow
            title="하루 끝"
            subtitle="이 시각에 날짜가 바뀌어요"
            value={`익일 ${String(endHour).padStart(2, '0')}:00`}
          />
          <View style={styles.rangeBlock}>
            <View style={styles.rangeTrack}>
              {segs.map((s) => (
                <View
                  key={s.from}
                  style={[
                    styles.rangeFill,
                    { left: `${(s.from / 24) * 100}%`, width: `${((s.to - s.from) / 24) * 100}%` },
                  ]}
                />
              ))}
            </View>
            <View style={styles.rangeLabels}>
              {['00', '06', '12', '18', '24'].map((h) => (
                <Text key={h} style={styles.caption}>
                  {h}
                </Text>
              ))}
            </View>
          </View>
        </SettingsGroup>
        <Text style={styles.note}>
          {ROWS}시간 = {ROWS}행 · 한 칸 10분(한 행 6칸). 03~05시는 격자에 없어요.
        </Text>

        <SettingsGroup label="일정 레인">
          <View style={styles.block}>
            <Text style={styles.label}>기본 상태</Text>
            <Segmented
              options={[
                { key: 'open', label: '펼침' },
                { key: 'closed', label: '접힘' },
                { key: 'hidden', label: '숨김' },
              ]}
              value={prefs.laneMode}
              onChange={(v) => updatePrefs({ laneMode: v })}
            />
          </View>
          <Divider />
          <View style={styles.block}>
            <Text style={styles.label}>레인 너비</Text>
            <Segmented
              options={[
                { key: 56, label: '좁게' },
                { key: 68, label: '보통' },
                { key: 84, label: '넓게' },
              ]}
              value={prefs.laneWidth}
              onChange={(v) => updatePrefs({ laneWidth: v })}
            />
          </View>
        </SettingsGroup>

        <SettingsGroup label="동작">
          <SettingsRow
            title="계획 칸 탭하면 바로 집중"
            subtitle="끄면 시작 시트를 먼저 보여줘요"
            right={
              <Toggle value={prefs.tapToFocus} onChange={(v) => updatePrefs({ tapToFocus: v })} />
            }
          />
          <Divider />
          <SettingsRow
            title="칸이 채워질 때 진동"
            right={
              <Toggle
                value={prefs.hapticOnFill}
                onChange={(v) => updatePrefs({ hapticOnFill: v })}
              />
            }
          />
          <Divider />
          <View style={styles.block}>
            <Text style={styles.label}>색각 보조</Text>
            <Segmented
              options={[
                { key: 'color', label: '색만' },
                { key: 'label', label: '색 + 라벨' },
              ]}
              value={prefs.a11yMode}
              onChange={(v) => updatePrefs({ a11yMode: v })}
            />
            <Text style={styles.caption}>라벨: 칸 묶음 첫 칸에 과목 첫 글자를 표시해요.</Text>
          </View>
        </SettingsGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper },
    content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
    caption: { ...PlannerType.caption, color: theme.textTertiary },
    note: { ...PlannerType.caption, color: theme.textSecondary, marginTop: -Spacing.three, paddingHorizontal: 4 },
    label: { ...PlannerType.labelStrong, color: theme.ink },
    block: { paddingVertical: 14, gap: 10 },
    rangeBlock: { paddingBottom: 14, gap: 6 },
    rangeTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.surface,
      overflow: 'hidden',
    },
    rangeFill: { position: 'absolute', top: 0, bottom: 0, backgroundColor: theme.ink },
    rangeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  });
