import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AtlasColors, AtlasRadius } from '@/constants/atlas-theme';
import { fetchProfile, fetchSubjectSummaries } from '@/lib/queries';
import type { SubjectSummary } from '@/lib/types';

/**
 * EKRAN 04 — Fetih Haritası — prototip: index.html #scr-map
 * 7 TYT kalesi + TYT Ana Kalesi. İçerik/ilerleme Supabase'ten.
 * (AYT haritası açık karar — BACKEND.md §9.4 — v1'de yalnız TYT.)
 */
export default function MapScreen() {
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [premium, setPremium] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, profile] = await Promise.all([fetchSubjectSummaries(), fetchProfile()]);
      setSubjects(list.filter((s) => s.exam_type === 'tyt'));
      setPremium(profile.is_premium);
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

  const allDone =
    subjects.length > 0 && subjects.every((s) => s.totalTopics > 0 && s.doneTopics === s.totalTopics);

  const openCastle = (s: SubjectSummary) => {
    if (!s.is_free && !premium) {
      Alert.alert(
        '🔒 Premium Kale',
        `${s.name} kalesi premium'la açılır. Tarih kalesi tamamen ücretsiz — önce onu fethet!`,
      );
      return;
    }
    if (s.totalTopics === 0) {
      Alert.alert('🏗️ Yakında', `${s.name} kalesinin içeriği hazırlanıyor.`);
      return;
    }
    router.push({ pathname: '/kale/[subjectId]', params: { subjectId: s.id } });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }>
          <Text style={styles.title}>🗺️ Fetih Haritası</Text>
          <Text style={styles.sub}>Her ders bir kale. Hepsini fethet, Ana Kale düşsün.</Text>

          <View style={styles.grid}>
            {subjects.map((s) => {
              const locked = !s.is_free && !premium;
              const done = s.totalTopics > 0 && s.doneTopics === s.totalTopics;
              const pct = s.totalTopics === 0 ? 0 : Math.round((s.doneTopics / s.totalTopics) * 100);
              return (
                <Pressable
                  key={s.id}
                  style={[styles.castle, { borderColor: s.color }, locked && styles.castleLocked]}
                  onPress={() => openCastle(s)}>
                  <Text style={styles.castleEmoji}>{locked ? '🔒' : s.emoji}</Text>
                  <Text style={styles.castleName}>{s.name}</Text>
                  {locked ? (
                    <Text style={styles.lockText}>Premium</Text>
                  ) : done ? (
                    <Text style={[styles.doneText, { color: s.color }]}>Fethedildi ✓</Text>
                  ) : (
                    <>
                      <View style={styles.track}>
                        <View style={[styles.bar, { width: `${pct}%`, backgroundColor: s.color }]} />
                      </View>
                      <Text style={styles.progText}>
                        {s.doneTopics}/{s.totalTopics} konu
                      </Text>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.boss, allDone && styles.bossOpen]}>
            <Image
              source={require('@/assets/images/atlas/castle-tyt.png')}
              style={styles.bossImg}
              contentFit="contain"
            />
            <Text style={styles.bossTitle}>TYT ANA KALESİ</Text>
            <Text style={styles.bossSub}>
              {allDone
                ? 'Tüm kaleler senin — Ana Kale kuşatması yakında! ⚔️'
                : 'Tüm kaleleri fethedince kapıları açılır.'}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628' },
  safe: { flex: 1 },
  scroll: { padding: 18, paddingBottom: 36 },
  title: { color: AtlasColors.white, fontSize: 22, fontWeight: '900', marginTop: 6 },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 12.5, marginTop: 4, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  castle: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#12263F',
    borderWidth: 2,
    borderRadius: AtlasRadius.castle,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 5,
  },
  castleLocked: { opacity: 0.55, borderColor: '#2A3A50' },
  castleEmoji: { fontSize: 32 },
  castleName: { color: AtlasColors.white, fontSize: 14.5, fontWeight: '900' },
  lockText: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '800' },
  doneText: { fontSize: 11.5, fontWeight: '900' },
  track: {
    alignSelf: 'stretch',
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginTop: 3,
  },
  bar: { height: '100%', borderRadius: 4 },
  progText: { color: 'rgba(255,255,255,0.6)', fontSize: 10.5, fontWeight: '700' },
  boss: {
    marginTop: 16,
    backgroundColor: '#12263F',
    borderRadius: AtlasRadius.castleBoss,
    borderWidth: 2,
    borderColor: '#2A3A50',
    alignItems: 'center',
    padding: 18,
    opacity: 0.75,
  },
  bossOpen: { borderColor: '#FFD700', opacity: 1 },
  bossImg: { width: 110, height: 110 },
  bossTitle: { color: '#FFD700', fontSize: 15, fontWeight: '900', letterSpacing: 1, marginTop: 6 },
  bossSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 4,
  },
});
