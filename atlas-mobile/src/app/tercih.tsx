import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { Card } from '@/components/ui/card';
import { AtlasColors, AtlasFonts, AtlasLayout, AtlasRadius, AtlasSurface } from '@/constants/atlas-theme';
import { TR_CITIES, foldTr } from '@/constants/tr-cities';
import { safeGoBack } from '@/lib/navigation';
import { fetchTercihSiraAraligi } from '@/lib/queries';
import { useThemeMode } from '@/lib/theme-context';
import type { TercihAralikSonuc, TercihRisk } from '@/lib/types';
import type { ScoreType } from '@shared/yks-calc';
import { yuvarla } from '@shared/yks-calc';

/**
 * EKRAN — Tercih Robotu (2026-07-14 revizyonu: sıralama ARALIĞI modeli).
 * Kullanıcı en düşük (en iyi) ve en yüksek (en kötü) sıralamasını girer;
 * `tercih_sira_araligi` RPC'si (supabase/tercih_aralik.sql) o aralıktaki
 * taban sıraya sahip TÜM programları listeler — puan girişi kaldırıldı
 * (kullanıcı isteği), ama Puan Türü/Yıl/Risk/Üniversite Türü filtreleri VE
 * risk rozetleri (🟢🟡🔴) korunuyor: risk artık RPC'den değil, sonucun
 * KULLANICININ KENDİ girdiği [rankMin, rankMax] aralığının neresine
 * düştüğüne göre İSTEMCİDE hesaplanıyor (alt üçte bir = güvenli, orta =
 * dengeli, üst üçte bir = riskli) — bkz. `riskFromPosition()`.
 *
 * Puan sekmesindeki "Tercih Robotu" butonundan açılır (bkz. (tabs)/puan.tsx).
 *
 * Veri kısıtı: taban sıralama (min_rank) YÖK Atlas'ta yalnız GÜNCEL yıl
 * (2025) için var — başka yıl seçilirse sonuç boş dönebilir (aşağıdaki
 * uyarı buna göre gösterilir).
 */

const SCORE_TYPES: { value: ScoreType | null; label: string }[] = [
  { value: null, label: 'Hepsi' },
  { value: 'SAY', label: 'SAY' },
  { value: 'EA', label: 'EA' },
  { value: 'SOZ', label: 'SÖZ' },
  { value: 'DIL', label: 'DİL' },
];

const YEARS = [2025, 2024, 2023];

const RISKS: { value: TercihRisk | null; label: string }[] = [
  { value: null, label: 'Hepsi' },
  { value: 'guvenli', label: '🟢 Güvenli' },
  { value: 'dengeli', label: '🟡 Dengeli' },
  { value: 'riskli', label: '🔴 Riskli' },
];

const UNI_TYPES: { value: 'DEVLET' | 'VAKIF' | null; label: string }[] = [
  { value: null, label: 'Hepsi' },
  { value: 'DEVLET', label: 'Devlet' },
  { value: 'VAKIF', label: 'Vakıf' },
];

const RISK_META: Record<TercihRisk, { label: string; emoji: string; color: string; bg: string }> = {
  guvenli: { label: 'Güvenli', emoji: '🟢', color: AtlasColors.greenDark, bg: AtlasColors.greenLight },
  dengeli: { label: 'Dengeli', emoji: '🟡', color: AtlasColors.yellowDark, bg: '#FFF3C9' },
  riskli: { label: 'Riskli', emoji: '🔴', color: AtlasColors.redDark, bg: AtlasColors.redLight },
};

/**
 * Bir programın taban sırası, kullanıcının girdiği [rankMin, rankMax]
 * aralığının neresine düşüyor? Alt üçte bir (en iyi/en düşük sıraya yakın) =
 * güvenli, orta üçte bir = dengeli, üst üçte bir (en kötü/en yüksek sıraya
 * yakın) = riskli. rankMin===rankMax ise (tek sayı girildiyse) hepsi dengeli sayılır.
 */
function riskFromPosition(programRank: number, rankMin: number, rankMax: number): TercihRisk {
  if (rankMax <= rankMin) return 'dengeli';
  const fraction = (programRank - rankMin) / (rankMax - rankMin);
  if (fraction <= 1 / 3) return 'guvenli';
  if (fraction <= 2 / 3) return 'dengeli';
  return 'riskli';
}

