/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Daily planner design tokens — carried over 1:1 from the web (React) version.
 * Light-mode only for now; a dark palette can be added later.
 *
 * Black-and-white minimal base: `accent` (black) drives all UI chrome
 * (active tab, buttons, progress rings, checkmarks, "오늘" chips). Color is
 * reserved for meaning only — priority tags (red/blue/faint) and schedule
 * block types (`green`/`sage`/`highlight`/`blue`/`red`), which stay as-is.
 */
export const Planner = {
  /** screen background — near-white off-white */
  paper: '#FAFAFA',
  /** card surface — pure white, floats on `paper` */
  card: '#FFFFFF',
  /** primary text */
  ink: '#111111',
  /** secondary / muted text */
  faint: '#9B9B9B',
  /** hairline borders */
  line: '#EAEAEA',
  /** the app's single accent color (black) — active tab, buttons, progress
   *  ring, checkmarks, "오늘" chip, toggle ON state */
  accent: '#111111',
  /** soft neutral background for accent-adjacent surfaces, e.g. D-day
   *  badges, "+추가" buttons, connected badges */
  accentSoft: '#F0F0F0',
  /** schedule block colors — kept saturated to distinguish event types on
   *  the timetable / monthly dots, not used as UI chrome */
  green: '#2F6B4F',
  sage: '#9DB8A4',
  highlight: '#F5D547',
  /** soft highlight-tinted background, e.g. the "오늘" badge on memo cards */
  highlightSoft: '#FBF0C7',
  /** priority tag: 높음 (high) */
  red: '#C0392B',
  /** priority tag: 보통 (mid) */
  blue: '#2C5AA0',
  /** text/icons on top of a saturated dark surface (accent buttons, filled
   *  checkmarks, dark schedule blocks) */
  onAccent: '#FFFFFF',
  onAccentFaint: 'rgba(255,255,255,0.72)',
  /** fable 디자인 토큰 — 텍스트 위계 (secondary=보조, tertiary=가장 흐림) */
  textSecondary: '#6B6B6B',
  textTertiary: '#A3A3A3',
  /** 입력창·탭 등 중립 표면 */
  surface: '#F2F2F2',
  /** 의미색 soft 배경 (우선순위/상태 뱃지) */
  redSoft: '#FBEDEB',
  blueSoft: '#EAF0F8',
  amber: '#B07D0E',
  amberSoft: '#FBF4E0',
} as const;

/** 앱 테마 토큰 형태 (라이트/다크 공통) */
export type AppTheme = Record<keyof typeof Planner, string>;

/** 다크 팔레트 — v2의 흑백(B&W) 톤을 유지한 어두운 배색 */
export const PlannerDark: AppTheme = {
  paper: '#121212',
  card: '#1E1E1E',
  ink: '#F0F0F0',
  faint: '#8A8A8A',
  line: '#2E2E2E',
  accent: '#F0F0F0',
  accentSoft: '#2A2A2A',
  green: '#4A9370',
  sage: '#6F8C7A',
  highlight: '#E7C24A',
  highlightSoft: '#3A3410',
  red: '#E0695C',
  blue: '#6FA3D6',
  onAccent: '#111111',
  onAccentFaint: 'rgba(17,17,17,0.72)',
  textSecondary: '#A6A6A6',
  textTertiary: '#6F6F6F',
  surface: '#2A2A2A',
  redSoft: '#3A201C',
  blueSoft: '#1D2A40',
  amber: '#E3B341',
  amberSoft: '#3A3016',
};

export const PlannerRadius = {
  card: 16,
  block: 10,
  chip: 999,
  sm: 8,
  md: 12,
  lg: 20,
} as const;

/** Soft, uniform card shadow (iOS) + elevation (Android). */
export const PlannerShadow = {
  shadowColor: '#000000',
  shadowOpacity: 0.05,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

/** Serif family for planner headings (system serif until custom fonts land). */
export const PlannerSerif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

/**
 * 타이포 스케일 (fable 디자인) — 제목은 serif, 본문은 sans.
 * 폰트 패밀리는 serif만 지정하고 본문은 시스템 기본(한글 대응)에 맡긴다.
 * 커스텀 Noto 폰트는 추후 로드 (용량 고려).
 */
export const PlannerType = {
  display: { fontFamily: PlannerSerif, fontSize: 30, lineHeight: 38, fontWeight: '600' },
  titleM: { fontFamily: PlannerSerif, fontSize: 20, lineHeight: 28, fontWeight: '600' },
  titleS: { fontFamily: PlannerSerif, fontSize: 17, lineHeight: 24, fontWeight: '600' },
  labelStrong: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  body: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  bodyMedium: { fontSize: 14, lineHeight: 21, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '400' },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 6 },
  tab: { fontSize: 11, lineHeight: 14, fontWeight: '500' },
} satisfies Record<string, TextStyle>;
