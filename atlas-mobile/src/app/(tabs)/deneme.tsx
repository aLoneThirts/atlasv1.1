import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetTrendChart } from '@/components/score/net-trend-chart';
import { Btn3D } from '@/components/ui/btn-3d';
import { Card } from '@/components/ui/card';
import { Interactive } from '@/components/ui/interactive';
import { AtlasColors, AtlasFonts, AtlasRadius, AtlasSurface } from '@/constants/atlas-theme';
import { DENEME_SUBJECT_ORDER, denemeSubjectMeta } from '@/constants/deneme-subjects';
import { deleteMockExam, fetchMockExamHistory, updateMockExamNets } from '@/lib/queries';
import { useThemeMode } from '@/lib/theme-context';
import type { MockExamHistoryEntry, MockExamNets } from '@/lib/types';

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function orderedSubjects(nets: MockExamNets): string[] {
  const keys = Object.keys(nets ?? {});
  const orderSet = new Set<string>(DENEME_SUBJECT_ORDER);
  const ordered = DENEME_SUBJECT_ORDER.filter((s) => keys.includes(s));
  const extra = keys.filter((s) => !orderSet.has(s));
  return [...ordered, ...extra];
}

type WithDelta = MockExamHistoryEntry & { delta: number | null };

/**
 * EKRAN — Deneme Net Takibi. Koç sekmesinde girilen deneme sonuçlarının
 * (mock_exams) özet istatistikleri, ders bazlı seçilebilir trend grafiği ve
 * geçmiş kayıt listesi (kart içi düzenleme/silme dahil). Kayıt girişi burada
 * yapılmaz — Koç sekmesindeki "Deneme Sonucu Gir" formuna yönlendirir.
 */