type TercihSonucRisk = TercihAralikSonuc & { risk: TercihRisk };

export default function TercihScreen() {
  const router = useRouter();
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];

  const [rankMin, setRankMin] = useState('');
  const [rankMax, setRankMax] = useState('');
  const [scoreType, setScoreType] = useState<ScoreType | null>('SAY');
  const [year, setYear] = useState(YEARS[0]);
  const [risk, setRisk] = useState<TercihRisk | null>(null); // varsayılan: Hepsi
  const [uniType, setUniType] = useState<'DEVLET' | 'VAKIF' | null>(null);
  const [city, setCity] = useState('');
  const [program, setProgram] = useState('');
  const [university, setUniversity] = useState('');
  const [maxResult, setMaxResult] = useState('100');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResults, setRawResults] = useState<TercihAralikSonuc[] | null>(null);

  const setRankMinInput = (v: string) => {
    setRankMin(v.replace(/[^0-9]/g, ''));
    setRawResults(null);
  };
  const setRankMaxInput = (v: string) => {
    setRankMax(v.replace(/[^0-9]/g, ''));
    setRawResults(null);
  };
  const setMaxInput = (v: string) => {
    const clean = v.replace(/[^0-9]/g, '');
    setMaxResult(clean === '' ? '' : String(Math.min(Number(clean), 300)));
  };

  const rankMinNum = rankMin === '' ? null : Number(rankMin);
  const rankMaxNum = rankMax === '' ? null : Number(rankMax);
  const rankDataMissingYear = year !== 2025;

  // Ham sonuçlara risk ekle (kullanıcının aralığına göre) — filtre/aralık
  // değişince yeniden hesaplanır, RPC'yi tekrar çağırmaya gerek yok.
  const resultsWithRisk: TercihSonucRisk[] | null = useMemo(() => {
    if (!rawResults || rankMinNum == null || rankMaxNum == null) return rawResults as TercihSonucRisk[] | null;
    return rawResults.map((r) => ({
      ...r,
      risk: r.minRank != null ? riskFromPosition(r.minRank, rankMinNum, rankMaxNum) : 'dengeli',
    }));
  }, [rawResults, rankMinNum, rankMaxNum]);

  const results = resultsWithRisk && risk ? resultsWithRisk.filter((r) => r.risk === risk) : resultsWithRisk;

  const getir = async () => {
    if (busy) return;
    if (rankMinNum == null || rankMaxNum == null) {
      setError('En düşük ve en yüksek sıralamanı gir.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const list = await fetchTercihSiraAraligi({
        rankMin: rankMinNum,
        rankMax: rankMaxNum,
        year,
        scoreType,
        city: city.trim() || null,
        universityType: uniType,
        qProgram: program.trim(),
        qUniversity: university.trim(),
        limit: maxResult === '' ? 100 : Number(maxResult),
      });
      setRawResults(list);
    } catch (e) {
      setRawResults(null);
      setError(e instanceof Error ? e.message : 'Liste getirilemedi — internetini kontrol edip tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: surface.bg }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => safeGoBack(router)} hitSlop={10}>
            <Text style={[styles.back, { color: surface.text }]}>‹ Geri</Text>
          </Pressable>
          <Text style={[styles.title, { color: surface.text }]}>🎯 Tercih Robotu</Text>
          <View style={styles.backSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.intro, { color: surface.textSecondary }]}>
            En düşük (en iyi) ve en yüksek (en kötü) sıralamanı gir; filtrele. Robot bu aralıktaki
            programları 3 risk seviyesinde gösterir — 🟢 güvenli, 🟡 dengeli, 🔴 riskli.
          </Text>

          {/* SIRA ARALIĞI */}
          <Card style={styles.card}>
            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
                <Text style={[styles.fieldLabel, { color: surface.textSecondary }]}>EN DÜŞÜK SIRALAMA</Text>
                <TextInput
                  style={[styles.input, { color: surface.text, borderColor: surface.cardBorder }]}
                  placeholder="ör. 10000"
                  placeholderTextColor={surface.textSecondary}
                  keyboardType="number-pad"
                  value={rankMin}
                  onChangeText={setRankMinInput}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={[styles.fieldLabel, { color: surface.textSecondary }]}>EN YÜKSEK SIRALAMA</Text>
                <TextInput
                  style={[styles.input, { color: surface.text, borderColor: surface.cardBorder }]}
                  placeholder="ör. 50000"
                  placeholderTextColor={surface.textSecondary}
                  keyboardType="number-pad"
                  value={rankMax}
                  onChangeText={setRankMaxInput}
                />
              </View>
            </View>
            {rankDataMissingYear && (
              <Text style={[styles.hint, { color: surface.textSecondary }]}>
                ⚠️ {year} için taban sıra verisi yok; arama boş dönebilir. Taban sıralama verisi
                yalnız 2025 kılavuz dönemi için mevcut.
              </Text>
            )}
          </Card>

          {/* Filtreler */}
          <Card style={styles.card}>
            <Text style={[styles.groupLabel, { color: surface.textSecondary }]}>PUAN TÜRÜ</Text>
            <PillRow
              options={SCORE_TYPES}
              selected={scoreType}
              onSelect={(v) => {
                setScoreType(v);
                setRawResults(null);
              }}
              surface={surface}
              activeColor={AtlasColors.purple}
            />

            <Text style={[styles.groupLabel, { color: surface.textSecondary }]}>YIL</Text>
            <PillRow
              options={YEARS.map((y) => ({ value: y, label: String(y) }))}
              selected={year}
              onSelect={(y) => {
                setYear(y);
                setRawResults(null);
              }}
              surface={surface}
              activeColor={AtlasColors.blue}
            />

            <Text style={[styles.groupLabel, { color: surface.textSecondary }]}>RİSK</Text>
            <PillRow options={RISKS} selected={risk} onSelect={setRisk} surface={surface} activeColor={AtlasColors.orange} />

            <Text style={[styles.groupLabel, { color: surface.textSecondary }]}>ÜNİVERSİTE TÜRÜ</Text>
            <PillRow
              options={UNI_TYPES}
              selected={uniType}
              onSelect={(v) => {
                setUniType(v);
                setRawResults(null);
              }}
              surface={surface}
              activeColor={AtlasColors.green}
            />
          </Card>

          {/* Arama alanları */}
          <Card style={styles.card}>
            <AutocompleteInput
              label="ŞEHİR"
              placeholder="ör. Ankara (boş = hepsi)"
              value={city}
              onChangeText={(v) => {
                setCity(v);
                setRawResults(null);
              }}
              suggestions={TR_CITIES}
              surface={surface}
              onSubmit={getir}
            />
            <LabeledInput
              label="PROGRAM ARA"
              placeholder="ör. Tıp"
              value={program}
              onChangeText={(v) => {
                setProgram(v);
                setRawResults(null);
              }}
              surface={surface}
              onSubmit={getir}
            />
            <LabeledInput
              label="ÜNİVERSİTE ARA"
              placeholder="ör. ODTÜ"
              value={university}
              onChangeText={(v) => {
                setUniversity(v);
                setRawResults(null);
              }}
              surface={surface}
              onSubmit={getir}
            />
            <LabeledInput
              label="MAX SONUÇ"
              placeholder="100"
              value={maxResult}
              onChangeText={setMaxInput}
              surface={surface}
              keyboardType="number-pad"
              onSubmit={getir}
            />
            <View style={styles.onlisansRow}>
              <View style={[styles.checkbox, { borderColor: surface.cardBorder }]} />
              <Text style={[styles.onlisansLabel, { color: surface.textSecondary }]}>
                Önlisans dahil <Text style={styles.soon}>(yakında)</Text>
              </Text>
            </View>
          </Card>

          {error && <Text style={styles.error}>{error}</Text>}

          <Btn3D variant="orange" onPress={getir} disabled={busy}>
            {busy ? '...' : 'Öneri Listesi Getir'}
          </Btn3D>

          {results && results.length === 0 && (
            <Card style={styles.card}>
              <Text style={{ color: surface.textSecondary }}>
                Bu filtrelerle uygun program bulunamadı — aralığı ya da filtreleri gevşetip tekrar
                dene.
              </Text>
            </Card>
          )}

          {results && results.length > 0 && (
            <>
              <Text style={[styles.resultCount, { color: surface.textSecondary }]}>
                {results.length} program • en iyi sıralama önce
              </Text>
              {results.map((r) => (
                <ResultCard key={r.programId} item={r} surface={surface} />
              ))}
              <Text style={[styles.disclaimer, { color: surface.textSecondary }]}>
                ⚠️ Taban puan/sıralar geçmiş yıl verisidir; kontenjan ve sınav zorluğu her yıl
                değişir. Bu liste bir tahmindir, kesin tercih için ÖSYM/YÖK Atlas&apos;ı da kontrol et.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PillRow<T>({
  options,
  selected,
  onSelect,
  surface,
  activeColor,
}: {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (v: T) => void;
  surface: (typeof AtlasSurface)[keyof typeof AtlasSurface];
  activeColor: string;
}) {
  return (
    <View style={styles.pillRow}>
      {options.map((opt) => {
        const active = opt.value === selected;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onSelect(opt.value)}
            style={[
              styles.pill,
              { borderColor: surface.cardBorder },
              active && { backgroundColor: activeColor, borderColor: activeColor },
            ]}>
            <Text style={[styles.pillText, { color: active ? AtlasColors.white : surface.textSecondary }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LabeledInput({
  label,
  placeholder,
  value,
  onChangeText,
  surface,
  keyboardType,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  surface: (typeof AtlasSurface)[keyof typeof AtlasSurface];
  keyboardType?: 'number-pad';
  onSubmit?: () => void;
}) {
  return (
    <View style={styles.labeledInput}>
      <Text style={[styles.groupLabel, { color: surface.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.input, { color: surface.text, borderColor: surface.cardBorder }]}
        placeholder={placeholder}
        placeholderTextColor={surface.textSecondary}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        onSubmitEditing={onSubmit}
        autoCapitalize="none"
      />
    </View>
  );
}

/**
 * Yazdıkça statik listeden süzülen otomatik-tamamlama alanı. Serbest metne de
 * izin verir (kullanıcı listede olmayan bir şey yazabilir). Şimdilik yalnız
 * şehir (81 il) besleniyor; okul/bölüm önerileri sonraki turda (distinct RPC).
 */
function AutocompleteInput({
  label,
  placeholder,
  value,
  onChangeText,
  suggestions,
  surface,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  suggestions: readonly string[];
  surface: (typeof AtlasSurface)[keyof typeof AtlasSurface];
  onSubmit?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const q = foldTr(value.trim());
  const matches =
    focused && q.length > 0
      ? suggestions.filter((s) => foldTr(s).includes(q) && foldTr(s) !== q).slice(0, 6)
      : [];

  return (
    <View style={styles.labeledInput}>
      <Text style={[styles.groupLabel, { color: surface.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.input, { color: surface.text, borderColor: surface.cardBorder }]}
        placeholder={placeholder}
        placeholderTextColor={surface.textSecondary}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        // seçime dokunma blur'dan önce kaydolsun diye kapanışı geciktir
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onSubmitEditing={onSubmit}
        autoCapitalize="none"
      />
      {matches.length > 0 && (
        <View style={[styles.suggestBox, { backgroundColor: surface.card, borderColor: surface.cardBorder }]}>
          {matches.map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                onChangeText(s);
                setFocused(false);
              }}
              style={styles.suggestRow}>
              <Text style={[styles.suggestText, { color: surface.text }]}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function ResultCard({
  item,
  surface,
}: {
  item: TercihSonucRisk;
  surface: (typeof AtlasSurface)[keyof typeof AtlasSurface];
}) {
  const meta = RISK_META[item.risk];
  return (
    <Card style={styles.resultCard}>
      <View style={styles.resultHead}>
        <Text style={[styles.resultUni, { color: surface.text }]} numberOfLines={2}>
          {item.university}
        </Text>
        <View style={[styles.riskBadge, { backgroundColor: meta.bg }]}>
          <Text style={[styles.riskBadgeText, { color: meta.color }]}>
            {meta.emoji} {meta.label}
          </Text>
        </View>
      </View>
      <Text style={[styles.resultDept, { color: surface.textSecondary }]} numberOfLines={2}>
        {item.department} • {item.scoreType}
        {item.city ? ` • ${item.city}` : ''}
        {item.universityType ? ` • ${item.universityType === 'VAKIF' ? 'Vakıf' : 'Devlet'}` : ''}
      </Text>
      <View style={styles.statLine}>
        <Stat label="Taban Sıra" value={item.minRank != null ? `~${item.minRank.toLocaleString('tr')}` : '—'} surface={surface} />
        <Stat label="Taban Puan" value={item.minScore != null ? String(yuvarla(item.minScore)) : '—'} surface={surface} />
        <Stat label="Kontenjan" value={item.quota != null ? String(item.quota) : '—'} surface={surface} />
      </View>
    </Card>
  );
}

function Stat({
  label,
  value,
  surface,
}: {
  label: string;
  value: string;
  surface: (typeof AtlasSurface)[keyof typeof AtlasSurface];
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: surface.text }]}>{value}</Text>
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
    paddingVertical: 12,
  },
  back: { fontSize: 15, fontFamily: AtlasFonts.bodyBold },
  backSpacer: { width: 44 },
  title: { fontSize: 18, fontFamily: AtlasFonts.heading },
  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 48,
    gap: 14,
    width: '100%',
    maxWidth: AtlasLayout.maxFormWidth,
    alignSelf: 'center',
  },
  intro: { fontSize: 12.5, fontFamily: AtlasFonts.bodySemi, lineHeight: 18 },
  card: { gap: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  inputCol: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 10.5, fontFamily: AtlasFonts.bodyBold, letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5,
    borderRadius: AtlasRadius.button,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  hint: { fontSize: 11, fontFamily: AtlasFonts.bodySemi, lineHeight: 16 },
  groupLabel: { fontSize: 10.5, fontFamily: AtlasFonts.bodyBold, letterSpacing: 0.5, marginBottom: -4 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderWidth: 1.5, borderRadius: AtlasRadius.pill, paddingVertical: 7, paddingHorizontal: 14 },
  pillText: { fontFamily: AtlasFonts.bodyBold, fontSize: 12 },
  labeledInput: { gap: 6 },
  suggestBox: {
    borderWidth: 1.5,
    borderRadius: AtlasRadius.button,
    overflow: 'hidden',
    marginTop: -2,
  },
  suggestRow: { paddingHorizontal: 14, paddingVertical: 10 },
  suggestText: { fontSize: 14, fontFamily: AtlasFonts.bodySemi },
  onlisansRow: { flexDirection: 'row', alignItems: 'center', gap: 10, opacity: 0.6 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2 },
  onlisansLabel: { fontSize: 12.5, fontFamily: AtlasFonts.bodySemi },
  soon: { fontFamily: AtlasFonts.bodyBold, color: AtlasColors.orange },
  error: {
    color: AtlasColors.redDark,
    backgroundColor: AtlasColors.redLight,
    borderRadius: 12,
    padding: 10,
    fontSize: 12.5,
    fontFamily: AtlasFonts.bodyBold,
  },
  resultCount: { fontSize: 12, fontFamily: AtlasFonts.bodyBold, marginTop: 4 },
  resultCard: { gap: 8 },
  resultHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  resultUni: { flex: 1, fontSize: 14, fontFamily: AtlasFonts.heading },
  riskBadge: { borderRadius: AtlasRadius.pill, paddingVertical: 4, paddingHorizontal: 10 },
  riskBadgeText: { fontSize: 11, fontFamily: AtlasFonts.bodyBold },
  resultDept: { fontSize: 12, fontFamily: AtlasFonts.bodySemi, lineHeight: 17 },
  statLine: { flexDirection: 'row', gap: 8, marginTop: 2 },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 9, fontFamily: AtlasFonts.bodyBold, color: AtlasColors.gray, textAlign: 'center' },
  statValue: { fontSize: 12.5, fontFamily: AtlasFonts.heading, marginTop: 2, textAlign: 'center' },
  disclaimer: { fontSize: 10.5, fontFamily: AtlasFonts.bodySemi, lineHeight: 15, marginTop: 6 },
});
