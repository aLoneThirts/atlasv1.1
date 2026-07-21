import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Interactive } from '@/components/ui/interactive';
import { AtlasColors, AtlasFonts, AtlasLayout, AtlasRadius, AtlasSurface } from '@/constants/atlas-theme';
import { refreshExamCountdownNotification } from '@/lib/exam-countdown-notification';
import { safeGoBack } from '@/lib/navigation';
import { deleteAccount, fetchProfile, setExamTrack, updateProfile } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useThemeMode } from '@/lib/theme-context';
import type { ExamTrack } from '@/lib/types';

const EXAM_TRACK_OPTIONS: { value: ExamTrack; label: string }[] = [
  { value: 'tyt', label: 'Sadece TYT' },
  { value: 'tyt_ayt_ea', label: 'TYT + AYT (EA)' },
];

/** EKRAN — Ayarlar. Sınav kapsamı + hedef okul/bölüm (onboarding'de girilenlerin değiştirilebildiği yer). */
export default function AyarlarScreen() {
  const router = useRouter();
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];

  const [university, setUniversity] = useState('');
  const [department, setDepartment] = useState('');
  const [examDate, setExamDate] = useState<string | null>(null);
  const [examTrack, setExamTrackState] = useState<ExamTrack>('tyt');
  const [examTrackBusy, setExamTrackBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [adsRemoved, setAdsRemoved] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile()
      .then((p) => {
        setUniversity(p.target_university ?? '');
        setDepartment(p.target_department ?? '');
        setExamDate(p.exam_date);
        setExamTrackState(p.exam_track);
        setIsPremium(p.is_premium);
        setAdsRemoved(p.ads_removed);
      })
      .catch(() => setError('Profil yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  const onPickExamTrack = async (track: ExamTrack) => {
    if (examTrackBusy || track === examTrack) return;
    const previous = examTrack;
    setExamTrackState(track);
    setExamTrackBusy(true);
    try {
      await setExamTrack(track);
    } catch {
      setExamTrackState(previous);
      setError('Sınav kapsamı kaydedilemedi — internetini kontrol edip tekrar dene.');
    } finally {
      setExamTrackBusy(false);
    }
  };

  const onPickExamDate = async (iso: string) => {
    const previous = examDate;
    setExamDate(iso);
    try {
      await updateProfile({ exam_date: iso });
      refreshExamCountdownNotification(iso);
    } catch {
      setExamDate(previous);
      setError('Sınav tarihi kaydedilemedi — internetini kontrol edip tekrar dene.');
    }
  };

  const onDeleteAccount = async () => {
    if (deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      await supabase.auth.signOut();
    } catch {
      setDeleteError('Hesap silinemedi — internetini kontrol edip tekrar dene.');
      setDeleteBusy(false);
    }
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({
        target_university: university.trim() || null,
        target_department: department.trim() || null,
      });
      setSaved(true);
    } catch {
      setError('Kaydedilemedi — internetini kontrol edip tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: surface.bg }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Interactive onPress={() => safeGoBack(router)} hitSlop={10}>
            <Text style={[styles.back, { color: surface.text }]}>‹ Geri</Text>
          </Interactive>
          <Text style={[styles.title, { color: surface.text }]}>Ayarlar</Text>
          <View style={styles.backSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: surface.text }]}>Üyelik</Text>
            {!loading && (
              <View style={styles.form}>
                {isPremium ? (
                  <Text style={styles.premiumActive}>👑 Premium aktif</Text>
                ) : (
                  <Btn3D variant="yellow" onPress={() => router.push('/premium')}>
                    👑 Premium&apos;a Geç
                  </Btn3D>
                )}
                {!isPremium && adsRemoved && <Text style={styles.premiumActive}>🚫📺 Reklamsız aktif</Text>}
              </View>
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: surface.text }]}>Sınav Kapsamı</Text>
            <Text style={[styles.sectionSub, { color: surface.textSecondary }]}>
              Fetih haritan buna göre şekillenir — istediğin zaman değiştirebilirsin.
            </Text>
            {!loading && (
              <View style={styles.trackRow}>
                {EXAM_TRACK_OPTIONS.map((opt) => (
                  <Interactive
                    key={opt.value}
                    onPress={() => onPickExamTrack(opt.value)}
                    style={[
                      styles.trackPill,
                      { borderColor: surface.cardBorder },
                      examTrack === opt.value && styles.trackPillActive,
                    ]}>
                    <Text style={[styles.trackPillText, examTrack === opt.value && styles.trackPillTextActive]}>
                      {opt.label}
                    </Text>
                  </Interactive>
                ))}
              </View>
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: surface.text }]}>Sınav Tarihi</Text>
            <Text style={[styles.sectionSub, { color: surface.textSecondary }]}>
              Koç ekranında geri sayım olarak gösterilir.
            </Text>
            {!loading && (
              <DateField value={examDate} onChange={onPickExamDate} minimumDate={new Date()} placeholder="Sınav tarihini seç" />
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: surface.text }]}>Hedef Okul / Bölüm</Text>
            <Text style={[styles.sectionSub, { color: surface.textSecondary }]}>
              Koçun sana buna göre yol gösteriyor. İstediğin zaman değiştirebilirsin.
            </Text>

            {!loading && (
              <View style={styles.form}>
                <TextInput
                  style={[styles.input, { color: surface.text, borderColor: surface.cardBorder }]}
                  placeholder="Hedef Üniversite (ör. Boğaziçi)"
                  placeholderTextColor={surface.textSecondary}
                  value={university}
                  onChangeText={setUniversity}
                />
                <TextInput
                  style={[styles.input, { color: surface.text, borderColor: surface.cardBorder }]}
                  placeholder="Hedef Bölüm (ör. İktisat)"
                  placeholderTextColor={surface.textSecondary}
                  value={department}
                  onChangeText={setDepartment}
                  onSubmitEditing={save}
                />

                {error && <Text style={styles.error}>{error}</Text>}
                {saved && <Text style={styles.savedText}>Kaydedildi ✓</Text>}

                <Btn3D onPress={save} disabled={busy}>
                  {busy ? '...' : 'Kaydet'}
                </Btn3D>
              </View>
            )}
          </Card>

          <Card style={styles.card}>
            <Interactive onPress={() => router.push('/hukuki')} hitSlop={8}>
              <Text style={[styles.sectionTitle, { color: surface.text }]}>Gizlilik ve Kullanım Şartları</Text>
            </Interactive>
          </Card>

          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: AtlasColors.redDark }]}>Tehlikeli Bölge</Text>
            <Text style={[styles.sectionSub, { color: surface.textSecondary }]}>
              Hesabını sildiğinde tüm ilerlemen, canların, seri ve satın alımların kalıcı olarak silinir. Bu işlem geri alınamaz.
            </Text>
            {deleteError && <Text style={styles.error}>{deleteError}</Text>}
            {!deleteConfirming ? (
              <Interactive onPress={() => setDeleteConfirming(true)} hitSlop={8}>
                <Text style={styles.dangerLink}>Hesabı Sil</Text>
              </Interactive>
            ) : (
              <View style={styles.form}>
                <Text style={[styles.sectionSub, { color: surface.text }]}>
                  Emin misin? Bu işlem geri alınamaz.
                </Text>
                <Btn3D variant="red" onPress={onDeleteAccount} disabled={deleteBusy}>
                  {deleteBusy ? 'Siliniyor...' : 'Evet, Kalıcı Olarak Sil'}
                </Btn3D>
                <Interactive onPress={() => setDeleteConfirming(false)} disabled={deleteBusy} hitSlop={8}>
                  <Text style={[styles.sectionSub, { color: surface.textSecondary, textAlign: 'center' }]}>Vazgeç</Text>
                </Interactive>
              </View>
            )}
          </Card>
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
    paddingVertical: 12,
  },
  back: { fontSize: 15, fontFamily: AtlasFonts.bodyBold },
  backSpacer: { width: 40 },
  title: { fontSize: 17, fontFamily: AtlasFonts.heading },
  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 30,
    gap: 14,
    width: '100%',
    maxWidth: AtlasLayout.maxFormWidth,
    alignSelf: 'center',
  },
  card: { gap: 4 },
  sectionTitle: { fontSize: 15, fontFamily: AtlasFonts.heading },
  sectionSub: { fontSize: 12, fontFamily: AtlasFonts.bodySemi, marginTop: 2, marginBottom: 10 },
  form: { gap: 12 },
  input: {
    borderWidth: 1.5,
    borderRadius: AtlasRadius.button,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  error: {
    color: AtlasColors.redDark,
    fontSize: 13,
    fontFamily: AtlasFonts.bodyBold,
    textAlign: 'center',
  },
  savedText: {
    color: AtlasColors.greenDark,
    fontSize: 13,
    fontFamily: AtlasFonts.bodyBold,
    textAlign: 'center',
  },
  dangerLink: {
    color: AtlasColors.redDark,
    fontSize: 14,
    fontFamily: AtlasFonts.bodyBold,
    textAlign: 'center',
  },
  premiumActive: {
    color: AtlasColors.greenDark,
    fontSize: 14,
    fontFamily: AtlasFonts.heading,
    textAlign: 'center',
  },
  trackRow: { flexDirection: 'row', gap: 8 },
  trackPill: { flex: 1, borderWidth: 1.5, borderRadius: AtlasRadius.pill, paddingVertical: 10, alignItems: 'center' },
  trackPillActive: { backgroundColor: AtlasColors.blue, borderColor: AtlasColors.blue },
  trackPillText: { fontSize: 13, fontFamily: AtlasFonts.bodyBold, color: AtlasColors.gray },
  trackPillTextActive: { color: AtlasColors.white },
});
