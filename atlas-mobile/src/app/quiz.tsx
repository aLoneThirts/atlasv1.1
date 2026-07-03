import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3d } from '@/components/btn-3d';
import { AtlasColors, AtlasRadius } from '@/constants/atlas-theme';
import {
  fetchCurrentWeeklyExam,
  fetchProfile,
  fetchQuestionById,
  fetchQuestionsByIds,
  fetchTopicQuestions,
  finishQuiz,
} from '@/lib/queries';
import type { FinishQuizResult, Question, QuizAnswer, QuizMode } from '@/lib/types';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

const MASCOT = {
  happy: require('@/assets/images/atlas/mascot-happy.png'),
  sad: require('@/assets/images/atlas/mascot-sad.png'),
  wave: require('@/assets/images/atlas/mascot-wave.png'),
};

type Phase = 'loading' | 'question' | 'result' | 'hearts' | 'error';

/**
 * EKRAN 06/07/08 — Quiz + geri bildirim + sonuç — prototip: #scr-quiz/#scr-result/#scr-hearts
 * Can/XP/yıldız/streak SUNUCUDA hesaplanır (finish_quiz RPC) — buradaki can
 * göstergesi canlı önizlemedir; bitişte RPC sonucu esas alınır.
 */
export default function QuizScreen() {
  const params = useLocalSearchParams<{ mode?: string; topicId?: string; questionId?: string }>();
  const mode = (params.mode ?? 'topic') as QuizMode;

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [hearts, setHearts] = useState(5);
  const [premium, setPremium] = useState(false);
  const [result, setResult] = useState<FinishQuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const profile = await fetchProfile();
        setPremium(profile.is_premium);
        setHearts(profile.hearts);

        let qs: Question[] = [];
        if (mode === 'topic' && params.topicId) {
          qs = await fetchTopicQuestions(params.topicId);
        } else if (mode === 'single' && params.questionId) {
          const q = await fetchQuestionById(params.questionId);
          qs = q ? [q] : [];
        } else if (mode === 'weekly') {
          const exam = await fetchCurrentWeeklyExam();
          qs = exam ? await fetchQuestionsByIds(exam.question_ids) : [];
        }

        if (qs.length === 0) {
          setLoadError('Bu quiz için soru bulunamadı.');
          setPhase('error');
          return;
        }
        if (!profile.is_premium && profile.hearts === 0) {
          setPhase('hearts');
          return;
        }
        setQuestions(qs);
        setPhase('question');
      } catch {
        setLoadError('Sorular yüklenemedi — bağlantını kontrol et.');
        setPhase('error');
      }
    })();
    // params expo-router'da her render'da yeni obje — sadece ilk yüklemede koş
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = questions[i];
  const total = questions.length;
  const correctCount = answers.filter((a) => a.correct).length;

  const check = () => {
    if (selected === null || answered || !q) return;
    const good = selected === q.correct_index;
    setAnswers((prev) => [...prev, { question_id: q.id, selected_index: selected, correct: good }]);
    if (!good && !premium) setHearts((h) => Math.max(0, h - 1));
    setAnswered(true);
  };

  const submit = async (finalAnswers: QuizAnswer[], outOfHearts: boolean) => {
    setSubmitting(true);
    try {
      const res = await finishQuiz(mode, params.topicId ?? null, finalAnswers);
      setResult(res);
      setPhase(outOfHearts ? 'hearts' : 'result');
    } catch {
      setLoadError('Sonuç kaydedilemedi — tekrar dene.');
      setPhase('error');
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (submitting) return;
    const outOfHearts = !premium && hearts === 0;
    if (i + 1 < total && !outOfHearts) {
      setI(i + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      // son soru YA DA can bitti: o ana kadarki cevaplar sunucuya işlenir
      submit(answers, outOfHearts && i + 1 < total);
    }
  };

  const quit = () => {
    Alert.alert('Quizden çık?', 'İlerlemen kaydedilmeden çıkılacak.', [
      { text: 'Devam Et', style: 'cancel' },
      { text: 'Çık', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  /* ---------------- görünümler ---------------- */

  if (phase === 'loading') {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.centerEmoji}>⚔️</Text>
        <Text style={styles.centerText}>Sefer hazırlanıyor...</Text>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.centerEmoji}>🛠️</Text>
        <Text style={styles.centerText}>{loadError}</Text>
        <View style={styles.centerBtn}>
          {answers.length > 0 && (
            <Btn3d label="Tekrar Dene" onPress={() => submit(answers, false)} disabled={submitting} />
          )}
          <Btn3d
            label="Geri Dön"
            color={AtlasColors.card}
            colorDark={AtlasColors.line}
            textColor={AtlasColors.ink}
            onPress={() => router.back()}
          />
        </View>
      </View>
    );
  }

  if (phase === 'hearts') {
    return (
      <View style={[styles.centerBox, styles.heartsBox]}>
        <Text style={styles.centerEmoji}>💔</Text>
        <Text style={styles.heartsTitle}>Canın Bitti!</Text>
        <Text style={styles.heartsSub}>
          Biraz dinlen, canların yenilensin.{'\n'}Premium&apos;da canlar sınırsız — mola yok, fetih var. ⚔️
        </Text>
        <View style={styles.centerBtn}>
          <Btn3d label="Geri Dön" color={AtlasColors.red} colorDark={AtlasColors.redDark} onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  if (phase === 'result' && result) {
    const perfect = correctCount === total;
    const goodRun = correctCount >= total - 1;
    return (
      <View style={styles.centerBox}>
        <Image source={goodRun ? MASCOT.happy : MASCOT.wave} style={styles.resMascot} contentFit="contain" />
        <Text style={styles.resTitle}>
          {perfect ? 'Kusursuz Fetih!' : goodRun ? 'Harika iş!' : 'Bitirdin!'}
        </Text>
        {mode === 'topic' && result.stars != null && (
          <Text style={styles.resStars}>{'⭐'.repeat(result.stars)}</Text>
        )}
        <Text style={styles.resSub}>
          {mode === 'topic'
            ? 'Konu fethedildi — sıradaki konunun kilidi açıldı!'
            : mode === 'weekly'
              ? 'Haftalık sınav tamamlandı — doğruların yanlış havuzundan silindi.'
              : correctCount === total
                ? 'Yanlış temizlendi! 🧹'
                : 'Bu soru listende kalmaya devam edecek.'}
        </Text>
        <View style={styles.resGrid}>
          <ResStat label="Doğru" value={`${correctCount}/${total}`} />
          <ResStat label="XP" value={`+${result.xp_earned}`} />
          <ResStat label="Can" value={premium ? '∞' : `${result.hearts_left}/5`} />
          <ResStat label="Seri" value={`🔥${result.streak_count}`} />
        </View>
        <View style={styles.centerBtn}>
          <Btn3d label={mode === 'topic' ? 'Kaleye Dön' : 'Devam'} onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  if (!q) return null;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* üst bar */}
        <View style={styles.topBar}>
          <Pressable onPress={quit} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
          <View style={styles.track}>
            <View
              style={[
                styles.bar,
                { width: `${Math.max(6, Math.round((i / total) * 100))}%` },
                mode === 'weekly' && { backgroundColor: AtlasColors.purple },
              ]}
            />
          </View>
          <Text style={styles.heartsText}>{premium ? '❤️∞' : `❤️${hearts}`}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {q.subject_name && (
            <View style={[styles.dersBadge, { backgroundColor: q.subject_color ?? AtlasColors.blue }]}>
              <Text style={styles.dersBadgeText}>{q.subject_name.toLocaleUpperCase('tr')}</Text>
            </View>
          )}
          <Text style={styles.prompt}>{q.prompt}</Text>

          <View style={styles.opts}>
            {q.options.map((opt, idx) => {
              const isSel = selected === idx;
              const showGood = answered && idx === q.correct_index;
              const showBad = answered && isSel && idx !== q.correct_index;
              return (
                <Pressable
                  key={idx}
                  disabled={answered}
                  onPress={() => setSelected(idx)}
                  style={[
                    styles.opt,
                    isSel && !answered && styles.optSel,
                    showGood && styles.optGood,
                    showBad && styles.optBad,
                  ]}>
                  <View
                    style={[
                      styles.optLetter,
                      isSel && !answered && { backgroundColor: AtlasColors.blue },
                      showGood && { backgroundColor: AtlasColors.green },
                      showBad && { backgroundColor: AtlasColors.red },
                    ]}>
                    <Text style={styles.optLetterText}>{LETTERS[idx]}</Text>
                  </View>
                  <Text style={styles.optText}>{opt}</Text>
                  {showGood && <Text style={styles.mark}>✓</Text>}
                  {showBad && <Text style={styles.mark}>✗</Text>}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* alt: kontrol / geri bildirim */}
        {!answered ? (
          <View style={styles.foot}>
            <Btn3d label="Kontrol Et" onPress={check} disabled={selected === null} />
          </View>
        ) : (
          <View
            style={[
              styles.feedback,
              selected === q.correct_index ? styles.fbOk : styles.fbNo,
            ]}>
            <View style={styles.fbHead}>
              <Image
                source={selected === q.correct_index ? MASCOT.happy : MASCOT.sad}
                style={styles.fbMascot}
                contentFit="contain"
              />
              <Text
                style={[
                  styles.fbTitle,
                  { color: selected === q.correct_index ? AtlasColors.greenDark : AtlasColors.redDark },
                ]}>
                {selected === q.correct_index
                  ? '✅ Mükemmel!'
                  : `❌ Doğru: ${LETTERS[q.correct_index]}`}
              </Text>
            </View>
            {!!q.explanation && <Text style={styles.fbExp}>{q.explanation}</Text>}
            <Btn3d
              label={submitting ? 'Kaydediliyor...' : i + 1 < total ? 'Devam' : 'Bitir'}
              color={selected === q.correct_index ? AtlasColors.green : AtlasColors.red}
              colorDark={selected === q.correct_index ? AtlasColors.greenShadow : AtlasColors.redDark}
              onPress={next}
              disabled={submitting}
            />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function ResStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.resStat}>
      <Text style={styles.resStatValue}>{value}</Text>
      <Text style={styles.resStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AtlasColors.white },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  close: { fontSize: 20, color: AtlasColors.gray, fontWeight: '900' },
  track: { flex: 1, height: 12, borderRadius: 6, backgroundColor: AtlasColors.card, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 6, backgroundColor: AtlasColors.green },
  heartsText: { fontSize: 14, fontWeight: '900', color: AtlasColors.red },
  body: { paddingHorizontal: 18, paddingBottom: 20 },
  dersBadge: {
    alignSelf: 'flex-start',
    borderRadius: AtlasRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
    marginBottom: 8,
  },
  dersBadgeText: { color: AtlasColors.white, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  prompt: {
    fontSize: 17.5,
    lineHeight: 25,
    fontWeight: '800',
    color: AtlasColors.inkStrong,
    marginTop: 6,
    marginBottom: 16,
  },
  opts: { gap: 9 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 2,
    borderColor: AtlasColors.line,
    borderRadius: AtlasRadius.button,
    padding: 12,
    backgroundColor: AtlasColors.white,
  },
  optSel: { borderColor: AtlasColors.blue, backgroundColor: AtlasColors.blueLight },
  optGood: { borderColor: AtlasColors.green, backgroundColor: AtlasColors.greenLight },
  optBad: { borderColor: AtlasColors.red, backgroundColor: AtlasColors.redLight },
  optLetter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: AtlasColors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optLetterText: { color: AtlasColors.white, fontSize: 13, fontWeight: '900' },
  optText: { flex: 1, fontSize: 14, fontWeight: '600', color: AtlasColors.ink, lineHeight: 20 },
  mark: { fontSize: 16, fontWeight: '900', color: AtlasColors.ink },
  foot: { paddingHorizontal: 18, paddingBottom: 14 },
  feedback: {
    borderTopLeftRadius: AtlasRadius.sheet,
    borderTopRightRadius: AtlasRadius.sheet,
    padding: 18,
    paddingBottom: 22,
    gap: 10,
  },
  fbOk: { backgroundColor: AtlasColors.greenLight },
  fbNo: { backgroundColor: AtlasColors.redLight },
  fbHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fbMascot: { width: 44, height: 44 },
  fbTitle: { fontSize: 18, fontWeight: '900', flex: 1 },
  fbExp: { fontSize: 13, lineHeight: 19, color: AtlasColors.ink, fontWeight: '500' },
  centerBox: {
    flex: 1,
    backgroundColor: AtlasColors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 10,
  },
  centerEmoji: { fontSize: 44 },
  centerText: { fontSize: 15, fontWeight: '700', color: AtlasColors.ink, textAlign: 'center' },
  centerBtn: { alignSelf: 'stretch', marginTop: 14, gap: 10 },
  heartsBox: { backgroundColor: '#2A0505' },
  heartsTitle: { color: AtlasColors.white, fontSize: 26, fontWeight: '900' },
  heartsSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
  resMascot: { width: 130, height: 130 },
  resTitle: { fontSize: 26, fontWeight: '900', color: AtlasColors.inkStrong },
  resStars: { fontSize: 30, letterSpacing: 4 },
  resSub: { fontSize: 13, color: AtlasColors.gray, fontWeight: '600', textAlign: 'center' },
  resGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  resStat: {
    flex: 1,
    backgroundColor: AtlasColors.card,
    borderRadius: AtlasRadius.card,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 2,
  },
  resStatValue: { fontSize: 16, fontWeight: '900', color: AtlasColors.inkStrong },
  resStatLabel: { fontSize: 10, fontWeight: '700', color: AtlasColors.gray },
});
