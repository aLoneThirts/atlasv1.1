import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AtlasColors, AtlasFonts, AtlasRadius, AtlasSurface } from '@/constants/atlas-theme';
import { safeGoBack } from '@/lib/navigation';
import { fetchNotifications, markNotificationsRead } from '@/lib/queries';
import { useThemeMode } from '@/lib/theme-context';
import type { NotificationItem } from '@/lib/types';

function relativeTr(iso: string): string {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (diffMin < 1) return 'az önce';
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} sa önce`;
  return `${Math.round(diffHour / 24)} gün önce`;
}

/**
 * EKRAN — Bildirimler gelen kutusu (bkz. supabase/notifications.sql).
 * Açılınca sunucudaki okunmamışlar işaretlenir; hangi satırların YÜKLENIRKEN
 * okunmamış olduğu `unreadIds` state'inde dondurulur — ekran açıkken hâlâ
 * vurgulu kalsınlar diye (aksi halde işaretleme anında vurgu aniden kaybolurdu).
 */
export default function BildirimlerScreen() {
  const router = useRouter();
  const { mode } = useThemeMode();
  const surface = AtlasSurface[mode];

  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      const list = await fetchNotifications();
      const unread = new Set(list.filter((n) => !n.readAt).map((n) => n.id));
      setUnreadIds(unread);
      setItems(list);
      if (unread.size > 0) markNotificationsRead().catch(() => {});
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: surface.bg }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => safeGoBack(router)} hitSlop={10}>
            <Text style={[styles.back, { color: surface.text }]}>‹ Geri</Text>
          </Pressable>
          <Text style={[styles.title, { color: surface.text }]}>Bildirimler</Text>
          <View style={styles.backSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {items !== null &&
            (items.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🔔</Text>
                <Text style={[styles.emptyTitle, { color: surface.text }]}>Henüz bildirimin yok</Text>
              </View>
            ) : (
              items.map((item) => {
                const unread = unreadIds.has(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => item.route && router.push(item.route as never)}
                    style={[
                      styles.row,
                      { backgroundColor: surface.card, borderColor: surface.cardBorder },
                      unread && styles.rowUnread,
                    ]}>
                    {unread && <View style={styles.unreadDot} />}
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: surface.text }]}>{item.title}</Text>
                      <Text style={[styles.rowBody, { color: surface.textSecondary }]}>{item.body}</Text>
                      <Text style={[styles.rowTime, { color: surface.textSecondary }]}>
                        {relativeTr(item.createdAt)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  back: { fontSize: 15, fontFamily: AtlasFonts.bodyBold },
  title: { fontSize: 17, fontFamily: AtlasFonts.heading },
  backSpacer: { width: 40 },
  scroll: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 30, gap: 10 },
  row: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: AtlasRadius.card,
    padding: 14,
  },
  rowUnread: { borderColor: AtlasColors.blue },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: AtlasColors.blue, marginTop: 6 },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14.5, fontFamily: AtlasFonts.heading },
  rowBody: { fontSize: 13, fontFamily: AtlasFonts.body, lineHeight: 19 },
  rowTime: { fontSize: 11, fontFamily: AtlasFonts.bodySemi, marginTop: 2 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 6 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 16, fontFamily: AtlasFonts.heading },
});
