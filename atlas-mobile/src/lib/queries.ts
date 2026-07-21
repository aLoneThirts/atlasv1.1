/**
 * Veri katmanı — tüm Supabase okuma/yazmaları buradan geçer.
 * İş kuralları sunucuda (finish_quiz RPC + RLS); burası sadece
 * sorgular ve efektif konu durumu türetme (BACKEND.md §4.5).
 */
import { supabase } from './supabase';
import type {
  Badge,
  CoachConversationSummary,
  CoachMessage,
  ContinueTarget,
  ExamCalcResult,
  FinishQuizResult,
  Flashcard,
  MistakeItem,
  MockExamHistoryEntry,
  MockExamNets,
  NotificationItem,
  Profile,
  Question,
  QuizAnswer,
  QuizMode,
  ScoreCoefficients,
  Subject,
  SubjectSummary,
  TercihAralikFiltre,
  TercihAralikSonuc,
  TercihFiltre,
  TercihOneri,
  TopicNode,
  TopicStatus,
  UnitNode,
  WeeklyExam,
  WeeklySummary,
  YksProgramStat,
  YksProgramSummary,
} from './types';
import type { NetMap, ScoreType } from '@shared/yks-calc';
import type { RankPoint } from '@shared/rank-estimator';

/* ------------------------------------------------------------
   Zaman yardımcıları — iş kuralları Europe/Istanbul (UTC+3 sabit)
------------------------------------------------------------ */

const HOUR = 60 * 60 * 1000;

/** İstanbul gününün başlangıcı, UTC ISO string (xp "bugün" sorguları için) */
export function istanbulDayStartIso(): string {
  const tr = new Date(Date.now() + 3 * HOUR);
  tr.setUTCHours(0, 0, 0, 0);
  return new Date(tr.getTime() - 3 * HOUR).toISOString();
}

/** Bu haftanın pazartesi'si (İstanbul), YYYY-MM-DD — weekly_exams.week_start */
export function weekStartIstanbul(): string {
  const tr = new Date(Date.now() + 3 * HOUR);
  tr.setUTCDate(tr.getUTCDate() - ((tr.getUTCDay() + 6) % 7));
  return tr.toISOString().slice(0, 10);
}

/**
 * İstanbul gününün YYYY-MM-DD'si (offsetDays ile geçmişe/geleceğe kaydırılabilir) —
 * `profiles.streak_updated_on` (Postgres `date`) ile client tarafında karşılaştırmak
 * için. finish_quiz()'ün streak mantığıyla birebir aynı gün hesabı (§4.2).
 */
export function istanbulDateStr(offsetDays = 0): string {
  const tr = new Date(Date.now() + 3 * HOUR + offsetDays * 24 * HOUR);
  return tr.toISOString().slice(0, 10);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------
   Profil + XP
------------------------------------------------------------ */

export async function fetchProfile(): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').single();
  if (error) throw error;
  return data as Profile;
}

/**
 * lose_heart() RPC — can ANINDA (quiz bitmeden) düşer (BACKEND.md §4.1).
 * Her yanlış cevapta çağrılmalı; dönen değer sunucudaki gerçek can sayısıdır
 * (istemci matematiği değil) — quiz yarıda bırakılsa bile kayıp kalıcıdır.
 */
export async function loseHeart(): Promise<number> {
  const { data, error } = await supabase.rpc('lose_heart');
  if (error) throw error;
  return (data as { hearts: number }).hearts;
}

export type HeartsState = { hearts: number; hearts_updated_at: string; next_heart_at: string | null };

/**
 * get_hearts() RPC — 1 saatte 1 can yenilemesini (BACKEND.md §4.1) hesaplayıp
 * kalıcı yazar, güncel değeri + bir sonraki can zamanını döner. Kale/quiz
 * ekranları açılırken çağrılmalı (UI'da geri sayım göstermek için).
 */
export async function getHearts(): Promise<HeartsState> {
  const { data, error } = await supabase.rpc('get_hearts');
  if (error) throw error;
  return data as HeartsState;
}

/**
 * RLS "own profile" zaten çağıranın satırıyla sınırlar, ama supabase-js
 * filtresiz update/delete'i KENDİSİ reddediyor ("UPDATE requires a WHERE
 * clause") — bu yüzden id filtresi RLS için değil, client kütüphanesinin
 * kendi güvenlik kontrolünü geçmek için gerekli.
 */
