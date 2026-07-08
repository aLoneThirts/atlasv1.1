import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { AtlasColors, AtlasFonts } from '@/constants/atlas-theme';
import { getHearts } from '@/lib/queries';

export function formatCountdown(ms: number) {
  const totalMin = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} sa ${m} dk` : `${m} dk`;
}

/**
 * quiz.tsx ve quiz-haftalik.tsx'teki ortak "Canın Bitti" ekranı. Can 8 saatte
 * 1 kendiliğinden yenilenir (BACKEND.md §4.1, `get_hearts()`) — burada canlı
 * geri sayım gösterilir; can yenilenince ya da satın alınınca (odaktan dönünce
 * de kontrol edilir) `onHeartsAvailable` çağrılır ve quiz kaldığı yerden devam eder.
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
  const [nextHeartAt, setNextHeartAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const resumed = useRef(false);
  const onAvailableRef = useRef(onHeartsAvailable);
  useEffect(() => {
    onAvailableRef.current = onHeartsAvailable;
  });

  const check = useCallback(() => {
    getHearts()
      .then((h) => {
        if (h.hearts > 0 && !resumed.current) {
          resumed.current = true;
          onAvailableRef.current(h.hearts);
        } else {
          setNextHeartAt(h.next_heart_at);
        }
      })
      .catch(() => {});
  }, []);

  // /odeme'den (satın alma) dönüşte ekran odağa gelince tekrar kontrol et
  useFocusEffect(
    useCallback(() => {
      check();
    }, [check]),
  );

  // Ekranda beklerken de 8 saatlik yenilenmeyi yakalamak için periyodik kontrol
  useEffect(() => {
    const poll = setInterval(check, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [check]);

  const remainingMs = nextHeartAt ? new Date(nextHeartAt).getTime() - now : null;

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.content}>
        <Image source={require('@/assets/images/atlas/mascot-sad.png')} style={styles.mascot} contentFit="contain" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{message}</Text>
        {remainingMs !== null && remainingMs > 0 && (
          <Text style={styles.countdown}>❤️ Sıradaki can: {formatCountdown(remainingMs)}</Text>
        )}
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
  body: { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  countdown: {
    color: AtlasColors.yellow,
    fontFamily: AtlasFonts.bodyBold,
    fontSize: 13.5,
    marginTop: 2,
    marginBottom: 4,
  },
  btnStack: { gap: 10, width: '100%', marginTop: 12 },
});
