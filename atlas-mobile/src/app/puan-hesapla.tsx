import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { Card } from '@/components/ui/card';
import { AtlasColors, AtlasFonts, AtlasRadius, AtlasSurface } from '@/constants/atlas-theme';
import { calculateAndSaveExamScore, fetchAvailableRankYears, fetchScoreRankDistribution } from '@/lib/queries';
import { useThemeMode } from '@/lib/theme-context';
import { hesaplaNet, yuvarla, type NetMap } from '@shared/yks-calc';
import { sonYillarSira, type RankPoint, type YearlyRankEstimate } from '@shared/rank-estimator';

/**
 * EKRAN — YKS puan hesaplama (görev listesi madde 10/11).
 * Formül shared/yks-calc.ts'te, katsayılar score_coefficients'ten
 * (Edge Function hesaplar ve kaydeder — client kendi başına hesaplamaz,
 * tek doğruluk kaynağı sunucu, bkz. supabase/functions/calculate-yks-score).
 *
 * Ders bazlı soru sayıları ÖSYM'nin resmi 2025-YKS istatistik belgesinden
 * (dokuman.osym.gov.tr/pdfdokuman/2025/YKS/sayisalbilgiler_tayd21072025.pdf) —
 * bunlar sınav YAPISI (kaç soru sorulduğu), katsayı gibi tahmini/gizli
 * değerler değil, resmi ve sabit.
 */
const YEARS = [2025, 2024, 2023];

type ScoreTypeUi = 'TYT' | 'SAY' | 'EA' | 'SOZ' | 'DIL';

const SCORE_TYPE_LABELS: Record<ScoreTypeUi, string> = {
  TYT: 'TYT',
  SAY: 'SAY',
  EA: 'EA',
  SOZ: 'SÖZ',
  DIL: 'DİL',
};

const TYT_SUBJECTS = [
  { key: 'tyt_turkce', label: 'TYT Türkçe', max: 40 },
  { key: 'tyt_sosyal', label: 'TYT Sosyal Bilimler', max: 20 },
  { key: 'tyt_matematik', label: 'TYT Matematik', max: 40 },
  { key: 'tyt_fen', label: 'TYT Fen Bilimleri', max: 20 },
];

const SUBJECTS_BY_SCORE_TYPE: Record<ScoreTypeUi, { key: string; label: string; max: number }[]> = {
  TYT: TYT_SUBJECTS,
  SAY: [
    ...TYT_SUBJECTS,
    { key: 'ayt_matematik', label: 'AYT Matematik', max: 40 },
    { key: 'ayt_fizik', label: 'AYT Fizik', max: 14 },
    { key: 'ayt_kimya', label: 'AYT Kimya', max: 13 },
    { key: 'ayt_biyoloji', label: 'AYT Biyoloji', max: 13 },
  ],
  EA: [
    ...TYT_SUBJECTS,
    { key: 'ayt_matematik', label: 'AYT Matematik', max: 40 },
    { key: 'ayt_edebiyat', label: 'AYT Türk Dili ve Edebiyatı', max: 24 },
    { key: 'ayt_tarih1', label: 'AYT Tarih-1', max: 10 },
    { key: 'ayt_cografya1', label: 'AYT Coğrafya-1', max: 6 },
  ],
  SOZ: [
    ...TYT_SUBJECTS,
    { key: 'ayt_edebiyat', label: 'AYT Türk Dili ve Edebiyatı', max: 24 },
    { key: 'ayt_tarih1', label: 'AYT Tarih-1', max: 10 },
    { key: 'ayt_cografya1', label: 'AYT Coğrafya-1', max: 6 },
    { key: 'ayt_tarih2', label: 'AYT Tarih-2', max: 11 },
    { key: 'ayt_cografya2', label: 'AYT Coğrafya-2', max: 11 },
    { key: 'ayt_felsefe', label: 'AYT Felsefe Grubu', max: 12 },
    { key: 'ayt_dkab', label: 'AYT DKAB/Ek Felsefe Grubu', max: 6 },
  ],
  DIL: [...TYT_SUBJECTS, { key: 'ydt', label: 'YDT (seçtiğin dil)', max: 80 }],
};

