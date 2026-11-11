import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zzgrmknfoyqlenxntylq.supabase.co';
// publishable(=예전 anon) 키 — 공개용이라 클라이언트에 넣어도 안전. RLS로 데이터 보호.
const SUPABASE_ANON_KEY = 'sb_publishable_7q3-EV-m7s-Coah5XaO2GA_-Pj_ErJx';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
