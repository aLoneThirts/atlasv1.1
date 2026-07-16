import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetTrendChart } from '@/components/score/net-trend-chart';
import { Btn3D } from '@/components/ui/btn-3d';
import { Card } from '@/components/ui/card';
import { AtlasColors, AtlasFonts, AtlasRadius, AtlasSurface } from '@/constants/atlas-theme';
import {
  calculateAndSaveExamScore,
  fetchAvailableRankYears,
  fetchMockExamHistory,
  fetchProgramStats,
  fetchScoreRankDistribution,
  searchYksPrograms,
} from '@/lib/queries';
import { useThemeMode } from '@/lib/theme-context';
import type { MockExamHistoryEntry, YksProgramStat, YksProgramSummary } from '@/lib/types';
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

export default function PuanScreen() {
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
  const [mockHistory, setMockHistory] = useState<MockExamHistoryEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchMockExamHistory()
        .then(setMockHistory)
        .catch(() => {});
    }, []),
  );

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
      if (scoreType !== 'TYT') await yukleSiralamaTahmini(r.yerlestirmePuani);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hesaplanamadı — internetini kontrol edip tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  const yukleSiralamaTahmini = async (puan: number) => {
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
          <Text style={[styles.title, { color: surface.text }]}>🧮 Puanımı Hesapla</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.robotCard}>
            <Text style={[styles.robotTitle, { color: surface.text }]}>🎯 Tercih Robotu</Text>
            <Text style={[styles.robotSub, { color: surface.textSecondary }]}>
              Sıralana veya puanına göre risk seviyeli (güvenli/dengeli/riskli) program önerileri al.
            </Text>
            <Btn3D variant="orange" size="small" onPress={() => router.push('/tercih')}>
              Tercih Robotunu Aç
            </Btn3D>
          </Card>

          <Card style={styles.trendCard}>
            <Text style={[styles.robotTitle, { color: surface.text }]}>📈 Deneme Net Takibi</Text>
            <NetTrendChart entries={mockHistory} surface={surface} />
          </Card>

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

          {result && (
            <Card style={styles.card}>
              <Text style={[styles.sectionTitle, { color: surface.text }]}>Son Yıllar Sıralama (~yaklaşık)</Text>
              {scoreType === 'TYT' && (
                <Text style={{ color: surface.textSecondary }}>
                  TYT tek başına bir programa yerleştirmediği için TYT puan türünde sıralama verisi yok — bir
                  puan türü (SAY/EA/SÖZ/DİL) hesapla, sıralamanı orada gör.
                </Text>
              )}
              {scoreType !== 'TYT' && siralarYukleniyor && (
                <Text style={{ color: surface.textSecondary }}>Hesaplanıyor…</Text>
              )}
              {scoreType !== 'TYT' && !siralarYukleniyor && siralar && siralar.length === 0 && (
                <Text style={{ color: surface.textSecondary }}>Bu puan türü için henüz sıralama verisi yok.</Text>
              )}
              {scoreType !== 'TYT' &&
                !siralarYukleniyor &&
                siralar?.map((s) => (
                  <View key={s.yil} style={styles.rankRow}>
                    <Text style={[styles.rankYear, { color: surface.text }]}>{s.yil}</Text>
                    <Text style={styles.rankValue}>
                      ~{Math.round(s.yaklasikSira).toLocaleString('tr')}
                      {s.tabloDisi ? ' (tablo dışı, düşük güven)' : ''}
                    </Text>
                  </View>
                ))}
              {scoreType !== 'TYT' && (
                <Text style={[styles.rankWarning, { color: surface.textSecondary }]}>
                  ⚠️ Yıllar arası puan enflasyonu nedeniyle aynı puan farklı yıllarda farklı sıraya denk
                  gelebilir — bunlar kendi topladığımız program taban puanlarından türetilen YAKLAŞIK
                  tahminlerdir, kesin sıra DEĞİLDİR. Kesin sıran için ÖSYM sonuç belgeni kontrol et.
                </Text>
              )}
            </Card>
          )}

          <OkulBolumSorgula surface={surface} />
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

/**
 * Okul/bölüm arayıp o programın geçmiş yıllardaki taban puan/sıralama/net
 * ortalamasını gösteren bölüm — yks_programs/yks_program_stats'tan
 * (tools/yokatlas-scraper ile toplandı), kullanıcının kendi netinden bağımsız.
 */