export async function updateProfile(patch: Partial<Profile>): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Oturum yok.');
  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
  if (error) throw error;
}

/**
 * exam_track hassas bir kolon (monetization.sql'de client GRANT'ından
 * bilerek dışarıda bırakıldı) — yalnız supabase/exam_track.sql'deki
 * set_exam_track RPC'siyle değişir (dev_set_premium ile aynı düzen).
 */
export async function setExamTrack(track: Profile['exam_track']): Promise<void> {
  const { error } = await supabase.rpc('set_exam_track', { new_track: track });
  if (error) throw error;
}

/**
 * delete-account Edge Function — auth.users satırını admin API ile siler;
 * profiles + tüm bağlı kullanıcı verisi FK cascade ile otomatik gider
 * (App Store Guideline 5.1.1(v) / KVKK unutulma hakkı, bkz. Ayarlar ekranı).
 * Başarılı dönerse çağıran taraf ayrıca signOut çağırmalı (oturum token'ı
 * artık geçersiz bir kullanıcıya ait olsa da istemci state'i temizlenmeli).
 */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  if (!(data as { ok: boolean })?.ok) throw new Error('delete_failed');
}

/* ------------------------------------------------------------
   ÖSYM puan hesaplama (görev listesi madde 10/11)
------------------------------------------------------------ */

export async function fetchScoreCoefficients(year: number, scoreType: ScoreType): Promise<ScoreCoefficients> {
  const { data, error } = await supabase
    .from('score_coefficients')
    .select('year, score_type, base_score, coefficients')
    .eq('year', year)
    .eq('score_type', scoreType)
    .single();
  if (error) throw error;
  return data as ScoreCoefficients;
}

/** calculate-yks-score Edge Function'ı çağırır — hesaplama + kayıt tek adımda (bkz. shared/yks-calc.ts). */
export async function calculateAndSaveExamScore(params: {
  year: number;
  scoreType: ScoreType;
  netler: NetMap;
  diplomaNotu?: number;
  oncekiYilYerlesti?: boolean;
}): Promise<ExamCalcResult> {
  const { data, error } = await supabase.functions.invoke('calculate-yks-score', { body: params });
  if (error) throw error;
  return data as ExamCalcResult;
}

/** score_rank_distribution'da bu puan türü için verisi olan yıllar (yeniden→eskiye). */
export async function fetchAvailableRankYears(scoreType: ScoreType): Promise<number[]> {
  const { data, error } = await supabase
    .from('score_rank_distribution')
    .select('year')
    .eq('score_type', scoreType);
  if (error) throw error;
  const years = [...new Set((data ?? []).map((r) => r.year as number))];
  return years.sort((a, b) => b - a);
}

/** Bir yılın (score,rank) nokta bulutu — rank-estimator.ts'in tahminSira'sına verilir. */
export async function fetchScoreRankDistribution(year: number, scoreType: ScoreType): Promise<RankPoint[]> {
  const { data, error } = await supabase
    .from('score_rank_distribution')
    .select('score, rank')
    .eq('year', year)
    .eq('score_type', scoreType);
  if (error) throw error;
  return (data ?? []) as RankPoint[];
}

/**
 * Üniversite ve/veya bölüm adına göre yks_programs araması (bkz.
 * tools/yokatlas-scraper) — okul/bölüm bazlı sıralama/net ortalaması
 * sorgulama özelliği için (Puan sekmesi, "Okul/Bölüm Sırala").
 *
 * Düz `.ilike()` yerine `search_yks_programs` RPC'si kullanılıyor (bkz.
 * supabase/yks_programs_search.sql) — veritabanının locale'i "İ" harfini
 * doğru küçültmediğinden (`lower('İSTANBUL')` "istanbul" üretmiyor), düz
 * ilike kullanıcı "istanbul" yazınca hiç sonuç bulamıyordu (test edilip
 * doğrulandı). RPC İ/I/ı'yı arama sırasında tek forma indirgeyip eşleştiriyor.
 */
