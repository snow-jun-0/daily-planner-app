// ---------- 구글 Tasks → 앱 역방향 동기화 (전역 reconcile) ----------
// 로그인 세션당 1회 runReverseSync() 호출. 구글 상태를 done/삭제/날짜의 기준으로 삼는다.
// v1(web) reconcileGoogleTasks 로직을 v2(AsyncStorage 날짜별 저장) 구조로 포팅.

import { listAllGTasks, type GTaskFull } from './gtasks';
import { removeItem } from './storage';
import {
  createTask,
  dateKeyFromDue,
  loadAllTaskDays,
  saveTasks,
  type Task,
} from './tasks';

/** notes의 [[planner:<localId>]] 마커에서 로컬 id 추출 (링크 유실 시 2차 매칭용) */
function plannerMarkerId(notes?: string): string | null {
  return notes?.match(/\[\[planner:([a-z0-9-]+)\]\]/i)?.[1] ?? null;
}

/**
 * 구글 Tasks 스냅샷을 로컬에 반영 (구글 → 앱).
 *  - 구글에서 삭제/목록에 없음: 연결된 로컬 할 일 삭제
 *  - 구글 완료 상태: 로컬 done을 구글 기준으로 맞춤
 *  - 구글 due 변경: 로컬 할 일을 새 날짜로 이동
 *  - 구글 신규 미완료 + due 있음: 해당 날짜에 로컬 생성(priority "mid", 마커로 중복방지)
 * @returns 변경이 있었으면 true
 */
export async function runReverseSync(): Promise<boolean> {
  const snaps = await listAllGTasks();
  if (snaps == null) return false; // 미로그인/권한없음/조회실패 → 스킵

  const store = await loadAllTaskDays();
  let changed = false;

  const activeById = new Map<string, GTaskFull>();
  for (const g of snaps) if (!g.deleted) activeById.set(g.id, g);

  const matched = new Set<string>();
  const moves: { task: Task; toKey: string }[] = [];

  // Pass 1: googleTaskId로 연결된 기존 로컬 할 일 갱신/삭제/이동
  for (const key of Object.keys(store)) {
    const kept: Task[] = [];
    for (const t of store[key]) {
      if (!t.googleTaskId) {
        kept.push(t);
        continue;
      }
      const g = activeById.get(t.googleTaskId);
      if (!g) {
        changed = true; // 구글에서 삭제됨 → 로컬도 제거
        continue;
      }
      matched.add(g.id);
      let nt = t;
      if (g.taskListId && t.googleTaskListId !== g.taskListId) {
        nt = { ...nt, googleTaskListId: g.taskListId };
        changed = true;
      }
      const gDone = g.status === 'completed';
      if (gDone !== !!t.done) {
        nt = { ...nt, done: gDone };
        changed = true;
      }
      const gKey = g.due ? dateKeyFromDue(g.due) : null;
      if (gKey && gKey !== key) {
        moves.push({ task: nt, toKey: gKey });
        changed = true;
        continue;
      }
      kept.push(nt);
    }
    store[key] = kept;
  }
  for (const { task, toKey } of moves) {
    store[toKey] = [...(store[toKey] ?? []), task];
  }

  // Pass 2: 아직 연결 안 된 구글 미완료 할 일(due 있음) → 로컬 생성
  for (const g of activeById.values()) {
    if (matched.has(g.id)) continue;
    if (g.status !== 'needsAction') continue; // 완료 히스토리는 편입 안 함
    if (!g.due) continue; // due 없는 항목은 날짜를 못 정하므로 편입 안 함
    const gKey = dateKeyFromDue(g.due);

    // 2차 매칭: 마커의 로컬 id를 가진 미연결 할 일이 있으면 새로 만들지 말고 연결
    const mId = plannerMarkerId(g.notes);
    let linked = false;
    if (mId) {
      for (const key of Object.keys(store)) {
        const idx = store[key].findIndex((t) => t.id === mId && !t.googleTaskId);
        if (idx < 0) continue;
        store[key] = store[key].map((x, i) =>
          i === idx ? { ...x, googleTaskId: g.id, googleTaskListId: g.taskListId, done: false } : x,
        );
        changed = true;
        linked = true;
        break;
      }
    }
    if (linked) continue;

    const base = createTask(g.title || '(제목 없음)', 'mid');
    const nt: Task = { ...base, googleTaskId: g.id, googleTaskListId: g.taskListId };
    store[gKey] = [...(store[gKey] ?? []), nt];
    changed = true;
  }

  if (changed) {
    await Promise.all(
      Object.keys(store).map(async (k) => {
        if (store[k].length === 0) await removeItem(`tasks:${k}`);
        else await saveTasks(k, store[k]);
      }),
    );
  }
  return changed;
}
