import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/** Google ile giriş — web'de Supabase'in kendi redirect'i, native'de tarayıcı oturumu + manuel token exchange. */
export async function signInWithGoogle() {
  const redirectTo = Platform.OS === 'web' ? window.location.origin : Linking.createURL('auth-callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });

  if (error) throw error;

  // Web: signInWithOAuth zaten tarayıcıyı yönlendirdi, detectSessionInUrl geri dönüşü işleyecek.
  if (Platform.OS === 'web') return;

  if (!data?.url) throw new Error('Google giriş bağlantısı alınamadı.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    if (result.type === 'cancel' || result.type === 'dismiss') return;
    throw new Error('Google girişi tamamlanamadı.');
  }

  const params = new URLSearchParams(result.url.split('#')[1] ?? result.url.split('?')[1] ?? '');
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (!access_token || !refresh_token) {
    throw new Error('Google girişinden oturum bilgisi alınamadı.');
  }

  const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
  if (sessionError) throw sessionError;
}