export async function searchYksPrograms(university: string, department: string): Promise<YksProgramSummary[]> {
  const { data, error } = await supabase.rpc('search_yks_programs', {
    q_university: university.trim(),
    q_department: department.trim(),
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    university: r.university as string,
    universityType: r.university_type as string | null,
    city: r.city as string | null,
    faculty: r.faculty as string | null,
    department: r.department as string,
    scoreType: r.score_type as YksProgramSummary['scoreType'],
    language: r.language as string | null,
    scholarship: r.scholarship as string | null,
  }));
}

/** Bir yks_programs satırının yıllara göre taban puan/sıralama/net ortalaması (en yeni yıl önce). */
export async function fetchProgramStats(programId: string): Promise<YksProgramStat[]> {
  const { data, error } = await supabase
    .from('yks_program_stats')
    .select('year, min_score, min_rank, avg_tyt_net, avg_ayt_net, quota, placed')
    .eq('program_id', programId)
    .order('year', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    year: r.year as number,
    minScore: r.min_score as number | null,
    minRank: r.min_rank as number | null,
    avgTytNet: r.avg_tyt_net as number | null,
    avgAytNet: r.avg_ayt_net as number | null,
    quota: r.quota as number | null,
    placed: r.placed as number | null,
  }));
}

/**
 * Tercih robotu — kullanıcının sırası/puanı + filtrelerle risk sınıflı program
 * önerileri (bkz. supabase/tercih_robotu.sql → tercih_oner RPC). Veri kaynağı
 * yks_programs/yks_program_stats (tools/yokatlas-scraper ile toplanıp yüklenir);
 * tablolar boşsa RPC boş liste döner (hata değil).
 */
export async function fetchTercihOnerileri(f: TercihFiltre): Promise<TercihOneri[]> {
  const { data, error } = await supabase.rpc('tercih_oner', {
    p_score_type: f.scoreType ?? null,
    p_year: f.year,
    p_rank: f.rank ?? null,
    p_score: f.score ?? null,
    p_risk: f.risk ?? null,
    p_city: f.city ?? null,
    p_university_type: f.universityType ?? null,
    p_q_program: f.qProgram ?? '',
    p_q_university: f.qUniversity ?? '',
    p_include_onlisans: f.includeOnlisans ?? false,
    p_limit: f.limit ?? 50,
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    programId: r.program_id as string,
    university: r.university as string,
    universityType: r.university_type as string | null,
    city: r.city as string | null,
    faculty: r.faculty as string | null,
    department: r.department as string,
    scoreType: r.score_type as string,
    language: r.language as string | null,
    scholarship: r.scholarship as string | null,
    year: r.year as number,
    minScore: r.min_score as number | null,
    minRank: r.min_rank as number | null,
    quota: r.quota as number | null,
    risk: r.risk as TercihOneri['risk'],
    gap: r.gap as number | null,
  }));
}

/**
 * Tercih robotu — sıralama ARALIĞI sorgusu (bkz. supabase/tercih_aralik.sql →
 * tercih_sira_araligi RPC). Kullanıcı en düşük/en yüksek sıralamasını girer,
 * o aralıktaki taban sıraya sahip TÜM programlar (filtrelerle) listelenir —
 * risk sınıflandırması/puan girişi yok, tercih_oner'ın yerini aldı (2026-07-14).
 * Veri kısıtı: min_rank yalnız 2025 için var (bkz. tercih_aralik.sql başlığı).
 */
export async function fetchTercihSiraAraligi(f: TercihAralikFiltre): Promise<TercihAralikSonuc[]> {
  const { data, error } = await supabase.rpc('tercih_sira_araligi', {
    p_rank_min: f.rankMin,
    p_rank_max: f.rankMax,
    p_year: f.year ?? 2025,
    p_score_type: f.scoreType ?? null,
    p_city: f.city ?? null,
    p_university_type: f.universityType ?? null,
    p_q_program: f.qProgram ?? '',
    p_q_university: f.qUniversity ?? '',
    p_limit: f.limit ?? 100,
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    programId: r.program_id as string,
    university: r.university as string,
    universityType: r.university_type as string | null,
    city: r.city as string | null,
    faculty: r.faculty as string | null,
    department: r.department as string,
    scoreType: r.score_type as string,
    language: r.language as string | null,
    scholarship: r.scholarship as string | null,
    year: r.year as number,
    minScore: r.min_score as number | null,
    minRank: r.min_rank as number | null,
    quota: r.quota as number | null,
  }));
}

