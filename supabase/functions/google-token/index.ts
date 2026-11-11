// Supabase Edge Function: google-token
// 저장된 refresh token으로 구글 access token을 재발급해 반환한다.
// 배포:  supabase functions deploy google-token
// 시크릿: supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
//        (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY 는 자동 주입)

import { createClient } from 'jsr:@supabase/supabase-js@2';

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'no_auth' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1) 호출한 유저 확인 (요청에 담긴 JWT로)
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  // 2) refresh token 조회 (service role — RLS 우회)
  const admin = createClient(url, serviceKey);
  const { data: row } = await admin
    .from('google_tokens')
    .select('refresh_token')
    .eq('user_id', user.id)
    .single();
  if (!row?.refresh_token) return json({ error: 'no_refresh_token' }, 404);

  // 3) 구글에서 access token 재발급
  const form = new URLSearchParams({
    client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
    client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
    refresh_token: row.refresh_token,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (!res.ok) return json({ error: 'google_refresh_failed', detail: await res.text() }, 502);

  const tok = (await res.json()) as { access_token?: string; expires_in?: number };
  return json({ access_token: tok.access_token, expires_in: tok.expires_in });
});
