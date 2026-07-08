import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { Nunito_800ExtraBold, Nunito_900Black } from '@expo-google-fonts/nunito';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import '@/global.css';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ThemeModeProvider } from '@/lib/theme-context';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, initializing, onboardingCompleted } = useAuth();

  // İlk oturum okuması bitene kadar, oturum varsa da profilin onboarding
  // durumu gelene kadar native splash ekranda kalır (yanlış ekrana sıçramasın)
  if (initializing) return null;
  if (session && onboardingCompleted === null) return null;

  return (
    <>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session && onboardingCompleted === true}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="ayarlar" />
          <Stack.Screen name="premium" />
          <Stack.Screen name="reklamsiz" />
          <Stack.Screen name="tercih" />
          <Stack.Screen name="odeme" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session && onboardingCompleted === false}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="giris" />
        </Stack.Protected>
        <Stack.Screen name="auth-callback" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Nunito_800ExtraBold,
    Nunito_900Black,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ThemeModeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeModeProvider>
    </ThemeProvider>
  );
}
