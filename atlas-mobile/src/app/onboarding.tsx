import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { DateField } from '@/components/ui/date-field';
import { Interactive } from '@/components/ui/interactive';
import { AtlasColors, AtlasGradients, AtlasLayout, AtlasRadius } from '@/constants/atlas-theme';
import { useAuth } from '@/lib/auth-context';
import { refreshExamCountdownNotification } from '@/lib/exam-countdown-notification';
import { fetchProfile, setExamTrack, updateProfile } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { ExamTrack } from '@/lib/types';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const EXAM_TRACK_OPTIONS: { value: ExamTrack; emoji: string; title: string; subtitle: string }[] = [
  { value: 'tyt', emoji: '🏰', title: 'Sadece TYT', subtitle: 'Türkçe, Tarih, Coğrafya, Felsefe, Fizik, Kimya, Biyoloji' },
  { value: 'tyt_ayt_ea', emoji: '⚔️', title: 'TYT + AYT (EA)', subtitle: 'Yukarıdakilere ek: Edebiyat, Tarih, Coğrafya, Felsefe (AYT)' },
];

/**
 * EKRAN — İlk giriş onboarding'i.
 * Yalnız oturum açılmış AMA profiles.onboarding_completed=false iken gösterilir
 * (bkz. _layout.tsx Stack.Protected gate).
 *
 * Kullanıcı adı + ad/soyad da burada sorulur — Google ile girenler bunları
 * hiç seçmemiş olur (username e-posta önekinden otomatik türetilmişti,
 * bkz. supabase/profile-names.sql), bu ekran bunu tamamlama fırsatı verir.
 * E-posta ile kayıt olanlar zaten formda seçmişti, burada önceden dolu gelir
 * (istersen değiştir). Hedef okul/bölüm alanları boş bırakılıp atlanabilir;
 * "Şimdilik Atla" da yalnız o iki alanı boş geçer — kullanıcı adı/ad/soyad'daki
 * değişiklikler yine kaydedilir.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { refreshOnboarding } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [university, setUniversity] = useState('');
  const [department, setDepartment] = useState('');
  const [examDate, setExamDate] = useState<string | null>(null);
  const [examTrack, setExamTrackLocal] = useState<ExamTrack>('tyt');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchProfile()
      .then((p) => {
        setUsername(p.username ?? '');
        setOriginalUsername(p.username ?? '');
        setFirstName(p.first_name ?? '');
        setLastName(p.last_name ?? '');
        setUniversity(p.target_university ?? '');
        setDepartment(p.target_department ?? '');
        setExamDate(p.exam_date);
        setExamTrackLocal(p.exam_track);
      })
      .finally(() => setLoaded(true));
  }, []);

  const onUsernameChange = (text: string) => {
    setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  };

  useEffect(() => {
    if (!loaded) return;
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (username === originalUsername) {
      setUsernameStatus('idle'); // zaten kendi kullanıcı adı — tekrar kontrol gerekmez
      return;
    }
    if (!username) {
      setUsernameStatus('invalid');
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    checkTimer.current = setTimeout(async () => {
      const { data, error: err } = await supabase.rpc('is_username_available', { check_username: username });
      if (err) {
        setUsernameStatus('idle');
        return;
      }
      setUsernameStatus(data ? 'available' : 'taken');
    }, 450);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [username, originalUsername, loaded]);

  const usernameValid = username === originalUsername || USERNAME_RE.test(username);

  const finish = async (withValues: boolean) => {
    if (busy) return;
    if (!usernameValid) {
      setError('Kullanıcı adı 3-20 karakter olmalı, sadece küçük harf/rakam/alt çizgi içerebilir.');
      return;
    }
    if (username !== originalUsername && usernameStatus === 'taken') {
      setError('Bu kullanıcı adı alınmış — başka bir tane dene.');
      return;
    }
    if (!termsAccepted) {
      setError('Devam etmek için Kullanım Şartları ve Gizlilik Politikası\'nı onaylaman gerekiyor.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setExamTrack(examTrack);
      await updateProfile({
        username,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        target_university: withValues ? university.trim() || null : null,
        target_department: withValues ? department.trim() || null : null,
        exam_date: withValues ? examDate : null,
        onboarding_completed: true,
        terms_accepted_at: new Date().toISOString(),
      });
      if (withValues) refreshExamCountdownNotification(examDate);
      await refreshOnboarding();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.includes('duplicate key value') || msg.includes('profiles_username_lower_idx')
          ? 'Bu kullanıcı adı alınmış — başka bir tane dene.'
          : 'Kaydedilemedi — internetini kontrol edip tekrar dene.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={AtlasGradients.onboarding} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.emoji}>🎯</Text>
            <Text style={styles.title}>Profilini Tamamla</Text>
            <Text style={styles.sub}>
              Kullanıcı adın diğer öğrenciler seni bulup ekleyebilsin diye önemli. Hedef okul/bölümü
              {'\n'}istersen şimdi atla, ayarlardan istediğin an ekleyebilirsin.
            </Text>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Kullanıcı adı"
                placeholderTextColor="rgba(255,255,255,0.45)"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                value={username}
                onChangeText={onUsernameChange}
              />
              {usernameStatus !== 'idle' && (
                <Text
                  style={[
                    styles.usernameHint,
                    usernameStatus === 'available' && styles.usernameHintOk,
                    (usernameStatus === 'taken' || usernameStatus === 'invalid') && styles.usernameHintBad,
                  ]}>
                  {usernameStatus === 'checking' && 'Kontrol ediliyor…'}
                  {usernameStatus === 'available' && 'Kullanılabilir ✓'}
                  {usernameStatus === 'taken' && 'Bu kullanıcı adı alınmış'}
                  {usernameStatus === 'invalid' && 'En az 3 karakter — küçük harf/rakam/alt çizgi'}
                </Text>
              )}

              <View style={styles.nameRow}>
                <TextInput
                  style={[styles.input, styles.nameInput]}
                  placeholder="Ad"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  value={firstName}
                  onChangeText={setFirstName}
                />
                <TextInput
                  style={[styles.input, styles.nameInput]}
                  placeholder="Soyad"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>

              <Text style={styles.trackLabel}>Hangi sınava hazırlanıyorsun?</Text>
              <View style={styles.trackRow}>
                {EXAM_TRACK_OPTIONS.map((opt) => (
                  <Interactive
                    key={opt.value}
                    onPress={() => setExamTrackLocal(opt.value)}
                    style={[styles.trackCard, examTrack === opt.value && styles.trackCardActive]}>
                    <Text style={styles.trackEmoji}>{opt.emoji}</Text>
                    <Text style={styles.trackTitle}>{opt.title}</Text>
                    <Text style={styles.trackSubtitle}>{opt.subtitle}</Text>
                  </Interactive>
                ))}
              </View>

              <Text style={styles.trackLabel}>Sınav tarihin (biliyorsan)</Text>
              <DateField
                value={examDate}
                onChange={setExamDate}
                minimumDate={new Date()}
                placeholder="Sınav tarihini seç"
                dark
              />

              <TextInput
                style={styles.input}
                placeholder="Hedef Üniversite (ör. Boğaziçi)"
                placeholderTextColor="rgba(255,255,255,0.45)"
                value={university}
                onChangeText={setUniversity}
              />
              <TextInput
                style={styles.input}
                placeholder="Hedef Bölüm (ör. İktisat)"
                placeholderTextColor="rgba(255,255,255,0.45)"
                value={department}
                onChangeText={setDepartment}
                onSubmitEditing={() => finish(true)}
              />

              <Interactive
                style={styles.termsRow}
                onPress={() => setTermsAccepted((v) => !v)}
                hitSlop={6}>
                <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                  {termsAccepted && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.termsText}>
                  <Text
                    style={styles.termsLink}
                    onPress={() => router.push('/hukuki')}>
                    Kullanım Şartları ve Gizlilik Politikası
                  </Text>
                  &apos;nı okudum, kabul ediyorum. 18 yaşından küçüksem velimin bilgisi
                  dahilinde kullanıyorum.
                </Text>
              </Interactive>

              {error && <Text style={styles.error}>{error}</Text>}

              <Btn3D onPress={() => finish(true)} disabled={busy || !loaded || !termsAccepted}>
                {busy ? '...' : 'Kaydet ve Devam Et'}
              </Btn3D>

              <Interactive onPress={() => finish(false)} disabled={busy || !loaded || !termsAccepted} hitSlop={10}>
                <Text style={styles.skip}>Hedef Okul/Bölümü Şimdilik Atla</Text>
              </Interactive>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingVertical: 30,
    width: '100%',
    maxWidth: AtlasLayout.maxFormWidth,
    alignSelf: 'center',
  },
  emoji: { fontSize: 52, textAlign: 'center' },
  title: {
    color: AtlasColors.white,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 10,
  },
  sub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 26,
  },
  form: { gap: 12 },
  nameRow: { flexDirection: 'row', gap: 12 },
  nameInput: { flex: 1, minWidth: 0 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: AtlasRadius.button,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: AtlasColors.white,
    fontSize: 15,
  },
  usernameHint: {
    marginTop: -6,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  usernameHintOk: { color: AtlasColors.greenLight },
  usernameHintBad: { color: '#FFB4B4' },
  trackLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 4,
  },
  trackRow: { gap: 10 },
  trackCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: AtlasRadius.button,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  trackCardActive: {
    backgroundColor: 'rgba(88,204,2,0.18)',
    borderColor: AtlasColors.greenLight,
  },
  trackEmoji: { fontSize: 20, marginBottom: 2 },
  trackTitle: { color: AtlasColors.white, fontSize: 14.5, fontWeight: '800' },
  trackSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 11.5, marginTop: 2 },
  error: {
    color: '#FFB4B4',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: AtlasColors.greenLight,
    borderColor: AtlasColors.greenLight,
  },
  checkboxMark: {
    color: AtlasColors.inkStrong,
    fontSize: 13,
    fontWeight: '900',
  },
  termsText: {
    flex: 1,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12.5,
    lineHeight: 18,
  },
  termsLink: {
    color: AtlasColors.blue,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  skip: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
});
