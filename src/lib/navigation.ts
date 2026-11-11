/**
 * Tiny module-scoped handoff for cross-tab navigation — same pattern as
 * `pomodoro.ts`'s runtime store. The 월간 tab writes the date the user
 * tapped; the 오늘 tab reads (and clears) it on focus via `useFocusEffect`.
 * Simpler than threading router params through a persistent tab navigator.
 */
let pendingViewDate: string | null = null;

export function requestViewDate(dateKey: string): void {
  pendingViewDate = dateKey;
}

export function consumePendingViewDate(): string | null {
  const date = pendingViewDate;
  pendingViewDate = null;
  return date;
}
