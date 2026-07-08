import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AtlasColors, AtlasFonts, AtlasRadius } from '@/constants/atlas-theme';
import type { PremiumPlan } from '@/lib/purchases';

const BENEFITS = [
  { emoji: '🤖', text: 'Yapay zekâ koç — serine ve netlerine göre sana özel plan' },
  { emoji: '📝', text: 'Haftalık Mini Sınav — yanlışlarından otomatik hazırlanır' },
  { emoji: '🏰', text: 'Tarih dışındaki TÜM dersler açılır' },
];

/**
 * Premium fayda listesi + plan seçimi — hem tam paywall ekranında (premium.tsx)
 * hem reklamsız ekranının altında (reklamsiz.tsx, upsell olarak) kullanılır.
 * Plan seçimi doğrudan /odeme kart-formu modalını açar (bkz. lib/purchases.ts).
 * Fiyatlar BACKEND.md §1 hedef aralığında (49-69 TL/ay, 199-249 TL/yıl).
 */
export function PremiumBenefits({ onSubscribe }: { onSubscribe: (plan: PremiumPlan) => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Atlas Premium ile</Text>
      <View style={styles.benefits}>
        {BENEFITS.map((b) => (
          <View key={b.text} style={styles.benefitRow}>
            <Text style={styles.benefitEmoji}>{b.emoji}</Text>
            <Text style={styles.benefitText}>{b.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.plans}>
        <PlanCard label="Aylık" price="59 TL" sub="/ ay" onPress={() => onSubscribe('monthly')} />
        <PlanCard label="Yıllık" price="229 TL" sub="/ yıl" badge="En avantajlı" onPress={() => onSubscribe('yearly')} />
      </View>
    </View>
  );
}

function PlanCard({
  label,
  price,
  sub,
  badge,
  onPress,
}: {
  label: string;
  price: string;
  sub: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.planCard}>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Text style={styles.planLabel}>{label}</Text>
      <Text style={styles.planPrice}>
        {price}
        <Text style={styles.planSub}>{sub}</Text>
      </Text>
      <Text style={styles.planCta}>Seç</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  title: {
    color: AtlasColors.white,
    fontSize: 20,
    fontFamily: AtlasFonts.heading,
    textAlign: 'center',
  },
  benefits: { gap: 10 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitEmoji: { fontSize: 20 },
  benefitText: { color: 'rgba(255,255,255,0.9)', fontSize: 13.5, fontFamily: AtlasFonts.bodySemi, flex: 1 },
  plans: { flexDirection: 'row', gap: 12, marginTop: 6 },
  planCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: AtlasRadius.card,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    position: 'absolute',
    top: -10,
    backgroundColor: AtlasColors.orange,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: AtlasRadius.pill,
  },
  badgeText: { color: AtlasColors.white, fontSize: 9.5, fontFamily: AtlasFonts.heading },
  planLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: AtlasFonts.bodyBold, marginTop: 6 },
  planPrice: { color: AtlasColors.white, fontSize: 19, fontFamily: AtlasFonts.heading },
  planSub: { fontSize: 11, fontFamily: AtlasFonts.bodySemi, color: 'rgba(255,255,255,0.65)' },
  planCta: {
    marginTop: 6,
    color: '#5B4400',
    backgroundColor: AtlasColors.yellow,
    fontSize: 12,
    fontFamily: AtlasFonts.heading,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: AtlasRadius.pill,
    overflow: 'hidden',
  },
});
