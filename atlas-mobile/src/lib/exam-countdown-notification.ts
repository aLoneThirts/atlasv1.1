/**
 * Sınav geri sayımı — kilit ekranı/bildirim alanı görünürlüğü (2026-07-10 kararı:
 * gerçek native widget yerine, bugün Expo Go'da da çalışabilen günlük yerel
 * bildirim). `profiles.exam_date` her değiştiğinde ve uygulama her ön plana
 * geçtiğinde (bkz. _layout.tsx) çağrılmalı — güncel gün sayısıyla YARINKI
 * 08:00 için TEK bir bildirim planlar (aynı `identifier` ile öncekinin üstüne
 * yazar, yığılma olmaz). Bu bir tekrarlayan (repeating) bildirim DEĞİL: içerik
 * her gün değiştiği için (kalan gün sayısı), sabit metinli bir repeating
 * trigger kullanılamıyor — bu yüzden tazeliği uygulamanın en az günde bir
 * açılmasına bağlı (bu tarz bir alışkanlık uygulamasında makul bir varsayım).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_ID = 'atlas-exam-countdown';

/** Bugünden (gün başlangıcı) sınav tarihine kalan gün sayısı — Ev ekranı geri sayım rozeti de bunu kullanır. */
export function daysUntil(examDateIso: string): number {
  const examDate = new Date(examDateIso);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return Math.ceil((examDate.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));
}

function nextEightAm(): Date {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

export async function refreshExamCountdownNotification(examDateIso: string | null): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    /* daha önce hiç planlanmamışsa hata verir, yok sayılır */
  }

  if (!examDateIso) return;
  const days = daysUntil(examDateIso);
  if (days <= 0) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: { title: '📅 Atlas', body: `Sınavına ${days} gün kaldı ⏰` },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextEightAm() },
  });
}
