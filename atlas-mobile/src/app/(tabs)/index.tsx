import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3d } from '@/components/btn-3d';
import { AtlasColors, AtlasRadius } from '@/constants/atlas-theme';
import { fetchContinueTarget, fetchProfile, fetchXpToday } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { ContinueTarget, Profile } from '@/lib/types';

/**
 * EKRAN 03 — Ana Sayfa (Ev) — prototip: index.html #scr-home
 * Streak / can / günlük XP + "Devam Et" kartı, hepsi Supabase'ten.
 */
export default function HomeScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [xpToday, setXpToday] = useState(0);
  const [target, setTarget] = useState<ContinueTarget | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const p = await fetchProfile();
      const [xp, t] = await Promise.all([fetchXpToday(), fetchContinueTarget(p.is_premium)]);
      setProfile(p);
      setXpToday(xp);
      setTarget(t);
    } catch {
      setError('Veriler yüklenemedi — internetini kontrol edip aşağı çek.');
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Günaydın! ☀️' : hour < 18 ? 'İyi günler! 👋' : 'İyi akşamlar! 🌙';
  const name = profile?.username || 'Komutan';
  const goal = profile?.daily_xp_goal ?? 200;
  const xpPct = Math.min(100, Math.round((xpToday / goal) * 100));

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.hello}>{greeting}</Text>
              <Text style={styles.name}>{name}</Text>
            </View>
            <Pressable onPress={() => supabase.auth.signOut()} hitSlop={10}>
              <Text style={styles.logout}>Çıkış</Text>
            </Pressable>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={styles.statNum}>{profile?.streak_count ?? 0}</Text>
              <Text style={styles.statLabel}>Günlük Seri</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statEmoji}>❤️</Text>
              <Text style={styles.statNum}>{profile?.is_premium ? '∞' : (profile?.hearts ?? 5)}</Text>
              <Text style={styles.statLabel}>Can</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statEmoji}>⭐</Text>
              <Text style={styles.statNum}>{xpToday}</Text>
              <Text style={styles.statLabel}>Bugünkü XP</Text>
            </View>
          </View>

          <View style={styles.goalCard}>
            <View style={styles.goalHead}>
              <Text style={styles.goalTitle}>Günlük Hedef</Text>
              <Text style={styles.goalPct}>
                {xpToday}/{goal} XP
              </Text>
            </View>
            <View style={styles.goalTrack}>
              <View style={[styles.goalBar, { width: `${xpPct}%` }]} />
            </View>
            <Text style={styles.goalHint}>
              {xpPct >= 100
                ? 'Hedef tamam — kale duvarları bugün de yükseldi! 🏰'
                : `Hedefe ${Math.max(0, goal - xpToday)} XP kaldı. Bir konu ≈ 45 XP.`}
            </Text>
          </View>

          {target ? (
            <View style={[styles.continueCard, { backgroundColor: target.subject.color }]}>
              <Text style={styles.contBadge}>
                {target.subject.emoji} {target.subject.name.toLocaleUpperCase('tr')} KALESİ
              </Text>
              <Text style={styles.contTitle}>{target.topicTitle}</Text>
              <Text style={styles.contSub}>5 soru • ~4 dk • fethet, sıradaki konu açılsın</Text>
              <Btn3d
                label="Fethe Devam →"
                color={AtlasColors.white}
                colorDark="rgba(0,0,0,0.35)"
                textColor={target.subject.color_dark}
                onPress={() =>
                  router.push({
                    pathname: '/quiz',
                    params: { mode: 'topic', topicId: target.topicId },
                  })
                }
              />
            </View>
          ) : (
            <View style={styles.continueCard}>
              <Text style={styles.contTitle}>Tüm açık konular fethedildi! 🎉</Text>
              <Text style={styles.contSub}>Haritadan yeni bir kaleye sefer düzenle.</Text>
              <Btn3d label="Haritaya Git 🗺️" onPress={() => router.push('/harita')} />
            </View>
          )}

          <Pressable style={styles.mapTeaser} onPress={() => router.push('/harita')}>
            <Image
              source={require('@/assets/images/atlas/castle-tyt.png')}
              style={styles.mapImg}
              contentFit="contain"
            />
            <View style={styles.mapText}>
              <Text style={styles.mapTitle}>Fetih Haritası</Text>
              <Text style={styles.mapSub}>7 kale seni bekliyor — TYT Ana Kalesi&apos;ne giden yol</Text>
            </View>
            <Text style={styles.mapArrow}>→</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AtlasColors.surface },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 },
  headerText: { flex: 1 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: AtlasColors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: AtlasColors.white, fontSize: 20, fontWeight: '900' },
  hello: { color: AtlasColors.gray, fontSize: 11, fontWeight: '600' },
  name: { color: AtlasColors.inkStrong, fontSize: 17, fontWeight: '900' },
  logout: { color: AtlasColors.gray, fontSize: 12, fontWeight: '700' },
  error: {
    color: AtlasColors.redDark,
    backgroundColor: AtlasColors.redLight,
    borderRadius: 12,
    padding: 10,
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 10,
  },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stat: {
    flex: 1,
    backgroundColor: AtlasColors.white,
    borderWidth: 1.5,
    borderColor: AtlasColors.line,
    borderRadius: AtlasRadius.card,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 2,
  },
  statEmoji: { fontSize: 20 },
  statNum: { fontSize: 19, fontWeight: '900', color: AtlasColors.inkStrong },
  statLabel: { fontSize: 10, fontWeight: '700', color: AtlasColors.gray },
  goalCard: {
    backgroundColor: AtlasColors.white,
    borderWidth: 1.5,
    borderColor: AtlasColors.line,
    borderRadius: AtlasRadius.card,
    padding: 16,
    marginBottom: 12,
    gap: 9,
  },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalTitle: { fontSize: 14, fontWeight: '900', color: AtlasColors.inkStrong },
  goalPct: { fontSize: 12.5, fontWeight: '800', color: AtlasColors.greenDark },
  goalTrack: { height: 12, borderRadius: 6, backgroundColor: AtlasColors.card, overflow: 'hidden' },
  goalBar: { height: '100%', borderRadius: 6, backgroundColor: AtlasColors.green },
  goalHint: { fontSize: 11.5, color: AtlasColors.gray, fontWeight: '600' },
  continueCard: {
    backgroundColor: AtlasColors.violet,
    borderRadius: AtlasRadius.card,
    padding: 18,
    marginBottom: 12,
    gap: 6,
  },
  contBadge: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  contTitle: { color: AtlasColors.white, fontSize: 19, fontWeight: '900' },
  contSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  mapTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A3A5C',
    borderRadius: AtlasRadius.card,
    padding: 14,
  },
  mapImg: { width: 52, height: 52 },
  mapText: { flex: 1 },
  mapTitle: { color: AtlasColors.white, fontSize: 15, fontWeight: '900' },
  mapSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11.5, marginTop: 2 },
  mapArrow: { color: AtlasColors.white, fontSize: 20, fontWeight: '900' },
});
