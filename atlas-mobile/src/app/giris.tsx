import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { AtlasColors, AtlasGradients, AtlasLayout, AtlasRadius } from '@/constants/atlas-theme';
import { signInWithGoogle } from '@/lib/auth-google';
import { supabase } from '@/lib/supabase';

/**
 * EKRAN 01 — Giriş / Kayıt
 * Oturum açılınca root layout'taki Stack.Protected otomatik olarak
 * sekmelere geçirir; yönlendirme koduna gerek yok.
 */
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function GirisScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onUsernameChange = (text: string) => {
    const clean = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(clean);
  };

  useEffect(() => {
    if (mode !== 'signup') return;
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!username) {
      setUsernameStatus('idle');
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
  }, [username, mode]);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setInfo(null);
    const mail = email.trim().toLowerCase();
    if (!mail || !password) {
      setError('E-posta ve şifreni gir.');
      return;
    }
    if (mode === 'signup') {
      if (!USERNAME_RE.test(username)) {
        setError('Kullanıcı adı 3-20 karakter olmalı, sadece küçük harf/rakam/alt çizgi içerebilir.');
        return;
      }
      if (usernameStatus === 'taken') {
        setError('Bu kullanıcı adı alınmış — başka bir tane dene.');
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: mail,
          password,
          options: {
            data: {
              username,
              first_name: firstName.trim() || null,
              last_name: lastName.trim() || null,
            },
          },
        });
        if (err) throw err;
        if (!data.session) {
          setInfo('Hesabın oluştu! 📬 E-postana gelen doğrulama bağlantısına tıkla, sonra giriş yap.');
          setMode('login');
        }
      }
    } catch (e) {
      setError(turkishAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const submitGoogle = async () => {
    if (googleBusy) return;
    setError(null);
    setInfo(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(turkishAuthError(e));
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <LinearGradient colors={AtlasGradients.onboarding} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Image
              source={require('@/assets/images/atlas/mascot-wave.png')}
              style={styles.mascot}
              contentFit="contain"
            />
            <Text style={styles.title}>Atlas</Text>
            <Text style={styles.sub}>Kaleni kur, konuları fethet.{'\n'}YKS bir sefer — sen komutansın. ⚔️</Text>

            <View style={styles.form}>
              {mode === 'signup' && (
                <>
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
                </>
              )}
              <TextInput
                style={styles.input}
                placeholder="E-posta"
                placeholderTextColor="rgba(255,255,255,0.45)"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="Şifre (en az 6 karakter)"
                placeholderTextColor="rgba(255,255,255,0.45)"
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={submit}
              />

              {error && <Text style={styles.error}>{error}</Text>}
              {info && <Text style={styles.info}>{info}</Text>}

              <Btn3D onPress={submit} disabled={busy}>
                {busy ? '...' : mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
              </Btn3D>

              <Pressable onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}>
                <Text style={styles.switch}>
                  {mode === 'login' ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap'}
                </Text>
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>veya</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                onPress={submitGoogle}
                disabled={googleBusy}
                style={({ pressed }) => [styles.googleBtn, pressed && styles.googleBtnPressed]}>
                <View style={styles.googleG}>
                  <Text style={styles.googleGText}>G</Text>
                </View>
                <Text style={styles.googleText}>
                  {googleBusy ? 'Bağlanıyor…' : 'Google ile devam et'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function turkishAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Invalid login credentials')) return 'E-posta veya şifre hatalı.';
  if (msg.includes('already registered')) return 'Bu e-posta zaten kayıtlı — giriş yapmayı dene.';
  if (msg.includes('at least 6 characters')) return 'Şifre en az 6 karakter olmalı.';
  if (msg.includes('valid email')) return 'Geçerli bir e-posta adresi gir.';
  if (msg.includes('Email not confirmed')) return 'E-postan doğrulanmamış — gelen kutunu kontrol et.';
  if (msg.includes('Network request failed')) return 'Bağlantı sorunu — internetini kontrol et.';
  if (msg.includes('provider is not enabled') || msg.includes('Unsupported provider')) {
    return 'Google ile giriş henüz açılmadı — Supabase Dashboard\'da etkinleştirilmesi gerekiyor.';
  }
  if (msg.includes('profiles_username_lower_idx') || msg.includes('duplicate key value')) {
    return 'Bu kullanıcı adı alınmış — başka bir tane dene.';
  }
  if (msg.includes('profiles_username_format')) {
    return 'Kullanıcı adı sadece küçük harf, rakam ve alt çizgi içerebilir (3-20 karakter).';
  }
  return 'Bir şeyler ters gitti: ' + msg;
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
  mascot: { width: 130, height: 130, alignSelf: 'center' },
  title: {
    color: AtlasColors.white,
    fontSize: 40,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 6,
  },
  sub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
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
  error: {
    color: '#FFB4B4',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  usernameHint: {
    marginTop: -6,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  usernameHintOk: { color: AtlasColors.greenLight },
  usernameHintBad: { color: '#FFB4B4' },
  info: {
    color: AtlasColors.greenLight,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },
  switch: {
    color: AtlasColors.blue,
    fontSize: 13.5,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 10,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12.5,
    fontWeight: '700',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: AtlasColors.white,
    borderRadius: AtlasRadius.button,
    paddingVertical: 14,
  },
  googleBtnPressed: {
    opacity: 0.85,
  },
  googleG: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AtlasColors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleGText: {
    color: AtlasColors.white,
    fontWeight: '900',
    fontSize: 13,
  },
  googleText: {
    color: AtlasColors.inkStrong,
    fontWeight: '700',
    fontSize: 15,
  },
});
