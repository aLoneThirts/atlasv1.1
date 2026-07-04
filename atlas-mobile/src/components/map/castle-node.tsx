import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlowHalo } from '@/components/ui/glow-halo';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AtlasColors, AtlasFonts } from '@/constants/atlas-theme';
import type { CastleViewModel } from '@/lib/map-progress';

import { castleXY } from './map-layout';

const ICON_SIZE = 64;
const NODE_WIDTH = 84;

/** Tek bir ders kalesi — konumu radyal düzenden gelir */
export function CastleNode({ castle, index, total }: { castle: CastleViewModel; index: number; total: number }) {
  const router = useRouter();
  const { x, y } = castleXY(index, total);
  const { subject, frac, state } = castle;
  const locked = state === 'locked';
  const done = state === 'done';

  const onPress = () => {
    if (locked) return;
    router.push({ pathname: '/kale/[subjectId]', params: { subjectId: subject.id } } as never);
  };

  return (
    <Pressable
      onPress={onPress}
      style={[styles.wrapper, { left: x - NODE_WIDTH / 2, top: y - ICON_SIZE / 2 - 8, width: NODE_WIDTH }]}>
      {done && <Text style={styles.alindi}>ALINDI!</Text>}
      <View style={styles.iconSlot}>
        {done && <GlowHalo color={subject.color} size={ICON_SIZE} opacity={0.8} />}
        <View
          style={[
            styles.icon,
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
