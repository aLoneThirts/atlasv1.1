import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PremiumBenefits } from '@/components/premium/premium-benefits';
import { AtlasColors, AtlasFonts, AtlasGradients } from '@/constants/atlas-theme';
import { buyPremium, type PremiumPlan } from '@/lib/purchases';

/**
 * EKRAN — Premium paywall. `koc.tsx` / `haftalik.tsx` kilit ekranlarından
 * ve harita'da kilitli kale dokunuşundan buraya yönlendirilir.
 */
export default function PremiumScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<PremiumPlan | null>(null);

  const subscribe = async (p: PremiumPlan) => {
    if (busy) return;
    setPlan(p);
    setBusy(true);
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
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={AtlasGradients.bossGold} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.back}>‹ Geri</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Image
            source={require('@/assets/images/atlas/castle-tyt.png')}
            style={styles.crest}
            contentFit="contain"
          />
          <Text style={styles.testNote}>
            🚧 Test modu — mağaza hesapları hazır olunca gerçek ödemeye bağlanacak, şimdilik seçince direkt aktif olur.
          </Text>
          <PremiumBenefits onSubscribe={subscribe} busy={busy} selectedPlan={plan} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: { paddingHorizontal: 18, paddingVertical: 10 },
  back: { color: '#5B4400', fontSize: 15, fontFamily: AtlasFonts.bodyBold },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center', gap: 16 },
  crest: { width: 96, height: 96 },
  testNote: {
    color: 'rgba(0,0,0,0.55)',
    fontSize: 11.5,
    fontFamily: AtlasFonts.bodySemi,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
    padding: 8,
    borderRadius: 12,
  },
});
