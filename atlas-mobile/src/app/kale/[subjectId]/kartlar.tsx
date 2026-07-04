import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Confetti } from '@/components/ui/animated/confetti';
import { MascotPop } from '@/components/ui/animated/mascot-pop';
import { Btn3D } from '@/components/ui/btn-3d';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AtlasColors, AtlasFonts, AtlasRadius } from '@/constants/atlas-theme';
import { checkFlashcardAnswer, fetchFlashcardsByTopic, finishQuiz } from '@/lib/queries';
import type { Flashcard, QuizAnswer } from '@/lib/types';

type Phase = 'loading' | 'empty' | 'cards' | 'done' | 'error';

/**
 * EKRAN — Bilgi Kartları: tamamlanmış konular için yazılı-cevap tekrar aracı.
 * Sadece status==='done' konularda açılır; ilerlemeyi/canı etkilemez, XP verir.
 */
export default function FlashcardsScreen() {
  const { subjectId, topicId } = useLocalSearchParams<{
    subjectId: string;
    topicId: string;
    topicTitle?: string;
  }>();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [deck, setDeck] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [input, setInput] = useState('');
  const [warn, setWarn] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [ok, setOk] = useState(0);
  const [no, setNo] = useState(0);
  const [saveError, setSaveError] = useState(false);

  const answersRef = useRef<QuizAnswer[]>([]);

  // kart geçişi için hafif cross-fade + scale
  const anim = useSharedValue(1);

  useEffect(() => {
    if (!topicId) return;
    (async () => {
      try {
        const cards = await fetchFlashcardsByTopic(topicId);
        if (cards.length === 0) {
          setPhase('empty');
          return;
        }
        setDeck(cards);
        setPhase('cards');
      } catch {
        setPhase('error');
      }
    })();
  }, [topicId]);

  // her kart değişiminde giriş animasyonunu yeniden tetikle
  useEffect(() => {
    if (phase !== 'cards') return;
    anim.value = 0;
    anim.value = withTiming(1, { duration: 260 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ scale: 0.96 + anim.value * 0.04 }],
  }));

  const card = deck[index];
  const total = deck.length;

  const onCheck = () => {
    if (flipped || !card) return;
    if (input.trim().length === 0) {
      setWarn(true);
      return;
    }
    setWarn(false);
    const correct = checkFlashcardAnswer(input, card.accepted_answers);
    setLastCorrect(correct);
    answersRef.current.push({ question_id: card.id, selected_index: 0, correct });
    if (correct) setOk((c) => c + 1);
    else setNo((c) => c + 1);
    setFlipped(true);
  };

  const onNext = async () => {
    if (index + 1 < total) {
      setIndex((i) => i + 1);
      setFlipped(false);
      setInput('');
      setWarn(false);
      return;
    }
    // deste bitti — sunucuya bir kez gönder, sonuç ekranını göster
    setPhase('done');
    try {
      await finishQuiz('flashcards', topicId!, answersRef.current);
    } catch {
      setSaveError(true);
    }
  };

  const goBack = () => router.back();

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
        <Btn3D variant="ghost" onPress={goBack}>
          Geri Dön
        </Btn3D>
      </View>
    );
  }

  if (phase === 'empty') {
    return (
      <View style={styles.centerDark}>
        <Image source={require('@/assets/images/atlas/mascot-wave.png')} style={styles.mascotBig} contentFit="contain" />
        <Text style={styles.emptyText}>Bu konunun kartları henüz hazır değil 🃏</Text>
        <Btn3D variant="green" onPress={goBack}>
          Geri Dön
        </Btn3D>
      </View>
    );
  }

  if (phase === 'done') {
    const perfect = ok === total;
    return (
      <View style={styles.dark}>
        <Confetti fire={perfect} />
        <SafeAreaView style={styles.centerContent}>
          <Image
            source={
              perfect
                ? require('@/assets/images/atlas/mascot-happy.png')
                : require('@/assets/images/atlas/mascot-wave.png')
            }
            style={styles.mascotBig}
            contentFit="contain"
          />
          <Text style={styles.resultTitle}>
            {ok}/{total} Bildin!
          </Text>
          <Text style={styles.resultSub}>
            {perfect ? 'Hafızan kale duvarı gibi sağlam.' : 'Yanlışların yarın tekrar karşına çıkacak.'}
          </Text>
          {saveError && <Text style={styles.saveErrText}>Puanın kaydedilemedi ama tekrarın tamamlandı.</Text>}
          <View style={styles.btnStack}>
            <Btn3D
              variant="green"
              onPress={() =>
                router.replace({ pathname: '/kale/[subjectId]', params: { subjectId: subjectId! } } as never)
              }>
              Kaleye Dön
            </Btn3D>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!card) return null;

  return (
    <View style={styles.dark}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.head}>
          <Pressable onPress={goBack} hitSlop={10}>
            <Text style={styles.closeX}>✕</Text>
          </Pressable>
          <View style={styles.barWrap}>
            <ProgressBar
              progress={(index + 1) / total}
              height={10}
              color={AtlasColors.purple}
              trackColor="rgba(255,255,255,0.15)"
            />
          </View>
          <Text style={styles.score}>
            <Text style={styles.scoreOk}>✓ {ok}</Text>
            {'  '}
            <Text style={styles.scoreNo}>✗ {no}</Text>
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.card, cardStyle]}>
            {!flipped ? (
              <>
                <Text style={styles.tag}>SORU {index + 1}/{total}</Text>
                <Text style={styles.prompt}>{card.prompt}</Text>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={(t) => {
                    setInput(t);
                    if (warn) setWarn(false);
                  }}
                  onSubmitEditing={onCheck}
                  placeholder="Cevabını buraya yaz..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  returnKeyType="done"
                  autoCorrect={false}
                  multiline
                />
                {warn && <Text style={styles.warn}>Önce cevabını yaz ✍️</Text>}
                <View style={styles.cardBtn}>
                  <Btn3D variant="purple" size="small" onPress={onCheck}>
                    Kontrol Et
                  </Btn3D>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.verdict, lastCorrect ? styles.verdictOk : styles.verdictNo]}>
                  {lastCorrect ? '✅ Doğru!' : '❌ Doğru cevap:'}
                </Text>
                <MascotPop trigger={index} style={styles.mascotWrap}>
                  <Image
                    source={
                      lastCorrect
                        ? require('@/assets/images/atlas/mascot-happy.png')
                        : require('@/assets/images/atlas/mascot-sad.png')
                    }
                    style={styles.mascotMed}
                    contentFit="contain"
                  />
                </MascotPop>
                <Text style={styles.answer}>{card.answer}</Text>
                {card.explanation && <Text style={styles.explanation}>{card.explanation}</Text>}
                <View style={styles.cardBtn}>
                  <Btn3D variant="green" size="small" onPress={onNext}>
                    {index + 1 < total ? 'Devam →' : 'Bitir →'}
                  </Btn3D>
                </View>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const DARK_BG = '#141B2E';

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: DARK_BG },
  safe: { flex: 1 },
  centerDark: { flex: 1, backgroundColor: DARK_BG, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 30 },
  errorText: { color: AtlasColors.white, fontSize: 14, textAlign: 'center', paddingHorizontal: 30, marginBottom: 6 },
  emptyText: {
    color: AtlasColors.white,
    fontFamily: AtlasFonts.heading,
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  closeX: { color: 'rgba(255,255,255,0.7)', fontSize: 20, fontFamily: AtlasFonts.heading },
  barWrap: { flex: 1 },
  score: { fontFamily: AtlasFonts.heading, fontSize: 14 },
  scoreOk: { color: AtlasColors.green },
  scoreNo: { color: AtlasColors.red },
  scroll: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: AtlasRadius.sheet,
    padding: 22,
    gap: 12,
    alignItems: 'center',
  },
  tag: { color: AtlasColors.gray, fontFamily: AtlasFonts.bodyBold, fontSize: 11, letterSpacing: 0.6 },
  prompt: {
    color: AtlasColors.white,
    fontFamily: AtlasFonts.heading,
    fontSize: 21,
    lineHeight: 28,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    minHeight: 52,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: AtlasRadius.button,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: AtlasColors.white,
    fontFamily: AtlasFonts.bodySemi,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  warn: { color: AtlasColors.yellow, fontFamily: AtlasFonts.bodyBold, fontSize: 12.5 },
  cardBtn: { alignSelf: 'stretch', marginTop: 4 },
  verdict: { fontFamily: AtlasFonts.heading, fontSize: 18 },
  verdictOk: { color: AtlasColors.green },
  verdictNo: { color: AtlasColors.red },
  mascotWrap: { alignItems: 'center' },
  mascotMed: { width: 88, height: 88 },
  answer: {
    color: AtlasColors.white,
    fontFamily: AtlasFonts.heading,
    fontSize: 20,
    lineHeight: 27,
    textAlign: 'center',
  },
  explanation: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: AtlasFonts.bodySemi,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 10 },
  mascotBig: { width: 130, height: 130, marginBottom: 6 },
  resultTitle: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 26 },
  resultSub: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginBottom: 4 },
  saveErrText: { color: AtlasColors.yellow, fontFamily: AtlasFonts.bodyBold, fontSize: 12, textAlign: 'center' },
  btnStack: { gap: 10, width: '100%', marginTop: 12 },
});
