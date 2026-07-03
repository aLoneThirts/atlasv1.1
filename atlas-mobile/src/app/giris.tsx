import { Image } from 'expo-image';
import { useState } from 'react';
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

import { Btn3d } from '@/components/btn-3d';
import { AtlasColors, AtlasRadius } from '@/constants/atlas-theme';
import { supabase } from '@/lib/supabase';

/**
 * EKRAN 01 — Giriş / Kayıt
 * Oturum açılınca root layout'taki Stack.Protected otomatik olarak
 * sekmelere geçirir; yönlendirme koduna gerek yok.
 */
export default function GirisScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setInfo(null);
    const mail = email.trim().toLowerCase();
    if (!mail || !password) {
      setError('E-posta ve şifreni gir.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email: mail, password });
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

  return (
    <View style={styles.container}>
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

              <Btn3d
                label={busy ? '...' : mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
                onPress={submit}
                disabled={busy}
              />

              <Pressable onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}>
                <Text style={styles.switch}>
                  {mode === 'login' ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
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
  return 'Bir şeyler ters gitti: ' + msg;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#203A43' },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 30 },
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
});
