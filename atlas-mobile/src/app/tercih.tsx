import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { Card } from '@/components/ui/card';
import { AtlasColors, AtlasFonts, AtlasRadius, AtlasSurface } from '@/constants/atlas-theme';
import { fetchTercihOnerileri } from '@/lib/queries';
import { useThemeMode } from '@/lib/theme-context';
import type { TercihOneri, TercihRisk } from '@/lib/types';
import type { ScoreType } from '@shared/yks-calc';
import { yuvarla } from '@shared/yks-calc';

/**
 * EKRAN — Tercih Robotu (madde 3).
 * Kullanıcı YA sırasını YA puanını + filtreleri girer; tercih_oner RPC'si
 * (supabase/tercih_robotu.sql) her programı taban sıra/puanıyla kıyaslayıp
 * 3 risk seviyesine ayırır. Veri kaynağı yks_programs/yks_program_stats
 * (tools/yokatlas-scraper ile toplanıp yüklenir). Puan sekmesindeki
 * "Tercih Robotu" butonundan açılır (bkz. (tabs)/puan.tsx).
 *
 * NOT: Kullanıcının sırası/puanı ELLE girilir (madde 1a). Net'ten otomatik
 * türetme ve önlisans/geçmiş yıl sırası ikinci adımda (madde 2c) eklenecek.
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

export default function TercihScreen() {
  const router = useRouter();
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];

  const [rank, setRank] = useState('');
  const [score, setScore] = useState('');
  const [scoreType, setScoreType] = useState<ScoreType | null>('SAY');
  const [year, setYear] = useState(YEARS[0]);
  const [risk, setRisk] = useState<TercihRisk | null>('dengeli');
  const [uniType, setUniType] = useState<'DEVLET' | 'VAKIF' | null>(null);
  const [city, setCity] = useState('');
  const [program, setProgram] = useState('');
  const [university, setUniversity] = useState('');
  const [maxResult, setMaxResult] = useState('50');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TercihOneri[] | null>(null);

  const setRankInput = (v: string) => {
    setRank(v.replace(/[^0-9]/g, ''));
    setResults(null);
  };
  const setScoreInput = (v: string) => {
    // rakam + tek ayraç (virgül/nokta) — virgülü noktaya çeviririz
    const clean = v.replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    setScore(parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean);
    setResults(null);
  };
  const setMaxInput = (v: string) => {
    const clean = v.replace(/[^0-9]/g, '');
    setMaxResult(clean === '' ? '' : String(Math.min(Number(clean), 200)));
  };

  const rankNum = rank === '' ? null : Number(rank);
  const scoreNum = score === '' || score === '.' ? null : Number(score);
  const rankUsedOnOldYear = rankNum != null && scoreNum == null && year !== 2025;

  const getir = async () => {
    if (busy) return;
    if (rankNum == null && scoreNum == null) {
      setError('Önce sıralamanı ya da puanını gir.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const list = await fetchTercihOnerileri({
        scoreType,
        year,
        rank: rankNum,
        score: rankNum == null ? scoreNum : null, // sıra verildiyse puanı yok say
        risk,
        city: city.trim() || null,
        universityType: uniType,
        qProgram: program.trim(),
        qUniversity: university.trim(),
        limit: maxResult === '' ? 50 : Number(maxResult),
      });
      setResults(list);
    } catch (e) {
      setResults(null);
      setError(e instanceof Error ? e.message : 'Öneri getirilemedi — internetini kontrol edip tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: surface.bg }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={[styles.back, { color: surface.text }]}>‹ Geri</Text>
          </Pressable>
          <Text style={[styles.title, { color: surface.text }]}>🎯 Tercih Robotu</Text>
          <View style={styles.backSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.intro, { color: surface.textSecondary }]}>
            Sıralanı veya puanını gir; filtrele. Robot programları taban sıra/puanına göre
            3 risk seviyesinde önerir — 🟢 güvenli, 🟡 dengeli, 🔴 riskli.
          </Text>

          {/* SIRA / PUAN */}
          <Card style={styles.card}>
            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
                <Text style={[styles.fieldLabel, { color: surface.textSecondary }]}>SIRAN</Text>
                <TextInput
                  style={[styles.input, { color: surface.text, borderColor: surface.cardBorder }]}
                  placeholder="ör. 20000"
                  placeholderTextColor={surface.textSecondary}
                  keyboardType="number-pad"
                  value={rank}
                  onChangeText={setRankInput}
                />
              </View>
              <View style={styles.orCol}>
                <Text style={[styles.orText, { color: surface.textSecondary }]}>veya</Text>
              </View>
              <View style={styles.inputCol}>
                <Text style={[styles.fieldLabel, { color: surface.textSecondary }]}>PUAN</Text>
                <TextInput
                  style={[styles.input, { color: surface.text, borderColor: surface.cardBorder }]}
                  placeholder="ör. 450.5"
                  placeholderTextColor={surface.textSecondary}
                  keyboardType="decimal-pad"
                  value={score}
                  onChangeText={setScoreInput}
                />
              </View>
            </View>
            <Text style={[styles.hint, { color: surface.textSecondary }]}>
              İkisini birden girersen sıra esas alınır. Sıra ile arama şimdilik yalnız 2025 için
              çalışır; geçmiş yıllar için puan gir.
            </Text>
          </Card>

          {/* Filtreler */}
          <Card style={styles.card}>
            <Text style={[styles.groupLabel, { color: surface.textSecondary }]}>PUAN TÜRÜ</Text>
            <PillRow
              options={SCORE_TYPES}
              selected={scoreType}
              onSelect={(v) => {
                setScoreType(v);
                setResults(null);
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
                setResults(null);
              }}
              surface={surface}
              activeColor={AtlasColors.blue}
            />

            <Text style={[styles.groupLabel, { color: surface.textSecondary }]}>RİSK</Text>
            <PillRow
              options={RISKS}
              selected={risk}
              onSelect={(v) => {
                setRisk(v);
                setResults(null);
              }}
              surface={surface}
              activeColor={AtlasColors.orange}
            />

            <Text style={[styles.groupLabel, { color: surface.textSecondary }]}>ÜNİVERSİTE TÜRÜ</Text>
            <PillRow
              options={UNI_TYPES}
              selected={uniType}
              onSelect={(v) => {
                setUniType(v);
                setResults(null);
              }}
              surface={surface}
              activeColor={AtlasColors.green}
            />
          </Card>

          {/* Arama alanları */}
          <Card style={styles.card}>
            <LabeledInput
              label="ŞEHİR"
              placeholder="ör. Ankara (boş = hepsi)"
              value={city}
              onChangeText={(v) => {
                setCity(v);
                setResults(null);
              }}
              surface={surface}
              onSubmit={getir}
            />
            <LabeledInput
              label="PROGRAM ARA"
              placeholder="ör. Tıp"
              value={program}
              onChangeText={(v) => {
                setProgram(v);
                setResults(null);
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
                setResults(null);
              }}
              surface={surface}
              onSubmit={getir}
            />
            <LabeledInput
              label="MAX SONUÇ"
              placeholder="50"
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

          {rankUsedOnOldYear && (
            <Text style={[styles.warn, { color: surface.textSecondary }]}>
              ⚠️ {year} için taban sıra verisi yok; sıra ile arama boş dönebilir. Bu yıl için puan gir.
            </Text>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <Btn3D variant="orange" onPress={getir} disabled={busy}>
            {busy ? '...' : 'Öneri Listesi Getir'}
          </Btn3D>

          {results && results.length === 0 && (
            <Card style={styles.card}>
              <Text style={{ color: surface.textSecondary }}>
                Bu filtrelerle uygun program bulunamadı — sıra/puanını ya da filtreleri gevşetip
                tekrar dene.
              </Text>
            </Card>
          )}

          {results && results.length > 0 && (
            <>
              <Text style={[styles.resultCount, { color: surface.textSecondary }]}>
                {results.length} program • en yakın taban önce
              </Text>
              {results.map((r) => (
                <ResultCard key={r.programId} item={r} surface={surface} usedRank={rankNum != null} />
              ))}
              <Text style={[styles.disclaimer, { color: surface.textSecondary }]}>
                ⚠️ Taban puan/sıralar geçmiş yıl verisidir; kontenjan ve sınav zorluğu her yıl değişir.
                Bu liste bir tahmindir, kesin tercih için ÖSYM/YÖK Atlas&apos;ı da kontrol et.
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

function ResultCard({
  item,
  surface,
  usedRank,
}: {
  item: TercihOneri;
  surface: (typeof AtlasSurface)[keyof typeof AtlasSurface];
  usedRank: boolean;
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
        <Stat label="Taban Puan" value={item.minScore != null ? String(yuvarla(item.minScore)) : '—'} surface={surface} />
        <Stat
          label="Taban Sıra"
          value={item.minRank != null ? `~${item.minRank.toLocaleString('tr')}` : '—'}
          surface={surface}
        />
        <Stat label="Kontenjan" value={item.quota != null ? String(item.quota) : '—'} surface={surface} />
        <Stat
          label={usedRank ? 'Sıra Farkı' : 'Puan Farkı'}
          value={item.gap != null ? (usedRank ? Math.round(item.gap).toLocaleString('tr') : String(yuvarla(item.gap))) : '—'}
          surface={surface}
        />
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
  scroll: { paddingHorizontal: 18, paddingBottom: 48, gap: 14 },
  intro: { fontSize: 12.5, fontFamily: AtlasFonts.bodySemi, lineHeight: 18 },
  card: { gap: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  inputCol: { flex: 1, gap: 6 },
  orCol: { paddingBottom: 12 },
  orText: { fontSize: 12, fontFamily: AtlasFonts.bodySemi },
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
  onlisansRow: { flexDirection: 'row', alignItems: 'center', gap: 10, opacity: 0.6 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2 },
  onlisansLabel: { fontSize: 12.5, fontFamily: AtlasFonts.bodySemi },
  soon: { fontFamily: AtlasFonts.bodyBold, color: AtlasColors.orange },
  warn: { fontSize: 11.5, fontFamily: AtlasFonts.bodySemi, lineHeight: 16 },
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
