import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { GlowBanner } from '@/components/ui/animated/glow-banner';
import { AtlasColors, AtlasFonts, AtlasRadius } from '@/constants/atlas-theme';
import { fetchOpenMistakes } from '@/lib/queries';
import type { MistakeItem } from '@/lib/types';

/**
 * EKRAN 09 — Yanlışlarım
 * Prototip referansı: ../index.html #scr-mistakes
 * Açık yanlış havuzu + ders filtresi + haftalık mini sınav banner'ı.
 */

const ALL = '__all__';

/** created_at'ten basit Türkçe göreli zaman — harici tarih kütüphanesi yok. */
function relativeTr(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'bugün';
  if (days === 1) return 'dün';
  return `${days} gün önce`;
}

export default function MistakesScreen() {
  const router = useRouter();
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [filter, setFilter] = useState<string>(ALL);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchOpenMistakes();
      setMistakes(data);
    } catch {
      setError('Yüklenemedi — internetini kontrol et.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Fetch sonuçlarından benzersiz ders adları (renkleriyle) türet
  const subjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of mistakes) if (!map.has(m.subjectName)) map.set(m.subjectName, m.subjectColor);
    return Array.from(map, ([name, color]) => ({ name, color }));
  }, [mistakes]);

  const filtered = filter === ALL ? mistakes : mistakes.filter((m) => m.subjectName === filter);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={styles.header}>
            <Text style={styles.title}>⚠️ Yanlışlarım</Text>
            <Pill color={AtlasColors.redLight} textColor={AtlasColors.redDark}>
              {`${mistakes.length} soru`}
            </Pill>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable onPress={() => router.push('/yanlislar/haftalik')}>
            <GlowBanner glowColor={AtlasColors.purple} backgroundColor="#1A0A2E" style={styles.banner}>
              <View style={styles.bannerRow}>
                <View style={styles.bannerText}>
                  <Text style={styles.bannerTitle}>🏆 Haftalık Mini Sınav</Text>
                  <Text style={styles.bannerSub}>Her Pazar 🔔 — haftanın yanlışlarından</Text>
                </View>
                <View style={styles.bannerCta}>
                  <Text style={styles.bannerCtaText}>Başla</Text>
                  <Text style={styles.bannerChevron}>›</Text>
                </View>
              </View>
            </GlowBanner>
          </Pressable>

          {mistakes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>✅</Text>
              <Text style={styles.emptyTitle}>Hiç yanlışın yok!</Text>
              <Text style={styles.emptySub}>Harika gidiyorsun 💪</Text>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}>
                <Chip label="Tümü" active={filter === ALL} onPress={() => setFilter(ALL)} />
                {subjects.map((s) => (
                  <Chip
                    key={s.name}
                    label={s.name}
                    color={s.color}
                    active={filter === s.name}
                    onPress={() => setFilter(s.name)}
                  />
                ))}
              </ScrollView>

              {filtered.length === 0 ? (
                <Text style={styles.emptyInline}>Bu derste yanlışın yok 🎉</Text>
              ) : (
                filtered.map((item) => (
                  <MistakeCard
                    key={item.id}
                    item={item}
                    onSolve={() =>
                      router.push({
                        pathname: '/yanlislar/quiz-tekil',
                        params: { questionId: item.question.id },
                      } as never)
                    }
                  />
                ))
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Chip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active && { backgroundColor: color ?? AtlasColors.inkStrong, borderColor: color ?? AtlasColors.inkStrong },
      ]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MistakeCard({ item, onSolve }: { item: MistakeItem; onSolve: () => void }) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <Pill color={item.subjectColor} textColor={AtlasColors.white}>
          {item.subjectName}
        </Pill>
        <Text style={styles.cardTime}>{relativeTr(item.created_at)}</Text>
      </View>
      <Text style={styles.cardTopic}>{item.topicTitle}</Text>
      <Text style={styles.cardPrompt} numberOfLines={2}>
        {item.question.prompt}
      </Text>

      {/* Cevaplar burada gösterilmez — "Çöz" ile aynı soruyu tekrar çözecek, spoiler olmasın */}
      <Text style={styles.retryHint}>🔁 Bu soruyu tekrar çözmeye hazır</Text>

      <View style={styles.cardFoot}>
        <Btn3D variant="green" size="small" onPress={onSolve}>
          Çöz
        </Btn3D>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AtlasColors.surface },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 30, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  title: { color: AtlasColors.inkStrong, fontSize: 22, fontFamily: AtlasFonts.heading },
  error: {
    color: AtlasColors.redDark,
    backgroundColor: AtlasColors.redLight,
    borderRadius: 12,
    padding: 10,
    fontSize: 12.5,
    fontFamily: AtlasFonts.bodyBold,
  },
  banner: { alignItems: 'stretch' },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },
  bannerText: { flex: 1 },
  bannerTitle: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 16 },
  bannerSub: { color: 'rgba(255,255,255,0.75)', fontFamily: AtlasFonts.bodySemi, fontSize: 12, marginTop: 3 },
  bannerCta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bannerCtaText: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 13 },
  bannerChevron: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 22, marginTop: -2 },
  chips: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: {
    borderWidth: 2,
    borderColor: AtlasColors.line,
    backgroundColor: AtlasColors.white,
    borderRadius: AtlasRadius.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  chipText: { color: AtlasColors.ink, fontFamily: AtlasFonts.bodyBold, fontSize: 12.5 },
  chipTextActive: { color: AtlasColors.white },
  card: { gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTime: { color: AtlasColors.gray, fontFamily: AtlasFonts.bodySemi, fontSize: 11.5 },
  cardTopic: { color: AtlasColors.inkStrong, fontFamily: AtlasFonts.heading, fontSize: 14.5 },
  cardPrompt: { color: AtlasColors.ink, fontFamily: AtlasFonts.body, fontSize: 13, lineHeight: 19 },
  retryHint: { color: AtlasColors.gray, fontFamily: AtlasFonts.bodySemi, fontSize: 11.5 },
  cardFoot: { alignItems: 'flex-end', marginTop: 2 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 6 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { color: AtlasColors.inkStrong, fontFamily: AtlasFonts.heading, fontSize: 18 },
  emptySub: { color: AtlasColors.gray, fontFamily: AtlasFonts.bodySemi, fontSize: 13.5 },
  emptyInline: { color: AtlasColors.gray, fontFamily: AtlasFonts.bodySemi, fontSize: 13.5, textAlign: 'center', paddingVertical: 30 },
});
