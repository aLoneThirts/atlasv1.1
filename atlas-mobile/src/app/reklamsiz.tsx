import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { PremiumBenefits } from '@/components/premium/premium-benefits';
import { AtlasFonts, AtlasSurface } from '@/constants/atlas-theme';
import type { PremiumPlan } from '@/lib/purchases';
import { useThemeMode } from '@/lib/theme-context';

/**
 * EKRAN — Reklamsız deneyim. Üstte tek başlıklı "Reklamsız Devam Et" satın
 * alması, altında upsell olarak Premium ekranıyla AYNI fayda/plan bloğu
 * (PremiumBenefits) — kullanıcı isterse doğrudan oradan Premium'a geçebilir.
 * İkisi de /odeme kart-formu modalını açar (iyzico, bkz. lib/purchases.ts).
 */
export default function ReklamsizScreen() {
  const router = useRouter();
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];

  const continueAdFree = () => {
    router.push({ pathname: '/odeme', params: { product: 'ads_removed' } } as never);
  };

  const subscribePremium = (p: PremiumPlan) => {
    router.push({ pathname: '/odeme', params: { product: p === 'monthly' ? 'premium_monthly' : 'premium_yearly' } } as never);
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

          <Btn3D variant="blue" onPress={continueAdFree}>
            Reklamsız Devam Etmek İstiyorum
          </Btn3D>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: surface.cardBorder }]} />
            <Text style={[styles.dividerText, { color: surface.textSecondary }]}>ya da daha fazlasını al</Text>
            <View style={[styles.dividerLine, { backgroundColor: surface.cardBorder }]} />
          </View>

          <View style={styles.premiumBox}>
            <PremiumBenefits onSubscribe={subscribePremium} />
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
