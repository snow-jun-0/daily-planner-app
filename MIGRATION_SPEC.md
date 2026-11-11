# v1 → v2 이식 스펙 (Phase 1~3)

> v1 웹앱(github.com/snow-jun-0/daily-planner, Vite+React+TS)의 검증된 로직을
> v2(React Native / Expo)로 옮기기 위한 상세 스펙. 색/디자인은 v2의 흑백(B&W)
> 톤을 유지하고, v1의 **로직·데이터 모델·UX 흐름만** 가져온다.
> v1 색(종이+초록)은 그대로 쓰지 않는다.

## 공통 변환 규칙 (웹 API → RN)

| v1 (웹)                         | v2 (RN/Expo)                                    |
|--------------------------------|-------------------------------------------------|
| `localStorage`                 | `AsyncStorage` (이미 `src/lib/storage.ts` 래퍼) |
| `Notification` (Web)           | `expo-notifications`                            |
| `navigator.vibrate(pattern)`   | `Vibration.vibrate(pattern)` (react-native) 또는 `expo-haptics` |
| `document.documentElement.classList.toggle("dark")` | React Context (ThemeProvider) |
| Web Audio `playBeep()`         | `expo-notifications` 사운드 또는 `expo-av` 짧은 사운드 |
| CSS 변수 `var(--paper)`        | 테마 토큰 객체 (`useTheme()`)                   |

AsyncStorage 키 접두사(현재): `tasks:`, `events:`, `memo:`, `pomodoro:`. 신규로 `dday:list`, `settings:*` 추가.

---

## Phase 1 — 설정 실작동 + 다크모드

### 1-1. 설정 저장 레이어 — `src/lib/settings.ts` (신규)
v1 lib.ts의 설정 함수들을 AsyncStorage 버전으로:
- `NotifyMode = 'mute' | 'vibrate' | 'sound'` (기본 'sound')
  - `getNotifyMode()` / `setNotifyMode(mode)`  (key: `settings:notifyMode`)
- 저녁 회고 알림 on/off: `getNotifyDaily()` / `setNotifyDaily(bool)` (key: `settings:notifyDaily`, 기본 false)
  - 중복발송 방지: `wasDailyFiredToday(todayKey)` / `markDailyFired(todayKey)` (key: `settings:notifyDailyLast`)
- 시간표 범위(시 단위): `getTimetableRange()` → `{startHour, endHour}` (기본 6~24), `setTimetableRange(...)` (key: `settings:timetableRange`)
  - 일간/월간 타임라인이 이 값을 참조하도록 연결.
- 다크모드: `getDarkMode()` / `setDarkMode(bool)` (key: `settings:darkMode`, 기본: 시스템 `useColorScheme`)

### 1-2. 데이터 초기화 (settings.tsx "데이터 초기화" 실작동)
v1 `resetAllData()` = `daily-planner` 접두사 키 전부 삭제. RN 버전:
```ts
export async function resetAllData() {
  const keys = await AsyncStorage.getAllKeys();
  const mine = keys.filter(k =>
    k.startsWith('tasks:') || k.startsWith('events:') ||
    k.startsWith('memo:') || k.startsWith('pomodoro:') ||
    k.startsWith('dday') || k.startsWith('settings:'));
  await AsyncStorage.multiRemove(mine);
}
```
- 확인 다이얼로그 후 실행 (RN `Alert.alert` 또는 기존 PlannerCard 스타일 모달). 삭제 후 화면 리로드 + 위젯 갱신(`syncWidgets()`).

### 1-3. 다크모드 (전 화면) ★ 가장 큰 작업
`src/constants/theme.ts`의 `Planner` 토큰을 **light / dark 2벌**로 만들고 Context로 공급.

**팔레트 (B&W 유지 — v1 녹색 아님):**
```
            light        dark
paper       #FAFAFA      #121212
card        #FFFFFF      #1E1E1E
ink         #111111      #F0F0F0
faint       #9B9B9B      #8A8A8A
line        #EAEAEA      #2E2E2E
accent      #111111      #F0F0F0   (다크에선 밝은색이 accent)
accentSoft  #F0F0F0      #2A2A2A
onAccent    #FFFFFF      #111111
highlightSoft #FBF0C7    #3A3410
--- 일정 블록 색 (의미색, 다크에서 약간 밝게) ---
green       #2F6B4F      #4A9370
sage        #9DB8A4      #6F8C7A
highlight   #F5D547      #E7C24A
red         #C0392B      #E0695C
blue        #2C5AA0      #6FA3D6
```

