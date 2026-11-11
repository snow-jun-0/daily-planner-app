import * as NavigationBar from 'expo-navigation-bar';
import { Platform } from 'react-native';

import { startPinning, stopPinning } from '../../modules/expo-screen-pin';

/** 집중모드 시작 — 화면 고정(홈/최근 차단) + 네비게이션 바 숨김 */
export async function enterFocusMode(): Promise<void> {
  if (Platform.OS !== 'android') return;
  startPinning();
  try {
    await NavigationBar.setVisibilityAsync('hidden');
  } catch {
    // 네비바 제어 실패는 무시
  }
}

/** 집중모드 해제 — 화면 고정 풀고 네비게이션 바 복원 */
export async function exitFocusMode(): Promise<void> {
  if (Platform.OS !== 'android') return;
  stopPinning();
  try {
    await NavigationBar.setVisibilityAsync('visible');
  } catch {
    // 무시
  }
}
