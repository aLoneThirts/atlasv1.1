import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BadgeUnlockPopup } from '@/components/badges/badge-unlock-popup';
import { Btn3D } from '@/components/ui/btn-3d';
import { Confetti } from '@/components/ui/animated/confetti';
import { HeartsEmptyCard } from '@/components/hearts/hearts-empty-card';
import { MascotPop } from '@/components/ui/animated/mascot-pop';
import { HeartsRow } from '@/components/ui/hearts-row';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AtlasColors, AtlasFonts, AtlasRadius } from '@/constants/atlas-theme';
import { safeGoBack } from '@/lib/navigation';
import { checkAndAwardBadges, finishQuiz, fetchTopicQuestions, getHearts, loseHeart } from '@/lib/queries';
import type { Badge, FinishQuizResult, Question, QuizAnswer } from '@/lib/types';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

type Phase = 'loading' | 'quiz' | 'hearts-empty' | 'result' | 'error';

/**
 * EKRAN 06/07/08 — Quiz + Canın Bitti + Sonuç, tek ekranda faz makinesi.
 * Prototip: ../../../../index.html #scr-quiz / #scr-hearts / #scr-result
 */
export default function QuizScreen() {
  const { subjectId, topicId } = useLocalSearchParams<{
    subjectId: string;
    topicId: string;
    topicTitle?: string;
  }>();
  const router = useRouter();

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

  useEffect(() => {
    if (!topicId) return;
    (async () => {
      try {
        const [qs, hearts] = await Promise.all([fetchTopicQuestions(topicId, 5), getHearts()]);
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
    })();
  }, [topicId]);

  const question = questions[index];
  const total = questions.length;

  // Yanlış cevapta can ANINDA (quiz bitmeden) düşer — sunucudan dönen gerçek
  // değeri kullanır, kayıp quiz yarıda bırakılsa bile kalıcıdır (BACKEND.md §4.1).
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

  // Sıradaki soruya geç ya da (son soruysa) quiz'i bitir — hem normal "Devam
  // Et" akışından hem can-bitti ekranından (can yenilenince/satın alınınca) çağrılır.
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
      const r = await finishQuiz('topic', topicId!, answers);
      setResult(r);
      setPhase('result');
      // Rozet kontrolü — kalıcı akışı bloklamasın diye sonucu beklemiyoruz
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
      // Canın bittiği an direkt satın alma ekranına yönlendir — ekstra bir
      // buton beklemeden (BACKEND.md §4.1).
      router.push({ pathname: '/odeme', params: { product: 'hearts_refill' } } as never);
      return;
    }
    await advance(localHearts);
  };

  const quit = () => safeGoBack(router, '/harita');

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
        <Text style={styles.errorText}>Bir şeyler ters gitti — internetini kontrol edip tekrar dene.</Text>
        <Btn3D variant="ghost" onPress={quit}>
          Geri Dön
        </Btn3D>
      </View>
    );
  }

  if (phase === 'hearts-empty') {
    return (
      <HeartsEmptyCard
        title="Canın Bitti!"
        message={'Kaleyi savunacak askerin kalmadı.\nBiraz bekleyip yenilenmesini bekle ya da satın al.'}
        onHeartsAvailable={(h) => advance(h)}>
        <Btn3D variant="orange" onPress={() => router.replace({ pathname: '/kale/[subjectId]', params: { subjectId: subjectId! } } as never)}>
          Kaleye Geri Dön
        </Btn3D>
      </HeartsEmptyCard>
    );
  }

  if (phase === 'result' && result) {
    const perfect = correctCount === total;
    const goodRun = correctCount >= total - 1;
    const heartsLeft = result.hearts_left;
    return (
      <View style={styles.resultBg}>
        <Confetti fire={goodRun} />
        <SafeAreaView style={styles.centerSafe}>
        <ScrollView contentContainerStyle={styles.centerContent}>
          <Image
            source={goodRun ? require('@/assets/images/atlas/mascot-happy.png') : require('@/assets/images/atlas/mascot-wave.png')}
            style={styles.mascotBig}
            contentFit="contain"
          />
          <Text style={styles.resultTitle}>{perfect ? 'Kusursuz Fetih!' : goodRun ? 'Harika iş!' : 'Bitirdin!'}</Text>
          <Text style={styles.resultSub}>Konu fethedildi — kale güçlendi!</Text>

          <View style={styles.statGrid}>
            <StatBox emoji="🎯" value={`${correctCount}/${total}`} label="DOĞRU" color={AtlasColors.greenDark} />
            <StatBox emoji="❌" value={`${wrongCount}`} label="YANLIŞ" color={AtlasColors.red} />
            <StatBox emoji="❤️" value={`${heartsLeft}/5`} label="CAN" color={AtlasColors.red} />
            <StatBox emoji="💫" value={`+${result.xp_earned} XP`} label="KAZANILAN" color={AtlasColors.blue} />
          </View>

          <View style={styles.btnStack}>
            {wrongCount > 0 && (
              <Btn3D variant="blue" onPress={() => router.replace('/yanlislar' as never)}>
                Yanlışlarımı Gör
              </Btn3D>
            )}
            <Btn3D
              variant="green"
              onPress={() => router.replace({ pathname: '/kale/[subjectId]', params: { subjectId: subjectId! } } as never)}>
              Kaleye Dön
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

  return (
    <View style={styles.quizBg}>
      <SafeAreaView style={styles.quizSafe}>
        <View style={styles.quizHead}>
          <Pressable onPress={quit} hitSlop={10}>
            <Text style={styles.closeX}>✕</Text>
          </Pressable>
          <View style={styles.quizBarWrap}>
            <ProgressBar progress={Math.max(0.06, index / total)} height={10} color={AtlasColors.green} trackColor="rgba(255,255,255,0.15)" />
          </View>
          <HeartsRow hearts={localHearts} size={16} />
        </View>

        <ScrollView contentContainerStyle={styles.quizScroll}>
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
                  <Text style={[styles.optLetterText, (isSel || isCorrectOpt) && styles.optLetterTextOn]}>{LETTERS[i]}</Text>
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
                source={good ? require('@/assets/images/atlas/mascot-happy.png') : require('@/assets/images/atlas/mascot-sad.png')}
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
  quizHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  closeX: { color: 'rgba(255,255,255,0.7)', fontSize: 20, fontFamily: AtlasFonts.heading },
  quizBarWrap: { flex: 1 },
  quizScroll: { padding: 20, paddingBottom: 40, gap: 10 },
  qTag: { color: AtlasColors.gray, fontFamily: AtlasFonts.bodyBold, fontSize: 11, letterSpacing: 0.6 },
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
  fbExp: { color: 'rgba(255,255,255,0.75)', fontFamily: AtlasFonts.bodySemi, fontSize: 13, textAlign: 'center', marginBottom: 6 },
  resultBg: { flex: 1, backgroundColor: DARK_BG },
  centerSafe: { flex: 1 },
  centerContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingVertical: 24, gap: 10 },
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
  btnStack: { gap: 10, width: '100%', marginTop: 12 },
});
