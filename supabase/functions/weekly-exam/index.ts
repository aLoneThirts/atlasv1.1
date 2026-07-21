// ============================================================
// ATLAS — weekly-exam Edge Function (BACKEND.md §6.2)
// Her Pazar cron ile koşar (Dashboard > Edge Functions > Schedules,
// cron: "0 9 * * 0" — 09:00 UTC ≈ 12:00 TR).
//
// Akış (kullanıcı başına):
//   1. expo_push_token'ı dolu premium kullanıcıları çek
//   2. Son 7 günün çözülmemiş yanlışlarından ≤5 soru seç
//      (ders çeşitliliği için subject bazında round-robin)
//   3. weekly_exams upsert — unique(user_id, week_start) → idempotent;
//      cron iki kez koşarsa push da tekrarlanmaz (notified_at kontrolü)
//   4. Expo Push API'ye bildirim gönder, notified_at doldur
//   Hiç yanlış yoksa: sınav satırı AÇILMAZ, tebrik bildirimi gider.
//
// Deploy: npx supabase functions deploy weekly-exam
// Güvenlik: CRON_SECRET secret'ı tanımlıysa istekte x-cron-secret
// başlığı eşleşmek zorunda (elle tetiklemeye karşı).
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

type MistakeRow = {
  question_id: string;
  created_at: string;
  questions: { topics: { units: { subject_id: string } } };
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CONGRATS_TITLE = '🎉 Tertemiz bir hafta!';

/** Europe/Istanbul (UTC+3, sabit) gününe göre bu haftanın pazartesi'si — YYYY-MM-DD */
function weekStartIstanbul(): string {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const daysSinceMonday = (tr.getUTCDay() + 6) % 7; // Pzt=0 ... Paz=6
  tr.setUTCDate(tr.getUTCDate() - daysSinceMonday);
  return tr.toISOString().slice(0, 10);
}

/** weekStartIstanbul()'ün aynı Pazartesi'si, 00:00 Europe/Istanbul olarak UTC ISO string —
 * "tebrik" push'unun bu hafta zaten gidip gitmediğini notifications tablosunda aramak için. */
function weekStartIstanbulIso(): string {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const daysSinceMonday = (tr.getUTCDay() + 6) % 7;
  tr.setUTCDate(tr.getUTCDate() - daysSinceMonday);
  tr.setUTCHours(0, 0, 0, 0);
  return new Date(tr.getTime() - 3 * 60 * 60 * 1000).toISOString();
}

/** Ders çeşitliliğini koruyarak en fazla `max` soru seç (subject round-robin) */
function pickDiverse(mistakes: MistakeRow[], max: number): string[] {
  const bySubject = new Map<string, string[]>();
  for (const m of mistakes) {
    const subject = m.questions?.topics?.units?.subject_id ?? 'diger';
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject)!.push(m.question_id);
  }
  const buckets = [...bySubject.values()];
  const picked: string[] = [];
  for (let round = 0; picked.length < max; round++) {
    let added = false;
    for (const bucket of buckets) {
      if (round < bucket.length && picked.length < max) {
        picked.push(bucket[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return picked;
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

  const weekStart = weekStartIstanbul();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Haftalık sınav premium özelliği; push token'ı olmayanlara gidecek bir şey yok
  const { data: users, error: usersErr } = await supabase
    .from('profiles')
    .select('id, expo_push_token')
    .eq('is_premium', true)
    .not('expo_push_token', 'is', null);
  if (usersErr) {
    return new Response(JSON.stringify({ error: usersErr.message }), { status: 500 });
  }

  let examsCreated = 0, congrats = 0, skipped = 0, congratsSkipped = 0;
  const pushes: object[] = [];
  const congratsNotificationRows: { user_id: string; title: string; body: string; route: string }[] = [];
  const congratsBody = 'Bu hafta hiç yanlışın yok — kale duvarların sapasağlam. Böyle devam!';
  const weekStartIso = weekStartIstanbulIso();

  for (const user of users ?? []) {
    const { data: mistakes, error: mErr } = await supabase
      .from('mistakes')
      .select('question_id, created_at, questions!inner(topics!inner(units!inner(subject_id)))')
      .eq('user_id', user.id)
      .is('resolved_at', null)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: true })
      .returns<MistakeRow[]>();
    if (mErr) {
      console.error(`mistakes sorgusu (${user.id}):`, mErr.message);
      continue;
    }

    if (!mistakes || mistakes.length === 0) {
      // idempotent kurulum: weekly_exams satırı yok (§4.7 — hiç yanlış yoksa
      // sınav satırı açılmaz), bu yüzden tekrar-gönderim kontrolü notifications
      // tablosunda yapılır (streak-reminder ile aynı desen) — cron aynı hafta
      // iki kez koşarsa "tertemiz hafta" bildirimi mükerrer gitmesin.
      const { data: existing, error: existingErr } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('title', CONGRATS_TITLE)
        .gte('created_at', weekStartIso)
        .maybeSingle();
      if (existingErr) {
        console.error(`notifications kontrolü (${user.id}):`, existingErr.message);
        continue;
      }
      if (existing) {
        congratsSkipped++;
        continue;
      }
      pushes.push({
        to: user.expo_push_token,
        title: CONGRATS_TITLE,
        body: congratsBody,
        data: { route: '/yanlislar' },
      });
      congratsNotificationRows.push({ user_id: user.id, title: CONGRATS_TITLE, body: congratsBody, route: '/yanlislar' });
      congrats++;
      continue;
    }

    const questionIds = pickDiverse(mistakes, 5);

    // idempotent kurulum: satır zaten varsa dokunma
    const { error: upsertErr } = await supabase
      .from('weekly_exams')
      .upsert(
        { user_id: user.id, week_start: weekStart, question_ids: questionIds },
        { onConflict: 'user_id,week_start', ignoreDuplicates: true },
      );
    if (upsertErr) {
      console.error(`weekly_exams upsert (${user.id}):`, upsertErr.message);
      continue;
    }

    // push'u yalnız daha önce bildirilmemiş satır için at (çifte koşuda no-op)
    const { data: exam } = await supabase
      .from('weekly_exams')
      .select('id, notified_at, question_ids')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .single();
    if (!exam || exam.notified_at) {
      skipped++;
      continue;
    }

    pushes.push({
      to: user.expo_push_token,
      title: '🏆 Haftalık Mini Sınav hazır!',
      body: `Bu haftaki ${exam.question_ids.length} yanlışından sınavın seni bekliyor.`,
      data: { route: '/yanlislar/haftalik' },
    });
    await supabase.from('weekly_exams').update({ notified_at: new Date().toISOString() }).eq('id', exam.id);
    examsCreated++;
  }

  await sendPush(pushes);
  if (congratsNotificationRows.length > 0) {
    const { error: insertErr } = await supabase.from('notifications').insert(congratsNotificationRows);
    if (insertErr) console.error('notifications insert (congrats):', insertErr.message);
  }

  return new Response(
    JSON.stringify({ week_start: weekStart, exams: examsCreated, congrats, skipped, congratsSkipped }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
