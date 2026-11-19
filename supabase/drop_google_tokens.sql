-- 구글 연동(캘린더·Tasks) 제거에 따른 정리: 저장해 두던 구글 refresh token 삭제
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 1회 실행.
-- 앱은 더 이상 토큰을 저장하지 않는다 (로그인·백업은 영향 없음).
-- 함께 할 일: 대시보드 → Edge Functions 에서 'google-token' 함수 삭제
--            (또는 CLI: supabase functions delete google-token)
--            시크릿 GOOGLE_CLIENT_SECRET 도 더 이상 필요 없음.
drop table if exists public.google_tokens;
