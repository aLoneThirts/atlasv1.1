/**
 * Supabase tablo satırlarının TS karşılıkları — kaynak: supabase/schema.sql
 * (Database type üretimi yapılmadı; sorgu sonuçları queries.ts'te bu tiplere map'lenir.)
 */

export type ExamTrack = 'tyt' | 'tyt_ayt_ea';

export type Profile = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  exam_track: ExamTrack;
  target_university: string | null;
  target_department: string | null;
  exam_date: string | null;
  hearts: number;
  hearts_updated_at: string;
  streak_count: number;
  streak_updated_on: string | null;
  daily_xp_goal: number;
  is_premium: boolean;
  expo_push_token: string | null;
  onboarding_completed: boolean;
  ads_removed: boolean;
  created_at: string;
};

export type Subject = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  color_dark: string;
  exam_type: 'tyt' | 'ayt';
  is_free: boolean;
  sort_order: number;
};

export type Question = {
  id: string;
  topic_id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  /** weekly/single modda rozet için (join'le doldurulur) */
  subject_name?: string;
  subject_color?: string;
};

export type TopicStatus = 'locked' | 'active' | 'done';

export type TopicNode = {
  id: string;
  title: string;
  sort_order: number;
  status: TopicStatus;
  stars: number;
};

export type UnitNode = {
  id: string;
  title: string;
  sort_order: number;
  topics: TopicNode[];
};

export type SubjectSummary = Subject & {
  totalTopics: number;
  doneTopics: number;
};

export type QuizMode = 'topic' | 'weekly' | 'single' | 'flashcards';

export type QuizAnswer = {
  question_id: string;
  selected_index: number;
  correct: boolean;
};

export type FinishQuizResult = {
  xp_earned: number;
  stars: number | null;
  hearts_left: number;
  streak_count: number;
};

export type MistakeItem = {
  id: string;
  created_at: string;
  wrong_answer_index: number | null;
  question: Question;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  topicTitle: string;
};

export type CoachMessage = {
  id: number;
  role: 'user' | 'coach';
  content: string;
  created_at: string;
};

export type WeeklyExam = {
  id: string;
  week_start: string;
  question_ids: string[];
  completed_at: string | null;
  correct_count: number | null;
};

export type ContinueTarget = {
  subject: Subject;
  topicId: string;
  topicTitle: string;
};

export type Flashcard = {
  id: string;
  topic_id: string;
  prompt: string;
  answer: string;
  accepted_answers: string[];
  explanation: string | null;
};

/** mock_exams.nets — ders adı -> net sayısı, örn. {"Türkçe": 32.5, "Tarih": 7} */
export type MockExamNets = Record<string, number>;

export type ScoreCoefficients = {
  year: number;
  score_type: import('@shared/yks-calc').ScoreType;
  base_score: number;
  coefficients: Record<string, number>;
};

export type ExamCalcResult = {
  hamPuan: number;
  obp: number;
  obpKatkisi: number;
  yerlestirmePuani: number;
};

/** yks_programs satırı — YÖK Atlas'tan toplanan lisans programı (bkz. supabase/yks_programs.sql). */
export type YksProgramSummary = {
  id: string;
  university: string;
  universityType: string | null;
  city: string | null;
  faculty: string | null;
  department: string;
  scoreType: import('@shared/yks-calc').ScoreType;
  language: string | null;
  scholarship: string | null;
};

/** yks_program_stats satırı — bir programın bir yıldaki taban puan/sıralama/net ortalaması. */
export type YksProgramStat = {
  year: number;
  minScore: number | null;
  minRank: number | null;
  avgTytNet: number | null;
  avgAytNet: number | null;
  quota: number | null;
  placed: number | null;
};

/** Tercih robotu risk seviyesi — kullanıcının sırası/puanı vs programın tabanı. */
export type TercihRisk = 'guvenli' | 'dengeli' | 'riskli';

/** tercih_oner RPC'sine gönderilen filtre (bkz. supabase/tercih_robotu.sql). */
export type TercihFiltre = {
  scoreType?: import('@shared/yks-calc').ScoreType | null;
  year: number;
  /** Kullanıcı sırası — verilirse puana göre önceliklidir. */
  rank?: number | null;
  /** Veya yerleştirme puanı. */
  score?: number | null;
  risk?: TercihRisk | null;
  city?: string | null;
  universityType?: 'DEVLET' | 'VAKIF' | null;
  qProgram?: string;
  qUniversity?: string;
  includeOnlisans?: boolean;
  limit?: number;
};

/** tercih_oner RPC sonucu — bir programın kullanıcı için risk-sınıflı önerisi. */
export type TercihOneri = {
  programId: string;
  university: string;
  universityType: string | null;
  city: string | null;
  faculty: string | null;
  department: string;
  scoreType: string;
  language: string | null;
  scholarship: string | null;
  year: number;
  minScore: number | null;
  minRank: number | null;
  quota: number | null;
  risk: TercihRisk;
  /** Kullanıcı ile taban arasındaki mutlak fark (sıra farkı veya puan farkı). */
  gap: number | null;
};
