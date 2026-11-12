-- user_backups: 유저별 앱 데이터(할일/일정/메모/D-day/통계/설정) 클라우드 백업
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행.
create table if not exists public.user_backups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table public.user_backups enable row level security;

-- 본인 백업만 읽고/쓰기
drop policy if exists "own backup select" on public.user_backups;
create policy "own backup select" on public.user_backups
  for select using (auth.uid() = user_id);
drop policy if exists "own backup insert" on public.user_backups;
create policy "own backup insert" on public.user_backups
  for insert with check (auth.uid() = user_id);
drop policy if exists "own backup update" on public.user_backups;
create policy "own backup update" on public.user_backups
  for update using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_backups to authenticated;
