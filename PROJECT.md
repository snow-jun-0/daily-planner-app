# 데일리 플래너 v2 — 프로젝트 핸드오프 문서

> 다른 AI 세션(또는 사람)이 이 레포를 이어받아 작업할 수 있도록 정리한 문서.
> 마지막 갱신: 2026-11-11

---

## 0. 한눈에

- **무엇**: React Native / Expo 네이티브 앱 "데일리 플래너" v2 (하루 단위 할일·일정·메모 + 뽀모도로 타이머 + 구글 연동)
- **왜**: 앱 **출시 경험**과 **취업 포트폴리오**가 목표
- **개발자**: 우준영 (동국대 정보컴퓨터공학부, 학교는 백엔드 위주 / 프론트(React·RN)는 UMC에서 학습)
- **현재 상태**: 핵심 기능 구현 완료, EAS preview(APK) 빌드로 실기기(갤럭시, 360px) 검증 중
- **v1**: 웹 버전 (github.com/snow-jun-0/daily-planner, public). v2는 이걸 네이티브로 다시 만들며 기능 확장 중. **v1에 있는데 v2에 아직 없는 기능**은 "7. 앞으로 할 일" 참고.

---

## 1. 기술 스택

| 영역 | 사용 |
|---|---|
| 런타임 | Expo SDK 57, React Native 0.86, React 19.2 |
| 라우팅 | expo-router (파일 기반, typedRoutes 실험 켜짐) |
| 언어 | TypeScript (strict) |
| 로컬 저장 | @react-native-async-storage/async-storage |
| 그래픽 | react-native-svg 15 (Time Timer 다이얼, 통계 파이) |
| 애니메이션/제스처 | react-native-reanimated 4, gesture-handler, PanResponder |
| 위젯 | react-native-android-widget 0.22 (홈 화면 위젯 2종) |
| 알림 | expo-notifications |
| 인증/백엔드 | Supabase (@supabase/supabase-js 2.x), Google OAuth (PKCE) |
| 빌드 | EAS Build (CNG — android/ 폴더 없음), preview = APK |
| 네이티브 모듈 | 로컬 Expo 모듈 `modules/expo-screen-pin` (화면 고정) |

**빌드 명령**: `eas build --profile preview --platform android` (약 40분). 유저가 직접 터미널에서 돌림.
**타입체크**: `npx tsc --noEmit --skipLibCheck` (풀 tsc는 180s 타임아웃 → skipLibCheck 필수)
**안드로이드 패키지**: `com.snowjun.dailyplanner`

---

## 2. 프로젝트 구조

```
src/
  app/                       # expo-router 화면 (파일=라우트)
    _layout.tsx              # 루트 (PlannerThemeProvider + RootNavigator)
    (tabs)/
      _layout.tsx            # 탭 바 (borderTop + shadow로 네비바와 구분)
      index.tsx              # [홈] 하루 화면: 할일·일정·메모·D-day요약
      monthly.tsx            # [월간] 달력 (2탭 미리보기 → 열기), 통계 진입
      timer.tsx              # [타이머] Time Timer 뽀모도로 + 휴식 초과
      memo.tsx, settings.tsx
    stats.tsx                # 통계 화면 (월별 집중/완료율/휴식초과/기록일)
    auth/callback.tsx        # OAuth 리다이렉트 콜백
  components/planner/        # UI 컴포넌트
    time-timer-dial.tsx      # SVG 타임타이머 다이얼 (드래그로 시간 설정)
    todo-card, schedule-card, memo-card, dday-modal, today-summary-card ...
  lib/                       # 도메인 로직 (화면과 분리)
    tasks.ts, events.ts, memos.ts, dday.ts   # 날짜별 CRUD + 저장
    pomodoro.ts              # 타이머 상태머신 (모듈 스코프 + useSyncExternalStore)
    stats.ts                 # 통계 집계 + 휴식초과 잔소리 메시지
    notify.ts                # expo-notifications 래퍼 (채널/예약/반복)
    focus-mode.ts            # 화면 고정 (screen pinning) 진입/해제
    auth.ts                  # 구글 OAuth 로그인 + refresh token 저장
    supabase.ts              # Supabase 클라이언트
    google-auth.ts           # 구글 API 토큰 (자동 갱신 래퍼 googleFetch)
    gcal.ts                  # 구글 캘린더 → 로컬 이벤트 동기화
    gtasks.ts                # 구글 Tasks API (생성/완료/삭제/목록)
    task-sync.ts             # 구글 Tasks → 앱 역방향 전역 reconcile
    storage.ts               # AsyncStorage JSON 래퍼
    settings.ts, date.ts, navigation.ts, widget-*.ts
  widgets/                   # 홈 화면 위젯 (Today, TodayBig)
  constants/theme.ts, theme-context.tsx   # 테마/다크모드
modules/expo-screen-pin/     # 로컬 네이티브 모듈 (Kotlin startLockTask/stopLockTask)
supabase/functions/google-token/   # Edge Function (구글 토큰 자동 갱신)
```

