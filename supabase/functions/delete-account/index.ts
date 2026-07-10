// ============================================================
// ATLAS — delete-account Edge Function
// App Store Guideline 5.1.1(v) + KVKK "unutulma hakkı": kullanıcı hesabını
// uygulama içinden kalıcı olarak silebilmeli. Client'ta anon key ile
// auth.users satırı silinemez (admin API gerekir) — bu function proxy'dir.
//
// Input : (gövde yok, sadece Authorization: Bearer <user JWT>)
// Output: { ok: true } | { ok: false, error }
//
// Akış:
//   1. JWT → kullanıcı (auth.uid())
//   2. service_role ile auth.admin.deleteUser(userId)
//      → auth.users satırı silinir → profiles (FK: id references auth.users
//        on delete cascade) ve ona bağlı tüm kullanıcı verisi (quiz_attempts,
//        mistakes, xp_events, coach_messages, mock_exams, weekly_exams,
//        payments, topic_progress — hepsi "on delete cascade") otomatik gider.
//
// Deploy: npx supabase functions deploy delete-account
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authed = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: auth } = await authed.auth.getUser();
  if (!auth?.user) return json({ error: 'auth_required' }, 401);

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error } = await service.auth.admin.deleteUser(auth.user.id);
  if (error) {
    console.error('delete-account hatası:', error);
    return json({ ok: false, error: 'delete_failed' }, 500);
  }

  return json({ ok: true });
});
