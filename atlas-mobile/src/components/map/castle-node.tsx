import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlowHalo } from '@/components/ui/glow-halo';
import { ProgressBar } from '@/components/ui/progress-bar';
import { PulsingBadge } from '@/components/ui/animated/pulsing-badge';
import { AtlasColors, AtlasFonts, ledgeShadow, ledgeShadowWeb } from '@/constants/atlas-theme';
import type { CastleViewModel } from '@/lib/map-progress';

import { castleXY } from './map-layout';

const ICON_SIZE = 64;
const NODE_WIDTH = 84;

/**
 * Tek bir ders kalesi — konumu radyal düzenden (referans 393x852 uzayı) gelir,
 * gerçek piksele `scale` ile taşınır. İkon boyutu sabit kalır (scale aralığı
 * dar — ~0.85-1.17 varsayılmıştı) ama "FETHET!"/"ALINDI!" rozetleri BUNUN
 * dışında — bunlar komşu kalelere göre yatayda taşan geniş pill'ler, düşük
 * scale'de (ör. dar web pencerelerinde MIN_MAP_SCALE=0.82 tabanına inildiğinde)
 * komşu kale rozetleriyle/ana kale etiketiyle görsel olarak çakışıyordu (canlı
 * ekran görüntüsüyle doğrulandı). `badgeScale` ile bu rozetler haritanın genel
 * scale'ine göre küçülüp aradaki boşluğu koruyor — okunabilirlik için 0.7 altına
 * inmiyor.
 */
export function CastleNode({
  castle,
  index,
  total,
  scale,
}: {
  castle: CastleViewModel;
  index: number;
  total: number;
  scale: number;
}) {
  const router = useRouter();
  const { x, y } = castleXY(index, total);
  const px = x * scale;
  const py = y * scale;
  const badgeScale = Math.max(0.7, Math.min(1, scale));
  const { subject, frac, state } = castle;
  const locked = state === 'locked';
  const done = state === 'done';

  const onPress = () => {
    if (locked) {
      router.push('/premium');
      return;
    }
    router.push({ pathname: '/kale/[subjectId]', params: { subjectId: subject.id } } as never);
  };

  const active = state === 'active';
  const elevated = Platform.OS === 'web' ? ledgeShadowWeb(subject.color_dark, 4) : ledgeShadow(subject.color_dark, 4);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.wrapper, { left: px - NODE_WIDTH / 2, top: py - ICON_SIZE / 2 - 8, width: NODE_WIDTH }]}>
      {done && (
        <Text
          style={[
            styles.alindi,
            {
              top: -13 * badgeScale,
              fontSize: 9 * badgeScale,
              paddingHorizontal: 8 * badgeScale,
              paddingVertical: 3 * badgeScale,
            },
          ]}>
          ALINDI!
        </Text>
      )}
      {active && (
        <PulsingBadge style={[styles.fethetWrap, { top: -34 * badgeScale }]}>
          <Text
            style={[
              styles.fethet,
              {
                fontSize: 9.5 * badgeScale,
                paddingHorizontal: 9 * badgeScale,
                paddingVertical: 4 * badgeScale,
              },
            ]}>
            FETHET!
          </Text>
        </PulsingBadge>
      )}
      <View style={styles.iconSlot}>
        <View style={styles.groundShadow} />
        {(done || active) && <GlowHalo color={subject.color} size={ICON_SIZE} opacity={done ? 0.8 : 0.6} />}
        <View
          style={[
            styles.icon,
            !locked && elevated,
            {
              backgroundColor: subject.color,
              borderColor: subject.color_dark,
              opacity: locked ? 0.5 : 1,
            },
          ]}>
          <Text style={styles.emoji}>{subject.emoji}</Text>
          {locked && (
            <View style={styles.lockOverlay}>
              <Text style={styles.lock}>🔒</Text>
            </View>
          )}
        </View>
        {!locked && (
          <View style={styles.progRing}>
            <ProgressBar progress={frac} color="#FFD700" trackColor="rgba(0,0,0,0.25)" height={4} />
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {subject.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', alignItems: 'center' },
  iconSlot: { alignItems: 'center', justifyContent: 'center' },
  groundShadow: {
    position: 'absolute',
    bottom: -6,
    width: ICON_SIZE * 0.8,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  fethetWrap: { position: 'absolute', top: -34, zIndex: 3 },
  fethet: {
    backgroundColor: AtlasColors.orange,
    color: AtlasColors.white,
    fontSize: 9.5,
    fontFamily: AtlasFonts.heading,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    textAlign: 'center',
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 28 },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: ICON_SIZE / 2,
  },
  lock: { fontSize: 22 },
  progRing: { width: ICON_SIZE - 12, marginTop: 4 },
  alindi: {
    position: 'absolute',
    top: -13,
    backgroundColor: AtlasColors.green,
    color: AtlasColors.white,
    fontSize: 9,
    fontFamily: AtlasFonts.heading,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    zIndex: 2,
  },
  name: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: AtlasFonts.bodyBold,
    color: AtlasColors.white,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
});
