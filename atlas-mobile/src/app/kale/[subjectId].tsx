import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AtlasColors, AtlasRadius } from '@/constants/atlas-theme';
import { fetchSubjects, fetchSubjectTree } from '@/lib/queries';
import type { Subject, TopicNode, UnitNode } from '@/lib/types';

/**
 * EKRAN 05 — Kale (konu ağacı) — prototip: index.html #scr-castle
 * Konular lineer açılır (§4.5): done ⭐ / active ▶ / locked 🔒.
 */
export default function CastleScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [tree, setTree] = useState<UnitNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!subjectId) return;
    try {
      setError(null);
      const [subjects, t] = await Promise.all([fetchSubjects(), fetchSubjectTree(subjectId)]);
      setSubject(subjects.find((s) => s.id === subjectId) ?? null);
      setTree(t);
    } catch {
      setError('Kale yüklenemedi — tekrar dene.');
    }
  }, [subjectId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const flat = tree.flatMap((u) => u.topics);
  const doneCount = flat.filter((t) => t.status === 'done').length;
  const color = subject?.color ?? AtlasColors.blue;
  const colorDark = subject?.color_dark ?? AtlasColors.blueDark;

  const openTopic = (topic: TopicNode) => {
    if (topic.status === 'locked') return;
    router.push({ pathname: '/quiz', params: { mode: 'topic', topicId: topic.id } });
  };

  return (
    <View style={[styles.container, { backgroundColor: color }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <View style={styles.headerMid}>
            <Text style={styles.hTitle}>
              {subject?.emoji} {subject?.name ?? '...'} Kalesi
            </Text>
            <Text style={styles.hSub}>
              {doneCount}/{flat.length} konu fethedildi
            </Text>
          </View>
          <View style={styles.hBadge}>
            <Text style={styles.hBadgeText}>
              {flat.length === 0 ? '—' : Math.round((doneCount / flat.length) * 100) + '%'}
            </Text>
          </View>
        </View>

        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scroll}>
            {error && <Text style={styles.error}>{error}</Text>}
            {tree.map((unit) => {
              const unitDone = unit.topics.filter((t) => t.status === 'done').length;
              return (
                <View key={unit.id}>
                  <View style={[styles.secBanner, { backgroundColor: colorDark }]}>
                    <Text style={styles.secEmoji}>{unitDone === unit.topics.length ? '🏆' : '🏹'}</Text>
                    <View style={styles.secText}>
                      <Text style={styles.secSmall}>BÖLÜM {unit.sort_order}</Text>
                      <Text style={styles.secTitle}>{unit.title}</Text>
                    </View>
                    <Text style={styles.secRight}>
                      {unitDone === unit.topics.length ? '✓ ' : ''}
                      {unitDone}/{unit.topics.length}
                    </Text>
                  </View>

                  {unit.topics.map((topic) => (
                    <Pressable
                      key={topic.id}
                      onPress={() => openTopic(topic)}
                      style={[
                        styles.row,
                        topic.status === 'active' && { borderColor: color, borderWidth: 2 },
                        topic.status === 'locked' && styles.rowLocked,
                      ]}>
                      <View
                        style={[
                          styles.rowIcon,
                          topic.status === 'done' && { backgroundColor: AtlasColors.green },
                          topic.status === 'active' && { backgroundColor: color },
                        ]}>
                        <Text style={styles.rowIconText}>
                          {topic.status === 'done' ? '✓' : topic.status === 'active' ? '▶' : '🔒'}
                        </Text>
                      </View>
                      <View style={styles.rowText}>
                        <Text
                          style={[styles.rowTitle, topic.status === 'locked' && styles.rowTitleLocked]}>
                          {topic.title}
                        </Text>
                        <Text style={styles.rowSub}>
                          {topic.status === 'done'
                            ? 'Fethedildi! ' + '⭐'.repeat(Math.max(1, topic.stars))
                            : topic.status === 'active'
                              ? '5 soru • ~4 dk'
                              : 'Kilidi açmak için ilerle'}
                        </Text>
                      </View>
                      {topic.status === 'active' && (
                        <View style={[styles.startPill, { backgroundColor: color }]}>
                          <Text style={styles.startPillText}>BAŞLA</Text>
                        </View>
                      )}
                      {topic.status === 'done' && <Text style={styles.replay}>↻</Text>}
                    </Pressable>
                  ))}
                </View>
              );
            })}
            <Text style={styles.footNote}>
              Fethedilen konular ↻ ile tekrar oynanabilir — yıldızın asla düşmez.
            </Text>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  back: { color: AtlasColors.white, fontSize: 34, fontWeight: '900', marginTop: -4 },
  headerMid: { flex: 1 },
  hTitle: { color: AtlasColors.white, fontSize: 18, fontWeight: '900' },
  hSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11.5, fontWeight: '600', marginTop: 1 },
  hBadge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: AtlasRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hBadgeText: { color: AtlasColors.white, fontSize: 12.5, fontWeight: '900' },
  sheet: {
    flex: 1,
    backgroundColor: AtlasColors.surface,
    borderTopLeftRadius: AtlasRadius.sheet,
    borderTopRightRadius: AtlasRadius.sheet,
  },
  scroll: { padding: 16, paddingBottom: 34, gap: 0 },
  error: {
    color: AtlasColors.redDark,
    backgroundColor: AtlasColors.redLight,
    borderRadius: 12,
    padding: 10,
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 10,
  },
  secBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: AtlasRadius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  secEmoji: { fontSize: 20 },
  secText: { flex: 1 },
  secSmall: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  secTitle: { color: AtlasColors.white, fontSize: 15, fontWeight: '900' },
  secRight: { color: AtlasColors.white, fontSize: 13, fontWeight: '900' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: AtlasColors.white,
    borderWidth: 1.5,
    borderColor: AtlasColors.line,
    borderRadius: AtlasRadius.card,
    padding: 13,
    marginBottom: 8,
  },
  rowLocked: { opacity: 0.6 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AtlasColors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconText: { color: AtlasColors.white, fontSize: 16, fontWeight: '900' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14.5, fontWeight: '900', color: AtlasColors.inkStrong },
  rowTitleLocked: { color: AtlasColors.gray },
  rowSub: { fontSize: 11.5, color: AtlasColors.gray, fontWeight: '600', marginTop: 1 },
  startPill: {
    borderRadius: AtlasRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  startPillText: { color: AtlasColors.white, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  replay: { fontSize: 20, color: AtlasColors.gray, fontWeight: '900' },
  footNote: {
    textAlign: 'center',
    color: AtlasColors.gray,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 10,
  },
});