### AsyncStorage 키 스킴
| 키 | 내용 |
|---|---|
| `tasks:YYYY-MM-DD` | 그 날짜 할일 배열 |
| `events:YYYY-MM-DD` | 그 날짜 일정 배열 |
| `memo:YYYY-MM-DD` | 그 날짜 메모 |
| `dday:list` | D-day 목록 |
| `stats:YYYY-MM-DD` | 집중 통계 (focusSeconds, focusSessions, breakOverrunSeconds) |
| `pomodoro:settings` | 집중/휴식 분 설정 |
| `pomodoro:sessions:YYYY-MM-DD` | 그날 완료 세션 수 |
| `settings:darkMode / notifyMode / autoSyncCalendar / timetableRange ...` | 설정값 |

> ⚠️ 전부 **로컬 저장**이라 앱을 완전 삭제하면 다 날아감 (백업 기능 없음 — 앞으로 할 일 참고).

---

## 3. 디자인 시스템

- **다크모드**: 전 화면 지원. 패턴은 아래 고정:
  ```ts
  const makeStyles = (theme: AppTheme) => StyleSheet.create({ ... });
  // 컴포넌트 안에서:
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  ```
  색상 맵이 theme에 의존하면 모듈 상수로 두지 말고 `(theme) => ({...})` 함수로.
- **테마 토큰**: `src/constants/theme.ts` (accent, red, bg, card, text 등). 하드코딩 색 금지, theme 토큰 사용.
- **스플래시/포인트 컬러**: `#208AEF` (파랑)
- 통계 화면은 현재 **MVP 수준** — 디자인 다듬기는 TODO (유저가 레퍼런스 줄 예정).

---

## 4. 구현된 기능 (상세)

### 4-1. 하루 화면 (index.tsx)
- 할일(우선순위 high/mid/low), 일정(시간블록), 메모, D-day 요약
- 날짜 좌우 이동, "오늘로"
- **당겨서 새로고침(pull-to-refresh)**: 구글 캘린더 + Tasks 다시 당겨옴
- 월간 탭에서 특정 날짜 열면 그 날짜로 점프 (navigation.ts의 pending view date)

### 4-2. Time Timer 뽀모도로 (timer.tsx + pomodoro.ts)
- **Time Timer 다이얼**(time-timer-dial.tsx): SVG 원 + 빨간 파이로 남은 시간 표시. idle+집중 단계일 때 **드래그로 분 설정** (PanResponder).
- 상태머신: `idle | running | paused | overrun`, 단계 `focus | break`. 모듈 스코프 상태 + `useSyncExternalStore`로 탭 전환에도 유지.
- 집중/휴식 분은 1분 단위 스테퍼로 조절.
- **화면 고정(focus mode)**: 집중 중 "화면 잠금" 버튼 → screen pinning(네이티브 startLockTask) + 네비바 숨김. 집중 중 BackHandler 차단.

