import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Interactive } from '@/components/ui/interactive';
import { AtlasColors, AtlasFonts, AtlasRadius, type Surface } from '@/constants/atlas-theme';
import { DENEME_SUBJECT_ORDER, denemeSubjectMeta } from '@/constants/deneme-subjects';
import type { MockExamHistoryEntry } from '@/lib/types';

const VIEW_W = 300;
const VIEW_H = 150;
const PAD_X = 14;
const PAD_LEFT = 30;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;

const TOTAL_COLOR = AtlasColors.violet;

function formatDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

function fmt(n: number): string {
  return n.toFixed(1);
}

/**
 * Deneme sekmesi — net trend grafiği. Üstteki çip satırından "Toplam" veya tek
 * bir ders seçilip aynı grafik o serinin trendini çizer (birden fazla çizgiyi
 * üst üste bindirmek yerine — okunabilirlik için). Proje içinde grafik
 * kütüphanesi yok, yalnız react-native-svg ile elle çizildi.
 */
export function NetTrendChart({ entries, surface }: { entries: MockExamHistoryEntry[]; surface: Surface }) {
  const subjects = useMemo(() => {
    const present = new Set<string>();
    entries.forEach((e) => Object.keys(e.nets ?? {}).forEach((k) => present.add(k)));
    const orderSet = new Set<string>(DENEME_SUBJECT_ORDER);
    const ordered = DENEME_SUBJECT_ORDER.filter((s) => present.has(s));
    const extra = Array.from(present).filter((s) => !orderSet.has(s));
    return [...ordered, ...extra];
  }, [entries]);

  const [selected, setSelected] = useState<string>('total');

  if (entries.length === 0) {
    return (
      <Text style={[styles.empty, { color: surface.textSecondary }]}>
        Henüz deneme kaydın yok — Koç sekmesinden bir deneme sonucu gir.
      </Text>
    );
  }

  const isTotal = selected === 'total';
  const meta = isTotal ? null : denemeSubjectMeta(selected);
  const seriesColor = isTotal ? TOTAL_COLOR : meta!.color;
  const values = entries.map((e) => (isTotal ? e.totalNet : Number(e.nets?.[selected] ?? 0)));

  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = Math.max(1, maxVal - minVal);
  const innerW = VIEW_W - PAD_LEFT - PAD_X;
  const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const stepX = entries.length > 1 ? innerW / (entries.length - 1) : 0;
  const yOf = (v: number) => PAD_TOP + innerH - ((v - minVal) / range) * innerH;

  const points = values.map((v, i) => ({
    x: entries.length > 1 ? PAD_LEFT + i * stepX : PAD_LEFT + innerW / 2,
    y: yOf(v),
  }));
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const last = values[values.length - 1];
  const prev = values.length > 1 ? values[values.length - 2] : null;
  const delta = prev !== null ? last - prev : null;

  // en fazla 4 x-ekseni etiketi göster (kalabalık olmasın)
  const labelCount = Math.min(4, entries.length);
  const labelIdxs =
    entries.length <= labelCount
      ? entries.map((_, i) => i)
      : Array.from({ length: labelCount }, (_, i) => Math.round((i * (entries.length - 1)) / (labelCount - 1)));
  const uniqueLabelIdxs = Array.from(new Set(labelIdxs));

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}>
        <SubjectChip
          label="Toplam"
          emoji="Σ"
          color={TOTAL_COLOR}
          active={isTotal}
          onPress={() => setSelected('total')}
        />
        {subjects.map((s) => {
          const m = denemeSubjectMeta(s);
          return (
            <SubjectChip
              key={s}
              label={s}
              emoji={m.emoji}
              color={m.color}
              active={selected === s}
              onPress={() => setSelected(s)}
            />
          );
        })}
      </ScrollView>

      <View style={styles.headRow}>
        <Text style={[styles.lastNet, { color: surface.text }]}>{fmt(last)} net</Text>
        {delta !== null && (
          <Text style={[styles.delta, delta >= 0 ? styles.deltaUp : styles.deltaDown]}>
            {delta >= 0 ? '▲' : '▼'} {fmt(Math.abs(delta))}
          </Text>
        )}
        <Text style={[styles.avgTag, { color: surface.textSecondary }]}>Ort. {fmt(avg)}</Text>
      </View>

      <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        {[0, 0.5, 1].map((f) => {
          const y = PAD_TOP + innerH * f;
          return (
            <Line key={f} x1={PAD_LEFT} y1={y} x2={VIEW_W - PAD_X} y2={y} stroke={surface.cardBorder} strokeWidth={1} />
          );
        })}
        <Line
          x1={PAD_LEFT}
          y1={yOf(avg)}
          x2={VIEW_W - PAD_X}
          y2={yOf(avg)}
          stroke={seriesColor}
          strokeWidth={1}
          strokeOpacity={0.35}
          strokeDasharray="4,3"
        />
        {points.length > 1 && (
          <Polyline points={polylinePoints} fill="none" stroke={seriesColor} strokeWidth={2.5} />
        )}
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4.5 : 3.5} fill={seriesColor} />
        ))}
      </Svg>
      {/* Y ekseni etiketleri SVG üstünde mutlak konumlandırılır (RN Text SVG içinde font tutarsız render edebiliyor) */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {[0, 0.5, 1].map((f) => {
          const val = maxVal - range * f;
          const topOffset = PAD_TOP + innerH * f;
          return (
            <Text
              key={f}
              style={[
                styles.yLabel,
                { color: surface.textSecondary, top: topOffset - 6 },
              ]}>
              {fmt(val)}
            </Text>
          );
        })}
      </View>

      <View style={styles.labelsRow}>
        {uniqueLabelIdxs.map((i) => (
          <Text key={i} style={[styles.label, { color: surface.textSecondary }]}>
            {formatDate(entries[i].takenOn)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function SubjectChip({
  label,
  emoji,
  color,
  active,
  onPress,
}: {
  label: string;
  emoji: string;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Interactive
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: active ? color : 'transparent', backgroundColor: active ? `${color}22` : 'rgba(128,128,128,0.08)' },
      ]}>
      <Text style={[styles.chipText, { color: active ? color : AtlasColors.gray }]}>
        {emoji} {label}
      </Text>
    </Interactive>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, fontFamily: AtlasFonts.bodySemi, textAlign: 'center', paddingVertical: 12 },
  chipRow: { flexDirection: 'row', gap: 6, paddingBottom: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: AtlasRadius.pill,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  chipText: { fontSize: 12, fontFamily: AtlasFonts.bodyBold },
  headRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 2 },
  lastNet: { fontSize: 20, fontFamily: AtlasFonts.heading },
  delta: { fontSize: 13, fontFamily: AtlasFonts.bodyBold },
  deltaUp: { color: AtlasColors.greenDark },
  deltaDown: { color: AtlasColors.red },
  avgTag: { fontSize: 11.5, fontFamily: AtlasFonts.bodySemi, marginLeft: 'auto' },
  yLabel: { position: 'absolute', left: 0, fontSize: 9, fontFamily: AtlasFonts.bodySemi, width: PAD_LEFT - 4 },
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2, paddingLeft: PAD_LEFT, paddingRight: PAD_X },
  label: { fontSize: 10.5, fontFamily: AtlasFonts.bodySemi },
});
