import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { Card } from '@/components/ui/card';
import { AtlasColors, AtlasFonts, AtlasRadius, AtlasSurface } from '@/constants/atlas-theme';
import { fetchProfile, updateProfile } from '@/lib/queries';
import { useThemeMode } from '@/lib/theme-context';

/** EKRAN — Ayarlar. Şimdilik yalnız hedef okul/bölüm (onboarding'de girilenin değiştirilebildiği yer). */
export default function AyarlarScreen() {
  const router = useRouter();
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];

  const [university, setUniversity] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [adsRemoved, setAdsRemoved] = useState(false);

  useEffect(() => {
    fetchProfile()
      .then((p) => {
        setUniversity(p.target_university ?? '');
        setDepartment(p.target_department ?? '');
        setIsPremium(p.is_premium);
        setAdsRemoved(p.ads_removed);
      })
      .catch(() => setError('Profil yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

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
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={[styles.back, { color: surface.text }]}>‹ Geri</Text>
          </Pressable>
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
                {!isPremium && (adsRemoved ? (
                  <Text style={styles.premiumActive}>🚫📺 Reklamsız aktif</Text>
                ) : (
                  <Btn3D variant="purple" onPress={() => router.push('/reklamsiz')}>
                    Reklamsız Deneyim
                  </Btn3D>
                ))}
              </View>
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: surface.text }]}>Puan Hesaplama</Text>
            <Text style={[styles.sectionSub, { color: surface.textSecondary }]}>
              Netlerini gir, ham puanını ve yerleştirme puanını hesapla (TYT/SAY/EA/SÖZ/DİL).
            </Text>
            <Btn3D variant="blue" onPress={() => router.push('/puan-hesapla')}>
              🧮 Puanımı Hesapla
            </Btn3D>
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
  scroll: { paddingHorizontal: 18, paddingBottom: 30, gap: 14 },
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
  premiumActive: {
    color: AtlasColors.greenDark,
    fontSize: 14,
    fontFamily: AtlasFonts.heading,
    textAlign: 'center',
  },
});
