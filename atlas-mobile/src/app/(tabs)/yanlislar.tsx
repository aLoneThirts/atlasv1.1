import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { GlowBanner } from '@/components/ui/animated/glow-banner';
import { AtlasColors, AtlasFonts, AtlasRadius, AtlasSurface } from '@/constants/atlas-theme';
import { fetchOpenMistakes, fetchProfile } from '@/lib/queries';
import { useThemeMode } from '@/lib/theme-context';
import type { MistakeItem } from '@/lib/types';

type ExamType = 'tyt' | 'ayt';

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
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [filter, setFilter] = useState<string>(ALL);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examType, setExamType] = useState<ExamType>('tyt');
  const [showAytToggle, setShowAytToggle] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [data, profile] = await Promise.all([fetchOpenMistakes(), fetchProfile()]);
      setMistakes(data);
      setShowAytToggle(profile.exam_track === 'tyt_ayt_ea');
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

  // Seçili sınav (TYT/AYT) türüne ait yanlışlar — toggle görünmüyorsa (tek TYT'liler) hep TYT
  const trackMistakes = useMemo(
    () => mistakes.filter((m) => m.subjectExamType === examType),
    [mistakes, examType],
  );

  // Fetch sonuçlarından benzersiz ders adları (renkleriyle) türet — yalnız seçili sınav türünden
  const subjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of trackMistakes) if (!map.has(m.subjectName)) map.set(m.subjectName, m.subjectColor);
    return Array.from(map, ([name, color]) => ({ name, color }));
  }, [trackMistakes]);

  const filtered = filter === ALL ? trackMistakes : trackMistakes.filter((m) => m.subjectName === filter);

  const onPickExamType = (t: ExamType) => {
    if (t === examType) return;
    setExamType(t);
    setFilter(ALL);
  };

  return (
    <View style={[styles.container, { backgroundColor: surface.bg }]}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: surface.text }]}>⚠️ Yanlışlarım</Text>
            <Pill color={AtlasColors.redLight} textColor={AtlasColors.redDark}>
              {`${trackMistakes.length} soru`}
            </Pill>
          </View>

          {showAytToggle && (
            <View style={styles.trackToggle}>
              {(['tyt', 'ayt'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => onPickExamType(t)}
                  style={[
                    styles.trackPill,
                    { backgroundColor: surface.card, borderColor: surface.cardBorder },
                    examType === t && styles.trackPillActive,
                  ]}>
                  <Text
                    style={[
                      styles.trackPillText,
                      { color: surface.text },
                      examType === t && styles.trackPillTextActive,
                    ]}>
                    {t.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

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

          {trackMistakes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>✅</Text>
              <Text style={[styles.emptyTitle, { color: surface.text }]}>Hiç yanlışın yok!</Text>
              <Text style={[styles.emptySub, { color: surface.textSecondary }]}>Harika gidiyorsun 💪</Text>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}>
                <Chip label="Tümü" active={filter === ALL} onPress={() => setFilter(ALL)} surface={surface} />
                {subjects.map((s) => (
                  <Chip
                    key={s.name}
                    label={s.name}
                    color={s.color}
                    active={filter === s.name}
                    onPress={() => setFilter(s.name)}
                    surface={surface}
                  />
                ))}
              </ScrollView>

              {filtered.length === 0 ? (
                <Text style={[styles.emptyInline, { color: surface.textSecondary }]}>Bu derste yanlışın yok 🎉</Text>
              ) : (
                filtered.map((item) => (
                  <MistakeCard
                    key={item.id}
                    item={item}
                    surface={surface}
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

type Surface = (typeof AtlasSurface)[keyof typeof AtlasSurface];

function Chip({
  label,
  active,
  color,
  onPress,
  surface,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
  surface: Surface;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: surface.card, borderColor: surface.cardBorder },
        active && { backgroundColor: color ?? AtlasColors.inkStrong, borderColor: color ?? AtlasColors.inkStrong },
      ]}>
      <Text style={[styles.chipText, { color: surface.text }, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MistakeCard({ item, onSolve, surface }: { item: MistakeItem; onSolve: () => void; surface: Surface }) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadLeft}>
          <Pill color={item.subjectColor} textColor={AtlasColors.white}>
            {item.subjectName}
          </Pill>
          {item.question.difficulty === 3 && (
            <Pill color={AtlasColors.redLight} textColor={AtlasColors.redDark}>
              🔥 Öncelikli
            </Pill>
          )}
        </View>
        <Text style={[styles.cardTime, { color: surface.textSecondary }]}>{relativeTr(item.created_at)}</Text>
      </View>
      <Text style={[styles.cardTopic, { color: surface.text }]}>{item.topicTitle}</Text>
      <Text style={[styles.cardPrompt, { color: surface.text }]} numberOfLines={2}>
        {item.question.prompt}
      </Text>

      {/* Cevaplar burada gösterilmez — "Çöz" ile aynı soruyu tekrar çözecek, spoiler olmasın */}
      <Text style={[styles.retryHint, { color: surface.textSecondary }]}>🔁 Bu soruyu tekrar çözmeye hazır</Text>

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
  trackToggle: { flexDirection: 'row', gap: 8 },
  trackPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: AtlasRadius.pill,
    borderWidth: 2,
    borderColor: AtlasColors.line,
    backgroundColor: AtlasColors.white,
  },
  trackPillActive: { backgroundColor: AtlasColors.inkStrong, borderColor: AtlasColors.inkStrong },
  trackPillText: { fontSize: 12, fontFamily: AtlasFonts.heading, color: AtlasColors.ink },
  trackPillTextActive: { color: AtlasColors.white },
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
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
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
