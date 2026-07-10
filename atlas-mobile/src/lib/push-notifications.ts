/**
 * Push token kaydı (BACKEND.md §6.2, §6.4) — haftalık sınav bildirimi
 * `profiles.expo_push_token`a Expo Push API ile gönderiliyor, ama şu ana kadar
 * hiçbir istemci kodu bu token'ı almıyor/yazmıyordu. Bu dosya o eksiği kapatır.
 *
 * Not: Expo Go'da SDK 53'ten beri Android'de, ve genel olarak dev client
 * dışında uzak (remote) push token alınamıyor — bu yüzden hatalar sessizce
 * yutulur (uygulamayı çökertmemeli). Ayrıca `Constants.expoConfig.extra.eas.projectId`
 * henüz yok (proje `eas init` ile bağlanmadı) — o olmadan token isteği başarısız
 * olur, bu da beklenen bir durumdur ve prod derlemesinden önce çözülmeli.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { updateProfile } from './queries';

export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!Device.isDevice) return;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('[push] eas projectId yok — `eas init` çalıştırılmadan gerçek push token alınamaz.');
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    await updateProfile({ expo_push_token: token });
  } catch (e) {
    console.warn('[push] token kaydı başarısız (Expo Go/dev client kısıtı olabilir):', e);
  }
}