export async function fetchXpToday(): Promise<number> {
  const { data, error } = await supabase
    .from('xp_events')
    .select('amount')
    .gte('created_at', istanbulDayStartIso());
  if (error) throw error;
  return (data ?? []).reduce((sum, e) => sum + (e.amount as number), 0);
}

/* ------------------------------------------------------------
   Rozetler (bkz. supabase/badges.sql)
------------------------------------------------------------ */

/** Rozet kataloğu + bu kullanıcının kazanıp kazanmadığı. */
export async function fetchBadges(): Promise<Badge[]> {
  const [catalogRes, earnedRes] = await Promise.all([
    supabase.from('badges').select('id, key, title, description, emoji').order('sort_order', { ascending: true }),
    supabase.from('user_badges').select('badge_id, earned_at'),
  ]);
  if (catalogRes.error) throw catalogRes.error;
  if (earnedRes.error) throw earnedRes.error;

  const earnedMap = new Map(
    ((earnedRes.data ?? []) as { badge_id: string; earned_at: string }[]).map((r) => [r.badge_id, r.earned_at]),
  );
  return (
    (catalogRes.data ?? []) as { id: string; key: string; title: string; description: string; emoji: string }[]
  ).map((b) => ({
    id: b.id,
    key: b.key,
    title: b.title,
    description: b.description,
    emoji: b.emoji,
    earned: earnedMap.has(b.id),
    earnedAt: earnedMap.get(b.id) ?? null,
  }));
}

/**
 * check_and_award_badges() RPC — eşiği geçilmiş ama henüz kazanılmamış rozetleri
 * kaydeder, yeni kazanılanları döner (varsa kutlama popup'ı için). Ev yüklenişinde
 * ve her quiz bitişinde çağrılmalı.
 */
export async function checkAndAwardBadges(): Promise<Badge[]> {
  const { data, error } = await supabase.rpc('check_and_award_badges');
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    key: r.key as string,
    title: r.title as string,
    description: r.description as string,
    emoji: r.emoji as string,
    earned: true,
    earnedAt: (r.earned_at as string) ?? new Date().toISOString(),
  }));
}

/* ------------------------------------------------------------
   Dersler (kaleler) + konu ağacı
------------------------------------------------------------ */

export async function fetchSubjects(): Promise<Subject[]> {
  const { data, error } = await supabase.from('subjects').select('*').order('sort_order');
  if (error) throw error;
  return (data ?? []) as Subject[];
}

/** Harita: dersler + konu sayıları + fethedilen konu sayıları */
export async function fetchSubjectSummaries(): Promise<SubjectSummary[]> {
  const [subjects, topicsRes, doneRes] = await Promise.all([
    fetchSubjects(),
    supabase.from('topics').select('id, units!inner(subject_id)'),
    supabase.from('topic_progress').select('topic_id, status').eq('status', 'done'),
  ]);
  if (topicsRes.error) throw topicsRes.error;
  if (doneRes.error) throw doneRes.error;

  const subjectByTopic = new Map<string, string>();
  const totals = new Map<string, number>();
  for (const t of (topicsRes.data ?? []) as unknown as { id: string; units: { subject_id: string } }[]) {
    subjectByTopic.set(t.id, t.units.subject_id);
    totals.set(t.units.subject_id, (totals.get(t.units.subject_id) ?? 0) + 1);
  }
  const dones = new Map<string, number>();
  for (const p of (doneRes.data ?? []) as { topic_id: string }[]) {
    const s = subjectByTopic.get(p.topic_id);
    if (s) dones.set(s, (dones.get(s) ?? 0) + 1);
  }
  return subjects.map((s) => ({
    ...s,
    totalTopics: totals.get(s.id) ?? 0,
    doneTopics: dones.get(s.id) ?? 0,
  }));
}

/**
 * Kale ekranı: bölümler + konular + kullanıcının efektif durumu.
 * Kural (§4.5): konular lineer açılır; hiç kayıt yoksa ilk konu 'active'.
 * DB'de 'active' satırı yoksa (ör. yeni kullanıcı) ilk 'done' olmayan konu
 * 'active' kabul edilir — finish_quiz sonraki konuyu zaten 'active' yazar.
 */
