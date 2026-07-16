import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetTrendChart } from '@/components/score/net-trend-chart';
import { Card } from '@/components/ui/card';
import { AtlasFonts, AtlasSurface } from '@/constants/atlas-theme';
import { fetchMockExamHistory } from '@/lib/queries';
import { useThemeMode } from '@/lib/theme-context';
import type { MockExamHistoryEntry } from '@/lib/types';

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/**
 * EKRAN — Deneme Net Takibi. Koç sekmesinde girilen deneme sonuçlarının
 * (mock_exams) trend grafiği + geçmiş listesi. Puan sekmesinden ayrı, kendi
 * sekmesi (bkz. app-tabs.tsx/app-tabs.web.tsx).
 */
export default function DenemeScreen() {
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];

  const [history, setHistory] = useState<MockExamHistoryEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setHistory(await fetchMockExamHistory());
    } catch {
      /* sessizce geç — grafik boş durumunu gösterir */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const reversedHistory = [...history].reverse(); // en yeni önce

  return (
    <View style={[styles.container, { backgroundColor: surface.bg }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: surface.text }]}>📈 Deneme Net Takibi</Text>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <Card style={styles.chartCard}>
            <NetTrendChart entries={history} surface={surface} />
          </Card>

          {reversedHistory.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: surface.text }]}>Geçmiş Denemeler</Text>
              {reversedHistory.map((entry, i) => (
                <Card key={`${entry.takenOn}-${i}`} style={styles.entryCard}>
                  <View style={styles.entryHead}>
                    <Text style={[styles.entryDate, { color: surface.text }]}>{formatDate(entry.takenOn)}</Text>
                    <Text style={[styles.entryTotal, { color: surface.text }]}>{entry.totalNet.toFixed(1)} net</Text>
                  </View>
                  <View style={styles.entryBreakdown}>
                    {Object.entries(entry.nets).map(([subject, net]) => (
                      <Text key={subject} style={[styles.entrySubject, { color: surface.textSecondary }]}>
                        {subject}: {Number(net).toFixed(1)}
                      </Text>
                    ))}
                  </View>
                </Card>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: { paddingHorizontal: 18, paddingVertical: 12 },
  title: { fontSize: 22, fontFamily: AtlasFonts.heading },
  scrollArea: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingBottom: 30, gap: 12 },
  chartCard: { gap: 8 },
  sectionTitle: { fontSize: 15, fontFamily: AtlasFonts.heading, marginTop: 4 },
  entryCard: { gap: 8 },
  entryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryDate: { fontSize: 13.5, fontFamily: AtlasFonts.bodyBold },
  entryTotal: { fontSize: 15, fontFamily: AtlasFonts.heading },
  entryBreakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  entrySubject: { fontSize: 12, fontFamily: AtlasFonts.bodySemi },
});
