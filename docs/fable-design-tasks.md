# fable 디자인 → 코드 반영 작업 지시서 (Claude Code용)

> 이 문서는 fable이 Figma에 그린 UI 디자인을 앱 코드에 반영하기 위한 작업 목록이다.
> 격자 타임테이블 "본체"는 이미 구현되어 있다(아래 참고). 남은 작업을 순서대로 진행한다.

## 0. 프로젝트 컨텍스트
- React Native 0.86 / Expo SDK 57 / expo-router(typedRoutes) / TypeScript strict
- **피벗**: 모트모트식 격자 타임테이블이 앱의 핵심. 06:00~익일02:00, 세로 20행 × 가로 6칸(=10분).
- 데이터 모델: `src/lib/timetable.ts` (완성) — `DayTimetable{cells, events, overflowMin}`, `Category{id,name,color}`, `Cell{planned?,actual?}`, 집계 함수(`totalActualMin`,`achievementRate`,`actualByCategory` 등), `dateToCellIndex`, `timetableDateKey`.
- **이미 완성**: `src/components/planner/timetable-grid.tsx` — 격자 렌더 + 드래그로 "계획(planned)" 색칠 + 과목 필터칩 + 과목 추가 모달 + 지우개 + TOTAL 요약 + 현재시각 라인. 오늘 화면 `src/app/(tabs)/index.tsx`에 `<TimetableGrid>`로 연결됨(기존 ScheduleCard 대체).
- 디자인 토큰: `src/constants/theme.ts` — `Planner`/`PlannerDark`(AppTheme), `PlannerType`(타이포), `PlannerRadius`, `PlannerShadow`, `PlannerSerif`.

## 1. 공통 규칙 (반드시 지킬 것)
- **다크모드 패턴**: 모든 화면/컴포넌트는 `const theme = useTheme();` + `const styles = useMemo(() => makeStyles(theme), [theme]);`, 그리고 `const makeStyles = (theme: AppTheme) => StyleSheet.create({...})`. 색은 전부 `theme.*` 토큰 사용, **하드코딩 금지**.
- 타이포는 `PlannerType.*` 스프레드, 반경은 `PlannerRadius.*`, 그림자는 `PlannerShadow`.
- 작업 묶음마다 `npx tsc --noEmit --skipLibCheck` 통과 확인 후 한글 메시지로 git 커밋.
- Figma 확인: 아래 노드ID로 `get_screenshot`(비주얼) / `get_design_context`(정확한 수치·색). fileKey = `Uq6SeVLrcn5gi5NteEA2Ri`.
  - Figma 스크린샷은 cloud에서 curl이 막히니 `enableBase64Response:true`로 받을 것.

## 2. 작업 1 — 타이머 ↔ 격자 연동 (최우선 ⭐)
> G4 "타이머로 실제 채워지는 중"의 핵심: 집중하면 **현재 시각 칸이 과목색으로 실시간 자동 채워짐(actual)**.
- Figma: G4(42:2515), F2 뽀모도로 집중중(43:1709), F4 블록집중 집중중(43:1941), F1 시간설정(43:1589), G7 계획칸 탭→집중시작 시트(42:3215).
- `src/lib/pomodoro.ts` 확장:
  - state에 `focusSubject: SubjectId`(기본 'focus') 추가.
  - `start()`에 과목 인자 받거나, `setFocusSubject(id)` 추가.
  - `tick()`에서 `status==='running' && phase==='focus'`이면 `dateToCellIndex(new Date())`로 현재 칸을 구해 오늘 `timetable`의 `cells[idx].actual = focusSubject`로 마킹.
    - **저장 효율**: 매 tick 저장 금지. 메모리에 이번 세션이 채운 칸을 모았다가, 칸 경계(10분)가 바뀔 때 + pause/skip/완료 시 `saveTimetable` 1회. 또는 마지막 저장 후 ≥20초일 때만.
    - **동시 쓰기 주의**: `TimetableGrid`도 같은 `timetable:<date>`를 읽고 씀. 타이머가 actual을 쓰고 격자가 planned를 쓰므로, 저장 직전 항상 `loadTimetable`로 최신을 읽어 병합한 뒤 저장(마지막 저장본 덮어쓰기 금지).
  - 격자가 타이머 반영을 보이게: `TimetableGrid`가 화면 포커스/주기적으로 `loadTimetable` 재조회(현재 `dateKey` 변경 때만 로드함 → focus 시 리로드 추가).
