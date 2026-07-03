import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * Supabase istemcisi — brief §11: PostgreSQL + Auth + Edge Functions.
 * Anahtarlar .env dosyasından gelir (.env.example'a bak); EXPO_PUBLIC_
 * önekli değişkenler istemciye gömülür, service_role anahtarını ASLA koyma.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase yapılandırılmadı: .env dosyasına EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY ekleyin.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Web'de storage verme: supabase-js SSR korumalı localStorage kullanır.
    // AsyncStorage'ın web shim'i window'a import anında dokunup static
    // export'u (SSG, Node ortamı) kırıyor.
    ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
