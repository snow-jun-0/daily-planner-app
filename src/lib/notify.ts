import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';

import { getNotifyMode } from './settings';

// 앱이 포그라운드일 때도 배너/소리를 띄운다.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'reminder';
const ALARM_CHANNEL_ID = 'overrun-alarm';
let channelReady = false;
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  // 일반 리마인더: heads-up 배너용 importance MAX.
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '리마인더',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  // 휴식 초과 전용 '알람' 채널: 방해금지(DnD)도 뚫고, 알람 음량/강한 진동으로 운다.
  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
    name: '휴식 초과 알람',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 600, 300, 600, 300, 600],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM },
  });
  channelReady = true;
}

/** 알림 권한 요청 (이미 허용돼 있으면 그대로 true) */
export async function requestNotifyPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** 뽀모도로 단계 종료 알림 — 알림 방식(무음/진동/소리)에 따라 진동/소리 분기 */
export async function notifyPhaseEnd(wasFocus: boolean): Promise<void> {
  const mode = await getNotifyMode();
  if (mode === 'mute') return;

  // 진동 (진동/소리 모드 공통)
  Vibration.vibrate([0, 400, 200, 400]);

  await ensureChannel();
  const title = wasFocus ? '집중 끝!' : '휴식 끝!';
  const body = wasFocus ? '잠깐 쉬어가자' : '다시 집중을 시작해봐';
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: mode === 'sound' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    // 알림 실패해도 화면 표시로 대체되므로 무시
  }
}

const DAILY_ID = 'daily-reflection';

/** 저녁 회고 알림 예약 (매일 지정 시각, 기본 21:00) */
export async function scheduleDailyReflection(hour = 21, minute = 0): Promise<void> {
  await ensureChannel();
  await cancelDailyReflection();
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_ID,
      content: {
        title: '오늘 하루 어땠어?',
        body: '잠깐 돌아보고 내일 할 일을 챙겨봐요',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    // 예약 실패 무시
  }
}

export async function cancelDailyReflection(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_ID);
  } catch {
    // 이미 없으면 무시
  }
}

const OVERRUN_IDS = ['overrun-start', 'overrun-10', 'overrun-30', 'overrun-60', 'overrun-90', 'overrun-120', 'overrun-150', 'overrun-180'];

/**
 * 휴식이 끝난 시점에 호출. 1분 유예 뒤부터 초과 단계(10/30/60/90분)마다
 * OS 알림을 미리 예약한다. 백그라운드(딴 앱)에서도 뜨도록 미래 시점 예약 방식.
 */
export async function scheduleOverrunNags(): Promise<void> {
  const mode = await getNotifyMode();
  if (mode === 'mute') return;
  await ensureChannel();
  await cancelOverrunNags();
  const min = 60;
  const nags = [
    { id: 'overrun-start', seconds: min, title: '휴식 끝났어! ⏰', body: '안 돌아오네? 지금부터 초과 시간 카운트 중' },
    { id: 'overrun-10', seconds: min + 10 * 60, title: '10분 초과 👀', body: '적당히 하고 다시 하자' },
    { id: 'overrun-30', seconds: min + 30 * 60, title: '30분 초과 😤', body: '집중 좀 하자...' },
    { id: 'overrun-60', seconds: min + 60 * 60, title: '1시간 초과 🫠', body: '공부 안 함...?' },
    { id: 'overrun-90', seconds: min + 90 * 60, title: '1시간 반 초과 😇', body: '공부 포기했지? 걍 하지 마라' },
  ];
  for (const nag of nags) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: nag.id,
        content: { title: nag.title, body: nag.body, sound: mode === 'sound' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: nag.seconds,
          channelId: ALARM_CHANNEL_ID,
        },
      });
    } catch {
      // 예약 실패 무시
    }
  }
}

/** 예약된 휴식 초과 잔소리 알림을 모두 취소 (복귀/리셋 시). */
export async function cancelOverrunNags(): Promise<void> {
  for (const id of OVERRUN_IDS) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // 이미 없으면 무시
    }
  }
}

/** 완료 후 사용자가 끌 때까지 반복되는 알람(진동). 정리 함수를 반환한다. */
export function startRepeatingAlarm(): () => void {
  let active = true;
  const buzz = () => {
    void getNotifyMode().then((mode) => {
      if (!active || mode === 'mute') return;
      Vibration.vibrate([0, 500, 300, 500]);
    });
  };
  buzz();
  const id = setInterval(buzz, 2000);
  return () => {
    active = false;
    clearInterval(id);
    Vibration.cancel();
  };
}
