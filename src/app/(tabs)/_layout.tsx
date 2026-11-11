import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { StyleSheet, type ColorValue } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ICON_SIZE = 24;

function tabIcon(name: IoniconName) {
  function TabIcon({ color }: { color: ColorValue }) {
    return <Ionicons name={name} size={ICON_SIZE} color={color as string} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.faint,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}>
      <Tabs.Screen
        name="monthly"
        options={{ title: '월간', tabBarIcon: tabIcon('calendar-outline') }}
      />
      <Tabs.Screen
        name="memo"
        options={{ title: '메모', tabBarIcon: tabIcon('document-text-outline') }}
      />
      <Tabs.Screen name="index" options={{ title: '오늘', tabBarIcon: tabIcon('time-outline') }} />
      <Tabs.Screen
        name="timer"
        options={{ title: '타이머', tabBarIcon: tabIcon('timer-outline') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: '설정', tabBarIcon: tabIcon('settings-outline') }}
      />
    </Tabs>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
  tabBar: {
    backgroundColor: theme.card,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: theme.line,
    shadowColor: theme.ink,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
