import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { AtlasColors, AtlasFonts, AtlasGradients, AtlasRadius } from '@/constants/atlas-theme';
import { fetchCurrentWeeklyExam, fetchProfile, fetchQuestionsByIds } from '@/lib/queries';
import type { Profile, Question, WeeklyExam } from '@/lib/types';

type Phase = 'loading' | 'ready' | 'error';

/**
 * EKRAN 10 — Haftalık Mini Sınav girişi.
 * Premium gate + bu haftanın weekly_exams satırının durumuna göre farklı ekranlar.
 */
export default function WeeklyIntroScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [exam, setExam] = useState<WeeklyExam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [p, e] = await Promise.all([fetchProfile(), fetchCurrentWeeklyExam()]);
        setProfile(p);
        setExam(e);
        if (p.is_premium && e && !e.completed_at) {
          setQuestions(await fetchQuestionsByIds(e.question_ids));
        }
        setPhase('ready');
      } catch {
        setPhase('error');
      }
    })();
  }, []);

  // Sınav içeriği: ders adına göre grupla (rozet dökümü)
  const breakdown = useMemo(() => {
    const map = new Map<string, { count: number; color: string }>();
    for (const q of questions) {
      const name = q.subject_name ?? 'Genel';
      const prev = map.get(name);
      map.set(name, { count: (prev?.count ?? 0) + 1, color: q.subject_color ?? AtlasColors.purple });
    }
    return Array.from(map, ([name, v]) => ({ name, ...v }));
  }, [questions]);

  const back = () => router.back();

  return (
    <LinearGradient colors={AtlasGradients.weeklyIntro} style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        {phase === 'loading' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={AtlasColors.white} />
          </View>
        )}

        {phase === 'error' && (
          <View style={styles.center}>
            <Text style={styles.errorText}>Yüklenemedi — internetini kontrol et.</Text>
            <View style={styles.btnStack}>
              <Btn3D variant="ghost" onPress={back}>
                Geri Dön
              </Btn3D>
            </View>
          </View>
        )}

        {phase === 'ready' && profile && (
          <ScrollView contentContainerStyle={styles.scroll}>
            {!profile.is_premium ? (
              <Locked back={back} />
            ) : exam === null ? (
              <NotReady back={back} />
            ) : exam.completed_at ? (
              <Completed exam={exam} back={back} />
            ) : (
              <Ready
                breakdown={breakdown}
                total={exam.question_ids.length}
                onStart={() => router.push('/yanlislar/quiz-haftalik')}
                back={back}
              />
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function Locked({ back }: { back: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.stateBox}>
      <Image source={require('@/assets/images/atlas/mascot-wave.png')} style={styles.mascot} contentFit="contain" />
      <Text style={styles.stateTitle}>Haftalık Mini Sınav Premium&apos;da 🔒</Text>
      <Text style={styles.stateBody}>
        Haftanın yanlışlarından hazırlanan mini sınav Atlas Premium&apos;a özel bir özellik.
      </Text>
      <View style={styles.btnStack}>
        <Btn3D variant="purple" onPress={() => router.push('/premium')}>
          Premium&apos;a Geç
        </Btn3D>
        <Btn3D variant="ghost" onPress={back}>
          Geri Dön
        </Btn3D>
      </View>
    </View>
  );
}

function NotReady({ back }: { back: () => void }) {
  return (
    <View style={styles.stateBox}>
      <Text style={styles.bigEmoji}>🎉</Text>
      <Text style={styles.stateTitle}>Bu hafta için sınav hazır değil</Text>
      <Text style={styles.stateBody}>Yanlışın birikince otomatik hazırlanacak — her Pazar yenilenir 🔔</Text>
      <View style={styles.btnStack}>
        <Btn3D variant="ghost" onPress={back}>
          Geri Dön
        </Btn3D>
      </View>
    </View>
  );
}

function Completed({ exam, back }: { exam: WeeklyExam; back: () => void }) {
  return (
    <View style={styles.stateBox}>
      <Image source={require('@/assets/images/atlas/mascot-happy.png')} style={styles.mascot} contentFit="contain" />
      <Text style={styles.stateTitle}>Bu haftanın sınavını tamamladın ✅</Text>
      <Text style={styles.scoreBig}>
        {exam.correct_count ?? 0}/{exam.question_ids.length} doğru
      </Text>
      <Text style={styles.stateBody}>Yeni sınav gelecek Pazar hazır olacak.</Text>
      <View style={styles.btnStack}>
        <Btn3D variant="ghost" onPress={back}>
          Geri Dön
        </Btn3D>
      </View>
    </View>
  );
}

function Ready({
  breakdown,
  total,
  onStart,
  back,
}: {
  breakdown: { name: string; count: number; color: string }[];
  total: number;
  onStart: () => void;
  back: () => void;
}) {
  return (
    <View style={styles.readyBox}>
      <Text style={styles.bigEmoji}>🏆</Text>
      <Text style={styles.readyTitle}>Haftalık Mini Sınav</Text>
      <Text style={styles.readySub}>{total} soru • haftanın yanlışlarından • tek deneme hakkı</Text>

      <Text style={styles.sectionLabel}>SINAV İÇERİĞİ</Text>
      <View style={styles.contentList}>
        {breakdown.map((b) => (
          <View key={b.name} style={[styles.contentRow, { borderLeftColor: b.color }]}>
            <Text style={styles.contentName}>{b.name}</Text>
            <Text style={styles.contentCount}>{b.count} soru</Text>
          </View>
        ))}
      </View>

      <View style={styles.btnStack}>
        <Btn3D variant="purple" onPress={onStart}>
          Sınava Başla →
        </Btn3D>
        <Btn3D variant="ghost" onPress={back}>
          Geri Dön
        </Btn3D>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 16 },
  errorText: { color: AtlasColors.white, fontSize: 14, textAlign: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 30 },
  stateBox: { alignItems: 'center', gap: 12 },
  mascot: { width: 120, height: 120, marginBottom: 4 },
  bigEmoji: { fontSize: 52, marginBottom: 4 },
  stateTitle: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 22, textAlign: 'center', lineHeight: 29 },
  stateBody: { color: 'rgba(255,255,255,0.75)', fontFamily: AtlasFonts.bodySemi, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  scoreBig: { color: AtlasColors.yellow, fontFamily: AtlasFonts.heading, fontSize: 30 },
  readyBox: { alignItems: 'center', gap: 8 },
  readyTitle: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 26, textAlign: 'center' },
  readySub: { color: 'rgba(255,255,255,0.7)', fontFamily: AtlasFonts.bodySemi, fontSize: 13.5, textAlign: 'center', marginBottom: 10 },
  sectionLabel: {
    alignSelf: 'flex-start',
    color: 'rgba(255,255,255,0.6)',
    fontFamily: AtlasFonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 4,
  },
  contentList: { width: '100%', gap: 8 },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 4,
    borderRadius: AtlasRadius.button,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  contentName: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 14.5 },
  contentCount: { color: 'rgba(255,255,255,0.75)', fontFamily: AtlasFonts.bodyBold, fontSize: 12.5 },
  btnStack: { gap: 10, width: '100%', marginTop: 20 },
});
