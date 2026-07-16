import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BadgeUnlockPopup } from '@/components/badges/badge-unlock-popup';
import { Btn3D } from '@/components/ui/btn-3d';
import { Confetti } from '@/components/ui/animated/confetti';
import { HeartsEmptyCard } from '@/components/hearts/hearts-empty-card';
import { MascotPop } from '@/components/ui/animated/mascot-pop';
import { HeartsRow } from '@/components/ui/hearts-row';
import { Pill } from '@/components/ui/pill';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AtlasColors, AtlasFonts, AtlasRadius } from '@/constants/atlas-theme';
import { checkAndAwardBadges, fetchQuestionsByTopics, finishQuiz, getHearts, loseHeart } from '@/lib/queries';
import type { Badge, FinishQuizResult, Question, QuizAnswer } from '@/lib/types';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

type Phase = 'loading' | 'quiz' | 'hearts-empty' | 'result' | 'error';

/**
 * Deneme sonrası "zayıf konular" hedefli pratik quiz'i — Koç sekmesinde deneme
 * kaydederken seçilen konu id'lerinden (route param `topicIds`, virgülle
 * ayrılmış) rastgele soru çeker. `yanlislar/quiz-haftalik.tsx`'in faz
 * makinesinin birebir kopyası; farkı: sorular weekly_exams değil rastgele
 * konu bazlı seçim, `finishQuiz('weak_topics', ...)` çağrılır, sonuç
 * ekranında yanlış cevaplanan sorular ders/konu bazlı gruplanıp "bunlara
 * çalışmalısın" olarak listelenir + "Tekrar Pratik Yap" ile aynı konu
 * setinden yeni bir tur başlatılabilir.
 */
