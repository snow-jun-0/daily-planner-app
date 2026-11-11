import { getGoogleToken, googleFetch } from './google-auth';

const API = 'https://tasks.googleapis.com/tasks/v1';
export const DEFAULT_TASKLIST = '@default';

/** 역동기화용 구글 Task 스냅샷 (완료/삭제 상태 포함) */
export type GTaskFull = {
  id: string;
  taskListId: string;
  title: string;
  status: 'needsAction' | 'completed';
  due?: string;
  deleted?: boolean;
  notes?: string;
};

/**
 * 할 일 생성 (앱 → 구글). notes에 [[planner:<localId>]] 마커를 남겨
 * 역동기화 시 링크가 유실돼도 2차 매칭으로 중복 생성을 막는다.
 * 반환: 생성된 구글 task id + 목록 id (실패 시 null)
 */
export async function insertGTask(
  title: string,
  dueDateKey?: string,
  plannerId?: string,
): Promise<{ id: string; taskListId: string } | null> {
  const body: { title: string; due?: string; notes?: string } = { title };
  if (dueDateKey) body.due = `${dueDateKey}T00:00:00.000Z`;
  if (plannerId) body.notes = `[[planner:${plannerId}]]`;
  try {
    const res = await googleFetch(`${API}/lists/${DEFAULT_TASKLIST}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res || !res.ok) return null;
    const json = (await res.json()) as { id?: string };
    return json.id ? { id: json.id, taskListId: DEFAULT_TASKLIST } : null;
  } catch {
    return null;
  }
}

/** 완료 상태 변경 (앱 → 구글). 미완료로 되돌릴 땐 completed 날짜도 비운다. */
export async function setGTaskStatus(
  taskListId: string,
  taskId: string,
  done: boolean,
): Promise<void> {
  const body = done ? { status: 'completed' } : { status: 'needsAction', completed: null };
  try {
    await googleFetch(
      `${API}/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  } catch {
    // best-effort
  }
}

/** 삭제 (앱 → 구글) */
export async function deleteGTask(taskListId: string, taskId: string): Promise<void> {
  try {
    await googleFetch(
      `${API}/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
      { method: 'DELETE' },
    );
  } catch {
    // best-effort
  }
}

type RawTask = {
  id: string;
  title?: string;
  status?: string;
  due?: string;
  deleted?: boolean;
  notes?: string;
};

/**
 * 모든 Tasks 목록의 전체 할 일(완료·숨김·삭제 포함)을 역동기화용으로 가져온다.
 * 미로그인/권한없음/목록 조회 실패면 null → 역동기화를 통째로 스킵하라는 신호
 * (빈 배열로 오해해 로컬을 지우는 사고 방지). 정상 응답이면 0개여도 배열을 반환.
 */
export async function listAllGTasks(): Promise<GTaskFull[] | null> {
  if (!(await getGoogleToken())) return null;
  let lists: { id: string }[];
  try {
    const res = await googleFetch(`${API}/users/@me/lists?maxResults=100`);
    if (!res || !res.ok) return null;
    const json = (await res.json()) as { items?: { id: string }[] };
    lists = json.items ?? [];
  } catch {
    return null;
  }
  const params = 'showCompleted=true&showHidden=true&showDeleted=true&maxResults=100';
  const perList = await Promise.all(
    lists.map(async (l) => {
      try {
        const res = await googleFetch(`${API}/lists/${encodeURIComponent(l.id)}/tasks?${params}`);
        if (!res || !res.ok) return [] as GTaskFull[];
        const json = (await res.json()) as { items?: RawTask[] };
        return (json.items ?? []).map(
          (t): GTaskFull => ({
            id: t.id,
            taskListId: l.id,
            title: t.title ?? '(제목 없음)',
            status: t.status === 'completed' ? 'completed' : 'needsAction',
            due: t.due,
            deleted: !!t.deleted,
            notes: t.notes,
          }),
        );
      } catch {
        return [] as GTaskFull[];
      }
    }),
  );
  return perList.flat();
}