type Answers = Record<string, { dogru: string; yanlis: string }>;

function emptyAnswers(scoreType: ScoreTypeUi): Answers {
  return Object.fromEntries(SUBJECTS_BY_SCORE_TYPE[scoreType].map((s) => [s.key, { dogru: '', yanlis: '' }]));
}

export default function PuanHesaplaScreen() {
  const router = useRouter();
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];

  const [scoreType, setScoreType] = useState<ScoreTypeUi>('SAY');
  const [year, setYear] = useState(YEARS[0]);
  const [answers, setAnswers] = useState<Answers>(() => emptyAnswers('SAY'));
  const [diplomaNotu, setDiplomaNotu] = useState('');
  const [oncekiYilYerlesti, setOncekiYilYerlesti] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ hamPuan: number; obp: number; yerlestirmePuani: number } | null>(null);
  const [siralar, setSiralar] = useState<YearlyRankEstimate[] | null>(null);
  const [siralarYukleniyor, setSiralarYukleniyor] = useState(false);

  const subjects = SUBJECTS_BY_SCORE_TYPE[scoreType];

  const switchScoreType = (next: ScoreTypeUi) => {
    setScoreType(next);
    setAnswers(emptyAnswers(next));
    setResult(null);
    setSiralar(null);
    setError(null);
  };

  const setField = (key: string, field: 'dogru' | 'yanlis', value: string, max: number) => {
    const clean = value.replace(/[^0-9]/g, '');
    const num = clean === '' ? '' : String(Math.min(Number(clean), max));
    setAnswers((prev) => ({ ...prev, [key]: { ...prev[key], [field]: num } }));
    setResult(null);
    setSiralar(null);
  };

  const netler: NetMap = Object.fromEntries(
    subjects.map((s) => {
      const a = answers[s.key];
      const dogru = Number(a.dogru) || 0;
      const yanlis = Number(a.yanlis) || 0;
      return [s.key, hesaplaNet(dogru, yanlis)];
    }),
  );

  const hesaplaVeKaydet = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSiralar(null);
    try {
      const diploma = diplomaNotu === '' ? undefined : Number(diplomaNotu);
      const r = await calculateAndSaveExamScore({ year, scoreType, netler, diplomaNotu: diploma, oncekiYilYerlesti });
      setResult(r);
      await yukleSiralamaTahmini(r.yerlestirmePuani);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hesaplanamadı — internetini kontrol edip tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  const yukleSiralamaTahmini = async (puan: number) => {
    if (scoreType === 'TYT') return; // TYT için program bazlı sıralama verisi yok (bkz. yks_programs)
    setSiralarYukleniyor(true);
    try {
      const years = await fetchAvailableRankYears(scoreType);
      const dagilimByYear = new Map<number, RankPoint[]>();
      for (const y of years) {
        dagilimByYear.set(y, await fetchScoreRankDistribution(y, scoreType));
      }
      setSiralar(sonYillarSira(puan, dagilimByYear));
    } catch {
      // Sıralama tahmini opsiyonel bir ek — sessizce atla, ana sonucu etkilemesin.
    } finally {
      setSiralarYukleniyor(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: surface.bg }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={[styles.back, { color: surface.text }]}>‹ Geri</Text>
          </Pressable>
          <Text style={[styles.title, { color: surface.text }]}>Puanımı Hesapla</Text>
          <View style={styles.backSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.tabRow}>
            {(Object.keys(SCORE_TYPE_LABELS) as ScoreTypeUi[]).map((st) => (
              <Pressable
                key={st}
                onPress={() => switchScoreType(st)}
                style={[styles.tab, { borderColor: surface.cardBorder }, scoreType === st && styles.tabActive]}>
                <Text style={[styles.tabText, scoreType === st && styles.tabTextActive]}>{SCORE_TYPE_LABELS[st]}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.yearRow}>
            {YEARS.map((y) => (
              <Pressable
                key={y}
                onPress={() => {
                  setYear(y);
                  setResult(null);
                }}
                style={[styles.yearPill, { borderColor: surface.cardBorder }, year === y && styles.yearPillActive]}>
                <Text style={[styles.yearText, year === y && styles.yearTextActive]}>{y}</Text>
              </Pressable>
            ))}
          </View>

          <Card style={styles.card}>
            {subjects.map((s) => {
              const a = answers[s.key];
              const net = netler[s.key];
              return (
                <View key={s.key} style={styles.subjectRow}>
                  <View style={styles.subjectHead}>
                    <Text style={[styles.subjectLabel, { color: surface.text }]}>
                      {s.label} <Text style={{ color: surface.textSecondary }}>(max {s.max})</Text>
                    </Text>
                    <Text style={styles.netBadge}>Net: {yuvarla(net)}</Text>
                  </View>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, { color: surface.text, borderColor: surface.cardBorder }]}
                      placeholder="Doğru"
                      placeholderTextColor={surface.textSecondary}
                      keyboardType="number-pad"
                      value={a.dogru}
                      onChangeText={(v) => setField(s.key, 'dogru', v, s.max)}
                    />
                    <TextInput
                      style={[styles.input, { color: surface.text, borderColor: surface.cardBorder }]}
                      placeholder="Yanlış"
                      placeholderTextColor={surface.textSecondary}
                      keyboardType="number-pad"
                      value={a.yanlis}
                      onChangeText={(v) => setField(s.key, 'yanlis', v, s.max)}
                    />
                  </View>
                </View>
              );
            })}
          </Card>

          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: surface.text }]}>Diploma Notu (opsiyonel)</Text>
            <TextInput
              style={[styles.input, { color: surface.text, borderColor: surface.cardBorder }]}
              placeholder="0-100"
              placeholderTextColor={surface.textSecondary}
              keyboardType="number-pad"
              value={diplomaNotu}
              onChangeText={(v) => {
                const clean = v.replace(/[^0-9]/g, '');
                setDiplomaNotu(clean === '' ? '' : String(Math.min(Number(clean), 100)));
                setResult(null);
              }}
            />
            <Pressable
              style={styles.checkRow}
              onPress={() => {
                setOncekiYilYerlesti((v) => !v);
                setResult(null);
              }}>
              <View style={[styles.checkbox, oncekiYilYerlesti && styles.checkboxOn]}>
                {oncekiYilYerlesti && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={[styles.checkLabel, { color: surface.text }]}>
                Önceki yıl bir programa yerleştim (OBP katkısı yarıya iner)
              </Text>
            </Pressable>
          </Card>

          {error && <Text style={styles.error}>{error}</Text>}

          <Btn3D onPress={hesaplaVeKaydet} disabled={busy}>
            {busy ? '...' : 'Hesapla ve Kaydet'}
          </Btn3D>

          {result && (
            <Card style={styles.resultCard}>
              <ResultRow label="Ham Puan" value={yuvarla(result.hamPuan)} />
              <ResultRow label="OBP Katkısı Sonrası Fark" value={yuvarla(result.yerlestirmePuani - result.hamPuan)} />
              <ResultRow label="Yerleştirme Puanı" value={yuvarla(result.yerlestirmePuani)} emphasis />
            </Card>
          )}

          {result && scoreType !== 'TYT' && (
            <Card style={styles.card}>
              <Text style={[styles.sectionTitle, { color: surface.text }]}>Son Yıllar Sıralama (~yaklaşık)</Text>
              {siralarYukleniyor && <Text style={{ color: surface.textSecondary }}>Hesaplanıyor…</Text>}
              {!siralarYukleniyor && siralar && siralar.length === 0 && (
                <Text style={{ color: surface.textSecondary }}>Bu puan türü için henüz sıralama verisi yok.</Text>
              )}
              {!siralarYukleniyor &&
                siralar?.map((s) => (
                  <View key={s.yil} style={styles.rankRow}>
                    <Text style={[styles.rankYear, { color: surface.text }]}>{s.yil}</Text>
                    <Text style={styles.rankValue}>
                      ~{Math.round(s.yaklasikSira).toLocaleString('tr')}
                      {s.tabloDisi ? ' (tablo dışı, düşük güven)' : ''}
                    </Text>
                  </View>
                ))}
              <Text style={[styles.rankWarning, { color: surface.textSecondary }]}>
                ⚠️ Yıllar arası puan enflasyonu nedeniyle aynı puan farklı yıllarda farklı sıraya denk
                gelebilir — bunlar kendi topladığımız program taban puanlarından türetilen YAKLAŞIK
                tahminlerdir, kesin sıra DEĞİLDİR. Kesin sıran için ÖSYM sonuç belgeni kontrol et.
              </Text>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ResultRow({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultValue, emphasis && styles.resultValueBig]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  back: { fontSize: 15, fontFamily: AtlasFonts.bodyBold },
  backSpacer: { width: 40 },
  title: { fontSize: 16, fontFamily: AtlasFonts.heading },
  scroll: { paddingHorizontal: 18, paddingBottom: 40, gap: 14 },
  tabRow: { flexDirection: 'row', gap: 6 },
  tab: { flex: 1, borderWidth: 1.5, borderRadius: AtlasRadius.pill, paddingVertical: 8, alignItems: 'center' },
  tabActive: { backgroundColor: AtlasColors.purple, borderColor: AtlasColors.purple },
  tabText: { fontFamily: AtlasFonts.heading, fontSize: 12, color: AtlasColors.gray },
  tabTextActive: { color: AtlasColors.white },
  yearRow: { flexDirection: 'row', gap: 8 },
  yearPill: { flex: 1, borderWidth: 1.5, borderRadius: AtlasRadius.pill, paddingVertical: 8, alignItems: 'center' },
  yearPillActive: { backgroundColor: AtlasColors.blue, borderColor: AtlasColors.blue },
  yearText: { fontFamily: AtlasFonts.bodyBold, fontSize: 13, color: AtlasColors.gray },
  yearTextActive: { color: AtlasColors.white },
  card: { gap: 12 },
  subjectRow: { gap: 6 },
  subjectHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectLabel: { fontSize: 13, fontFamily: AtlasFonts.bodyBold },
  netBadge: { fontSize: 12, fontFamily: AtlasFonts.heading, color: AtlasColors.greenDark },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, minWidth: 0, borderWidth: 1.5, borderRadius: AtlasRadius.button, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  sectionTitle: { fontSize: 14, fontFamily: AtlasFonts.heading },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: AtlasColors.gray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: AtlasColors.blue, borderColor: AtlasColors.blue },
  checkboxMark: { color: AtlasColors.white, fontSize: 13, fontFamily: AtlasFonts.heading },
  checkLabel: { fontSize: 12.5, fontFamily: AtlasFonts.bodySemi, flex: 1 },
  error: {
    color: AtlasColors.redDark,
    backgroundColor: AtlasColors.redLight,
    borderRadius: 12,
    padding: 10,
    fontSize: 12.5,
    fontFamily: AtlasFonts.bodyBold,
  },
  resultCard: { gap: 8, backgroundColor: AtlasColors.violet },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between' },
  resultLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: AtlasFonts.bodySemi },
  resultValue: { color: AtlasColors.white, fontSize: 15, fontFamily: AtlasFonts.heading },
  resultValueBig: { fontSize: 20 },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rankYear: { fontSize: 13, fontFamily: AtlasFonts.bodyBold },
  rankValue: { fontSize: 13, fontFamily: AtlasFonts.heading, color: AtlasColors.blueDark },
  rankWarning: { fontSize: 11, fontFamily: AtlasFonts.bodySemi, lineHeight: 16, marginTop: 6 },
});
