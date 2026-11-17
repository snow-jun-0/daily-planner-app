import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { DEFAULT_PREFS, getPrefs, setPrefs, type Prefs } from '@/lib/settings';

/** 설정 묶음 읽기/쓰기 — 화면에 돌아올 때마다 다시 읽는다 */
export function usePrefs() {
  const [prefs, setState] = useState<Prefs>(DEFAULT_PREFS);
  useFocusEffect(
    useCallback(() => {
      void getPrefs().then(setState);
    }, []),
  );
  const update = useCallback((patch: Partial<Prefs>) => {
    setState((p) => ({ ...p, ...patch }));
    void setPrefs(patch);
  }, []);
  return [prefs, update] as const;
}
