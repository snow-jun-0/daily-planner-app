import { useEffect, useState } from 'react';

import * as pomodoro from '@/lib/pomodoro';

/**
 * 현재 시각(ms) — 매초 + 타이머 상태가 바뀔 때 갱신.
 * 렌더 중 `new Date()`는 React Compiler가 메모이즈해 멈춰 보일 수 있으니 시각은 이 훅으로 받는다.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const bump = () => setNow(Date.now());
    const unsub = pomodoro.subscribe(bump);
    const iv = setInterval(bump, 1000);
    return () => {
      unsub();
      clearInterval(iv);
    };
  }, []);
  return now;
}
