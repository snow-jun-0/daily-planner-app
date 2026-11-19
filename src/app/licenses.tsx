import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SubHeader } from '@/components/planner/settings-ui';
import licenses from '@/constants/licenses.json';
import type { AppTheme } from '@/constants/theme';
import { PlannerType, Spacing } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';

/** 설정 › 오픈소스 라이선스 (목록은 scripts/gen-licenses.mjs로 생성) */
export default function LicensesScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SubHeader title="오픈소스 라이선스" />
      <FlatList
        data={licenses}
        keyExtractor={(l) => l.name}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Text style={styles.caption}>
            이 앱은 아래 오픈소스 소프트웨어를 사용합니다. 각 라이선스 전문은 패키지 저장소에서 볼 수
            있어요.
          </Text>
        }
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.meta}>
              {item.version} · {item.license}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.paper },
    content: { padding: Spacing.three, paddingBottom: Spacing.six },
    caption: { ...PlannerType.caption, color: theme.textSecondary, marginBottom: Spacing.three },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    name: { ...PlannerType.bodyMedium, color: theme.ink, flex: 1 },
    meta: { ...PlannerType.caption, color: theme.textTertiary },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.line },
  });
