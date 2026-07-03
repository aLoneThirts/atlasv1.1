import { StyleSheet, Text, View } from 'react-native';

import { AtlasColors } from '@/constants/atlas-theme';

/**
 * EKRAN 09 — Yanlışlarım
 * Prototip referansı: ../index.html #scr-mistakes
 * TODO: mistakes tablosundan liste, filtre çipleri, haftalık mini sınav banner'ı
 * (weekly_exams — her Pazar Edge Function cron + Expo push bildirimi).
 */
export default function MistakesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚠️ Yanlışlarım</Text>
      <Text style={styles.sub}>Yanlış havuzu + haftalık sınav buraya port edilecek.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AtlasColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: { color: AtlasColors.inkStrong, fontSize: 20, fontWeight: '900' },
  sub: { color: AtlasColors.gray, fontSize: 13 },
});
