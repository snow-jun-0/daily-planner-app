import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { TimeTimerDial } from '@/components/planner/time-timer-dial';
import { PlannerCard } from '@/components/planner/planner-card';
import { PlannerScreen } from '@/components/planner/planner-screen';
import { PlannerRadius, PlannerSerif, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/constants/theme-context';
import { enterFocusMode, exitFocusMode } from '@/lib/focus-mode';
import * as pomodoro from '@/lib/pomodoro';
import { requestNotifyPermission } from '@/lib/notify';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const RING_SIZE = 252;
const RING_STROKE = 14;
const SESSIONS_GOAL = 4;
const TICK_MS = 250;

const FOCUS_STEP = 1;
const FOCUS_MIN = 1;
const FOCUS_MAX = 90;
const BREAK_STEP = 1;
const BREAK_MIN = 1;
const BREAK_MAX = 30;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TimerScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const state = useSyncExternalStore(pomodoro.subscribe, pomodoro.getState, pomodoro.getState);

  useEffect(() => {
    pomodoro.ensureInitialized();
    void requestNotifyPermission();
    const interval = setInterval(pomodoro.tick, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  // 타이머 작동 중엔 화면이 꺼지지 않게
  useEffect(() => {
    if (state.status === 'running') {
      void activateKeepAwakeAsync('timer');
      return () => {
        deactivateKeepAwake('timer');
      };
    }
  }, [state.status]);

  const { status, phase, remainingMs, settings, alarming, overrunMs } = state;
  const [focusMode, setFocusMode] = useState(false);

  const toggleFocus = () => {
    if (focusMode) {
      void exitFocusMode();
      setFocusMode(false);
    } else {
      void enterFocusMode();
      setFocusMode(true);
    }
  };

  // 집중모드 중엔 하드웨어 뒤로가기 차단
  useEffect(() => {
    if (!focusMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [focusMode]);
  const totalMs = pomodoro.getPhaseDurationMs(phase, settings);
  const percent = totalMs > 0 ? (remainingMs / totalMs) * 100 : 0;
  const isRunning = status === 'running';

  const isOverrun = status === 'overrun';
  const statusLabel =
    status === 'overrun'
      ? '휴식 초과 중 🫠'
      : status === 'paused'
        ? '일시정지'
        : phase === 'focus'
          ? '집중 중'
          : '휴식 중';

  const handleEndBreak = () => {
    pomodoro.endBreak();
  };

  function handleAdjustFocus(delta: number) {
    pomodoro.setFocusMinutes(clamp(settings.focusMinutes + delta, FOCUS_MIN, FOCUS_MAX));
  }

  function handleAdjustBreak(delta: number) {
    pomodoro.setBreakMinutes(clamp(settings.breakMinutes + delta, BREAK_MIN, BREAK_MAX));
  }

  return (
    <PlannerScreen contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>뽀모도로</Text>

        <Pressable style={styles.lockBtn} hitSlop={8} onPress={toggleFocus}>
          <Ionicons
            name={focusMode ? 'lock-open-outline' : 'lock-closed-outline'}
            size={14}
            color={focusMode ? theme.accent : theme.faint}
          />
          <Text style={[styles.lockBtnText, focusMode ? { color: theme.accent } : null]}>
            {focusMode ? '집중 해제' : '화면 잠금'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.statusPill}>
        <Text style={styles.statusPillText}>{statusLabel}</Text>
      </View>

      <Modal visible={alarming} transparent animationType="fade" onRequestClose={pomodoro.stopAlarm}>
        <View style={styles.alarmBackdrop}>
          <View style={styles.alarmPopup}>
            <Ionicons name="alarm" size={44} color={theme.accent} />
            <Text style={styles.alarmPopupTitle}>시간 종료!</Text>
            <Text style={styles.alarmPopupSub}>
              {phase === 'focus' ? '집중할 시간이에요' : '잠깐 쉬어가요'}
            </Text>
            <Pressable style={styles.alarmStopBig} onPress={pomodoro.stopAlarm}>
              <Text style={styles.alarmStopBigText}>알람 끄기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <TimeTimerDial
        size={RING_SIZE}
        minutes={phase === 'focus' ? settings.focusMinutes : settings.breakMinutes}
        remainingRatio={totalMs > 0 ? remainingMs / totalMs : 1}
        editable={status === 'idle' && phase === 'focus'}
        onChangeMinutes={(m) => void pomodoro.setFocusMinutes(m)}
        maxMinutes={60}
        pieColor={theme.red}>
        <Text style={[styles.timeText, isOverrun ? { color: theme.red } : null]}>
          {isOverrun ? `+${formatClock(overrunMs)}` : formatClock(remainingMs)}
        </Text>
      </TimeTimerDial>

      <View style={styles.controlsRow}>
        {isOverrun ? (
          <ControlButton icon="checkmark" label="휴식 종료" primary onPress={handleEndBreak} />
        ) : (
          <>
            <ControlButton icon="refresh-outline" label="처음으로" onPress={pomodoro.reset} />
            <ControlButton
              icon={isRunning ? 'pause' : 'play'}
              label={isRunning ? '일시정지' : status === 'paused' ? '재개' : '시작'}
              primary
              onPress={isRunning ? pomodoro.pause : pomodoro.start}
            />
            <ControlButton
              icon="play-skip-forward-outline"
              label={phase === 'focus' ? '휴식으로' : '집중으로'}
              onPress={pomodoro.skip}
            />
          </>
        )}
      </View>

      <PlannerCard style={styles.footerCard}>
        <DurationRow
          label="집중"
          minutes={settings.focusMinutes}
          onDecrease={() => handleAdjustFocus(-FOCUS_STEP)}
          onIncrease={() => handleAdjustFocus(FOCUS_STEP)}
        />
        <DurationRow
          label="휴식"
          minutes={settings.breakMinutes}
          onDecrease={() => handleAdjustBreak(-BREAK_STEP)}
          onIncrease={() => handleAdjustBreak(BREAK_STEP)}
        />
      </PlannerCard>
    </PlannerScreen>
  );
}

function ControlButton({
  icon,
  label,
  primary = false,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.controlItem}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.controlBtn,
          primary && styles.controlBtnPrimary,
          pressed && styles.controlBtnPressed,
        ]}>
        <Ionicons
          name={icon}
          size={primary ? 28 : 20}
          color={primary ? theme.onAccent : theme.ink}
        />
      </Pressable>
      <Text style={styles.controlLabel}>{label}</Text>
    </View>
  );
}

function DurationRow({
  label,
  minutes,
  onDecrease,
  onIncrease,
}: {
  label: string;
  minutes: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.durationRow}>
      <Text style={styles.durationLabel}>{label}</Text>
      <Pressable onPress={onDecrease} style={styles.stepBtn} hitSlop={8}>
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <View style={styles.durationBox}>
        <Text style={styles.durationValue}>{minutes}</Text>
      </View>
      <Pressable onPress={onIncrease} style={styles.stepBtn} hitSlop={8}>
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
      <Text style={styles.durationUnit}>분</Text>
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    alarmBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.four,
    },
    alarmPopup: {
      backgroundColor: theme.card,
      borderRadius: PlannerRadius.card,
      paddingVertical: Spacing.five,
      paddingHorizontal: Spacing.five,
      alignItems: 'center',
      gap: Spacing.one,
      width: '100%',
      maxWidth: 300,
    },
    alarmPopupTitle: {
      color: theme.ink,
      fontSize: 22,
      fontWeight: '700',
      marginTop: Spacing.two,
    },
    alarmPopupSub: {
      color: theme.faint,
      fontSize: 14,
    },
    alarmStopBig: {
      backgroundColor: theme.accent,
      borderRadius: PlannerRadius.chip,
      paddingVertical: Spacing.three,
      paddingHorizontal: Spacing.five,
      marginTop: Spacing.three,
      width: '100%',
      alignItems: 'center',
    },
    alarmStopBigText: {
      color: theme.onAccent,
      fontSize: 16,
      fontWeight: '700',
    },
  content: {
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: Spacing.one,
  },
  title: {
    color: theme.ink,
    fontFamily: PlannerSerif,
    fontSize: 28,
    fontWeight: '600',
  },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: PlannerRadius.chip,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.line,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one,
  },
  lockBtnText: {
    color: theme.faint,
    fontSize: 12,
    fontWeight: '600',
  },
  statusPill: {
    backgroundColor: theme.accentSoft,
    borderRadius: PlannerRadius.chip,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    marginTop: Spacing.two,
  },
  statusPillText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  timeText: {
    color: theme.ink,
    fontFamily: PlannerSerif,
    fontSize: 52,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: Spacing.five,
    marginTop: Spacing.two,
  },
  controlItem: {
    alignItems: 'center',
    gap: Spacing.two,
    width: 76,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: PlannerRadius.chip,
    backgroundColor: theme.paper,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnPrimary: {
    width: 76,
    height: 76,
    backgroundColor: theme.accent,
    borderWidth: 0,
  },
  controlBtnPressed: {
    opacity: 0.75,
  },
  controlLabel: {
    color: theme.faint,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerCard: {
    width: '100%',
    gap: Spacing.three,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  sessionLabel: {
    color: theme.faint,
    fontSize: 13,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.one + 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: PlannerRadius.chip,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.line,
  },
  dotFilled: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  sessionCount: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: theme.line,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  durationLabel: {
    color: theme.faint,
    fontSize: 13,
    fontWeight: '600',
    width: 32,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: PlannerRadius.chip,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  durationBox: {
    minWidth: 40,
    borderRadius: PlannerRadius.block,
    backgroundColor: theme.paper,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.line,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    alignItems: 'center',
  },
  durationValue: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  durationUnit: {
    color: theme.faint,
    fontSize: 13,
    fontWeight: '600',
  },
});
