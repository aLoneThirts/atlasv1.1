import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { Confetti } from '@/components/ui/animated/confetti';
import { MascotPop } from '@/components/ui/animated/mascot-pop';
import { HeartsRow } from '@/components/ui/hearts-row';
import { Pill } from '@/components/ui/pill';
import { AtlasColors, AtlasFonts, AtlasRadius } from '@/constants/atlas-theme';
import { fetchProfile, fetchQuestionById, finishQuiz } from '@/lib/queries';
import type { FinishQuizResult, Question } from '@/lib/types';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

type Phase = 'loading' | 'quiz' | 'result' | 'error';

/**
 * Tek yanlış düzeltme — tek soru. finishQuiz('single', null, [answer]).
 * Doğru cevapta ilgili mistakes satırı sunucuda otomatik çözülür.
 * Tek soru olduğu için can-bitti kesintisi yok.
 */
export default function SingleQuizScreen() {
  const { questionId } = useLocalSearchParams<{ questionId: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [question, setQuestion] = useState<Question | null>(null);
  const [startHearts, setStartHearts] = useState(5);

  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<FinishQuizResult | null>(null);

  useEffect(() => {
    if (!questionId) return;
    (async () => {
      try {
        const [q, profile] = await Promise.all([fetchQuestionById(questionId), fetchProfile()]);
        if (!q) {
          setPhase('error');
          return;
        }
        setQuestion(q);
        setStartHearts(profile.hearts);
        setPhase('quiz');
      } catch {
        setPhase('error');
      }
    })();
  }, [questionId]);

  const checkAnswer = () => {
    if (selected === null || answered || !question) return;
    setAnswered(true);
  };

  const onContinue = async () => {
    if (!question || selected === null) return;
    const good = selected === question.correct_index;
    setSubmitting(true);
    try {
      const r = await finishQuiz('single', null, [
        { question_id: question.id, selected_index: selected, correct: good },
      ]);
      setResult(r);
      setPhase('result');
    } catch {
      setPhase('error');
    } finally {
      setSubmitting(false);
    }
  };

  const toMistakes = () => router.replace('/yanlislar' as never);

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

  if (phase === 'result' && result && question) {
    const correct = selected === question.correct_index;
    const heartsLeft = result.hearts_left;
    return (
      <View style={styles.resultBg}>
        <Confetti fire={correct} />
        <SafeAreaView style={styles.centerSafe}>
        <ScrollView contentContainerStyle={styles.centerContent}>
          <Image
            source={correct ? require('@/assets/images/atlas/mascot-happy.png') : require('@/assets/images/atlas/mascot-sad.png')}
            style={styles.mascotBig}
            contentFit="contain"
          />
          <Text style={styles.resultTitle}>{correct ? 'Doğru!' : 'Olmadı!'}</Text>
          <Text style={styles.resultSub}>
            {correct ? 'Yanlış temizlendi! 🧹' : 'Bu soru listende kalmaya devam edecek.'}
          </Text>

          <View style={styles.statGrid}>
            <StatBox emoji="🎯" value={correct ? '1/1' : '0/1'} label="DOĞRU" color={AtlasColors.greenDark} />
            <StatBox emoji="❌" value={correct ? '0' : '1'} label="YANLIŞ" color={AtlasColors.red} />
            <StatBox emoji="❤️" value={`${heartsLeft}/5`} label="CAN" color={AtlasColors.red} />
            <StatBox emoji="💫" value={`+${result.xp_earned} XP`} label="KAZANILAN" color={AtlasColors.blue} />
          </View>

          <View style={styles.btnStack}>
            <Btn3D variant="blue" onPress={toMistakes}>
              Yanlışlara Dön
            </Btn3D>
          </View>
        </ScrollView>
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
          <Text style={styles.headLabel}>Yanlışını Düzelt</Text>
          <HeartsRow hearts={startHearts} size={16} />
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
            <MascotPop trigger={answered ? 1 : 0}>
              <Image
                source={good ? require('@/assets/images/atlas/mascot-happy.png') : require('@/assets/images/atlas/mascot-sad.png')}
                style={styles.fbMascot}
                contentFit="contain"
              />
            </MascotPop>
            <Text style={styles.fbHead}>{good ? '✅ Mükemmel!' : `❌ Doğru: ${LETTERS[question.correct_index]}`}</Text>
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
  quizHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  closeX: { color: 'rgba(255,255,255,0.7)', fontSize: 20, fontFamily: AtlasFonts.heading },
  headLabel: { color: 'rgba(255,255,255,0.85)', fontFamily: AtlasFonts.heading, fontSize: 14 },
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
  resultBg: { flex: 1, backgroundColor: DARK_BG },
  centerSafe: { flex: 1 },
  centerContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingVertical: 24, gap: 10 },
  mascotBig: { width: 130, height: 130, marginBottom: 6 },
  resultTitle: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 26 },
  resultSub: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 8, textAlign: 'center', paddingHorizontal: 10 },
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
