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

-- authenticated 역할에 테이블 접근 권한 부여 (RLS 정책은 그 위에서 행 단위로 제한).
-- SQL Editor로 만든 테이블은 이 grant가 자동으로 안 붙는 경우가 있어 명시한다.
grant select, insert, update, delete on public.google_tokens to authenticated;

-- Edge Function은 service_role 로 저장/조회하므로 service_role 에도 권한을 명시한다.
-- (SQL Editor로 만든 테이블은 이 grant가 자동으로 안 붙어 permission denied 가 날 수 있다)
grant select, insert, update, delete on public.google_tokens to service_role;
