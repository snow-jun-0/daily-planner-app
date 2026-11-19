-- delete_my_account: 로그인한 본인 계정 + 클라우드 데이터 삭제 (앱 설정 › 계정 탈퇴)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행.
--
-- security definer 로 auth.users 삭제 권한을 빌리되, 지우는 대상은 auth.uid()(호출한 본인)로 고정한다.
-- user_backups / google_tokens 는 auth.users 에 on delete cascade 로 묶여 있지만,
-- 테이블이 cascade 없이 만들어졌을 경우를 대비해 먼저 명시적으로 지운다.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.user_backups where user_id = uid;
  delete from public.google_tokens where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