export async function fetchSubjectTree(subjectId: string): Promise<UnitNode[]> {
  const { data: units, error: uErr } = await supabase
    .from('units')
    .select('id, title, sort_order, topics(id, title, sort_order)')
    .eq('subject_id', subjectId)
    .order('sort_order');
  if (uErr) throw uErr;

  const unitRows = (units ?? []) as unknown as {
    id: string;
    title: string;
    sort_order: number;
    topics: { id: string; title: string; sort_order: number }[];
  }[];

  const topicIds = unitRows.flatMap((u) => u.topics.map((t) => t.id));
  const { data: progress, error: pErr } = await supabase
    .from('topic_progress')
    .select('topic_id, status, stars')
    .in('topic_id', topicIds);
  if (pErr) throw pErr;

  const progressMap = new Map(
    ((progress ?? []) as { topic_id: string; status: TopicStatus; stars: number }[]).map((p) => [
      p.topic_id,
      p,
    ]),
  );

  const tree: UnitNode[] = unitRows.map((u) => ({
    id: u.id,
    title: u.title,
    sort_order: u.sort_order,
    topics: [...u.topics]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((t): TopicNode => {
        const p = progressMap.get(t.id);
        return { ...t, status: p?.status ?? 'locked', stars: p?.stars ?? 0 };
      }),
  }));

  // efektif 'active' türet: hiç active yoksa ilk done-olmayan konuyu aç
  const flat = tree.flatMap((u) => u.topics);
  if (!flat.some((t) => t.status === 'active')) {
    const first = flat.find((t) => t.status !== 'done');
    if (first) first.status = 'active';
  }
  return tree;
}

/**
 * Ev ekranı "Devam Et" hedefi: sıradaki fethedilecek konu.
 * `examTrack='tyt_ayt_ea'` kullanıcılar için AYT dersleri de aday listesine
 * girer — önceden yalnız exam_type='tyt' filtreleniyordu, bu da TYT'sini
 * bitiren AYT öğrencisine "tüm konular fethedildi" yanlış mesajını gösteriyordu
 * (AYT dersleri sort_order 10+ olduğundan zaten TYT'den sonra denenir, bkz.
 * schema.sql/ayt-subjects.sql).
 */
export async function fetchContinueTarget(
  isPremium: boolean,
  examTrack: Profile['exam_track'] = 'tyt',
): Promise<ContinueTarget | null> {
  const subjects = await fetchSubjects();
  const playable = subjects.filter(
    (s) => (s.exam_type === 'tyt' || examTrack === 'tyt_ayt_ea') && (s.is_free || isPremium),
  );
  // ücretsiz ders (Tarih) önce — monetizasyon kuralı gereği listede zaten filtreli
  for (const subject of playable) {
    const tree = await fetchSubjectTree(subject.id);
    const active = tree.flatMap((u) => u.topics).find((t) => t.status === 'active');
    if (active) return { subject, topicId: active.id, topicTitle: active.title };
  }
  return null;
}

/**
 * Konu özeti (seed_tarih_full.sql ile gelen topics.summary) — konu akışının
 * ilk adımı olan özet ekranı için. Özet yoksa null döner.
 */
export async function fetchTopicSummary(topicId: string): Promise<string | null> {
  const { data, error } = await supabase.from('topics').select('summary').eq('id', topicId).single();
  if (error) throw error;
  return (data?.summary as string | null) ?? null;
}

/* ------------------------------------------------------------
   Sorular + quiz bitişi
------------------------------------------------------------ */

export async function fetchTopicQuestions(topicId: string, limit = 5): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('id, topic_id, prompt, options, correct_index, explanation')
    .eq('topic_id', topicId);
  if (error) throw error;
  return shuffle((data ?? []) as Question[]).slice(0, limit);
}

type JoinedQuestionRow = Question & {
  topics: {
    title: string;
    units: { subjects: { id: string; name: string; color: string; exam_type: 'tyt' | 'ayt' } };
  };
};

const QUESTION_JOIN =
  'id, topic_id, prompt, options, correct_index, explanation, difficulty, topics!inner(title, units!inner(subjects!inner(id, name, color, exam_type)))';

