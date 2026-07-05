import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { PremiumBenefits } from '@/components/premium/premium-benefits';
import { AtlasColors, AtlasFonts, AtlasSurface } from '@/constants/atlas-theme';
import { buyAdRemoval, buyPremium, type PremiumPlan } from '@/lib/purchases';
import { useThemeMode } from '@/lib/theme-context';

/**
 * EKRAN — Reklamsız deneyim. Üstte tek başlıklı "Reklamsız Devam Et" satın
 * alması, altında upsell olarak Premium ekranıyla AYNI fayda/plan bloğu
 * (PremiumBenefits) — kullanıcı isterse doğrudan oradan Premium'a geçebilir.
 */
export default function ReklamsizScreen() {
  const router = useRouter();
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];
  const [busyAds, setBusyAds] = useState(false);
  const [busyPremium, setBusyPremium] = useState(false);
  const [plan, setPlan] = useState<PremiumPlan | null>(null);

  const continueAdFree = async () => {
    if (busyAds) return;
    setBusyAds(true);
    try {
      const res = await buyAdRemoval();
      if (res.ok) {
        Alert.alert('Hazır! 🎉', 'Artık reklamsız devam ediyorsun.', [{ text: 'Tamam', onPress: () => router.back() }]);
      } else {
        Alert.alert('Olmadı', res.error);
      }
    } finally {
      setBusyAds(false);
    }
  };

  const subscribePremium = async (p: PremiumPlan) => {
    if (busyPremium) return;
    setPlan(p);
    setBusyPremium(true);
    try {
      const res = await buyPremium(p);
      if (res.ok) {
        Alert.alert('Hoş geldin, Komutan! 👑', 'Premium aktif — tüm kaleler ve koç artık senin.', [
          { text: 'Tamam', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Olmadı', res.error);
      }
    } finally {
      setBusyPremium(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: surface.bg }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={[styles.back, { color: surface.text }]}>‹ Geri</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.emoji}>🚫📺</Text>
          <Text style={[styles.title, { color: surface.text }]}>Reklamsız Deneyim</Text>
          <Text style={[styles.sub, { color: surface.textSecondary }]}>
            Kaleni hiç kesintisiz fethet — tek seferlik satın alımla reklamlar tamamen kalksın.
          </Text>
          <Text style={[styles.testNote, { color: surface.textSecondary }]}>
            🚧 Test modu — mağaza hesapları hazır olunca gerçek ödemeye bağlanacak.
          </Text>

          <Btn3D variant="blue" onPress={continueAdFree} disabled={busyAds}>
            {busyAds ? '...' : 'Reklamsız Devam Etmek İstiyorum'}
          </Btn3D>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: surface.cardBorder }]} />
            <Text style={[styles.dividerText, { color: surface.textSecondary }]}>ya da daha fazlasını al</Text>
            <View style={[styles.dividerLine, { backgroundColor: surface.cardBorder }]} />
          </View>

          <View style={styles.premiumBox}>
            <PremiumBenefits onSubscribe={subscribePremium} busy={busyPremium} selectedPlan={plan} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: { paddingHorizontal: 18, paddingVertical: 10 },
  back: { fontSize: 15, fontFamily: AtlasFonts.bodyBold },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center', gap: 14 },
  emoji: { fontSize: 44 },
  title: { fontSize: 22, fontFamily: AtlasFonts.heading, textAlign: 'center' },
  sub: { fontSize: 13.5, fontFamily: AtlasFonts.bodySemi, textAlign: 'center', lineHeight: 20 },
  testNote: {
    fontSize: 11,
    fontFamily: AtlasFonts.bodySemi,
    textAlign: 'center',
    marginBottom: 4,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', marginTop: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 11.5, fontFamily: AtlasFonts.bodyBold },
  premiumBox: {
    width: '100%',
    backgroundColor: '#1A0F00',
    borderRadius: 20,
    padding: 18,
  },
});
