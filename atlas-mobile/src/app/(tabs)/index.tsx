import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatCountdown } from '@/components/hearts/hearts-empty-card';
import { Btn3D } from '@/components/ui/btn-3d';
import { Card } from '@/components/ui/card';
import { HeartsRow } from '@/components/ui/hearts-row';
import { ProgressBar } from '@/components/ui/progress-bar';
import { FireBadge } from '@/components/ui/animated/fire-badge';
import { AtlasColors, AtlasFonts, AtlasRadius, AtlasSurface } from '@/constants/atlas-theme';
import { daysUntil } from '@/lib/exam-countdown-notification';
import { fetchContinueTarget, fetchOpenMistakeCount, fetchProfile, fetchXpToday, getHearts, type HeartsState } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useThemeMode } from '@/lib/theme-context';
import type { ContinueTarget, Profile } from '@/lib/types';

/**
 * EKRAN 03 — Ana Sayfa (Ev) — prototip: ../../../index.html #scr-home
 * Streak / can / günlük XP + "Devam Et" kartı, hepsi Supabase'ten.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { mode, toggle } = useThemeMode();
  const surface = AtlasSurface[mode];
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hearts, setHearts] = useState<HeartsState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [xpToday, setXpToday] = useState(0);
  const [target, setTarget] = useState<ContinueTarget | null>(null);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const p = await fetchProfile();
      const [xp, t, mc, h] = await Promise.all([
        fetchXpToday(),
        fetchContinueTarget(p.is_premium),
        fetchOpenMistakeCount(),
        getHearts(),
      ]);
      setProfile(p);
      setXpToday(xp);
      setTarget(t);
      setMistakeCount(mc);
      setHearts(h);
    } catch {
      setError('Veriler yüklenemedi — internetini kontrol edip aşağı çek.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Günaydın! ☀️' : hour < 18 ? 'İyi günler! 👋' : 'İyi akşamlar! 🌙';
  const name = profile?.username || 'Komutan';
  const goal = profile?.daily_xp_goal ?? 200;
  const xpPct = goal > 0 ? Math.min(1, xpToday / goal) : 0;

  return (
    <View style={[styles.container, { backgroundColor: surface.bg }]}>
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
              <Text style={[styles.name, { color: surface.text }]}>{name}</Text>
            </View>
            <View style={styles.headerActions}>
              {profile?.exam_date &&
                (() => {
                  const days = daysUntil(profile.exam_date as string);
                  return (
                    <Pressable
                      onPress={() => router.push('/ayarlar')}
                      hitSlop={6}
                      style={[styles.examBadge, { backgroundColor: surface.card, borderColor: surface.cardBorder }]}>
                      <Text style={styles.examBadgeEmoji}>📅</Text>
                      <Text style={[styles.examBadgeText, { color: surface.text }]}>
                        {days > 0 ? `${days} gün` : days === 0 ? 'Bugün!' : 'Sınav geçti'}
                      </Text>
                    </Pressable>
                  );
                })()}
              <Pressable
                onPress={() => router.push('/ayarlar')}
                hitSlop={10}
                style={[styles.modeBtn, { backgroundColor: surface.card, borderColor: surface.cardBorder }]}>
                <Text style={styles.modeBtnIcon}>⚙️</Text>
              </Pressable>
              <Pressable
                onPress={toggle}
                hitSlop={10}
                style={[styles.modeBtn, { backgroundColor: surface.card, borderColor: surface.cardBorder }]}>
                <Text style={styles.modeBtnIcon}>{mode === 'dark' ? '☀️' : '🌙'}</Text>
              </Pressable>
              <Pressable onPress={() => supabase.auth.signOut()} hitSlop={10}>
                <Text style={styles.logout}>Çıkış</Text>
              </Pressable>
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.statRow}>
            <Card style={styles.statCard}>
              <FireBadge size={22} />
              <Text style={[styles.statNum, { color: surface.text }]}>{profile?.streak_count ?? 0}</Text>
              <Text style={[styles.statLabel, { color: surface.textSecondary }]}>Günlük Seri</Text>
            </Card>
            <Card style={styles.statCard}>
              <HeartsRow hearts={hearts?.hearts ?? profile?.hearts ?? 5} size={16} />
              <Text style={[styles.statNum, { color: surface.text }]}>{hearts?.hearts ?? profile?.hearts ?? 5}</Text>
              <Text style={[styles.statLabel, { color: surface.textSecondary }]}>Can</Text>
              {hearts && hearts.hearts < 5 && hearts.next_heart_at && (
                <Text style={[styles.heartsCountdown, { color: surface.textSecondary }]}>
                  +1: {formatCountdown(new Date(hearts.next_heart_at).getTime() - now)}
                </Text>
              )}
            </Card>
          </View>

          <Card style={styles.goalCard}>
            <View style={styles.goalHead}>
              <Text style={[styles.goalTitle, { color: surface.text }]}>Günlük Hedef</Text>
              <Text style={styles.goalPct}>
                {xpToday}/{goal} XP
              </Text>
            </View>
            <ProgressBar progress={xpPct} height={12} />
            <Text style={[styles.goalHint, { color: surface.textSecondary }]}>
              {xpPct >= 1
                ? 'Hedef tamam — kale duvarları bugün de yükseldi! 🏰'
                : `Hedefe ${Math.max(0, goal - xpToday)} XP kaldı. Bir konu ≈ 45 XP.`}
            </Text>
          </Card>

          {target ? (
            <Card style={[styles.continueCard, { backgroundColor: target.subject.color }]}>
              <Text style={styles.contBadge}>
                {target.subject.emoji} {target.subject.name.toLocaleUpperCase('tr')} KALESİ
              </Text>
              <Text style={styles.contTitle}>{target.topicTitle}</Text>
              <Text style={styles.contSub}>5 soru • ~4 dk • fethet, sıradaki konu açılsın</Text>
              <Btn3D
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: '/kale/[subjectId]',
                    params: { subjectId: target.subject.id },
                  } as never)
                }>
                Fethe Devam →
              </Btn3D>
            </Card>
          ) : (
            <Card style={styles.continueCard}>
              <Text style={styles.contTitle}>Tüm açık konular fethedildi! 🎉</Text>
              <Text style={styles.contSub}>Haritadan yeni bir kaleye sefer düzenle.</Text>
              <Btn3D variant="orange" onPress={() => router.push('/harita')}>
                Haritaya Git 🗺️
              </Btn3D>
            </Card>
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

          <Pressable style={styles.mistakesTeaser} onPress={() => router.push('/yanlislar')}>
            <Text style={styles.mistakesEmoji}>⚠️</Text>
            <View style={styles.mapText}>
              <Text style={styles.mistakesTitle}>
                {mistakeCount > 0 ? `${mistakeCount} Soru Bekliyor` : 'Yanlış yok — harika gidiyorsun!'}
              </Text>
              <Text style={styles.mistakesSub}>
                {mistakeCount > 0 ? 'Yanlışlarını temizle, kaleni güçlendir!' : 'Böyle devam 🎉'}
              </Text>
            </View>
            {mistakeCount > 0 && <Text style={styles.mistakesArrow}>Çöz</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AtlasColors.surface },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 30 },
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
  avatarText: { color: AtlasColors.white, fontSize: 20, fontFamily: AtlasFonts.heading },
  hello: { color: AtlasColors.gray, fontSize: 11, fontFamily: AtlasFonts.bodyBold },
  name: { color: AtlasColors.inkStrong, fontSize: 17, fontFamily: AtlasFonts.heading },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnIcon: { fontSize: 15 },
  examBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: AtlasRadius.pill,
    paddingHorizontal: 10,
    height: 32,
  },
  examBadgeEmoji: { fontSize: 12 },
  examBadgeText: { fontSize: 11.5, fontFamily: AtlasFonts.bodyBold },
  logout: { color: AtlasColors.gray, fontSize: 12, fontFamily: AtlasFonts.bodyBold },
  error: {
    color: AtlasColors.redDark,
    backgroundColor: AtlasColors.redLight,
    borderRadius: 12,
    padding: 10,
    fontSize: 12.5,
    fontFamily: AtlasFonts.bodyBold,
    marginBottom: 10,
  },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14 },
  statNum: { fontSize: 19, fontFamily: AtlasFonts.heading, color: AtlasColors.inkStrong },
  statLabel: { fontSize: 10, fontFamily: AtlasFonts.bodyBold, color: AtlasColors.gray },
  heartsCountdown: { fontSize: 9, fontFamily: AtlasFonts.bodySemi, marginTop: -2 },
  goalCard: { gap: 9, marginBottom: 12 },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalTitle: { fontSize: 14, fontFamily: AtlasFonts.heading, color: AtlasColors.inkStrong },
  goalPct: { fontSize: 12.5, fontFamily: AtlasFonts.bodyBold, color: AtlasColors.greenDark },
  goalHint: { fontSize: 11.5, color: AtlasColors.gray, fontFamily: AtlasFonts.bodySemi },
  continueCard: {
    backgroundColor: AtlasColors.violet,
    borderWidth: 0,
    padding: 18,
    marginBottom: 12,
    gap: 6,
  },
  contBadge: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10.5,
    fontFamily: AtlasFonts.heading,
    letterSpacing: 0.6,
  },
  contTitle: { color: AtlasColors.white, fontSize: 19, fontFamily: AtlasFonts.heading },
  contSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: AtlasFonts.bodySemi, marginBottom: 8 },
  mapTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A3A5C',
    borderRadius: AtlasRadius.card,
    padding: 14,
    marginBottom: 12,
  },
  mapImg: { width: 52, height: 52 },
  mapText: { flex: 1 },
  mapTitle: { color: AtlasColors.white, fontSize: 15, fontFamily: AtlasFonts.heading },
  mapSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11.5, marginTop: 2, fontFamily: AtlasFonts.bodySemi },
  mapArrow: { color: AtlasColors.white, fontSize: 20, fontFamily: AtlasFonts.heading },
  mistakesTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: AtlasColors.redLight,
    borderWidth: 1.5,
    borderColor: 'rgba(255,75,75,0.33)',
    borderRadius: AtlasRadius.card,
    padding: 14,
  },
  mistakesEmoji: { fontSize: 28 },
  mistakesTitle: { color: AtlasColors.redDark, fontSize: 14, fontFamily: AtlasFonts.heading },
  mistakesSub: { color: AtlasColors.ink, fontSize: 11.5, marginTop: 2, fontFamily: AtlasFonts.bodySemi },
  mistakesArrow: {
    color: AtlasColors.white,
    backgroundColor: AtlasColors.red,
    fontSize: 12,
    fontFamily: AtlasFonts.heading,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: AtlasRadius.pill,
  },
});
