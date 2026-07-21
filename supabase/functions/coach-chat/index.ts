// ============================================================
// ATLAS — coach-chat Edge Function (BACKEND.md §6.3)
// DeepSeek anahtarı istemciye ASLA konmaz; bu function proxy'dir.
//
// Input : { message: string, conversation_id: string }   (kullanıcı JWT'den bellidir)
//         conversation_id istemcide crypto.randomUUID() ile üretilir — ayrı
//         sohbet oturumları/thread'leri için (bkz. coach-conversations.sql,
//         "Yeni Sohbet" + geçmiş konuşma listesi özelliği).
// Output: { reply: string }
//
// Akış:
//   1. JWT → kullanıcı; premium değilse 403 (koç premium özelliği)
//   2. Rate limit: 30 kullanıcı mesajı/gün (Europe/Istanbul)
//   3. "Koç Biliyor" bağlamını topla: streak, bugünkü XP, zayıf ders
//      (son 30 gün en çok yanlış), hedef bölüm, sınava kalan gün,
//      son deneme netleri, açık yanlış sayısı
//   4. Son 10 mesajı geçmiş olarak ekle → DeepSeek (OpenAI uyumlu API)
//   5. Kullanıcı mesajı + cevabı coach_messages'a yaz, cevabı döndür
//
// Deploy: npx supabase functions deploy coach-chat
// Secret: npx supabase secrets set DEEPSEEK_API_KEY=...
//         (opsiyonel: DEEPSEEK_MODEL, varsayılan deepseek-chat;
//          deepseek-reasoner koç sohbeti için yavaş/pahalı — gerekmez)
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAILY_LIMIT = 30;

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Europe/Istanbul (UTC+3) gün başlangıcı — UTC ISO string */
function istanbulDayStartUtc(): string {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  tr.setUTCHours(0, 0, 0, 0);
  return new Date(tr.getTime() - 3 * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!deepseekKey) return json({ error: 'deepseek_key_missing' }, 500);

  const { message, conversation_id: conversationId } = await req
    .json()
    .catch(() => ({ message: null, conversation_id: null }));
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return json({ error: 'message_required' }, 400);
  }
  // conversation_id istemcide crypto.randomUUID() ile üretilir (bkz.
  // atlas-mobile/src/lib/queries.ts sendCoachMessage) — ayrı sohbet
  // oturumları/thread'leri için (BACKEND.md/coach-conversations.sql).
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!conversationId || typeof conversationId !== 'string' || !uuidRe.test(conversationId)) {
    return json({ error: 'conversation_id_required' }, 400);
  }
  const userMessage = message.trim().slice(0, 2000);

  // Kullanıcı JWT'siyle çalışan istemci — tüm okuma/yazmalar RLS'ten geçer
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return json({ error: 'auth_required' }, 401);
  const userId = auth.user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, streak_count, daily_xp_goal, target_university, target_department, exam_date, is_premium, exam_track')
    .eq('id', userId)
    .single();
  if (!profile) return json({ error: 'profile_not_found' }, 404);

  // Koç premium özelliği (BACKEND.md §4.9) — sunucu tarafında da doğrulanır
  if (!profile.is_premium) return json({ error: 'premium_required' }, 403);

  const dayStart = istanbulDayStartUtc();

  // Rate limit — bugün atılan kullanıcı mesajı sayısı
  const { count: sentToday } = await supabase
    .from('coach_messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'user')
    .gte('created_at', dayStart);
  if ((sentToday ?? 0) >= DAILY_LIMIT) {
    return json({ error: 'rate_limited', limit: DAILY_LIMIT }, 429);
  }

  // ---- "Koç Biliyor" bağlamı ------------------------------------
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [xpRes, weakRes, openRes, mockRes, historyRes] = await Promise.all([
    supabase.from('xp_events').select('amount').gte('created_at', dayStart),
    supabase
      .from('mistakes')
      .select('id, questions!inner(topics!inner(units!inner(subject_id)))')
      .gte('created_at', thirtyDaysAgo),
    supabase.from('mistakes').select('id', { count: 'exact', head: true }).is('resolved_at', null),
    supabase.from('mock_exams').select('taken_on, nets').order('created_at', { ascending: false }).limit(1),
    supabase
      .from('coach_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const xpToday = (xpRes.data ?? []).reduce((sum, e) => sum + (e.amount ?? 0), 0);

  const wrongBySubject = new Map<string, number>();
  for (const m of (weakRes.data ?? []) as { questions: { topics: { units: { subject_id: string } } } }[]) {
    const s = m.questions?.topics?.units?.subject_id;
    if (s) wrongBySubject.set(s, (wrongBySubject.get(s) ?? 0) + 1);
  }
  const weakest = [...wrongBySubject.entries()].sort((a, b) => b[1] - a[1])[0];

  const daysToExam = profile.exam_date
    ? Math.max(0, Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86_400_000))
    : null;
  const lastMock = mockRes.data?.[0];

  const contextLines = [
    `Öğrenci adı: ${profile.username ?? 'öğrenci'}`,
    `Seri (streak): ${profile.streak_count} gün`,
    `Bugünkü XP: ${xpToday} / hedef ${profile.daily_xp_goal}`,
    `Sınav hedefi: ${profile.target_university ?? '?'} ${profile.target_department ?? ''} (${profile.exam_track === 'tyt_ayt_ea' ? 'TYT + AYT-EA' : 'TYT'})`,
    daysToExam !== null ? `Sınava kalan gün: ${daysToExam}` : 'Sınav tarihi girilmemiş',
    weakest ? `En zayıf ders (son 30 gün, ${weakest[1]} yanlış): ${weakest[0]}` : 'Son 30 günde kayıtlı yanlış yok',
    `Çözülmemiş yanlış sayısı: ${openRes.count ?? 0}`,
    lastMock ? `Son deneme (${lastMock.taken_on}) netleri: ${JSON.stringify(lastMock.nets)}` : 'Henüz deneme girilmemiş',
  ].join('\n');

  const systemPrompt =
    'Sen "Atlas Koçu"sun: YKS\'ye hazırlanan 16-19 yaş öğrencilere Türkçe konuşan, ' +
    'samimi ve motive edici bir koçsun. Uygulamada dersler "kale", konular fethedilecek ' +
    'bölgelerdir; kale/fetih metaforunu doğal biçimde kullan. Cevapların KISA olsun ' +
    '(en fazla 120 kelime), somut ve veriye dayalı öneri ver, öğrenciyi asla azarlama. ' +
    'Emoji kullanabilirsin ama abartma. Aşağıdaki öğrenci verilerine dayan:\n\n' + contextLines;

  // DeepSeek OpenAI uyumlu sohbet formatı kullanır: system/user/assistant
  const history = (historyRes.data ?? []).reverse().map((m) => ({
    role: m.role === 'coach' ? 'assistant' : 'user',
    content: m.content,
  }));

  const model = Deno.env.get('DEEPSEEK_MODEL') ?? 'deepseek-chat';
  const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage },
      ],
      temperature: 1.0, // DeepSeek önerisi: genel sohbet için ~1.0-1.3
      max_tokens: 512,
      stream: false,
    }),
  });

  if (!deepseekRes.ok) {
    console.error('DeepSeek hatası:', deepseekRes.status, await deepseekRes.text());
    return json({ error: 'coach_unavailable' }, 502);
  }

  const deepseek = await deepseekRes.json();
  const reply: string =
    deepseek?.choices?.[0]?.message?.content?.trim() ||
    'Şu an cevap veremiyorum, birazdan tekrar dener misin? 🙏';

  // Sohbet geçmişine yaz (RLS: own coach) — sıra korunsun diye ardışık
  await supabase
    .from('coach_messages')
    .insert({ user_id: userId, conversation_id: conversationId, role: 'user', content: userMessage });
  await supabase
    .from('coach_messages')
    .insert({ user_id: userId, conversation_id: conversationId, role: 'coach', content: reply });

  return json({ reply });
});
