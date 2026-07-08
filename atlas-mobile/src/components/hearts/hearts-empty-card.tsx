import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { AtlasColors, AtlasFonts } from '@/constants/atlas-theme';
import { fetchProfile } from '@/lib/queries';

/**
 * quiz.tsx ve quiz-haftalik.tsx'teki ortak "Canın Bitti" ekranı. Can
 * KENDİLİĞİNDEN YENİLENMEZ (BACKEND.md §4.1, karar kesin) — yalnız satın
 * alınca dolar. /odeme modalından (can satın alma) dönüldüğünde ekran
 * odağa gelince canı tekrar kontrol eder; satın alma başarılıysa
 * `onHeartsAvailable` çağrılır ve quiz kaldığı yerden devam eder.
 */
export function HeartsEmptyCard({
  title,
  message,
  onHeartsAvailable,
  children,
}: {
  title: string;
  message: string;
  onHeartsAvailable: (hearts: number) => void;
  children?: ReactNode;
}) {
  const router = useRouter();
  const resumed = useRef(false);
  const onAvailableRef = useRef(onHeartsAvailable);
  useEffect(() => {
    onAvailableRef.current = onHeartsAvailable;
  });

  useFocusEffect(
    useCallback(() => {
      fetchProfile()
        .then((p) => {
          if (p.hearts > 0 && !resumed.current) {
            resumed.current = true;
            onAvailableRef.current(p.hearts);
          }
        })
        .catch(() => {});
    }, []),
  );

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.content}>
        <Image source={require('@/assets/images/atlas/mascot-sad.png')} style={styles.mascot} contentFit="contain" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{message}</Text>
        <View style={styles.btnStack}>
          <Btn3D
            variant="yellow"
            onPress={() => router.push({ pathname: '/odeme', params: { product: 'hearts_refill' } } as never)}>
            ❤️ Can Satın Al
          </Btn3D>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#1A0000' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 10 },
  mascot: { width: 130, height: 130, marginBottom: 6 },
  title: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 26 },
  body: { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 10 },
  btnStack: { gap: 10, width: '100%', marginTop: 12 },
});
