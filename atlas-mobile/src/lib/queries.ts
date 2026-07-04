/**
 * Veri katmanı — tüm Supabase okuma/yazmaları buradan geçer.
 * İş kuralları sunucuda (finish_quiz RPC + RLS); burası sadece
 * sorgular ve efektif konu durumu türetme (BACKEND.md §4.5).
 */
import { supabase } from './supabase';
import type {
  CoachMessage,
  ContinueTarget,
  FinishQuizResult,
  Flashcard,
  MistakeItem,
  MockExamNets,
  Profile,
  Question,
  QuizAnswer,
  QuizMode,
  Subject,
  SubjectSummary,
  TopicNode,
  TopicStatus,
  UnitNode,
  WeeklyExam,
} from './types';

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

export async function fetchXpToday(): Promise<number> {
  const { data, error } = await supabase
    .from('xp_events')
    .select('amount')
    .gte('created_at', istanbulDayStartIso());
  if (error) throw error;
  return (data ?? []).reduce((sum, e) => sum + (e.amount as number), 0);
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

/** Ev ekranı "Devam Et" hedefi: sıradaki fethedilecek konu */
export async function fetchContinueTarget(isPremium: boolean): Promise<ContinueTarget | null> {
  const subjects = await fetchSubjects();
  const playable = subjects.filter((s) => s.exam_type === 'tyt' && (s.is_free || isPremium));
  // ücretsiz ders (Tarih) önce — monetizasyon kuralı gereği listede zaten filtreli
  for (const subject of playable) {
    const tree = await fetchSubjectTree(subject.id);
    const active = tree.flatMap((u) => u.topics).find((t) => t.status === 'active');
    if (active) return { subject, topicId: active.id, topicTitle: active.title };
  }
  return null;
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
  topics: { title: string; units: { subjects: { id: string; name: string; color: string } } };
};

const QUESTION_JOIN =
  'id, topic_id, prompt, options, correct_index, explanation, topics!inner(title, units!inner(subjects!inner(id, name, color)))';

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
      } satisfies Question,
    ]),
  );
  return ids.map((id) => byId.get(id)).filter((q): q is Question => !!q);
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

export async function fetchOpenMistakes(): Promise<MistakeItem[]> {
  const { data, error } = await supabase
    .from('mistakes')
    .select(`id, created_at, wrong_answer_index, questions!inner(${QUESTION_JOIN})`)
    .is('resolved_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    id: string;
    created_at: string;
    wrong_answer_index: number | null;
    questions: JoinedQuestionRow;
  }[];

  return rows.map((m) => ({
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
    },
    subjectId: m.questions.topics.units.subjects.id,
    subjectName: m.questions.topics.units.subjects.name,
    subjectColor: m.questions.topics.units.subjects.color,
    topicTitle: m.questions.topics.title,
  }));
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

export async function fetchCoachHistory(limit = 50): Promise<CoachMessage[]> {
  const { data, error } = await supabase
    .from('coach_messages')
    .select('id, role, content, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as CoachMessage[]).reverse();
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
 * coach-chat Edge Function — Gemini proxy'si. Hata gövdesindeki kod
 * ('premium_required' | 'rate_limited' | ...) Error.message olarak fırlatılır.
 */
export async function sendCoachMessage(message: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('coach-chat', { body: { message } });
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
export async function saveMockExam(nets: MockExamNets, notes?: string): Promise<void> {
  const { error } = await supabase.from('mock_exams').insert({ nets, notes: notes ?? null });
  if (error) throw error;
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
