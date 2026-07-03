import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AtlasColors, AtlasRadius } from '@/constants/atlas-theme';
import { fetchCurrentWeeklyExam, fetchOpenMistakes } from '@/lib/queries';
import type { MistakeItem, WeeklyExam } from '@/lib/types';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/**
 * EKRAN 09 — Yanlışlarım — prototip: index.html #scr-mistakes
 * Açık yanlış havuzu + haftalık mini sınav banner'ı. Toplu "hepsini çöz"
 * butonu bilinçli olarak YOK (§4.7) — o işi Pazar sınavı üstlenir.
 */
export default function MistakesScreen() {
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [exam, setExam] = useState<WeeklyExam | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, e] = await Promise.all([fetchOpenMistakes(), fetchCurrentWeeklyExam()]);
      setMistakes(m);
      setExam(e);
    } catch {
      /* çevrimdışı: mevcut liste ekranda kalır */
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

  const subjects = [...new Map(mistakes.map((m) => [m.subjectId, m.subjectName])).entries()];
  const items = mistakes.filter((m) => filter === 'all' || m.subjectId === filter);
  const urgentCount = mistakes.filter((m) => ageDays(m.created_at) >= 2).length;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={styles.headRow}>
            <Text style={styles.title}>⚠️ Yanlışlarım</Text>
            <View style={styles.urgentPill}>
              <Text style={styles.urgentText}>{urgentCount} Acil 🔴</Text>
            </View>
          </View>
          <Text style={styles.sub}>
            Yanlışların burada birikir; her Pazar 5&apos;i mini sınav olarak karşına çıkar.
          </Text>

          {exam && !exam.completed_at && (
            <Pressable
              style={styles.weekly}
              onPress={() => router.push({ pathname: '/quiz', params: { mode: 'weekly' } })}>
              <Text style={styles.weeklyEmoji}>🏆</Text>
              <View style={styles.weeklyText}>
                <Text style={styles.weeklyTitle}>Haftalık Mini Sınav hazır!</Text>
                <Text style={styles.weeklySub}>
                  Bu haftanın {exam.question_ids.length} yanlışından kuruldu — hadi temizle.
                </Text>
              </View>
              <Text style={styles.weeklyGo}>Başla →</Text>
            </Pressable>
          )}

          {subjects.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
              <Chip label="Tümü" active={filter === 'all'} onPress={() => setFilter('all')} />
              {subjects.map(([id, name]) => (
                <Chip key={id} label={name} active={filter === id} onPress={() => setFilter(id)} />
              ))}
            </ScrollView>
          )}

          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>✅</Text>
              <Text style={styles.emptyTitle}>Hiç açık yanlışın yok!</Text>
              <Text style={styles.emptySub}>Harika gidiyorsun 💪 Kale duvarların sapasağlam.</Text>
            </View>
          ) : (
            items.map((m) => {
              const days = ageDays(m.created_at);
              const urgent = days >= 2;
              return (
                <View key={m.id} style={[styles.card, urgent && styles.cardUrgent]}>
                  <View style={styles.row1}>
                    <View style={[styles.badge, { backgroundColor: m.subjectColor }]}>
                      <Text style={styles.badgeText}>{m.subjectName}</Text>
                    </View>
                    <Text style={styles.topic} numberOfLines={1}>
                      {m.topicTitle}
                    </Text>
                    <Text style={[styles.time, urgent && styles.timeUrgent]}>
                      {days === 0 ? 'bugün' : `${days}g${urgent ? ' ⚠️' : ''}`}
                    </Text>
                  </View>
                  <Text style={styles.q}>{m.question.prompt}</Text>
                  <View style={styles.row2}>
                    {m.wrong_answer_index != null && (
                      <>
                        <Text style={styles.ansBad}>✗ {LETTERS[m.wrong_answer_index]}</Text>
                        <Text style={styles.arrow}>→</Text>
                      </>
                    )}
                    <Text style={styles.ansGood}>✓ {LETTERS[m.question.correct_index]}</Text>
                    <View style={styles.spacer} />
                    <Pressable
                      style={styles.solve}
                      onPress={() =>
                        router.push({
                          pathname: '/quiz',
                          params: { mode: 'single', questionId: m.question.id },
                        })
                      }>
                      <Text style={styles.solveText}>Çöz</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function ageDays(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AtlasColors.surface },
  safe: { flex: 1 },
  scroll: { padding: 18, paddingBottom: 30 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '900', color: AtlasColors.inkStrong },
  urgentPill: {
    backgroundColor: AtlasColors.redLight,
    borderRadius: AtlasRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  urgentText: { color: AtlasColors.redDark, fontSize: 11, fontWeight: '900' },
  sub: { color: AtlasColors.gray, fontSize: 12, fontWeight: '600', marginTop: 4, marginBottom: 12 },
  weekly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#2D1B5E',
    borderRadius: AtlasRadius.card,
    padding: 14,
    marginBottom: 12,
  },
  weeklyEmoji: { fontSize: 26 },
  weeklyText: { flex: 1 },
  weeklyTitle: { color: AtlasColors.white, fontSize: 14, fontWeight: '900' },
  weeklySub: { color: 'rgba(255,255,255,0.7)', fontSize: 11.5, marginTop: 2 },
  weeklyGo: { color: AtlasColors.purple, fontSize: 13, fontWeight: '900' },
  chips: { marginBottom: 12 },
  chip: {
    borderRadius: AtlasRadius.pill,
    borderWidth: 1.5,
    borderColor: AtlasColors.line,
    backgroundColor: AtlasColors.white,
    paddingHorizontal: 13,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipOn: { backgroundColor: AtlasColors.blueLight, borderColor: AtlasColors.blue },
  chipText: { fontSize: 12, fontWeight: '800', color: AtlasColors.gray },
  chipTextOn: { color: AtlasColors.blueDark },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: AtlasColors.inkStrong },
  emptySub: { fontSize: 12.5, color: AtlasColors.gray, fontWeight: '600' },
  card: {
    backgroundColor: AtlasColors.white,
    borderWidth: 1.5,
    borderColor: AtlasColors.line,
    borderRadius: AtlasRadius.card,
    padding: 13,
    marginBottom: 9,
    gap: 8,
  },
  cardUrgent: { borderColor: '#FFC9C9' },
  row1: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: AtlasRadius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { color: AtlasColors.white, fontSize: 10, fontWeight: '900' },
  topic: { flex: 1, fontSize: 11.5, fontWeight: '700', color: AtlasColors.gray },
  time: { fontSize: 11, fontWeight: '800', color: AtlasColors.gray },
  timeUrgent: { color: AtlasColors.red },
  q: { fontSize: 13.5, fontWeight: '700', color: AtlasColors.inkStrong, lineHeight: 19 },
  row2: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ansBad: {
    backgroundColor: AtlasColors.redLight,
    color: AtlasColors.redDark,
    fontSize: 11,
    fontWeight: '900',
    borderRadius: AtlasRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  arrow: { color: AtlasColors.gray, fontSize: 11 },
  ansGood: {
    backgroundColor: AtlasColors.greenLight,
    color: AtlasColors.greenDark,
    fontSize: 11,
    fontWeight: '900',
    borderRadius: AtlasRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  spacer: { flex: 1 },
  solve: {
    backgroundColor: AtlasColors.blue,
    borderRadius: AtlasRadius.pill,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  solveText: { color: AtlasColors.white, fontSize: 12, fontWeight: '900' },
});