**구현:**
- `ThemeProvider` + `useTheme(): ThemeTokens` 훅 (`src/constants/theme-context.tsx` 신규)
- `app/_layout.tsx`(루트)에서 `<ThemeProvider>`로 감싸기. 초기값 = `getDarkMode()` (없으면 `useColorScheme()`).
- **18개 파일**에서 `import { Planner }` 직접참조 → `const P = useTheme()`로 교체.
  대상: app/(tabs)/{index,memo,monthly,settings,timer,_layout}, components/planner/*, components/placeholder-screen
  - `StyleSheet.create`는 정적이라 색을 못 바꿈 → 색이 들어가는 스타일은 `useMemo(() => makeStyles(P), [P])` 패턴 또는 인라인 style로.
- settings.tsx 다크모드 Switch → `setDarkMode` + Context 토글 연결.
- 위젯(today-widget/today-big-widget)도 다크 대응(선택): 시스템 다크일 때 card 배경/글자색 반전.

### 1-4. 가짜 "연결됨" 뱃지 정리
settings.tsx 구글 캘린더 행의 "연결됨" 뱃지 → 실제 연동 전까지 "연결 안 됨"(회색)으로. (Phase 5에서 실연동)

### 1-5. 알림방식 세그먼트 연결
settings.tsx의 무음/진동/소리 세그먼트 → `getNotifyMode`/`setNotifyMode` 실연결.

---

## Phase 2 — 알림 / 알람 / 진동 / 화면깨우기

### 패키지 설치
`npx expo install expo-notifications expo-haptics expo-keep-awake`
app.json plugins에 `expo-notifications` 추가 (아이콘/색 옵션).

### 2-1. 알림 유틸 — `src/lib/notify.ts` (신규)
v1 pomodoro.ts의 알림 로직 RN 변환:
- `requestNotifyPermission()` → `Notifications.requestPermissionsAsync()`
- `firePhaseEndNotification(title, body)` → `Notifications.scheduleNotificationAsync({ content, trigger: null })` (즉시)
- `startPhaseEndAlarm(): () => void` — v1 `startPhaseEndAlarm` 포팅. 호출 시점 `getNotifyMode()` 캡처:
  - `sound`: 종료 알림(소리) + `setInterval`로 반복 피드백(1.3s). 정리 함수에서 `clearInterval`.
  - `vibrate`: `Vibration.vibrate([500,250,500], true)` 반복. 정리 시 `Vibration.cancel()`.
  - `mute`: no-op.
  - 반드시 정리 함수 반환 (확인/모달 닫힘 시 호출).
- 저녁 회고 알림: `getNotifyDaily()` on → `Notifications.scheduleNotificationAsync({ trigger: { hour: 21, minute: 0, repeats: true } })`, off → 해당 알림 취소.

### 2-2. 포모도로 연결 — `src/lib/pomodoro.ts`
- `completePhase()` (현 152줄)에서 `firePhaseEndNotification` + `startPhaseEndAlarm()` 호출.
- v1처럼 "확인 대기(awaiting)" 흐름을 둘지, 바로 다음 phase로 갈지 선택 — 최소안: 종료 시 알림 1회 + 진동/소리, 사용자가 타이머 화면 보면 정리.
- 타이머 화면(app/(tabs)/timer.tsx): `status === 'running'`일 때 `useKeepAwake()` (expo-keep-awake)로 화면 안 꺼지게.

---

## Phase 3 — D-Day

### 3-1. 데이터 레이어 — `src/lib/dday.ts` (신규)
v1 lib.ts D-Day 로직 그대로:
```ts
export type DDay = { id: string; title: string; date: string /* YYYY-MM-DD */; color: string };
export const DDAY_COLORS = ['#E8724C','#F5B94A','#7EC08A','#7FB5D9','#B98AD4'];
// AsyncStorage key: 'dday:list'
loadDDays() / saveDDays(list) / addDDay(d) / removeDDay(id)
getDDayCount(dateStr): 'D-DAY' | 'D-{n}' | 'D+{n}'
isDDayPast(dateStr), loadVisibleDDays()  // 지난 것 제외
isDDaySoon(dateStr)  // D-7 이내 → 강조색
```
계산식: `diffDays = round((target - today) / 86400000)`; 0 → "D-DAY", >0 → "D-n", <0 → "D+n".

### 3-2. UI
- D-Day 추가 UI: 제목 input + 날짜 선택(RN DateTimePicker 또는 간단 피커) + 색상 선택(DDAY_COLORS 점).
- D-Day 목록: 설정 화면 내 섹션 또는 전용 영역. 각 행에 "D-7 · 기말고사" + 색점 + 삭제.
- **오늘 화면(index.tsx) 상단**: 가장 가까운 D-Day를 `loadVisibleDDays()[0]`로 "D-7 기말고사" 칩 표시.

### 3-3. (보너스) D-Day 위젯
app.json에 세 번째 위젯 등록 + `src/widgets/dday-widget.tsx` + task-handler 매핑. 가장 가까운 D-Day의 D-N 크게 표시.

---

## 보너스 — 시간 입력 UX (v1과 다른 점, 준영이 지적)
v1 `TimeBlockFormModal`: 일정 추가 = **분 단위 select + 색상 + start 변경 시 end 자동조정**.
- `MINUTE_OPTIONS`(10분 간격), `minutesToLabel(min)` → "09:00"
- start 바꾸면 `end <= start`일 때 `end = start + 10`
- end 옵션은 start보다 큰 것만
- 색상: `BLOCK_COLORS` (노랑/초록/파랑/분홍/보라/주황)
v2 일정 추가 UI를 이 방식에 맞추면 "기존이랑 다른" 느낌 해소. (Phase 1~3 외 별도)