/** id listesiyle soru çek (haftalık sınav) — ders rozeti için subject join'li */
export async function fetchQuestionsByIds(ids: string[]): Promise<Question[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('questions').select(QUESTION_JOIN).in('id', ids);
  if (error) throw error;
  const rows = (data ?? []) as unknown as JoinedQuestionRow[];
  const byId = new Map<string, Question>(
    rows.map((q) => [
      q.id,
      {
        id: q.id,
        topic_id: q.topic_id,
        prompt: q.prompt,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
        subject_name: q.topics.units.subjects.name,
        subject_color: q.topics.units.subjects.color,
        difficulty: q.difficulty,
      } satisfies Question,
    ]),
  );
  return ids.map((id) => byId.get(id)).filter((q): q is Question => !!q);
}

/**
 * Bir dizi konudan rastgele soru çek — deneme sonrası "zayıf konular" hedefli
 * pratik quiz'i için (bkz. app/deneme/quiz-hedef.tsx). fetchTopicQuestions'ın
 * tek-konu sürümünün çoklu-konu genellemesi; sonuç ekranında "hangi ders/konu"
 * gruplaması yapılabilsin diye subject_id/topic_title de taşınır.
 */
export async function fetchQuestionsByTopics(topicIds: string[], limit = 10): Promise<Question[]> {
  if (topicIds.length === 0) return [];
  const { data, error } = await supabase.from('questions').select(QUESTION_JOIN).in('topic_id', topicIds);
  if (error) throw error;
  const rows = (data ?? []) as unknown as JoinedQuestionRow[];
  const mapped: Question[] = rows.map((q) => ({
    id: q.id,
    topic_id: q.topic_id,
    prompt: q.prompt,
    options: q.options,
    correct_index: q.correct_index,
    explanation: q.explanation,
    subject_name: q.topics.units.subjects.name,
    subject_color: q.topics.units.subjects.color,
    difficulty: q.difficulty,
    topic_title: q.topics.title,
    subject_id: q.topics.units.subjects.id,
  }));
  return shuffle(mapped).slice(0, limit);
}

/**
 * Quiz bitişi — TEK atomik RPC (BACKEND.md §6.1).
 * Can/XP/yıldız/streak/yanlış havuzu sunucuda işlenir.
 */
export async function finishQuiz(
  mode: QuizMode,
  topicId: string | null,
  answers: QuizAnswer[],
): Promise<FinishQuizResult> {
  const { data, error } = await supabase.rpc('finish_quiz', {
    p_topic_id: topicId,
    p_mode: mode,
    p_answers: answers,
  });
  if (error) throw error;
  return data as FinishQuizResult;
}

/* ------------------------------------------------------------
   Yanlış havuzu + haftalık sınav
------------------------------------------------------------ */

/**
 * Açık yanlış havuzu — en zor sorular önce (difficulty desc), eşitlikte en eski
 * yanlış önce (created_at asc), böylece en çok zorlanılan sorular listenin
 * başında öncelikli görünür.
 */
export async function fetchOpenMistakes(): Promise<MistakeItem[]> {
  const { data, error } = await supabase
    .from('mistakes')
    .select(`id, created_at, wrong_answer_index, questions!inner(${QUESTION_JOIN})`)
    .is('resolved_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    id: string;
    created_at: string;
    wrong_answer_index: number | null;
    questions: JoinedQuestionRow;
  }[];

  return rows
    .map((m) => ({
      id: m.id,
      created_at: m.created_at,
      wrong_answer_index: m.wrong_answer_index,
      question: {
        id: m.questions.id,
        topic_id: m.questions.topic_id,
        prompt: m.questions.prompt,
        options: m.questions.options,
        correct_index: m.questions.correct_index,
        explanation: m.questions.explanation,
        subject_name: m.questions.topics.units.subjects.name,
        subject_color: m.questions.topics.units.subjects.color,
        difficulty: m.questions.difficulty,
      },
      subjectId: m.questions.topics.units.subjects.id,
      subjectName: m.questions.topics.units.subjects.name,
      subjectColor: m.questions.topics.units.subjects.color,
      subjectExamType: m.questions.topics.units.subjects.exam_type,
      topicTitle: m.questions.topics.title,
    }))
    .sort((a, b) => (b.question.difficulty ?? 0) - (a.question.difficulty ?? 0));
}

export async function fetchQuestionById(id: string): Promise<Question | null> {
  const questions = await fetchQuestionsByIds([id]);
  return questions[0] ?? null;
}

