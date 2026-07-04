import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GlowHalo } from '@/components/ui/glow-halo';
import { AtlasColors, AtlasFonts } from '@/constants/atlas-theme';

import { MAP_CX, MAP_CY } from './map-layout';

const BOSS_BOX = 118;

/** Ana Kale — statik PNG üzerine nefes alma + altın parıltı katmanlarıyla "canlı" his */
export function BossCastle({
  overallFrac,
  doneCount,
  totalCount,
  litSubjects,
}: {
  overallFrac: number;
  doneCount: number;
  totalCount: number;
  litSubjects: boolean[];
}) {
  const baseScale = useSharedValue(0.78 + 0.45 * overallFrac);
  const breatheScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.55);
  const prevFrac = useRef(overallFrac);

  // Sürekli nefes alma + altın parıltı döngüsü — bir kez kurulur, hep döner
  useEffect(() => {
    breatheScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.55, { duration: 1900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [breatheScale, glowOpacity]);

  // İlerleme arttığında taban ölçek yumuşak geçişle büyür + tek seferlik "grow burst"
  useEffect(() => {
    const nextBase = 0.78 + 0.45 * overallFrac;
    baseScale.value = withTiming(nextBase, { duration: 700, easing: Easing.elastic(1.1) });

    if (overallFrac > prevFrac.current) {
      breatheScale.value = withSequence(
        withTiming(1.15, { duration: 250, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 400 }),
        withRepeat(
          withSequence(
            withTiming(1.03, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );
      glowOpacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(0.7, { duration: 600 }),
        withRepeat(
          withSequence(
            withTiming(0.9, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.55, { duration: 1900, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );
    }
    prevFrac.current = overallFrac;
  }, [overallFrac, baseScale, breatheScale, glowOpacity]);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: baseScale.value }],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breatheScale.value }],
  }));

  return (
    <View style={[styles.wrapper, { left: MAP_CX - BOSS_BOX / 2, top: MAP_CY - BOSS_BOX / 2 - 30 }]}>
      <Animated.View style={outerStyle}>
        <Animated.View style={innerStyle}>
          <GlowHalo color="#FFD700" size={BOSS_BOX} opacity={glowOpacity} />
          <Image
            source={require('@/assets/images/atlas/castle-tyt.png')}
            style={styles.image}
            contentFit="contain"
          />
        </Animated.View>
      </Animated.View>

      <View style={styles.squares}>
        {litSubjects.map((lit, i) => (
          <View key={i} style={styles.squareSlot}>
            {lit && <GlowHalo color={AtlasColors.yellow} size={8} opacity={1} />}
            <View style={[styles.square, lit && styles.squareLit]} />
          </View>
        ))}
      </View>

      <Text style={styles.label}>TYT Ana Kalesi</Text>
      <Text style={styles.stat}>
        {doneCount}/{totalCount} Kale Güçlendirildi
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', width: BOSS_BOX, alignItems: 'center' },
  image: { width: BOSS_BOX, height: BOSS_BOX },
  squares: { flexDirection: 'row', gap: 4, marginTop: 4 },
  squareSlot: { alignItems: 'center', justifyContent: 'center' },
  square: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: AtlasColors.yellow,
    opacity: 0.32,
  },
  squareLit: { opacity: 1 },
  label: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: AtlasFonts.heading,
    color: AtlasColors.white,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  stat: {
    fontSize: 10.5,
    fontFamily: AtlasFonts.bodyBold,
    color: 'rgba(255,255,255,0.85)',
  },
});
