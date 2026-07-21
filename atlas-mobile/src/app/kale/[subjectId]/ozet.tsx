import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { Interactive } from '@/components/ui/interactive';
import { AtlasColors, AtlasFonts, AtlasSurface } from '@/constants/atlas-theme';
import { safeGoBack } from '@/lib/navigation';
import { fetchTopicSummary } from '@/lib/queries';
import { useThemeMode } from '@/lib/theme-context';

/**
 * EKRAN — Konu Özeti (bilgi). Konu akışının ilk adımı: önce özet okunur,
 * sonra sorulara geçilir; konu tamamlanınca bilgi kartları açılır
 * (bilgi → sorular → flashcard). Özet metni topics.summary'den gelir
 * (seed_tarih_full.sql). Kaledeki konuya basınca buraya gelinir.
 */
export default function OzetScreen() {
  const { subjectId, topicId, topicTitle, status, color, colorDark, emoji } =
    useLocalSearchParams<{
      subjectId: string;
      topicId: string;
      topicTitle?: string;
      status?: string;
      color?: string;
      colorDark?: string;
      emoji?: string;
    }>();
  const router = useRouter();
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];

  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!topicId) return;
    (async () => {
      // Hata olursa (ör. summary kolonu henüz yüklenmemiş) özeti boş bırak;
      // kullanıcı yine sorulara geçebilir — bu ekranda hata göstermeye gerek yok.
      try {
        setSummary(await fetchTopicSummary(topicId));
      } catch {
        setSummary(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [topicId]);

  const headColor = color || AtlasColors.violet;
  const headColorDark = colorDark || headColor;

  const goQuiz = () =>
    router.replace({
      pathname: '/kale/[subjectId]/quiz',
      params: { subjectId: subjectId!, topicId: topicId!, topicTitle: topicTitle ?? '' },
    } as never);

  const goCards = () =>
    router.push({
      pathname: '/kale/[subjectId]/kartlar',
      params: { subjectId: subjectId!, topicId: topicId!, topicTitle: topicTitle ?? '' },
    } as never);

  return (
    <View style={[styles.container, { backgroundColor: surface.bg }]}>
      <LinearGradient
        colors={[headColor, headColorDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={styles.head}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headRow}>
            <Interactive onPress={() => safeGoBack(router, '/harita')} hitSlop={10} style={styles.backPill}>
              <Text style={styles.backText}>‹ Geri</Text>
            </Interactive>
            <View style={styles.headTitles}>
              <Text style={styles.headLabel}>KONU ÖZETİ</Text>
              <Text style={styles.headTitle} numberOfLines={2}>
                {emoji ? `${emoji} ` : ''}
                {topicTitle}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <ActivityIndicator color={headColor} style={{ marginTop: 40 }} />
        ) : summary ? (
          <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.cardBorder }]}>
            <Text style={[styles.body, { color: surface.text }]}>{summary}</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.cardBorder }]}>
            <Text style={[styles.body, { color: surface.textSecondary }]}>
              Bu konu için özet henüz eklenmemiş. Doğrudan sorulara geçebilirsin.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: surface.bg, borderTopColor: surface.cardBorder }]}>
        <Btn3D variant="green" onPress={goQuiz}>
          Sorulara Başla →
        </Btn3D>
        {status === 'done' && (
          <Btn3D variant="purple" size="small" onPress={goCards}>
            🃏 Bilgi Kartları
          </Btn3D>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: { paddingHorizontal: 18, paddingBottom: 16 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
  backPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  backText: { color: AtlasColors.white, fontFamily: AtlasFonts.bodyBold, fontSize: 13 },
  headTitles: { flex: 1 },
  headLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: AtlasFonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  headTitle: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 19 },
  scroll: { padding: 18, paddingBottom: 32 },
  card: { borderWidth: 1.5, borderRadius: 20, padding: 18 },
  body: { fontSize: 15, lineHeight: 24, fontFamily: AtlasFonts.body },
  footer: { padding: 18, paddingBottom: 32, borderTopWidth: 1.5, gap: 12 },
});
