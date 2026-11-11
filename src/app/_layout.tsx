import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PlannerThemeProvider, useThemeControl } from '@/constants/theme-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <PlannerThemeProvider>
      <RootNavigator />
    </PlannerThemeProvider>
  );
}

function RootNavigator() {
  const { isDark } = useThemeControl();
  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