export default function WeakTopicsQuizScreen() {
  const router = useRouter();
  const { topicIds: topicIdsParam } = useLocalSearchParams<{ topicIds: string }>();
  const topicIds = (topicIdsParam ?? '').split(',').filter(Boolean);

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [localHearts, setLocalHearts] = useState(5);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<FinishQuizResult | null>(null);
  const [unlockQueue, setUnlockQueue] = useState<Badge[]>([]);

  const loadQuestions = useCallback(async () => {
    setPhase('loading');
    setIndex(0);
    setSelected(null);
    setAnswered(false);
    setCorrectCount(0);
    setWrongCount(0);
    setAnswers([]);
    setResult(null);
    try {
      if (topicIds.length === 0) {
        setPhase('error');
        return;
      }
      const [qs, hearts] = await Promise.all([fetchQuestionsByTopics(topicIds, 10), getHearts()]);
      if (qs.length === 0) {
        setPhase('error');
        return;
      }
      setQuestions(qs);
      setLocalHearts(hearts.hearts);
      setPhase('quiz');
    } catch {
      setPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicIdsParam]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const question = questions[index];
  const total = questions.length;

  // Yanlış cevapta can ANINDA (quiz bitmeden) düşer — sunucudan dönen gerçek
  // değeri kullanır, kayıp sınav yarıda bırakılsa bile kalıcıdır (BACKEND.md §4.1).
  const checkAnswer = async () => {
    if (selected === null || answered || !question) return;
    setAnswered(true);
    const good = selected === question.correct_index;
    setAnswers((prev) => [...prev, { question_id: question.id, selected_index: selected, correct: good }]);
    if (good) {
      setCorrectCount((c) => c + 1);
    } else {
      setWrongCount((w) => w + 1);
      try {
        const heartsNow = await loseHeart();
        setLocalHearts(heartsNow);
      } catch {
        setLocalHearts((h) => Math.max(0, h - 1));
      }
    }
  };

  const advance = async (heartsNow: number) => {
    setLocalHearts(heartsNow);
    setPhase('quiz');
    if (index + 1 < total) {
      setIndex((i) => i + 1);
      setSelected(null);
      setAnswered(false);
      return;
    }
    setSubmitting(true);
    try {
      const r = await finishQuiz('weak_topics', null, answers);
      setResult(r);
      setPhase('result');
      checkAndAwardBadges()
        .then((earned) => {
          if (earned.length > 0) setUnlockQueue((q) => [...q, ...earned]);
        })
        .catch(() => {});
    } catch {
      setPhase('error');
    } finally {
      setSubmitting(false);
    }
  };

  const onContinue = async () => {
    if (localHearts <= 0) {
      setPhase('hearts-empty');
      router.push({ pathname: '/odeme', params: { product: 'hearts_refill' } } as never);
      return;
    }
    await advance(localHearts);
  };

  const goToDeneme = () => router.replace('/deneme' as never);

  if (phase === 'loading') {
    return (
      <View style={styles.centerDark}>
        <ActivityIndicator size="large" color={AtlasColors.white} />
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.centerDark}>
        <Text style={styles.errorText}>Yüklenemedi — internetini kontrol et.</Text>
        <Btn3D variant="ghost" onPress={goToDeneme}>
          Geri Dön
        </Btn3D>
      </View>
    );
  }

  if (phase === 'hearts-empty') {
    return (
      <HeartsEmptyCard
        title="Canın Bitti!"
        message={'Pratiği tamamlayacak canın kalmadı.\nBiraz bekleyip yenilenmesini bekle ya da satın al.'}
        onHeartsAvailable={(h) => advance(h)}>
        <Btn3D variant="blue" onPress={goToDeneme}>
          Geri Dön
        </Btn3D>
      </HeartsEmptyCard>
    );
  }

  if (phase === 'result' && result) {
    const perfect = correctCount === total;
    const goodRun = correctCount >= total - 1;
    const heartsLeft = result.hearts_left;

    // Bu pratikte yanlış cevaplanan sorular ders → konu başlığı gruplaması
    const bySubject = new Map<string, Set<string>>();
    questions.forEach((q, i) => {
      const a = answers[i];
      if (!a || a.correct) return;
      const subject = q.subject_name ?? 'Diğer';
      if (!bySubject.has(subject)) bySubject.set(subject, new Set());
      if (q.topic_title) bySubject.get(subject)!.add(q.topic_title);
    });

    return (
      <View style={styles.resultBg}>
        <Confetti fire={goodRun} />
        <SafeAreaView style={styles.centerSafe}>
          <ScrollView contentContainerStyle={styles.centerContent}>
            <Image
              source={
                goodRun
                  ? require('@/assets/images/atlas/mascot-happy.png')
                  : require('@/assets/images/atlas/mascot-wave.png')
              }
              style={styles.mascotBig}
              contentFit="contain"
            />
            <Text style={styles.resultTitle}>{perfect ? 'Kusursuz Pratik!' : goodRun ? 'Harika iş!' : 'Bitirdin!'}</Text>
            <Text style={styles.resultSub}>Hedefli pratik quiz tamamlandı!</Text>

            <View style={styles.statGrid}>
              <StatBox emoji="🎯" value={`${correctCount}/${total}`} label="DOĞRU" color={AtlasColors.greenDark} />
              <StatBox emoji="❌" value={`${wrongCount}`} label="YANLIŞ" color={AtlasColors.red} />
              <StatBox emoji="❤️" value={`${heartsLeft}/5`} label="CAN" color={AtlasColors.red} />
              <StatBox emoji="💫" value={`+${result.xp_earned} XP`} label="KAZANILAN" color={AtlasColors.blue} />
            </View>

            {bySubject.size > 0 && (
              <View style={styles.recoBox}>
                <Text style={styles.recoTitle}>📚 Bunlara Çalışmalısın</Text>
                {Array.from(bySubject.entries()).map(([subject, topics]) => (
                  <View key={subject} style={styles.recoRow}>
                    <Text style={styles.recoSubject}>{subject}</Text>
                    <Text style={styles.recoTopics}>{Array.from(topics).join(', ')}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.btnStack}>
              {bySubject.size > 0 && (
                <Btn3D variant="yellow" onPress={loadQuestions}>
                  🔁 Tekrar Pratik Yap
                </Btn3D>
              )}
              <Btn3D variant="blue" onPress={goToDeneme}>
                Deneme Sekmesine Dön
              </Btn3D>
            </View>
          </ScrollView>
        </SafeAreaView>
        <BadgeUnlockPopup badge={unlockQueue[0] ?? null} onClose={() => setUnlockQueue((q) => q.slice(1))} />
      </View>
    );
  }

  if (!question) return null;

  const good = answered && selected === question.correct_index;
  const badgeColor = question.subject_color ?? AtlasColors.purple;

  return (
    <View style={styles.quizBg}>
      <SafeAreaView style={styles.quizSafe}>
        <View style={styles.quizHead}>
          <Pressable onPress={goToDeneme} hitSlop={10}>
            <Text style={styles.closeX}>✕</Text>
          </Pressable>
          <View style={styles.quizBarWrap}>
            <ProgressBar
              progress={Math.max(0.06, index / total)}
              height={10}
              color={AtlasColors.purple}
              trackColor="rgba(255,255,255,0.15)"
            />
          </View>
          <HeartsRow hearts={localHearts} size={16} />
        </View>

        <ScrollView contentContainerStyle={styles.quizScroll}>
          {question.subject_name ? (
            <Pill color={badgeColor} textColor={AtlasColors.white}>
              {question.subject_name}
            </Pill>
          ) : null}
          <Text style={styles.qTag}>DOĞRU ŞIKKI SEÇİN</Text>
          <Text style={styles.qText}>{question.prompt}</Text>

          {question.options.map((opt, i) => {
            const isSel = selected === i;
            const isCorrectOpt = answered && i === question.correct_index;
            const isWrongSel = answered && isSel && !isCorrectOpt;
            return (
              <Pressable
                key={i}
                disabled={answered}
                onPress={() => setSelected(i)}
                style={[
                  styles.opt,
                  isSel && !answered && styles.optSel,
                  isCorrectOpt && styles.optGood,
                  isWrongSel && styles.optBad,
                ]}>
                <View style={[styles.optLetter, (isSel || isCorrectOpt) && styles.optLetterOn]}>
                  <Text style={[styles.optLetterText, (isSel || isCorrectOpt) && styles.optLetterTextOn]}>
                    {LETTERS[i]}
                  </Text>
                </View>
                <Text style={styles.optText}>{opt}</Text>
                {isCorrectOpt && <Text style={styles.optMark}>✓</Text>}
                {isWrongSel && <Text style={styles.optMark}>✗</Text>}
              </Pressable>
            );
          })}
        </ScrollView>

        {!answered && (
          <View style={styles.quizFoot}>
            <Btn3D variant="green" disabled={selected === null} onPress={checkAnswer}>
              Kontrol Et
            </Btn3D>
          </View>
        )}

        {answered && (
          <View style={[styles.feedback, good ? styles.feedbackOk : styles.feedbackNo]}>
            <MascotPop trigger={index}>
              <Image
                source={
                  good
                    ? require('@/assets/images/atlas/mascot-happy.png')
                    : require('@/assets/images/atlas/mascot-sad.png')
                }
                style={styles.fbMascot}
                contentFit="contain"
              />
            </MascotPop>
            <Text style={styles.fbHead}>{good ? '✅ Mükemmel!' : `❌ Doğru: ${LETTERS[question.correct_index]}`}</Text>
            {!good && <HeartsRow hearts={localHearts} size={16} />}
            {question.explanation && <Text style={styles.fbExp}>{question.explanation}</Text>}
            <Btn3D variant={good ? 'green' : 'red'} onPress={onContinue} disabled={submitting}>
              {submitting ? '...' : 'Devam Et'}
            </Btn3D>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function StatBox({ emoji, value, label, color }: { emoji: string; value: string; label: string; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const DARK_BG = '#141B2E';

const styles = StyleSheet.create({
  centerDark: { flex: 1, backgroundColor: DARK_BG, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { color: AtlasColors.white, fontSize: 14, textAlign: 'center', paddingHorizontal: 30, marginBottom: 6 },
  quizBg: { flex: 1, backgroundColor: DARK_BG },
  quizSafe: { flex: 1 },
  quizHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  closeX: { color: 'rgba(255,255,255,0.7)', fontSize: 20, fontFamily: AtlasFonts.heading },
  quizBarWrap: { flex: 1 },
  quizScroll: { padding: 20, paddingBottom: 40, gap: 10 },
  qTag: { color: AtlasColors.gray, fontFamily: AtlasFonts.bodyBold, fontSize: 11, letterSpacing: 0.6, marginTop: 4 },
  qText: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 21, lineHeight: 28, marginBottom: 10 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: AtlasRadius.button,
    padding: 14,
  },
  optSel: { borderColor: AtlasColors.blue, backgroundColor: 'rgba(28,176,246,0.15)' },
  optGood: { borderColor: AtlasColors.green, backgroundColor: 'rgba(88,204,2,0.18)' },
  optBad: { borderColor: AtlasColors.red, backgroundColor: 'rgba(255,75,75,0.18)' },
  optLetter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optLetterOn: { backgroundColor: AtlasColors.white, borderColor: AtlasColors.white },
  optLetterText: { color: 'rgba(255,255,255,0.7)', fontFamily: AtlasFonts.heading, fontSize: 12 },
  optLetterTextOn: { color: DARK_BG },
  optText: { color: AtlasColors.white, fontFamily: AtlasFonts.bodySemi, fontSize: 14.5, flex: 1 },
  optMark: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 16 },
  quizFoot: { padding: 16 },
  feedback: {
    padding: 20,
    paddingBottom: 28,
    gap: 8,
    alignItems: 'center',
    borderTopLeftRadius: AtlasRadius.sheet,
    borderTopRightRadius: AtlasRadius.sheet,
  },
  feedbackOk: { backgroundColor: '#0F2E0A' },
  feedbackNo: { backgroundColor: '#2E0A0A' },
  fbMascot: { width: 64, height: 64 },
  fbHead: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 18 },
  fbExp: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: AtlasFonts.bodySemi,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 6,
  },
  resultBg: { flex: 1, backgroundColor: DARK_BG },
  centerSafe: { flex: 1 },
  centerContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 24,
    gap: 10,
  },
  mascotBig: { width: 130, height: 130, marginBottom: 6 },
  resultTitle: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 26 },
  resultSub: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginVertical: 10 },
  statBox: {
    width: '45%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: AtlasRadius.card,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  statEmoji: { fontSize: 20 },
  statValue: { fontFamily: AtlasFonts.heading, fontSize: 17 },
  statLabel: { color: 'rgba(255,255,255,0.55)', fontFamily: AtlasFonts.bodyBold, fontSize: 10, letterSpacing: 0.5 },
  recoBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: AtlasRadius.card,
    padding: 14,
    gap: 8,
    marginTop: 4,
  },
  recoTitle: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 14 },
  recoRow: { gap: 2 },
  recoSubject: { color: '#ffd95e', fontFamily: AtlasFonts.bodyBold, fontSize: 12.5 },
  recoTopics: { color: 'rgba(255,255,255,0.75)', fontFamily: AtlasFonts.body, fontSize: 12, lineHeight: 17 },
  btnStack: { gap: 10, width: '100%', marginTop: 12 },
});
