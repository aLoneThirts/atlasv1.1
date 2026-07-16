import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BadgeGrid } from '@/components/badges/badge-grid';
import { AtlasFonts, AtlasSurface } from '@/constants/atlas-theme';
import { safeGoBack } from '@/lib/navigation';
import { fetchBadges } from '@/lib/queries';
import { useThemeMode } from '@/lib/theme-context';
import type { Badge } from '@/lib/types';

/** EKRAN — Rozetlerim. Ev ekranındaki teaser'dan açılır (bkz. (tabs)/index.tsx). */
export default function RozetlerScreen() {
  const router = useRouter();
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];

  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    fetchBadges()
      .then(setBadges)
      .catch(() => {});
  }, []);

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <View style={[styles.container, { backgroundColor: surface.bg }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => safeGoBack(router)} hitSlop={10}>
            <Text style={[styles.back, { color: surface.text }]}>‹ Geri</Text>
          </Pressable>
          <Text style={[styles.title, { color: surface.text }]}>Rozetlerim</Text>
          <View style={styles.backSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.summary, { color: surface.textSecondary }]}>
            {earnedCount}/{badges.length} rozet kazanıldı
          </Text>
          <BadgeGrid badges={badges} surface={surface} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  back: { fontSize: 15, fontFamily: AtlasFonts.bodyBold },
  title: { fontSize: 17, fontFamily: AtlasFonts.heading },
  backSpacer: { width: 40 },
  scroll: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 30, gap: 12 },
  summary: { fontSize: 13, fontFamily: AtlasFonts.bodySemi, marginBottom: 4 },
});
