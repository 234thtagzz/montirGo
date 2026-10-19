import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';
import {
  listNotifications,
  markNotificationsRead,
  type ClientNotification,
} from '@/features/client/service';
import { formatDateTime } from '@/utils/format';

export default function NotificationsScreen() {
  const [items, setItems] = useState<ClientNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await listNotifications();
      setItems(rows);
      setError(false);
      // Sudah dibaca saat layar dibuka; kegagalan penandaan tidak mengganggu tampilan.
      if (rows.some((row) => !row.is_read)) {
        markNotificationsRead().catch(() => {});
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Notifikasi" subtitle="Info terbaru seputar pesananmu" />

      {loading ? (
        <LoadingState message="Memuat notifikasi..." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={Brand.primary}
              colors={[Brand.primary]}
            />
          }
        >
          {error ? (
            <ErrorState onRetry={load} />
          ) : items.length === 0 ? (
            <EmptyState
              icon="notifications-outline"
              message="Belum ada notifikasi"
              hint="Pemberitahuan tentang pesanan dan montir akan muncul di sini."
            />
          ) : (
            items.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.iconBox}>
                  <Ionicons name="notifications-outline" size={18} color={Brand.primary} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.title}>{item.title}</Text>
                  {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
                  <Text style={styles.time}>{formatDateTime(item.created_at)}</Text>
                </View>
                {!item.is_read ? <View style={styles.unreadDot} /> : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  card: {
    flexDirection: 'row',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.md,
    marginBottom: Space.md,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: { fontSize: 13.5, fontWeight: '700', color: Brand.text },
  body: { fontSize: 12, color: Brand.textSecondary, marginTop: 2, lineHeight: 17 },
  time: { fontSize: 10.5, color: Brand.textMuted, marginTop: 6 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.primary,
    marginTop: 6,
  },
});
