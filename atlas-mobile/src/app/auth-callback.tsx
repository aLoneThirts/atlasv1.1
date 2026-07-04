import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AtlasColors } from '@/constants/atlas-theme';

/**
 * `atlasmobile://auth-callback` buraya düşer. Gerçek token exchange
 * lib/auth-google.ts içinde WebBrowser.openAuthSessionAsync'in
 * promise'i çözülürken yapılıyor; bu ekran sadece route'un var olması için.
 */
export default function AuthCallbackScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={AtlasColors.white} />
      <Text style={styles.text}>Giriş yapılıyor…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#203A43',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  text: {
    color: AtlasColors.white,
    fontSize: 15,
  },
});
