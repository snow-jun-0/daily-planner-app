import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Alert, Linking, Platform } from 'react-native';

// 문의 받을 이메일 주소. 비어 있으면 '문의하기'가 준비 중 안내를 띄운다.
export const CONTACT_EMAIL = 'dailyplanner.help@gmail.com';

// 운영자(개인정보 보호책임자) 이름과 약관·방침 시행일 (출시 확정 시 시행일 갱신)
export const OPERATOR_NAME = 'snow-jun';
export const LEGAL_EFFECTIVE_DATE = '2026년 11월 20일';

/** 문의 메일 작성창 열기 — 앱 버전·기기 정보를 본문에 미리 채운다 */
export async function openContact(): Promise<void> {
  if (!CONTACT_EMAIL) {
    Alert.alert('문의하기', '문의 창구를 준비하고 있어요.');
    return;
  }
  const body = [
    '',
    '',
    '---',
    `앱 버전: ${Constants.expoConfig?.version ?? '-'}`,
    `기기: ${Device.modelName ?? '-'} (${Platform.OS} ${Platform.Version})`,
  ].join('\n');
  const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('[데일리 플래너] 문의')}&body=${encodeURIComponent(body)}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('메일 앱을 열 수 없어요', `${CONTACT_EMAIL} 로 문의해 주세요.`);
  }
}
