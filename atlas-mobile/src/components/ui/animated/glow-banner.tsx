import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Easing, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { AtlasColors, AtlasRadius } from '@/constants/atlas-theme';
import { GlowHalo } from '@/components/ui/glow-halo';

/** Card with a breathing glow behind it — e.g. the weekly-exam promo banner. */
export function GlowBanner({
  children,
  glowColor = AtlasColors.purple,
  backgroundColor = '#1A0A2E',
  style,
}: {
  children: ReactNode;
  glowColor?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1300, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [opacity]);

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      <GlowHalo color={glowColor} size={80} opacity={opacity} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: AtlasRadius.card,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
  },
});
