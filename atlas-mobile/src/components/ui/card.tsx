import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { AtlasRadius, AtlasSurface, ledgeShadow, ledgeShadowWeb } from '@/constants/atlas-theme';
import { useThemeMode } from '@/lib/theme-context';

export function Card({ style, children, ...rest }: ViewProps & { style?: StyleProp<ViewStyle> }) {
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];
  const shadow = Platform.OS === 'web' ? ledgeShadowWeb(surface.cardBorder, 3) : ledgeShadow(surface.cardBorder, 3);
  return (
    <View
      style={[styles.card, { backgroundColor: surface.card, borderColor: surface.cardBorder }, shadow, style]}
      {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: AtlasRadius.card,
    padding: 16,
  },
});
