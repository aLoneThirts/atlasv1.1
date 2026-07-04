import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/ui/progress-bar';
import { AtlasColors, AtlasFonts } from '@/constants/atlas-theme';
import { computeCastleViewModels, computeOverallFraction, type CastleViewModel } from '@/lib/map-progress';
import { fetchProfile, fetchSubjectSummaries } from '@/lib/queries';

import { BossCastle } from './boss-castle';
import { CastleNode } from './castle-node';
import { MapBackground } from './map-background';
import { MapDecorations } from './map-decorations';
import { MAP_REF_HEIGHT, MAP_REF_WIDTH } from './map-layout';
import { MapRoads } from './map-roads';

/** Fetih Haritası — Ana Sayfa/prototip: ../../../../index.html #scr-map */
export function MapScreen() {
  const { width: deviceWidth } = useWindowDimensions();
  const [castles, setCastles] = useState<CastleViewModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [summaries, profile] = await Promise.all([fetchSubjectSummaries(), fetchProfile()]);
      const tyt = summaries.filter((s) => s.exam_type === 'tyt').sort((a, b) => a.sort_order - b.sort_order);
      setCastles(computeCastleViewModels(tyt, profile.is_premium));
    } catch {
      setError('Harita yüklenemedi — internetini kontrol et.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Genış masaüstü web görünümlerinde harita telefon-genişliğinde kalsın diye ölçek
  // için kullanılan genişliği sınırlıyoruz — cihaz gerçekten dar (telefon) ise etkisiz.
  const effectiveWidth = Math.min(deviceWidth, 460);
  const scale = effectiveWidth / MAP_REF_WIDTH;
  const overallFrac = castles ? computeOverallFraction(castles) : 0;
  const doneCount = castles ? castles.filter((c) => c.state === 'done').length : 0;

  return (
    <View style={styles.container}>
      <MapBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.head}>
          <Text style={styles.headTitle}>🗺️ Fetih Haritası</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={{ width: deviceWidth, alignItems: 'center' }}>
            <View style={{ width: MAP_REF_WIDTH * scale, height: MAP_REF_HEIGHT * scale }}>
              <MapDecorations scale={scale} />
              {castles && <MapRoads castles={castles} scale={scale} />}
              {castles &&
                castles.map((c, i) => (
                  <CastleNode key={c.subject.id} castle={c} index={i} total={castles.length} scale={scale} />
                ))}
              {castles && (
                <BossCastle
                  scale={scale}
                  overallFrac={overallFrac}
                  doneCount={doneCount}
                  totalCount={castles.length}
                  litSubjects={castles.map((c) => c.state === 'done')}
                />
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.foot}>
          <View style={styles.footRow}>
            <Text style={styles.footLabel}>Toplam İlerleme</Text>
            <Text style={styles.footStat}>
              {doneCount}/{castles?.length ?? 0} Bölge Fethedildi
            </Text>
          </View>
          <ProgressBar progress={overallFrac} height={10} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  head: { paddingHorizontal: 18, paddingVertical: 10 },
  headTitle: { fontSize: 18, fontFamily: AtlasFonts.heading, color: AtlasColors.white },
  error: {
    marginHorizontal: 18,
    color: AtlasColors.white,
    backgroundColor: 'rgba(255,75,75,0.35)',
    borderRadius: 12,
    padding: 10,
    fontSize: 12.5,
    fontFamily: AtlasFonts.bodyBold,
  },
  foot: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    gap: 6,
  },
  footRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footLabel: { fontSize: 11, fontFamily: AtlasFonts.bodySemi, color: 'rgba(255,255,255,0.75)' },
  footStat: { fontSize: 12, fontFamily: AtlasFonts.heading, color: AtlasColors.white },
});
