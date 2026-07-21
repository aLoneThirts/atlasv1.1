import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatCountdown } from '@/components/hearts/hearts-empty-card';
import { BadgeUnlockPopup } from '@/components/badges/badge-unlock-popup';
import { Btn3D } from '@/components/ui/btn-3d';
import { Card } from '@/components/ui/card';
import { HeartsRow } from '@/components/ui/hearts-row';
import { Interactive } from '@/components/ui/interactive';
import { ProgressBar } from '@/components/ui/progress-bar';
import { FireBadge } from '@/components/ui/animated/fire-badge';
import { AtlasColors, AtlasFonts, AtlasRadius, AtlasSurface } from '@/constants/atlas-theme';
import { daysUntil } from '@/lib/exam-countdown-notification';
import {
  checkAndAwardBadges,
  fetchBadges,
  fetchContinueTarget,
  fetchOpenMistakeCount,
  fetchProfile,
  fetchUnreadNotificationCount,
  fetchXpToday,
  getHearts,
  istanbulDateStr,
  type HeartsState,
} from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useThemeMode } from '@/lib/theme-context';
import type { Badge, ContinueTarget, Profile } from '@/lib/types';

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
  const [badges, setBadges] = useState<Badge[]>([]);
  const [unlockQueue, setUnlockQueue] = useState<Badge[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      const p = await fetchProfile();
      const [xp, t, mc, h, unread] = await Promise.all([
        fetchXpToday(),
        fetchContinueTarget(p.is_premium, p.exam_track),
        fetchOpenMistakeCount(),
        getHearts(),
        fetchUnreadNotificationCount(),
      ]);
      setProfile(p);
      setXpToday(xp);
      setTarget(t);
      setMistakeCount(mc);
      setHearts(h);
      setUnreadCount(unread);

      // Rozet kontrolü — güncel istatistikler yeni bir rozetin eşiğini geçtiyse
      // kaydedip döner, kutlama popup'ı gösterilir.
      const newlyEarned = await checkAndAwardBadges();
      setBadges(await fetchBadges());
      if (newlyEarned.length > 0) setUnlockQueue((q) => [...q, ...newlyEarned]);
    } catch (e) {
      console.error('[ev] yüklenemedi:', e);
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
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  const greetingEmoji = hour < 12 ? '☀️' : hour < 18 ? '👋' : '🌙';
  const name = profile?.username || 'Komutan';
  const goal = profile?.daily_xp_goal ?? 200;
  const xpPct = goal > 0 ? Math.min(1, xpToday / goal) : 0;
  const heartsNow = hearts?.hearts ?? profile?.hearts ?? 5;

  // Seri sunucuda yalnız quiz bitişinde yeniden hesaplanır (finish_quiz §4.2) —
  // gün atlanınca DB'deki streak_count anında 0'a düşmez, bir sonraki quize kadar
  // "bayat" kalır. Burada İstanbul gününe göre client'ta EFEKTİF değeri türetiyoruz:
  // streak_updated_on bugün ya da dün değilse seri fiilen kırılmış demektir, 0 göster.
  const streakToday = istanbulDateStr();
  const streakYesterday = istanbulDateStr(-1);
  const streakAlive =
    profile?.streak_updated_on === streakToday || profile?.streak_updated_on === streakYesterday;
  const displayedStreak = streakAlive ? (profile?.streak_count ?? 0) : 0;
  const streakAtRisk = streakAlive && profile?.streak_updated_on === streakYesterday && displayedStreak > 0;

  return (
    <View style={[styles.container, { backgroundColor: surface.bg }]}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.hello}>
                {greeting} {greetingEmoji}
              </Text>
              <Text style={[styles.name, { color: surface.text }]}>{name}</Text>
            </View>
            <View style={styles.headerActions}>
              {profile?.exam_date &&
                (() => {
                  const days = daysUntil(profile.exam_date as string);
                  return (
                    <Interactive
                      onPress={() => router.push('/ayarlar')}
                      hitSlop={6}
                      style={[styles.examBadge, { backgroundColor: surface.card, borderColor: surface.cardBorder }]}>
                      <Text style={styles.examBadgeEmoji}>📅</Text>
                      <Text style={[styles.examBadgeText, { color: surface.text }]}>
                        {days > 0 ? `${days} gün` : days === 0 ? 'Bugün!' : 'Sınav geçti'}
                      </Text>
                    </Interactive>
                  );
                })()}
              <Interactive
                onPress={() => router.push('/bildirimler')}
                hitSlop={10}
                style={[styles.modeBtn, { backgroundColor: surface.card, borderColor: surface.cardBorder }]}>
                <Text style={styles.modeBtnIcon}>🔔</Text>
                {unreadCount > 0 && <View style={styles.notifDot} />}
              </Interactive>
              <Interactive
                onPress={() => router.push('/ayarlar')}
                hitSlop={10}
                style={[styles.modeBtn, { backgroundColor: surface.card, borderColor: surface.cardBorder }]}>
                <Text style={styles.modeBtnIcon}>⚙️</Text>
              </Interactive>
              <Interactive
                onPress={toggle}
                hitSlop={10}
                style={[styles.modeBtn, { backgroundColor: surface.card, borderColor: surface.cardBorder }]}>
                <Text style={styles.modeBtnIcon}>{mode === 'dark' ? '☀️' : '🌙'}</Text>
              </Interactive>
              <Interactive onPress={() => supabase.auth.signOut()} hitSlop={10}>
                <Text style={styles.logout}>Çıkış</Text>
              </Interactive>
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {/* Bugün — tek kartta seri/can/XP, önceden 3 ayrı kart olan dağınık
              görünüm birleştirildi (Deneme sekmesindeki istatistik kaşı ile
              aynı yoğunluk). */}
          <Card style={styles.todayCard}>
            <View style={styles.todayRow}>
              <View style={styles.todayMetric}>
                <FireBadge size={20} />
                <Text style={[styles.todayNum, { color: surface.text }]}>{displayedStreak}</Text>
                <Text style={[styles.todayLabel, { color: surface.textSecondary }]}>Gün Seri</Text>
              </View>
              <View style={[styles.todayDivider, { backgroundColor: surface.cardBorder }]} />
              <View style={styles.todayMetric}>
                <HeartsRow hearts={heartsNow} size={14} />
                <Text style={[styles.todayNum, { color: surface.text }]}>{heartsNow}</Text>
                <Text style={[styles.todayLabel, { color: surface.textSecondary }]}>Can</Text>
              </View>
              <View style={[styles.todayDivider, { backgroundColor: surface.cardBorder }]} />
              <View style={styles.todayMetric}>
                <Text style={styles.todayEmoji}>⭐</Text>
                <Text style={[styles.todayNum, { color: surface.text }]}>{xpToday}</Text>
                <Text style={[styles.todayLabel, { color: surface.textSecondary }]}>Bugünkü XP</Text>
              </View>
            </View>

            {streakAtRisk && (
              <View style={styles.riskBanner}>
                <Text style={styles.riskBannerText}>🔥 Bugün çöz, serini kaybetme!</Text>
              </View>
            )}
            {hearts && hearts.hearts < 5 && hearts.next_heart_at && (
              <Text style={[styles.heartsCountdown, { color: surface.textSecondary }]}>
                +1 can: {formatCountdown(new Date(hearts.next_heart_at).getTime() - now)}
              </Text>
            )}

            <View style={styles.goalDivider} />
            <View style={styles.goalHead}>
              <Text style={[styles.goalTitle, { color: surface.text }]}>Günlük Hedef</Text>
              <Text style={styles.goalPct}>
                {xpToday}/{goal} XP
              </Text>
            </View>
            <ProgressBar progress={xpPct} height={10} />
            <Text style={[styles.goalHint, { color: surface.textSecondary }]}>
              {xpPct >= 1
                ? 'Hedef tamam — kale duvarları bugün de yükseldi! 🏰'
                : `Hedefe ${Math.max(0, goal - xpToday)} XP kaldı. Bir konu ≈ 45 XP.`}
            </Text>
          </Card>

          {badges.length > 0 && (
            <Interactive
              style={[styles.badgeTeaser, { backgroundColor: surface.card, borderColor: surface.cardBorder }]}
              onPress={() => router.push('/rozetler')}>
              <Text style={styles.badgeTeaserEmoji}>🏅</Text>
              <View style={styles.mapText}>
                <Text style={[styles.badgeTeaserTitle, { color: surface.text }]}>
                  Rozetlerim ({badges.filter((b) => b.earned).length}/{badges.length})
                </Text>
                <Text style={[styles.badgeTeaserSub, { color: surface.textSecondary }]}>Tümünü görmek için dokun</Text>
              </View>
              <Text style={[styles.chevron, { color: surface.textSecondary }]}>›</Text>
            </Interactive>
          )}

          {/* Devam Et — birincil CTA, konu rengiyle "arma" rozeti büyütüldü */}
          {target ? (
            <Card style={[styles.continueCard, { backgroundColor: target.subject.color }]}>
              <View style={styles.continueRow}>
                <View style={styles.crest}>
                  <Text style={styles.crestEmoji}>{target.subject.emoji}</Text>
                </View>
                <View style={styles.continueTextCol}>
                  <Text style={styles.contBadge}>{target.subject.name.toLocaleUpperCase('tr')} KALESİ</Text>
                  <Text style={styles.contTitle} numberOfLines={2}>
                    {target.topicTitle}
                  </Text>
                  <Text style={styles.contSub}>5 soru • ~4 dk</Text>
                </View>
              </View>
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
            <Card style={[styles.continueCard, { backgroundColor: AtlasColors.violet }]}>
              <Text style={styles.contTitle}>Tüm açık konular fethedildi! 🎉</Text>
              <Text style={styles.contSub}>Haritadan yeni bir kaleye sefer düzenle.</Text>
              <Btn3D variant="orange" onPress={() => router.push('/harita')}>
                Haritaya Git 🗺️
              </Btn3D>
            </Card>
          )}

          {/* Hızlı erişim — tutarlı ikon-rozet + başlık/alt başlık kalıbı */}
          <Text style={[styles.sectionLabel, { color: surface.textSecondary }]}>HIZLI ERİŞİM</Text>

          <Interactive style={[styles.actionRow, { backgroundColor: surface.card, borderColor: surface.cardBorder }]} onPress={() => router.push('/harita')}>
            <View style={[styles.actionIconWrap, { backgroundColor: '#1A3A5C' }]}>
              <Image
                source={require('@/assets/images/atlas/castle-tyt.png')}
                style={styles.actionIconImg}
                contentFit="contain"
              />
            </View>
            <View style={styles.mapText}>
              <Text style={[styles.actionTitle, { color: surface.text }]}>Fetih Haritası</Text>
              <Text style={[styles.actionSub, { color: surface.textSecondary }]}>
                7 kale seni bekliyor — TYT Ana Kalesi&apos;ne giden yol
              </Text>
            </View>
            <Text style={[styles.chevron, { color: surface.textSecondary }]}>›</Text>
          </Interactive>

          <Interactive
            style={[
              styles.actionRow,
              mistakeCount > 0
                ? { backgroundColor: AtlasColors.redLight, borderColor: 'rgba(255,75,75,0.33)' }
                : { backgroundColor: surface.card, borderColor: surface.cardBorder },
            ]}
            onPress={() => router.push('/yanlislar')}>
            <View style={[styles.actionIconWrap, { backgroundColor: mistakeCount > 0 ? AtlasColors.red : AtlasColors.greenLight }]}>
              <Text style={styles.actionIconEmoji}>{mistakeCount > 0 ? '⚠️' : '✅'}</Text>
            </View>
            <View style={styles.mapText}>
              <Text style={[styles.actionTitle, { color: mistakeCount > 0 ? AtlasColors.redDark : surface.text }]}>
                {mistakeCount > 0 ? `${mistakeCount} Soru Bekliyor` : 'Yanlış yok — harika gidiyorsun!'}
              </Text>
              <Text style={[styles.actionSub, { color: mistakeCount > 0 ? AtlasColors.ink : surface.textSecondary }]}>
                {mistakeCount > 0 ? 'Yanlışlarını temizle, kaleni güçlendir!' : 'Böyle devam 🎉'}
              </Text>
            </View>
            {mistakeCount > 0 ? (
              <View style={styles.mistakesArrow}>
                <Text style={styles.mistakesArrowText}>Çöz</Text>
              </View>
            ) : (
              <Text style={[styles.chevron, { color: surface.textSecondary }]}>›</Text>
            )}
          </Interactive>
        </ScrollView>
      </SafeAreaView>
      <BadgeUnlockPopup badge={unlockQueue[0] ?? null} onClose={() => setUnlockQueue((q) => q.slice(1))} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AtlasColors.surface },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 30, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 4 },
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modeBtn: {
    position: 'relative',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AtlasColors.red,
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
  },

  /* Bugün kartı — seri/can/XP tek yerde */
  todayCard: { gap: 4 },
  todayRow: { flexDirection: 'row', alignItems: 'center' },
  todayMetric: { flex: 1, alignItems: 'center', gap: 3 },
  todayDivider: { width: 1, alignSelf: 'stretch', marginVertical: 2 },
  todayEmoji: { fontSize: 17 },
  todayNum: { fontSize: 19, fontFamily: AtlasFonts.heading, marginTop: 1 },
  todayLabel: { fontSize: 9.5, fontFamily: AtlasFonts.bodyBold },
  riskBanner: {
    backgroundColor: AtlasColors.redLight,
    borderRadius: AtlasRadius.button,
    paddingVertical: 7,
    marginTop: 8,
    alignItems: 'center',
  },
  riskBannerText: { color: AtlasColors.redDark, fontSize: 11.5, fontFamily: AtlasFonts.bodyBold },
  heartsCountdown: { fontSize: 10.5, fontFamily: AtlasFonts.bodySemi, textAlign: 'center', marginTop: 8 },
  goalDivider: { height: 1, backgroundColor: 'rgba(128,128,128,0.15)', marginVertical: 12 },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  goalTitle: { fontSize: 13, fontFamily: AtlasFonts.heading },
  goalPct: { fontSize: 12, fontFamily: AtlasFonts.bodyBold, color: AtlasColors.greenDark },
  goalHint: { fontSize: 11, fontFamily: AtlasFonts.bodySemi, marginTop: 7, color: AtlasColors.gray },

  badgeTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: AtlasRadius.card,
    padding: 14,
  },
  badgeTeaserEmoji: { fontSize: 28 },
  badgeTeaserTitle: { fontSize: 14, fontFamily: AtlasFonts.heading },
  badgeTeaserSub: { fontSize: 11.5, marginTop: 2, fontFamily: AtlasFonts.bodySemi },
  chevron: { fontSize: 22, fontFamily: AtlasFonts.heading },

  /* Devam Et */
  continueCard: { borderWidth: 0, padding: 18, gap: 14 },
  continueRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  crest: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestEmoji: { fontSize: 26 },
  continueTextCol: { flex: 1, gap: 3 },
  contBadge: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10.5,
    fontFamily: AtlasFonts.heading,
    letterSpacing: 0.6,
  },
  contTitle: { color: AtlasColors.white, fontSize: 17, fontFamily: AtlasFonts.heading, lineHeight: 22 },
  contSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: AtlasFonts.bodySemi },

  /* Hızlı erişim */
  sectionLabel: { fontSize: 10.5, fontFamily: AtlasFonts.bodyBold, letterSpacing: 0.8, marginTop: 2, marginLeft: 2 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: AtlasRadius.card,
    padding: 12,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconImg: { width: 30, height: 30 },
  actionIconEmoji: { fontSize: 20 },
  mapText: { flex: 1 },
  actionTitle: { fontSize: 14, fontFamily: AtlasFonts.heading },
  actionSub: { fontSize: 11.5, marginTop: 2, fontFamily: AtlasFonts.bodySemi },
  mistakesArrow: {
    backgroundColor: AtlasColors.red,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: AtlasRadius.pill,
  },
  mistakesArrowText: { color: AtlasColors.white, fontSize: 12, fontFamily: AtlasFonts.heading },
});