/** Bu haftanın sınavı (Pazar cron'u kurduysa) */
export async function fetchCurrentWeeklyExam(): Promise<WeeklyExam | null> {
  const { data, error } = await supabase
    .from('weekly_exams')
    .select('id, week_start, question_ids, completed_at, correct_count')
    .eq('week_start', weekStartIstanbul())
    .maybeSingle();
  if (error) throw error;
  return data as WeeklyExam | null;
}

/* ------------------------------------------------------------
   Koç
------------------------------------------------------------ */

/**
 * Bir konuşma oturumunun (thread) mesajları — eskiden yeniye. `conversationId`
 * verilmezse en son konuşulan oturum otomatik bulunup o döner (uygulama
 * açılışında "kaldığın yerden devam" davranışı için).
 */
export async function fetchCoachHistory(conversationId?: string, limit = 200): Promise<CoachMessage[]> {
  let targetId = conversationId;
  if (!targetId) {
    const { data: latest, error: latestErr } = await supabase
      .from('coach_messages')
      .select('conversation_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestErr) throw latestErr;
    if (!latest) return [];
    targetId = (latest as { conversation_id: string }).conversation_id;
  }

  // En SONdaki `limit` mesaj isteniyor (uzun bir konuşmada en eski mesajlar
  // değil) — bu yüzden azalan sırada çekilip sonra ekran sırasına (artan)
  // çevriliyor; düz artan sırada limit uygulamak yanlışlıkla en eski
  // mesajları döndürüp yenileri keserdi.
  const { data, error } = await supabase
    .from('coach_messages')
    .select('id, conversation_id, role, content, created_at')
    .eq('conversation_id', targetId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as CoachMessage[]).reverse();
}

/** Geçmiş konuşmalar listesi — Koç ekranındaki 🕘 paneli için (en son üstte). */
export async function fetchCoachConversations(): Promise<CoachConversationSummary[]> {
  const { data, error } = await supabase.rpc('list_coach_conversations');
  if (error) throw error;
  return (
    (data ?? []) as {
      conversation_id: string;
      first_message: string | null;
      last_message_at: string;
      message_count: number;
    }[]
  ).map((r) => ({
    conversationId: r.conversation_id,
    firstMessage: r.first_message ?? '(mesaj yok)',
    lastMessageAt: r.last_message_at,
    messageCount: r.message_count,
  }));
}

export async function fetchOpenMistakeCount(): Promise<number> {
  const { count, error } = await supabase
    .from('mistakes')
    .select('id', { count: 'exact', head: true })
    .is('resolved_at', null);
  if (error) throw error;
  return count ?? 0;
}

/**
 * coach-chat Edge Function — DeepSeek proxy'si. Hata gövdesindeki kod
 * ('premium_required' | 'rate_limited' | ...) Error.message olarak fırlatılır.
 * `conversationId` zorunlu — ayrı sohbet oturumları için (bkz. koc.tsx,
 * her "Yeni Sohbet" crypto.randomUUID() ile yeni bir id üretir).
 */
export async function sendCoachMessage(message: string, conversationId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('coach-chat', {
    body: { message, conversation_id: conversationId },
  });
  if (error) {
    let code = 'coach_unavailable';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        if (body?.error) code = body.error;
      } catch {
        /* gövde json değilse genel hata koduyla devam */
      }
    }
    throw new Error(code);
  }
  return (data as { reply: string }).reply;
}

/** Deneme sonucu kaydı — koç bunu bir sonraki mesajında bağlam olarak görür (BACKEND.md §6.3). */
export async function saveMockExam(nets: MockExamNets, weakTopicIds: string[] = [], notes?: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Oturum yok.');
  const { error } = await supabase
    .from('mock_exams')
    .insert({ user_id: user.id, nets, weak_topic_ids: weakTopicIds, notes: notes ?? null });
  if (error) throw error;
}

/** Deneme net geçmişi (eskiden yeniye) — Deneme sekmesindeki trend grafiği için. */
export async function fetchMockExamHistory(): Promise<MockExamHistoryEntry[]> {
  const { data, error } = await supabase
    .from('mock_exams')
    .select('id, taken_on, nets')
    .order('taken_on', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as { id: string; taken_on: string; nets: MockExamNets }[]).map((r) => ({
    id: r.id,
    takenOn: r.taken_on,
    nets: r.nets,
    totalNet: Object.values(r.nets ?? {}).reduce((sum, n) => sum + (Number(n) || 0), 0),
  }));
}

