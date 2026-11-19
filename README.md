# 데일리 플래너

> 하루를 10분 칸으로 색칠하는 학습 플래너 — 계획을 칠하고, 집중하면 칸이 채워집니다.

<!-- TODO: 스크린샷 (오늘 화면 · 집중 타이머 · 월간 잔디밭 · 통계/배지) -->
| 오늘 | 집중 타이머 | 월간 잔디밭 | 통계 · 배지 |
|:---:|:---:|:---:|:---:|
| _TODO_ | _TODO_ | _TODO_ | _TODO_ |

## 소개

공부 시간을 "몇 시간 했다"가 아니라 **"하루 중 언제, 무엇을 했는지"** 로 보여주는 Android 앱입니다.
하루(06시~익일 02시)를 10분 단위 격자로 나누고, 손가락으로 쓱 드래그해 과목별 계획을 칠합니다.
집중 타이머를 켜면 지금 시각의 칸이 1분 단위로 실시간 차오르고, 실제로 채운 칸만 TOTAL TIME에 쌓입니다.

기록은 기본적으로 기기에만 저장되고, 원하면 구글 로그인으로 클라우드에 백업할 수 있습니다. 광고는 없습니다.

## 핵심 기능

- **격자 타임테이블** — 10분 칸 × 하루 20시간. 드래그로 칠하기/지우기, 계획 칸을 탭하면 바로 집중 시작, 요일별 템플릿
- **집중 타이머** — Time Timer 다이얼 뽀모도로(집중·휴식 시간 조절). 집중 중 '지금 칸'을 1분 블록으로 채우고, 휴식 초과 시 단계별 잔소리 알림. 집중 모드(화면 고정)
- **집중 잔디밭** — 한 달의 일별 집중 시간을 GitHub 잔디처럼 농도로 표시, 칸을 탭하면 그 날로 이동
- **연속 기록 · 배지** — 불꽃 "N일 연속" + 최장 기록, 첫 집중·7일 연속·누적 100시간 등 배지 11종과 획득 축하
- **통계** — 월간 TOTAL TIME·계획 달성률, 과목별 실제/계획, 요일×시간대 히트맵, 주간 공유 카드
- **오늘 일정 · 할 일 · 메모 · D-Day** — 격자 왼쪽 레인에 오늘만의 특별 일정
- **홈 화면 위젯** — 오늘 요약 / 오늘 전체 (Android)
- **클라우드 백업** — 구글 로그인 후 자동 백업·새 기기 자동 복원, 계정 탈퇴 지원
- **Pro 구독** — 고급 통계·공유 카드 스타일·테마 (기본 기능은 무료로 제한 없이)

## 기술 스택

| 영역 | 사용 |
|---|---|
| 앱 | React Native 0.86 · Expo SDK 57 · TypeScript (strict) |
| 라우팅 | Expo Router (파일 기반) |
| 애니메이션 | Reanimated 4 (CSS transition/keyframes) · expo-haptics |
| 그래픽 | react-native-svg (타이머 다이얼, 진행 링) |
| 저장 | AsyncStorage (로컬 우선) |
| 백엔드 | Supabase — Google OAuth(PKCE) 로그인, 백업 테이블(RLS), 계정 삭제 RPC |
| 결제 | RevenueCat (Google Play 구독) |
| 알림 · 위젯 | expo-notifications · react-native-android-widget |
| 네이티브 모듈 | 로컬 Expo 모듈 `modules/expo-screen-pin` (Kotlin, 화면 고정) |
| 빌드 | EAS Build (production AAB / preview APK) |

## 구조

```
src/
  app/            화면 (Expo Router) — (tabs)/ 오늘·월간·메모·타이머·설정
  components/     planner/ 격자·시트·카드 등 UI 컴포넌트
  lib/            도메인 로직 — timetable(격자 기록), pomodoro(타이머), stats, badges, backup, pro …
  constants/      디자인 토큰(라이트/다크 테마)
modules/          로컬 네이티브 모듈 (expo-screen-pin)
supabase/         테이블·함수 SQL
scripts/          검증 스크립트(*.check.mjs), 라이선스 목록 생성
```

## 개발

```bash
npm install
npx expo run:android          # 개발 빌드 설치 + 실행 (네이티브 모듈 포함이라 Expo Go 불가)
npx tsc --noEmit --skipLibCheck
node --experimental-strip-types --no-warnings scripts/streak.check.mjs
node --experimental-strip-types --no-warnings scripts/live-fill.check.mjs
```

환경 변수: `.env.example`을 `.env.local`로 복사해 RevenueCat 공개 SDK 키를 넣습니다. Supabase 설정은 `supabase/*.sql`을 대시보드 SQL Editor에서 실행합니다.

## 만든 사람

<!-- TODO: 이름 · 연락처 · 링크 -->
TODO