### 4-3. 휴식 초과 추적 (pomodoro.ts + stats.ts + notify.ts)
- 휴식 타이머가 0이 되면 → `overrun` 상태 진입. **1분 유예** 후부터 초과 시간 카운트.
- 복귀가 늦으면 **잔소리 OS 알림**이 시간대별로 뜸 (버튼 아니라 자동):
  - +1분(유예끝) / +10분 "적당히 하고 다시 하자" / +30분 "집중 좀 하자" / +60분 "공부 안 함…?" / +90·120·150·180분 "공부 포기했지? 걍 하지 마라" 류
- 알림은 **미래 시점 예약 방식**(`scheduleNotificationAsync` TIME_INTERVAL)이라 앱이 백그라운드여도 뜸. 복귀/리셋 시 남은 예약 취소.
- **알람 전용 채널**(`overrun-alarm`): importance MAX, bypassDnd, 알람 음량/강한 진동 → heads-up 배너로 뜸.
  > ⚠️ 안드로이드는 채널을 한번 만들면 importance를 코드로 못 바꿈. 채널 설정 바꾸면 **앱 완전 삭제 후 재설치**해야 반영됨.

### 4-4. 통계 (stats.tsx + stats.ts)
- 월별: 집중 시간, 할일 완료율, 휴식 초과(빨강), 기록한 날. **완주한 세션만** 집계.
- 월간 화면 → 통계 버튼으로 진입.

### 4-5. 월간 (monthly.tsx)
- 2탭 방식: 1탭 = 날짜 선택 + 미리보기 카드(일정 N·할일 N), 2탭(같은 날 다시) = 그 날짜 열기.

### 4-6. 구글 연동
- **로그인**(auth.ts): Supabase OAuth(Google, PKCE, 인앱 브라우저). 스코프 `calendar.readonly` + `tasks`. `access_type=offline, prompt=consent`로 refresh token 확보.
- **캘린더 동기화**(gcal.ts): 그 날짜 구글 캘린더 '시간 일정' → 로컬 이벤트. 손으로 넣은 일정은 보존, `gcal-` 접두사만 교체.
- **Tasks 양방향**(gtasks.ts + task-sync.ts):
  - 앱→구글: 추가/완료/삭제 즉시 push. notes에 `[[planner:<localId>]]` 마커 심음.
  - 구글→앱: 로그인 세션당 1회 **전역 reconcile** (`runReverseSync`). 모든 Tasks 목록 순회, 완료/삭제/날짜이동 반영, due 있는 새 할일은 그 날짜에 편입. (v1 로직 포팅)
  - 정책: **due(마감일) 없는 구글 할일은 편입 안 함** (어느 날짜인지 못 정해서). 실시간 아님 — 재실행/pull 시 반영.
- **자동 토큰 갱신**(google-auth.ts + Edge Function): provider_token은 ~1시간 만료. `googleFetch`가 401 뜨면 Edge Function `google-token`을 호출해 저장된 refresh token으로 새 토큰 발급 후 재시도. Edge Function 미배포면 기존처럼 graceful degrade.

### 4-7. 알림 (notify.ts)
- 채널 2종: `reminder`(일반, MAX) / `overrun-alarm`(휴식초과 알람, MAX+bypassDnd).
- 뽀모도로 단계 종료, 저녁 회고(매일 21:00 기본), 휴식 초과 잔소리.

### 4-8. 홈 위젯 (widgets/)
- `Today`(2x2), `TodayBig`(4x4): 오늘 남은 할일/다음 일정. 30분 주기 갱신. 할일 저장 시 즉시 동기화.

---

## 5. 백엔드 (Supabase)