/** Bir deneme kaydının netlerini düzenler — Deneme sekmesindeki kart içi düzenleme için. */
export async function updateMockExamNets(id: string, nets: MockExamNets): Promise<void> {
  const { error } = await supabase.from('mock_exams').update({ nets }).eq('id', id);
  if (error) throw error;
}

/** Bir deneme kaydını siler — Deneme sekmesindeki kart içi silme için. */
export async function deleteMockExam(id: string): Promise<void> {
  const { error } = await supabase.from('mock_exams').delete().eq('id', id);
  if (error) throw error;
}

/** Koç sekmesi "Bu Hafta" özet kartı — son 7 gün XP/quiz/yanlış-temizleme sayıları. */
export async function fetchWeeklySummary(): Promise<WeeklySummary> {
  const since = new Date(Date.now() - 7 * 24 * HOUR).toISOString();
  const [xpRes, quizRes, mistakesResolvedRes] = await Promise.all([
    supabase.from('xp_events').select('amount').gte('created_at', since),
    // quiz_attempts.created_at DİYE BİR KOLON YOK (bkz. schema.sql) — tabloda
    // yalnız started_at/finished_at var. Bu filtre yanlış kolon adıyla PostgREST'ten
    // 400 döndürüyordu (HEAD isteği olduğu için hata gövdesi boş geliyor, tarayıcı
    // konsolunda yalnız "{message: ''}" görünüyordu — teşhisi zorlaştıran asıl sebep buydu).
    supabase.from('quiz_attempts').select('id', { count: 'exact', head: true }).gte('started_at', since),
    supabase
      .from('mistakes')
      .select('id', { count: 'exact', head: true })
      .not('resolved_at', 'is', null)
      .gte('resolved_at', since),
  ]);
  if (xpRes.error) throw xpRes.error;
  if (quizRes.error) throw quizRes.error;
  if (mistakesResolvedRes.error) throw mistakesResolvedRes.error;
  return {
    xpThisWeek: ((xpRes.data ?? []) as { amount: number }[]).reduce((sum, e) => sum + e.amount, 0),
    quizzesThisWeek: quizRes.count ?? 0,
    mistakesResolvedThisWeek: mistakesResolvedRes.count ?? 0,
    weakestSubjectName: null,
  };
}

/* ------------------------------------------------------------
   Bilgi kartları (flashcards) — yalnız 'done' konularda açılır (§4.8)
------------------------------------------------------------ */

export async function fetchFlashcardsByTopic(topicId: string): Promise<Flashcard[]> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('id, topic_id, prompt, answer, accepted_answers, explanation')
    .eq('topic_id', topicId);
  if (error) throw error;
  return (data ?? []) as Flashcard[];
}

/**
 * Yazılı cevap eşleştirme — prototip `normTr` + `checkCard` birebir port (BACKEND.md §4.8).
 * Türkçe küçük harfe çevirir, yalnız a-zçğıöşü0-9 boşluk nokta bırakır, boşlukları teklemer.
 */
export function normTr(s: string): string {
  return (s || '')
    .toLocaleLowerCase('tr')
    .replace(/[^a-zçğıöşü0-9\s.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function checkFlashcardAnswer(input: string, acceptedAnswers: string[]): boolean {
  const ni = normTr(input);
  if (!ni) return false;
  return acceptedAnswers.some((k) => {
    const nk = normTr(k);
    return ni === nk || ni.includes(nk) || (ni.length >= 3 && nk.includes(ni) && ni.length >= nk.length * 0.6);
  });
}

/* ------------------------------------------------------------
   Bildirimler (bkz. supabase/notifications.sql)
------------------------------------------------------------ */

/** Bildirimler ekranı listesi — en yeni önce. */
export async function fetchNotifications(limit = 30): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, route, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (
    (data ?? []) as {
      id: string;
      title: string;
      body: string;
      route: string | null;
      created_at: string;
      read_at: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    route: r.route,
    createdAt: r.created_at,
    readAt: r.read_at,
  }));
}

/** Sekme/Ev'deki kırmızı nokta için okunmamış bildirim sayısı. */
export async function fetchUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

/** Bildirimler ekranı açılınca tüm okunmamışları okunmuş işaretler. */
export async function markNotificationsRead(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);
  if (error) throw error;
}