- 집중 시작 플로우: `TimetableGrid`의 "바로 집중 시작" 또는 계획 칸 탭 → **G7 과목 선택 시트** → `setFocusSubject` + 타이머 start + 타이머 탭 이동.
- `src/app/(tabs)/timer.tsx`: F1~F4 디자인(빨간 Time Timer 다이얼 유지 + 하단 미니 격자) 반영.

## 3. 작업 2 — 격자 부속 (G 시리즈)
- G8 계획 추가·편집 시트(42:3350): 칸 범위 선택 → 과목/시간 지정.
- **G9 카테고리 관리(54:1341)**: 과목 이름·색 편집, 추가/삭제. 현재는 과목 추가 모달만 있음 → 전체 관리 화면 필요. `saveCategories` 사용.
- G6 일정 레인(42:3094): `DayTimetable.events`(또는 기존 `src/lib/events.ts`)를 격자 왼쪽 레인 라벨로 표시(수업·약속). 접기 가능.
- G10 주간 격자(44:1948): 7일 격자 요약(주간 뷰). [일|주] 토글의 '주'.
- G11 엣지케이스(44:2120), G12 모션스펙(44:2231): 참고용.

## 4. 작업 3 — 나머지 화면 디자인 반영 (D/E/H/I)
각 프레임 스크린샷 확인 후 대응 파일에 반영(다크모드 패턴 유지):
| 디자인 | node | 대상 파일 |
|---|---|---|
| D1 월간 | 29:1283 | src/app/(tabs)/monthly.tsx |
| D2 통계 | 44:2958 | src/app/stats.tsx |
| D3 전체 할 일 | 7:472 | src/app/all-tasks.tsx |
| D4 메모 | 7:542 | src/app/(tabs)/memo.tsx |
| D5 설정 | 29:1791 | src/app/(tabs)/settings.tsx |
| E1 빈상태-할일 | 8:619 | all-tasks 빈상태 |
| E2 빈상태-메모 | 8:676 | memo 빈상태 |
| E3~E5 휴식초과 경고(1·2·3단계) | 9:352 / 9:383 / 9:414 | 휴식초과 경고 모달(src/lib/notify.ts 흐름) |
| E6 알림 설정 | 9:684 | settings 하위 |
| E7 백업·동기화 | 9:764 | settings 하위(backup.ts) |
| E8 복원 확인 다이얼로그 | 9:789 | backup 복원 |
| H1 설정-타임테이블 상세 | 56:1385 | settings 하위 |
| H2 로딩 스켈레톤 | 56:1599 | 공통 로딩 |
| H4 접근성(색+패턴/라벨) | 56:2075 | 격자 접근성 옵션 |
| H5 홈 위젯 3종 | 56:2299 | widget(별도 네이티브) |
| H6 알림 잠금화면 | 56:2411 | notify |
| H7 첫 사용(과목 없음) | 56:2569 | 온보딩/격자 빈상태 |
| H8 첫 과목 만들기 시트 | 56:2650 | 카테고리 추가 |
| I1 목표·연속기록 | 57:1548 | stats/홈 |
| I3 홈 TOTAL 카드(목표·연속) | 57:1626 | 격자 TOTAL 카드 확장 |
| I4 주간 공유 카드 | 57:1902 | 공유 기능 |
| I5 요일 템플릿 | 57:2218 | 계획 템플릿 |
| I7 D-Day 역산 계획 | 57:2422 | dday + 계획 |

## 5. 작업 4 — 온보딩 (C 시리즈, 선택)
C1 스플래시(8:271), C2~C5 온보딩(44:2289/2341/2409/2446), C6 카테고리 고르기(54:1433), C7 시작·구글연동 선택(54:1705).

## 6. 작업 5 — Pro (J 시리즈, 수익화 — 맨 마지막/선택)
J1 소개·가격(58:1656), J2 무료vsPro(58:1775), J3 결제확인(58:1837), J4 결제완료(58:1877), J5 통계잠금(58:2020), J6 테마잠금(58:2206).

## 참고
- K(브랜드 가이드), S(스토어 스크린샷)는 앱 코드 아님 — 마케팅/스토어 자산.
- 다크모드 프레임은 Light와 1:1 대응(섹션만 다름). 토큰이 다크 대응하므로 Light 기준으로 구현하면 됨.
