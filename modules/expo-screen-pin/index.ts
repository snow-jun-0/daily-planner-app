import ExpoScreenPin from './src/ExpoScreenPinModule';

/** 화면 고정 시작 (홈/최근 버튼 차단) */
export function startPinning(): void {
  ExpoScreenPin.startPinning();
}

/** 화면 고정 해제 */
export function stopPinning(): void {
  ExpoScreenPin.stopPinning();
}
