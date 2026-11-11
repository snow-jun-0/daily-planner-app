-- google_tokens: 유저별 구글 refresh token 저장소
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행.
create table if not exists public.google_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz default now()
);

alter table public.google_tokens enable row level security;

-- 본인 행만 insert / update 가능. select 정책은 없음 → 클라이언트는 refresh_token을
-- 읽을 수 없고, Edge Function의 service_role 로만 접근된다.
drop policy if exists "own insert" on public.google_tokens;
create policy "own insert" on public.google_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "own update" on public.google_tokens;
create policy "own update" on public.google_tokens
  for update using (auth.uid() = user_id);