export default function DenemeScreen() {
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];
  const router = useRouter();

  const [history, setHistory] = useState<MockExamHistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const h = await fetchMockExamHistory();
      setHistory(h);
      setBanner(null);
    } catch (e) {
      // Sessiz-yutma daha önce Koç ekranında ekranın sonsuza dek boş kalmasına
      // sebep olmuştu (bkz. proje geçmişi) — burada en azından konsola yazıp
      // görünür bir banner gösteriyoruz, "hiç kaydın yok" ile "yüklenemedi"
      // farklı durumlar, kullanıcı ikisini ayırt edebilmeli.
      console.error('[deneme] geçmiş yüklenemedi:', e);
      setBanner('Deneme geçmişi yüklenemedi — internetini kontrol edip aşağı çekerek tekrar dene.');
    } finally {
      setLoaded(true);
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

  const goToDenemeForm = () => router.push({ pathname: '/koc', params: { openDeneme: '1' } } as never);

  const withDelta: WithDelta[] = useMemo(
    () => history.map((e, i) => ({ ...e, delta: i > 0 ? e.totalNet - history[i - 1].totalNet : null })),
    [history],
  );
  const reversedHistory = useMemo(() => [...withDelta].reverse(), [withDelta]);

  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const totals = history.map((e) => e.totalNet);
    const avg = totals.reduce((s, n) => s + n, 0) / totals.length;
    const best = Math.max(...totals);
    const lastDelta = totals.length > 1 ? totals[totals.length - 1] - totals[totals.length - 2] : null;
    return { count: history.length, avg, best, lastDelta };
  }, [history]);

  const startEdit = (entry: MockExamHistoryEntry) => {
    setBanner(null);
    setEditingId(entry.id);
    const vals: Record<string, string> = {};
    orderedSubjects(entry.nets).forEach((s) => {
      const v = Number(entry.nets[s] ?? 0);
      vals[s] = Number.isInteger(v) ? String(v) : v.toFixed(1);
    });
    setEditVals(vals);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditVals({});
  };

  const saveEdit = async (entry: MockExamHistoryEntry) => {
    const nets: MockExamNets = {};
    let anyValid = false;
    for (const [subject, raw] of Object.entries(editVals)) {
      const num = Number(raw.replace(',', '.').trim());
      if (Number.isFinite(num) && num >= 0) {
        nets[subject] = num;
        anyValid = true;
      }
    }
    if (!anyValid) {
      setBanner('En az bir ders neti girmelisin.');
      return;
    }
    setSavingEdit(true);
    try {
      await updateMockExamNets(entry.id, nets);
      const totalNet = Object.values(nets).reduce((s, n) => s + n, 0);
      setHistory((prev) => prev.map((h) => (h.id === entry.id ? { ...h, nets, totalNet } : h)));
      setEditingId(null);
      setEditVals({});
    } catch {
      setBanner('Kaydedilemedi, tekrar dener misin?');
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = (entry: MockExamHistoryEntry) => {
    const doDelete = async () => {
      try {
        await deleteMockExam(entry.id);
        setHistory((prev) => prev.filter((h) => h.id !== entry.id));
      } catch {
        setBanner('Silinemedi, tekrar dener misin?');
      }
    };
    // RN Web'de butonlu Alert.alert sessiz no-op — tarayıcının confirm'i kullanılır
    if (Platform.OS === 'web') {
      if (window.confirm(`${formatDate(entry.takenOn)} tarihli deneme kalıcı olarak silinsin mi?`)) doDelete();
      return;
    }
    Alert.alert('Bu denemeyi sil?', `${formatDate(entry.takenOn)} tarihli kayıt kalıcı olarak silinecek.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: doDelete },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: surface.bg }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: surface.text }]}>📈 Deneme Net Takibi</Text>
          <Text style={[styles.subtitle, { color: surface.textSecondary }]}>
            Sınav performansını takip et, gelişimini gör
          </Text>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {banner && (
            <Interactive onPress={() => setBanner(null)} style={styles.bannerWrap}>
              <Text style={styles.bannerText}>{banner}</Text>
            </Interactive>
          )}

          {!loaded ? null : history.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📊</Text>
              <Text style={[styles.emptyTitle, { color: surface.text }]}>Henüz deneme kaydın yok</Text>
              <Text style={[styles.emptyText, { color: surface.textSecondary }]}>
                İlk deneme sonucunu girerek net gelişimini burada takip etmeye başla.
              </Text>
              <Btn3D variant="blue" onPress={goToDenemeForm}>
                📝 İlk Denemeni Gir
              </Btn3D>
            </Card>
          ) : (
            <>
              {stats && (
                <View style={styles.statsRow}>
                  <StatTile label="DENEME" value={String(stats.count)} surface={surface} />
                  <StatTile label="ORTALAMA" value={stats.avg.toFixed(1)} surface={surface} />
                  <StatTile label="EN İYİ" value={stats.best.toFixed(1)} surface={surface} color={AtlasColors.greenDark} />
                  <StatTile
                    label="SON DEĞİŞİM"
                    value={stats.lastDelta === null ? '—' : `${stats.lastDelta >= 0 ? '▲' : '▼'} ${Math.abs(stats.lastDelta).toFixed(1)}`}
                    surface={surface}
                    color={stats.lastDelta === null ? undefined : stats.lastDelta >= 0 ? AtlasColors.greenDark : AtlasColors.red}
                  />
                </View>
              )}

              <Card style={styles.chartCard}>
                <NetTrendChart entries={history} surface={surface} />
              </Card>

              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: surface.text }]}>Geçmiş Denemeler</Text>
                <Interactive onPress={goToDenemeForm} style={styles.addPill}>
                  <Text style={styles.addPillText}>+ Yeni Deneme</Text>
                </Interactive>
              </View>

              {reversedHistory.map((entry) => {
                const isEditing = editingId === entry.id;
                return (
                  <Card key={entry.id} style={styles.entryCard}>
                    <View style={styles.entryHead}>
                      <View style={styles.entryHeadLeft}>
                        <Text style={[styles.entryDate, { color: surface.text }]}>{formatDate(entry.takenOn)}</Text>
                        {entry.delta !== null && (
                          <Text style={[styles.entryDelta, entry.delta >= 0 ? styles.deltaUp : styles.deltaDown]}>
                            {entry.delta >= 0 ? '▲' : '▼'} {Math.abs(entry.delta).toFixed(1)}
                          </Text>
                        )}
                      </View>
                      {!isEditing && (
                        <View style={styles.entryActions}>
                          <Interactive onPress={() => startEdit(entry)} hitSlop={8} style={styles.iconBtn}>
                            <Text style={styles.iconBtnText}>✎</Text>
                          </Interactive>
                          <Interactive onPress={() => confirmDelete(entry)} hitSlop={8} style={styles.iconBtn}>
                            <Text style={styles.iconBtnText}>🗑</Text>
                          </Interactive>
                        </View>
                      )}
                    </View>

                    {!isEditing && (
                      <Text style={[styles.entryTotal, { color: surface.text }]}>{entry.totalNet.toFixed(1)} net</Text>
                    )}

                    {isEditing ? (
                      <View style={styles.editArea}>
                        <View style={styles.editGrid}>
                          {Object.keys(editVals).map((subject) => {
                            const meta = denemeSubjectMeta(subject);
                            return (
                              <View key={subject} style={styles.editField}>
                                <Text style={[styles.editLabel, { color: surface.textSecondary }]}>
                                  {meta.emoji} {subject}
                                </Text>
                                <TextInput
                                  style={[styles.editInput, { color: surface.text, borderColor: surface.cardBorder }]}
                                  keyboardType="numeric"
                                  value={editVals[subject]}
                                  onChangeText={(t) => setEditVals((prev) => ({ ...prev, [subject]: t }))}
                                />
                              </View>
                            );
                          })}
                        </View>
                        <View style={styles.editActions}>
                          <Interactive
                            onPress={cancelEdit}
                            disabled={savingEdit}
                            style={[styles.cancelBtn, { borderColor: surface.cardBorder }]}>
                            <Text style={[styles.cancelBtnText, { color: surface.textSecondary }]}>İptal</Text>
                          </Interactive>
                          <Btn3D variant="green" size="small" onPress={() => saveEdit(entry)} disabled={savingEdit}>
                            {savingEdit ? '...' : 'Kaydet'}
                          </Btn3D>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.entryBreakdown}>
                        {orderedSubjects(entry.nets).map((subject) => {
                          const meta = denemeSubjectMeta(subject);
                          return (
                            <View key={subject} style={[styles.subjectChip, { borderColor: `${meta.color}55` }]}>
                              <Text style={[styles.subjectChipText, { color: meta.color }]}>
                                {meta.emoji} {subject} {Number(entry.nets[subject]).toFixed(1)}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </Card>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function StatTile({
  label,
  value,
  surface,
  color,
}: {
  label: string;
  value: string;
  surface: { card: string; cardBorder: string; text: string; textSecondary: string };
  color?: string;
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: surface.card, borderColor: surface.cardBorder }]}>
      <Text style={[styles.statValue, { color: color ?? surface.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: surface.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 2 },
  title: { fontSize: 22, fontFamily: AtlasFonts.heading },
  subtitle: { fontSize: 12.5, fontFamily: AtlasFonts.bodySemi },
  scrollArea: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingBottom: 30, gap: 12 },

  bannerWrap: {
    backgroundColor: 'rgba(255,75,75,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.35)',
    borderRadius: AtlasRadius.button,
    padding: 10,
  },
  bannerText: { color: AtlasColors.red, fontSize: 12.5, fontFamily: AtlasFonts.bodySemi, textAlign: 'center' },

  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  emptyEmoji: { fontSize: 40, marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontFamily: AtlasFonts.heading },
  emptyText: { fontSize: 13, fontFamily: AtlasFonts.bodySemi, textAlign: 'center', paddingHorizontal: 16, marginBottom: 8, lineHeight: 19 },

  statsRow: { flexDirection: 'row', gap: 8 },
  statTile: { flex: 1, borderRadius: AtlasRadius.card, borderWidth: 1, paddingVertical: 12, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 16, fontFamily: AtlasFonts.heading },
  statLabel: { fontSize: 9, fontFamily: AtlasFonts.bodyBold, letterSpacing: 0.4 },

  chartCard: { gap: 8 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontFamily: AtlasFonts.heading },
  addPill: {
    backgroundColor: 'rgba(28,176,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(28,176,246,0.4)',
    borderRadius: AtlasRadius.pill,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  addPillText: { color: AtlasColors.blueDark, fontSize: 11.5, fontFamily: AtlasFonts.bodyBold },

  entryCard: { gap: 8 },
  entryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryDate: { fontSize: 13.5, fontFamily: AtlasFonts.bodyBold },
  entryDelta: { fontSize: 11.5, fontFamily: AtlasFonts.bodyBold },
  deltaUp: { color: AtlasColors.greenDark },
  deltaDown: { color: AtlasColors.red },
  entryActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(128,128,128,0.1)' },
  iconBtnText: { fontSize: 13 },
  entryTotal: { fontSize: 17, fontFamily: AtlasFonts.heading },
  entryBreakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  subjectChip: { borderWidth: 1.5, borderRadius: AtlasRadius.pill, paddingVertical: 4, paddingHorizontal: 9 },
  subjectChipText: { fontSize: 11.5, fontFamily: AtlasFonts.bodyBold },

  editArea: { gap: 10 },
  editGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  editField: { flexBasis: '47%', flexGrow: 1 },
  editLabel: { fontSize: 10.5, fontFamily: AtlasFonts.bodyBold, marginBottom: 4 },
  editInput: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, fontSize: 13.5, fontFamily: AtlasFonts.bodyBold },
  editActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', alignItems: 'center' },
  cancelBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14 },
  cancelBtnText: { fontSize: 13, fontFamily: AtlasFonts.bodyBold },
});
