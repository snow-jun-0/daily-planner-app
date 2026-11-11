import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { Planner, PlannerDark, type AppTheme } from './theme';

import { getDarkModeStored, setDarkModeStored } from '@/lib/settings';

type ThemeControl = {
  theme: AppTheme;
  isDark: boolean;
  setDark: (v: boolean) => void;
};

const ThemeContext = createContext<ThemeControl>({
  theme: Planner,
  isDark: false,
  setDark: () => {},
});

export function PlannerThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    void getDarkModeStored().then((stored) => {
      setIsDark(stored ?? system === 'dark');
    });
  }, [system]);

  const setDark = (v: boolean) => {
    setIsDark(v);
    void setDarkModeStored(v);
  };

  return (
    <ThemeContext.Provider value={{ theme: isDark ? PlannerDark : Planner, isDark, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** 현재 테마 토큰 (라이트/다크) */
export const useTheme = (): AppTheme => useContext(ThemeContext).theme;
/** 테마 상태 + 토글 */
export const useThemeControl = (): ThemeControl => useContext(ThemeContext);
