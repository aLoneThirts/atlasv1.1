import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { Confetti } from '@/components/ui/animated/confetti';
import { MascotPop } from '@/components/ui/animated/mascot-pop';
import { HeartsRow } from '@/components/ui/hearts-row';
import { Pill } from '@/components/ui/pill';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AtlasColors, AtlasFonts, AtlasRadius } from '@/constants/atlas-theme';
import { fetchCurrentWeeklyExam, fetchProfile, fetchQuestionsByIds, finishQuiz } from '@/lib/queries';
import { buyHeartRefill } from '@/lib/purchases';
import type { FinishQuizResult, Question, QuizAnswer } from '@/lib/types';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

type Phase = 'loading' | 'quiz' | 'hearts-empty' | 'result' | 'error';

/**
 * Haftalık Mini Sınav quiz + sonuç — kale konu quiz'inin (../kale/[subjectId]/quiz.tsx)
 * faz makinesini yansıtır, farkı: sorular weekly_exams'ten gelir, sorular çok dersli
 * (her soruda ders rozeti) ve finishQuiz('weekly', ...) çağrılır.
 */
export default function WeeklyQuizScreen() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [startHearts, setStartHearts] = useState(5);
  const [localHearts, setLocalHearts] = useState(5);
  const [buyingHearts, setBuyingHearts] = useState(false);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<FinishQuizResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [exam, profile] = await Promise.all([fetchCurrentWeeklyExam(), fetchProfile()]);
        if (!exam || exam.question_ids.length === 0) {
          setPhase('error');
          return;
        }
        const qs = await fetchQuestionsByIds(exam.question_ids);
        if (qs.length === 0) {
          setPhase('error');
          return;
        }
        setQuestions(qs);
        setStartHearts(profile.hearts);
        setLocalHearts(profile.hearts);
        setPhase('quiz');
      } catch {
        setPhase('error');
      }
    })();
  }, []);

  const resetRun = () => {
    setIndex(0);
    setSelected(null);
    setAnswered(false);
    setCorrectCount(0);
    setWrongCount(0);
    setAnswers([]);
    setLocalHearts(startHearts);
    setPhase('quiz');
  };

  const question = questions[index];
  const total = questions.length;

  const checkAnswer = () => {
    if (selected === null || answered || !question) return;
    setAnswered(true);
    const good = selected === question.correct_index;
    setAnswers((prev) => [...prev, { question_id: question.id, selected_index: selected, correct: good }]);
    if (good) {
      setCorrectCount((c) => c + 1);
    } else {
      setWrongCount((w) => w + 1);
      setLocalHearts((h) => Math.max(0, h - 1));
    }
  };

  const onContinue = async () => {
    if (localHearts <= 0) {
      setPhase('hearts-empty');
      return;
    }
    if (index + 1 < total) {
      setIndex((i) => i + 1);
      setSelected(null);
      setAnswered(false);
      return;
    }
    setSubmitting(true);
    try {
      const r = await finishQuiz('weekly', null, answers);
      setResult(r);
      setPhase('result');
    } catch {
      setPhase('error');
    } finally {
      setSubmitting(false);
    }
  };

  const toMistakes = () => router.replace('/yanlislar' as never);

  const buyHearts = () => {
    Alert.alert(
      '🚧 Test modu',
      'Gerçek ödeme entegrasyonu henüz yok — mağaza hesapları hazır olunca gerçek satın almaya bağlanacak. Şimdilik canını hemen dolduralım mı?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Canı Doldur',
          onPress: async () => {
            setBuyingHearts(true);
            const res = await buyHeartRefill();
            setBuyingHearts(false);
            if (res.ok) {
              setStartHearts(res.hearts);
              setLocalHearts(res.hearts);
              setPhase('quiz');
            } else {
              Alert.alert('Olmadı', res.error);
            }
          },
        },
      ],
    );
  };

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
        <Btn3D variant="ghost" onPress={toMistakes}>
          Yanlışlara Dön
        </Btn3D>
      </View>
    );
  }

  if (phase === 'hearts-empty') {
    return (
      <View style={styles.heartsEmptyBg}>
        <SafeAreaView style={styles.centerContent}>
          <Image source={require('@/assets/images/atlas/mascot-sad.png')} style={styles.mascotBig} contentFit="contain" />
          <Text style={styles.heartsTitle}>Canın Bitti!</Text>
          <Text style={styles.heartsBody}>
            Sınavı tamamlayacak canın kalmadı.{'\n'}Biraz dinlen, sonra tekrar dene!
          </Text>
          <View style={styles.btnStack}>
            <Btn3D variant="yellow" onPress={buyHearts} disabled={buyingHearts}>
              {buyingHearts ? '...' : '❤️ Can Satın Al'}
            </Btn3D>
            <Btn3D variant="blue" onPress={toMistakes}>
              Yanlışlara Dön
            </Btn3D>
            <Btn3D variant="ghost" onPress={resetRun}>
              Yeniden Dene
            </Btn3D>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'result' && result) {
    const perfect = correctCount === total;
    const goodRun = correctCount >= total - 1;
    const heartsLeft = result.hearts_left;
    return (
      <View style={styles.resultBg}>
        <Confetti fire={goodRun} />
        <SafeAreaView style={styles.centerContent}>
          <Image
            source={goodRun ? require('@/assets/images/atlas/mascot-happy.png') : require('@/assets/images/atlas/mascot-wave.png')}
            style={styles.mascotBig}
            contentFit="contain"
          />
          <Text style={styles.resultTitle}>{perfect ? 'Kusursuz Fetih!' : goodRun ? 'Harika iş!' : 'Bitirdin!'}</Text>
          <Text style={styles.resultSub}>Haftalık sınav tamamlandı!</Text>

          <View style={styles.statGrid}>
            <StatBox emoji="🎯" value={`${correctCount}/${total}`} label="DOĞRU" color={AtlasColors.greenDark} />
            <StatBox emoji="❌" value={`${wrongCount}`} label="YANLIŞ" color={AtlasColors.red} />
            <StatBox emoji="❤️" value={`${heartsLeft}/5`} label="CAN" color={AtlasColors.red} />
            <StatBox emoji="💫" value={`+${result.xp_earned} XP`} label="KAZANILAN" color={AtlasColors.blue} />
          </View>

          <View style={styles.btnStack}>
            <Btn3D variant="blue" onPress={toMistakes}>
              Yanlışlara Dön
            </Btn3D>
          </View>
        </SafeAreaView>
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
          <Pressable onPress={toMistakes} hitSlop={10}>
            <Text style={styles.closeX}>✕</Text>
          </Pressable>
          <View style={styles.quizBarWrap}>
            <ProgressBar progress={Math.max(0.06, index / total)} height={10} color={AtlasColors.purple} trackColor="rgba(255,255,255,0.15)" />
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
  fbExp: { color: 'rgba(255,255,255,0.75)', fontFamily: AtlasFonts.bodySemi, fontSize: 13, textAlign: 'center', marginBottom: 6 },
  heartsEmptyBg: { flex: 1, backgroundColor: '#1A0000' },
  resultBg: { flex: 1, backgroundColor: DARK_BG },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 10 },
  mascotBig: { width: 130, height: 130, marginBottom: 6 },
  heartsTitle: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 26 },
  heartsBody: { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 10 },
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
