import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { AtlasColors, AtlasFonts, type Surface } from '@/constants/atlas-theme';
import type { MockExamHistoryEntry } from '@/lib/types';

const VIEW_W = 300;
const VIEW_H = 140;
const PAD = 16;

function formatDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

/**
 * Puan sekmesi — deneme net geçmişi trend grafiği. Proje içinde hiçbir grafik
 * kütüphanesi yok (yalnız react-native-svg bağımlılığı var) — yeni paket
 * eklemek yerine elle basit bir çizgi grafik çizildi (bkz. plan).
 */
export function NetTrendChart({ entries, surface }: { entries: MockExamHistoryEntry[]; surface: Surface }) {
  if (entries.length === 0) {
    return (
      <Text style={[styles.empty, { color: surface.textSecondary }]}>
        Henüz deneme kaydın yok — Koç sekmesinden bir deneme sonucu gir.
      </Text>
    );
  }

  const nets = entries.map((e) => e.totalNet);
  const maxNet = Math.max(...nets, 1);
  const minNet = Math.min(...nets, 0);
  const range = Math.max(1, maxNet - minNet);
  const innerW = VIEW_W - PAD * 2;
  const innerH = VIEW_H - PAD * 2;
  const stepX = entries.length > 1 ? innerW / (entries.length - 1) : 0;
  const points = entries.map((e, i) => ({
    x: entries.length > 1 ? PAD + i * stepX : VIEW_W / 2,
    y: PAD + innerH - ((e.totalNet - minNet) / range) * innerH,
  }));
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  const last = entries[entries.length - 1];
  const prev = entries.length > 1 ? entries[entries.length - 2] : null;
  const delta = prev ? last.totalNet - prev.totalNet : null;

  return (
    <View>
      <View style={styles.headRow}>
        <Text style={[styles.lastNet, { color: surface.text }]}>{last.totalNet.toFixed(1)} net</Text>
        {delta !== null && (
          <Text style={[styles.delta, delta >= 0 ? styles.deltaUp : styles.deltaDown]}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
          </Text>
        )}
      </View>

      <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Line
          x1={PAD}
          y1={PAD + innerH}
          x2={VIEW_W - PAD}
          y2={PAD + innerH}
          stroke={surface.cardBorder}
          strokeWidth={1}
        />
        {points.length > 1 && (
          <Polyline points={polylinePoints} fill="none" stroke={AtlasColors.blue} strokeWidth={2.5} />
        )}
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill={AtlasColors.blue} />
        ))}
      </Svg>

      <View style={styles.labelsRow}>
        <Text style={[styles.label, { color: surface.textSecondary }]}>{formatDate(entries[0].takenOn)}</Text>
        <Text style={[styles.label, { color: surface.textSecondary }]}>
          {formatDate(entries[entries.length - 1].takenOn)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, fontFamily: AtlasFonts.bodySemi, textAlign: 'center', paddingVertical: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  lastNet: { fontSize: 20, fontFamily: AtlasFonts.heading },
  delta: { fontSize: 13, fontFamily: AtlasFonts.bodyBold },
  deltaUp: { color: AtlasColors.greenDark },
  deltaDown: { color: AtlasColors.red },
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  label: { fontSize: 10.5, fontFamily: AtlasFonts.bodySemi },
});
