import { StyleSheet, Text, View } from 'react-native';

import { AtlasFonts, type Surface } from '@/constants/atlas-theme';
import type { Badge } from '@/lib/types';

/** Ev ekranı rozet ızgarası — kazanılan renkli/net, kazanılmayan gri/soluk. */
export function BadgeGrid({ badges, surface }: { badges: Badge[]; surface: Surface }) {
  if (badges.length === 0) return null;
  return (
    <View style={styles.grid}>
      {badges.map((b) => (
        <View
          key={b.id}
          style={[
            styles.tile,
            { backgroundColor: surface.card, borderColor: surface.cardBorder },
            !b.earned && styles.tileLocked,
          ]}>
          <Text style={[styles.emoji, !b.earned && styles.emojiLocked]}>{b.emoji}</Text>
          <Text
            style={[styles.title, { color: b.earned ? surface.text : surface.textSecondary }]}
            numberOfLines={2}>
            {b.title}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '30%',
    minWidth: 90,
    flexGrow: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
  },
  tileLocked: { opacity: 0.45 },
  emoji: { fontSize: 26 },
  emojiLocked: { opacity: 0.6 },
  title: { fontSize: 10.5, fontFamily: AtlasFonts.bodyBold, textAlign: 'center' },
});
