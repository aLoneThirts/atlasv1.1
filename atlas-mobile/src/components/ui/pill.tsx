import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AtlasColors, AtlasFonts, AtlasRadius } from '@/constants/atlas-theme';

export function Pill({
  color = AtlasColors.line,
  textColor = AtlasColors.inkStrong,
  children,
}: {
  color?: string;
  textColor?: string;
  children: ReactNode;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      {typeof children === 'string' ? <Text style={[styles.text, { color: textColor }]}>{children}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: AtlasRadius.pill,
    paddingVertical: 5,
    paddingHorizontal: 11,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: AtlasFonts.heading,
    fontSize: 11,
  },
});
