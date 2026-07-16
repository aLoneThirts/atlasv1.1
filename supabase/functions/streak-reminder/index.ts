// ============================================================
// ATLAS — streak-reminder Edge Function
// Her gün cron ile koşar (Dashboard > Edge Functions > Schedules,
// önerilen cron: "0 17 * * *" — 17:00 UTC = 20:00 Europe/Istanbul).
//
// weekly-exam/index.ts'teki sendPush() deseni birebir taşındı. Farkı:
// weekly-exam yalnız premium kullanıcıları hedefler, bu fonksiyon TÜM
// kullanıcıları hedefler (herkes seri kaybedebilir, premium'a özel değil).
//
// Akış:
//   1. expo_push_token'ı dolu tüm kullanıcıları çek
//   2. Bugün (Europe/Istanbul) hiç xp_events satırı yoksa hatırlatma at
//   3. Aynı gün için tekrar göndermemek üzere notifications tablosunda
//      bugüne ait aynı başlıklı bir satır var mı diye bak (idempotent —
//      cron iki kez koşarsa bildirim tekrarlanmaz)
//   4. Expo Push API'ye gönder + notifications'a satır ekle (gelen kutusu)
//
// Deploy: npx supabase functions deploy streak-reminder
// Güvenlik: CRON_SECRET secret'ı tanımlıysa istekte x-cron-secret
// başlığı eşleşmek zorunda (elle tetiklemeye karşı).
//
// BİLİNEN KISIT: app.json'da extra.eas.projectId henüz tanımlı değil —
// bu olmadan gerçek cihazlarda expo_push_token hiç alınmıyor
// (bkz. src/lib/push-notifications.ts). Yani bu fonksiyon deploy edilse
// bile `eas init` ile proje bağlanana kadar hiçbir push ulaşmaz.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const REMINDER_TITLE = '🔥 Serini Kaybetme!';

/** Europe/Istanbul (UTC+3, sabit) gününün başlangıcı, UTC ISO string */
function istanbulDayStartIso(): string {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  tr.setUTCHours(0, 0, 0, 0);
  return new Date(tr.getTime() - 3 * 60 * 60 * 1000).toISOString();
}

async function sendPush(messages: object[]) {
  // Expo Push API tek istekte en fazla 100 mesaj kabul eder
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      console.error('Expo push hatası:', res.status, await res.text());
    }
  }
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
  }

  // Toplu okuma/yazma service_role ile — bu anahtar yalnız function env'inde yaşar
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const dayStart = istanbulDayStartIso();

  const { data: users, error: usersErr } = await supabase
    .from('profiles')
    .select('id, expo_push_token')
    .not('expo_push_token', 'is', null);
  if (usersErr) {
    return new Response(JSON.stringify({ error: usersErr.message }), { status: 500 });
  }

  let reminded = 0, studiedAlready = 0, alreadyNotifiedToday = 0;
  const pushes: object[] = [];
  const notificationRows: { user_id: string; title: string; body: string; route: string }[] = [];
  const body = 'Bugün henüz soru çözmedin — seriyi bozma, gel biraz çalış! 💪';

  for (const user of users ?? []) {
    const { count: xpCount, error: xpErr } = await supabase
      .from('xp_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', dayStart);
    if (xpErr) {
      console.error(`xp_events sorgusu (${user.id}):`, xpErr.message);
      continue;
    }
    if ((xpCount ?? 0) > 0) {
      studiedAlready++;
      continue;
    }

    // idempotent kurulum: bugün için bu kullanıcıya zaten hatırlatma gittiyse tekrar gönderme
    const { data: existing, error: existingErr } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('title', REMINDER_TITLE)
      .gte('created_at', dayStart)
      .maybeSingle();
    if (existingErr) {
      console.error(`notifications kontrolü (${user.id}):`, existingErr.message);
      continue;
    }
    if (existing) {
      alreadyNotifiedToday++;
      continue;
    }

    pushes.push({ to: user.expo_push_token, title: REMINDER_TITLE, body, data: { route: '/' } });
    notificationRows.push({ user_id: user.id, title: REMINDER_TITLE, body, route: '/' });
    reminded++;
  }

  await sendPush(pushes);
  if (notificationRows.length > 0) {
    const { error: insertErr } = await supabase.from('notifications').insert(notificationRows);
    if (insertErr) console.error('notifications insert:', insertErr.message);
  }

  return new Response(
    JSON.stringify({ reminded, studiedAlready, alreadyNotifiedToday }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
