// ============================================================
// ATLAS — expire-premium Edge Function (BACKEND.md §4.9, §6.6)
// Günlük cron ile koşar (Dashboard > Edge Functions > Schedules,
// önerilen cron: "0 3 * * *" — her gece 03:00 UTC ≈ 06:00 TR).
//
// iyzico-pay tek seferlik ödemeyle premium'u belli bir süre için açar
// (profiles.premium_expires_at). Süresi dolanları burada kapatıyoruz —
// ayrı bir webhook/subscription-renewal akışı yok (v1 kapsamı, BACKEND.md
// §4.9 notu).
//
// Deploy: npx supabase functions deploy expire-premium
// Güvenlik: CRON_SECRET secret'ı tanımlıysa istekte x-cron-secret
// başlığı eşleşmek zorunda (elle tetiklemeye karşı) — weekly-exam ile aynı desen.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase
    .from('profiles')
    .update({ is_premium: false })
    .eq('is_premium', true)
    .lt('premium_expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ expired: data?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
