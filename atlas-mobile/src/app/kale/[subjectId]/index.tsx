import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatCountdown } from '@/components/hearts/hearts-empty-card';
import { GlowHalo } from '@/components/ui/glow-halo';
import { Interactive } from '@/components/ui/interactive';
import { HeartsRow } from '@/components/ui/hearts-row';
import { PulsingBadge } from '@/components/ui/animated/pulsing-badge';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AtlasColors, AtlasFonts, AtlasRadius, ledgeShadow, ledgeShadowWeb } from '@/constants/atlas-theme';
import { safeGoBack } from '@/lib/navigation';
import { fetchSubjectTree, fetchSubjects, getHearts, type HeartsState } from '@/lib/queries';
import type { Subject, TopicNode, UnitNode } from '@/lib/types';

const SECTION_EMOJI = ['🏹', '🏰', '⚔️', '🛡️'];

/** EKRAN 05 — Kale Detay: konu ağacı. Prototip: ../../../../index.html #scr-castle */
export default function CastleScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const router = useRouter();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [units, setUnits] = useState<UnitNode[] | null>(null);
  const [hearts, setHearts] = useState<HeartsState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!subjectId) return;
    try {
      setError(null);
      const [subjects, tree, h] = await Promise.all([
        fetchSubjects(),
        fetchSubjectTree(subjectId),
        getHearts(),
      ]);
      setSubject(subjects.find((s) => s.id === subjectId) ?? null);
      setUnits(tree);
      setHearts(h);
    } catch {
      setError('Kale yüklenemedi — internetini kontrol et.');
    }
  }, [subjectId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const allTopics = units?.flatMap((u) => u.topics) ?? [];
  const doneCount = allTopics.filter((t) => t.status === 'done').length;
  const totalCount = allTopics.length;
  const frac = totalCount > 0 ? doneCount / totalCount : 0;

  const onTopicPress = (topic: TopicNode) => {
    if (topic.status === 'locked') {
      Alert.alert('🔒 Kilitli', 'Önce aktif konuyu fethet!');
      return;
    }
    // Konu akışı: önce özet (bilgi) → sorular → (tamamlanınca) flashcard.
    // Özet ekranı status'e göre "Bilgi Kartları" butonunu da gösterir.
    router.push({
      pathname: '/kale/[subjectId]/ozet',
      params: {
        subjectId: subjectId!,
        topicId: topic.id,
        topicTitle: topic.title,
        status: topic.status,
        color: subject?.color ?? AtlasColors.violet,
        colorDark: subject?.color_dark ?? subject?.color ?? AtlasColors.violet,
        emoji: subject?.emoji ?? '',
      },
    } as never);
  };

  const headColor = subject?.color ?? AtlasColors.violet;
  const headColorDark = subject?.color_dark ?? headColor;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <LinearGradient colors={[headColor, headColorDark]} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={styles.head}>
          <Text style={styles.headEmojiDeco}>{subject?.emoji}</Text>
          <Interactive onPress={() => safeGoBack(router, '/harita')} style={styles.backPill} hitSlop={8}>
            <Text style={styles.backText}>‹ Geri</Text>
          </Interactive>
          <View style={styles.row1}>
            <View style={styles.titles}>
              <Text style={styles.smallLabel}>{(subject?.name ?? '').toLocaleUpperCase('tr')} KALESİ</Text>
              <Text style={styles.bigTitle}>
                {subject?.emoji} {subject?.name ?? ''}
              </Text>
            </View>
            <View style={styles.heartsCol}>
              <HeartsRow hearts={hearts?.hearts ?? 5} size={14} />
              {hearts && hearts.hearts < 5 && hearts.next_heart_at && (
                <Text style={styles.heartsCountdown}>+1 can: {formatCountdown(new Date(hearts.next_heart_at).getTime() - now)}</Text>
              )}
            </View>
          </View>
          <View style={styles.progRow}>
            <ProgressBar progress={frac} height={8} trackColor="rgba(0,0,0,0.25)" color={AtlasColors.yellow} />
            <Text style={styles.progStat}>
              {doneCount}/{totalCount} Konu Fethi
            </Text>
          </View>
        </LinearGradient>

        {error && <Text style={styles.error}>{error}</Text>}

        <ScrollView contentContainerStyle={styles.scroll}>
          {units?.map((unit, ui) => {
            const unitDone = unit.topics.filter((t) => t.status === 'done').length;
            const unitAllDone = unitDone === unit.topics.length && unit.topics.length > 0;
            return (
              <View key={unit.id}>
                <View
                  style={[
                    styles.sectionBanner,
                    { borderLeftColor: headColor },
                    unitAllDone && styles.sectionBannerDone,
                  ]}>
                  <Text style={styles.sectionEmoji}>{SECTION_EMOJI[ui % SECTION_EMOJI.length]}</Text>
                  <View style={styles.sectionTexts}>
                    <Text style={styles.sectionSmall}>BÖLÜM {ui + 1}</Text>
                    <Text style={styles.sectionTitle}>{unit.title}</Text>
                  </View>
                  <Text style={styles.sectionRight}>
                    {unitAllDone ? '✓ ' : ''}
                    {unitDone}/{unit.topics.length}
                  </Text>
                </View>

                {unit.topics.map((topic) => (
                  <TopicRow key={topic.id} topic={topic} color={headColor} onPress={() => onTopicPress(topic)} />
                ))}

                {unitAllDone && ui < units.length - 1 && (
                  <View style={styles.reward}>
                    <Text style={styles.rewardCup}>🏆</Text>
                    <Text style={styles.rewardText}>Bölüm Ödülü Kazanıldı!</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function TopicRow({ topic, color, onPress }: { topic: TopicNode; color: string; onPress: () => void }) {
  const done = topic.status === 'done';
  const active = topic.status === 'active';
  const locked = topic.status === 'locked';
  const elevated = Platform.OS === 'web' ? ledgeShadowWeb(color, 3) : ledgeShadow(color, 3);

  return (
    <Interactive
      onPress={onPress}
      style={[
        styles.topicRow,
        done && { borderColor: color, backgroundColor: `${color}14` },
        active && { borderColor: color, backgroundColor: AtlasColors.white, ...elevated },
        locked && styles.topicRowLocked,
      ]}>
      {active && (
        <PulsingBadge style={styles.baslaBadgeWrap}>
          <View style={[styles.baslaBadge, { backgroundColor: color }]}>
            <Text style={styles.baslaBadgeText}>BAŞLA!</Text>
          </View>
        </PulsingBadge>
      )}
      <View style={styles.topicBadgeSlot}>
        {active && <GlowHalo color={color} size={34} opacity={0.8} />}
        <View
          style={[
            styles.topicBadge,
            { backgroundColor: done ? color : active ? color : AtlasColors.line },
          ]}>
          <Text style={styles.topicBadgeIcon}>{done ? '✓' : active ? '▶' : '🔒'}</Text>
        </View>
      </View>
      <View style={styles.topicTexts}>
        <Text style={[styles.topicTitle, locked && styles.topicTitleLocked]}>{topic.title}</Text>
        <Text style={styles.topicSub}>
          {done ? '🃏 Kartlarla tekrar et' : active ? '5 soru • ~4 dk' : 'Kilitli'}
        </Text>
      </View>
      {done && (
        <Text style={styles.topicStars}>
          {'★'.repeat(topic.stars)}
          <Text style={styles.topicStarsOff}>{'★'.repeat(3 - topic.stars)}</Text>
        </Text>
      )}
      {active && (
        <View style={[styles.girPill, { backgroundColor: color }]}>
          <Text style={styles.girPillText}>Gir!</Text>
        </View>
      )}
    </Interactive>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AtlasColors.surface },
  safe: { flex: 1 },
  head: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, gap: 10, overflow: 'hidden', position: 'relative' },
  headEmojiDeco: { position: 'absolute', right: -10, top: -18, fontSize: 96, opacity: 0.16, transform: [{ rotate: '-12deg' }] },
  backPill: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 4 },
  backText: { color: 'rgba(255,255,255,0.9)', fontFamily: AtlasFonts.bodyBold, fontSize: 13 },
  row1: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heartsCol: { alignItems: 'flex-end', gap: 2 },
  heartsCountdown: { color: 'rgba(255,255,255,0.8)', fontFamily: AtlasFonts.bodyBold, fontSize: 9.5 },
  titles: { flex: 1 },
  smallLabel: { color: 'rgba(255,255,255,0.75)', fontFamily: AtlasFonts.heading, fontSize: 10.5, letterSpacing: 0.6 },
  bigTitle: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 19, marginTop: 2 },
  progRow: { gap: 4 },
  progStat: { color: 'rgba(255,255,255,0.85)', fontFamily: AtlasFonts.bodyBold, fontSize: 11 },
  error: {
    margin: 14,
    color: AtlasColors.redDark,
    backgroundColor: AtlasColors.redLight,
    borderRadius: 12,
    padding: 10,
    fontSize: 12.5,
    fontFamily: AtlasFonts.bodyBold,
  },
  scroll: { padding: 14, paddingBottom: 30, gap: 10 },
  sectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: AtlasColors.card,
    borderRadius: AtlasRadius.card,
    borderLeftWidth: 4,
    padding: 12,
    marginTop: 6,
  },
  sectionBannerDone: { backgroundColor: AtlasColors.greenLight },
  sectionEmoji: { fontSize: 22 },
  sectionTexts: { flex: 1 },
  sectionSmall: { color: AtlasColors.gray, fontFamily: AtlasFonts.bodyBold, fontSize: 10, letterSpacing: 0.5 },
  sectionTitle: { color: AtlasColors.inkStrong, fontFamily: AtlasFonts.heading, fontSize: 15 },
  sectionRight: { color: AtlasColors.ink, fontFamily: AtlasFonts.bodyBold, fontSize: 12.5 },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: AtlasColors.white,
    borderWidth: 2,
    borderColor: AtlasColors.line,
    borderRadius: AtlasRadius.button,
    padding: 13,
    marginTop: 8,
  },
  topicRowLocked: { backgroundColor: AtlasColors.surface, opacity: 0.7 },
  baslaBadgeWrap: {
    position: 'absolute',
    top: -10,
    left: 14,
    zIndex: 2,
  },
  baslaBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  baslaBadgeText: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 9 },
  topicBadgeSlot: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  topicBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicBadgeIcon: { fontSize: 15, color: AtlasColors.white },
  topicTexts: { flex: 1 },
  topicTitle: { color: AtlasColors.inkStrong, fontFamily: AtlasFonts.heading, fontSize: 14.5 },
  topicTitleLocked: { color: AtlasColors.gray },
  topicSub: { color: AtlasColors.gray, fontFamily: AtlasFonts.bodySemi, fontSize: 11.5, marginTop: 2 },
  topicStars: { color: AtlasColors.yellow, fontSize: 13, letterSpacing: 1 },
  topicStarsOff: { color: AtlasColors.line },
  girPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  girPillText: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 11 },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  rewardCup: { fontSize: 18 },
  rewardText: { color: AtlasColors.gray, fontFamily: AtlasFonts.bodyBold, fontSize: 12 },
});