function OkulBolumSorgula({ surface }: { surface: (typeof AtlasSurface)[keyof typeof AtlasSurface] }) {
  const [university, setUniversity] = useState('');
  const [department, setDepartment] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<YksProgramSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [statsByProgram, setStatsByProgram] = useState<Record<string, YksProgramStat[]>>({});
  const [statsLoadingId, setStatsLoadingId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const ara = async () => {
    if (searching) return;
    if (!university.trim() && !department.trim()) return;
    setSearching(true);
    setSearched(true);
    setSearchError(null);
    setOpenId(null);
    try {
      const r = await searchYksPrograms(university, department);
      setResults(r);
    } catch (e) {
      setResults([]);
      setSearchError(e instanceof Error ? e.message : 'Arama yapılamadı — internetini kontrol edip tekrar dene.');
    } finally {
      setSearching(false);
    }
  };

  const toggleProgram = async (program: YksProgramSummary) => {
    if (openId === program.id) {
      setOpenId(null);
      return;
    }
    setOpenId(program.id);
    if (statsByProgram[program.id]) return;
    setStatsLoadingId(program.id);
    try {
      const stats = await fetchProgramStats(program.id);
      setStatsByProgram((prev) => ({ ...prev, [program.id]: stats }));
    } catch {
      setStatsByProgram((prev) => ({ ...prev, [program.id]: [] }));
    } finally {
      setStatsLoadingId(null);
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={[styles.sectionTitle, { color: surface.text }]}>Okul/Bölüm Sırala</Text>
      <Text style={[styles.sectionSub, { color: surface.textSecondary }]}>
        Bir üniversite ve/veya bölüm gir, geçmiş yılların taban puan/sıralama/net ortalamasını gör.
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1, color: surface.text, borderColor: surface.cardBorder }]}
          placeholder="Üniversite (ör. Boğaziçi)"
          placeholderTextColor={surface.textSecondary}
          value={university}
          onChangeText={setUniversity}
          onSubmitEditing={ara}
        />
        <TextInput
          style={[styles.input, { flex: 1, color: surface.text, borderColor: surface.cardBorder }]}
          placeholder="Bölüm (ör. İktisat)"
          placeholderTextColor={surface.textSecondary}
          value={department}
          onChangeText={setDepartment}
          onSubmitEditing={ara}
        />
      </View>
      <Btn3D variant="blue" size="small" onPress={ara} disabled={searching}>
        {searching ? '...' : 'Ara'}
      </Btn3D>

      {searchError && <Text style={styles.error}>{searchError}</Text>}

      {searched && !searching && !searchError && results.length === 0 && (
        <Text style={{ color: surface.textSecondary }}>Eşleşen program bulunamadı.</Text>
      )}

      {results.map((p) => (
        <View key={p.id} style={[styles.programItem, { borderColor: surface.cardBorder }]}>
          <Pressable onPress={() => toggleProgram(p)} style={styles.programHead}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.programUni, { color: surface.text }]}>{p.university}</Text>
              <Text style={[styles.programDept, { color: surface.textSecondary }]}>
                {p.department} • {p.scoreType}
                {p.city ? ` • ${p.city}` : ''}
              </Text>
            </View>
            <Text style={{ color: surface.textSecondary }}>{openId === p.id ? '▲' : '▼'}</Text>
          </Pressable>

          {openId === p.id && (
            <View style={styles.programBody}>
              {statsLoadingId === p.id && <Text style={{ color: surface.textSecondary }}>Yükleniyor…</Text>}
              {statsLoadingId !== p.id && (statsByProgram[p.id]?.length ?? 0) === 0 && (
                <Text style={{ color: surface.textSecondary }}>Bu program için veri yok.</Text>
              )}
              {statsLoadingId !== p.id &&
                statsByProgram[p.id]?.map((s) => (
                  <View key={s.year} style={styles.statRow}>
                    <Text style={[styles.statYear, { color: surface.text }]}>{s.year}</Text>
                    <View style={styles.statCol}>
                      <Text style={styles.statLabel}>Taban Puan</Text>
                      <Text style={[styles.statValue, { color: surface.text }]}>
                        {s.minScore != null ? yuvarla(s.minScore) : '—'}
                      </Text>
                    </View>
                    <View style={styles.statCol}>
                      <Text style={styles.statLabel}>Sıralama</Text>
                      <Text style={[styles.statValue, { color: surface.text }]}>
                        {s.minRank != null ? `~${s.minRank.toLocaleString('tr')}` : '—'}
                      </Text>
                    </View>
                    <View style={styles.statCol}>
                      <Text style={styles.statLabel}>Net Ort.</Text>
                      <Text style={[styles.statValue, { color: surface.text }]}>
                        {s.avgTytNet != null || s.avgAytNet != null
                          ? `${s.avgTytNet != null ? yuvarla(s.avgTytNet) : '—'} / ${s.avgAytNet != null ? yuvarla(s.avgAytNet) : '—'}`
                          : '—'}
                      </Text>
                    </View>
                  </View>
                ))}
            </View>
          )}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: { paddingHorizontal: 18, paddingVertical: 12 },
  title: { fontSize: 18, fontFamily: AtlasFonts.heading },
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
  robotCard: { gap: 8 },
  trendCard: { gap: 8 },
  robotTitle: { fontSize: 15, fontFamily: AtlasFonts.heading },
  robotSub: { fontSize: 12, fontFamily: AtlasFonts.bodySemi, lineHeight: 17 },
  subjectRow: { gap: 6 },
  subjectHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectLabel: { fontSize: 13, fontFamily: AtlasFonts.bodyBold },
  netBadge: { fontSize: 12, fontFamily: AtlasFonts.heading, color: AtlasColors.greenDark },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, minWidth: 0, borderWidth: 1.5, borderRadius: AtlasRadius.button, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  sectionTitle: { fontSize: 14, fontFamily: AtlasFonts.heading },
  sectionSub: { fontSize: 12, fontFamily: AtlasFonts.bodySemi, marginTop: -6 },
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
  programItem: { borderTopWidth: 1.5, paddingTop: 10, marginTop: 2 },
  programHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  programUni: { fontSize: 13.5, fontFamily: AtlasFonts.bodyBold },
  programDept: { fontSize: 12, fontFamily: AtlasFonts.bodySemi, marginTop: 2 },
  programBody: { marginTop: 10, gap: 8 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  statYear: { fontSize: 12.5, fontFamily: AtlasFonts.bodyBold, width: 40 },
  statCol: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 9.5, fontFamily: AtlasFonts.bodyBold, color: AtlasColors.gray },
  statValue: { fontSize: 12.5, fontFamily: AtlasFonts.heading, marginTop: 2 },
});
