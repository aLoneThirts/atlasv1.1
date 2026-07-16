/**
 * "Geri dön, soru çöz" hatırlatması — bugün henüz hiç XP kazanılmadıysa (yani
 * hiç quiz/flashcard çözülmediyse) bugün saat 20:00 için TEK bir yerel bildirim
 * planlar. exam-countdown-notification.ts'teki aynı desen: sabit `identifier`
 * ile öncekinin üstüne yazılır, yığılma olmaz. Uygulama her ön plana geçtiğinde
 * (bkz. _layout.tsx) çağrılmalı — hasStudiedToday true ise bildirim iptal edilir
 * (kullanıcı zaten çalıştı, hatırlatmaya gerek yok).
 *
 * Sunucu tarafı eşdeğeri: supabase/functions/streak-reminder (uygulama kapalıyken
 * de ulaşır, ama eas.projectId bağlanana kadar gerçek cihazda push token alınamıyor
 * — bu yerel bildirim o boşluğu şimdilik dolduruyor).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_ID = 'atlas-streak-reminder';

function todayAtTwenty(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0, 0);
}

export async function refreshStreakReminder(hasStudiedToday: boolean): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    /* daha önce hiç planlanmamışsa hata verir, yok sayılır */
  }

  if (hasStudiedToday) return;

  const target = todayAtTwenty();
  if (target.getTime() <= Date.now()) return; // saat 20:00 geçtiyse bugün için kurmaya gerek yok

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: { title: '🔥 Serini Kaybetme!', body: 'Bugün henüz soru çözmedin — gel biraz çalış! 💪' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target },
  });
}