- **프로젝트 ref**: `zzgrmknfoyqlenxntylq`
- **클라이언트 키**: publishable(anon) 키는 `src/lib/supabase.ts`에 하드코딩 (공개용, RLS로 보호).
- **테이블 `google_tokens`**: `user_id`(PK) · `refresh_token` · `updated_at`. RLS: 본인만 insert/update, select 정책 없음(클라는 못 읽음, Edge Function의 service_role만 접근). 스키마는 `supabase/functions/google-token/schema.sql`.
- **Edge Function `google-token`**: 호출 유저의 refresh token으로 구글 oauth2 token endpoint 호출 → access_token 반환.
  - 배포: `npx supabase functions deploy google-token`
  - 시크릿: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (`supabase secrets set ...`). `SUPABASE_URL/ANON/SERVICE_ROLE_KEY`는 자동 주입.
  - ✅ 배포·시크릿 설정 완료. **빌드 후 재로그인해야** refresh token이 저장돼 자동 갱신 활성화.

---

## 6. 코딩 컨벤션 / 주의사항

- **화면(app/)과 로직(lib/) 분리.** 저장·동기화·상태는 lib에, 화면은 그걸 호출만.
- 모든 파일 직접 편집은 노트북 레포(`C:\snowjun\daily-planner-app`)에서. 빌드는 유저가 직접.
- **다크모드 패턴**(3장) 반드시 지킬 것.
- expo install이 특정 환경에서 막히면 `npm install`로 대체 (단 Expo SDK 57 버전 맞출 것, 예: `expo-navigation-bar@~57.0.0`).
- SDK 57 edge-to-edge에서 `NavigationBar.setBehaviorAsync` 제거됨 — `setVisibilityAsync`만 사용.
- 새 라우트 추가 시 typedRoutes 타입 미생성이면 `router.push('/x' as never)` 임시 캐스팅.
- Edge Function(Deno)은 `tsconfig.json`의 `exclude`에 `supabase` 들어가 있어 앱 tsc에서 제외됨.

---

## 7. 앞으로 할 일 (우선순위順)

1. **디자인 전면 정돈** — 기능은 대부분 구현됨. Figma로 전 화면 디자인을 받아 비주얼을 개선하는 단계 (진행 예정). 통계 등 MVP 화면 포함.
2. **온보딩 / 로그인 화면 / 앱 아이콘 / 스플래시** — 아직 없음. 첫 실행 경험. (디자인 후 구현)
3. **빈 상태(Empty state) 화면** — 할일/일정/D-day가 없을 때 안내 UI.
4. **진짜 오버레이 창(휴식 초과)** — "다른 앱 위에 표시"(SYSTEM_ALERT_WINDOW) 권한 + 네이티브 오버레이. heads-up 알림보다 강하게 화면 위에 뜨는 방식.
5. **일정(캘린더) 양방향** — 현재 캘린더는 읽기 전용(`calendar.readonly`). 앱→구글 캘린더 쓰기를 추가하려면 쓰기 권한 + 구현 필요. (할일 Tasks는 이미 양방향)
6. **출시 준비** — 스토어 등록(Play Console), 버전 관리, 개인정보 처리방침.

---

## 8. 검증 현황 (2026-11-12 기준)

- ✅ 다크모드 전 화면 / 설정 실작동 / 홈 위젯 / D-day
- ✅ 구글 로그인 / 캘린더 동기화(읽기 전용) / 화면 고정(screen pinning)
- ✅ Time Timer 드래그 (실행 중에도 시간 조절) / 통계 / 월간 2탭
- ✅ 구글 Tasks 양방향(완전판 reconcile) + 실시간 역동기화(앱 포그라운드 복귀 시)
- ✅ 전체 할일 화면 (미완료/완료/전체 필터, 날짜별 그룹)
- ✅ 휴식 초과 heads-up 알림 (알람 채널 MAX, bypassDnd)
- ✅ 데이터 백업/복원 (Supabase `user_backups`, 변경 시 자동 + 설정에서 수동)
- ⏳ 구글 자동 토큰 갱신 — 앱 직접 저장이 RLS 타이밍에 막혀 **Edge Function(service_role) 경유 저장**으로 전환. 재로그인 실사용 검증 중.
  - 주의: `google_tokens` / `user_backups` 테이블에 `authenticated` 역할 grant 필요 (SQL Editor로 만든 테이블은 자동 안 붙음)
