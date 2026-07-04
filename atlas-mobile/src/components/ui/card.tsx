import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { AtlasColors, AtlasRadius, ledgeShadow, ledgeShadowWeb } from '@/constants/atlas-theme';

export function Card({ style, children, ...rest }: ViewProps & { style?: StyleProp<ViewStyle> }) {
  const shadow = Platform.OS === 'web' ? ledgeShadowWeb(AtlasColors.line, 3) : ledgeShadow(AtlasColors.line, 3);
  return (
    <View style={[styles.card, shadow, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AtlasColors.white,
    borderWidth: 2,
    borderColor: AtlasColors.line,
    borderRadius: AtlasRadius.card,
    padding: 16,
  },
});
