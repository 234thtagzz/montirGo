import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';
import { useMechanicAlerts } from '@/features/notifications/mechanic-alerts';
import {
  listMyNotifications,
  markAllNotificationsRead,
  type AppNotification,
} from '@/features/notifications/service';
import { formatDateTime } from '@/utils/format';

function iconFor(type: string) {
  if (type === 'new_request') return 'flash-outline' as const;
  if (type === 'payment') return 'cash-outline' as const;
  return 'notifications-outline' as const;
}

export default function MechanicNotificationsScreen() {
  const router = useRouter();
  const { refresh } = useMechanicAlerts();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await listMyNotifications();
      setItems(rows);
      setError(false);
      // Tandai sudah dibaca saat layar dibuka; kegagalan tidak mengganggu tampilan.
      if (rows.some((row) => !row.is_read)) {
        markAllNotificationsRead()
          .then(() => {
            setItems((current) => current.map((row) => ({ ...row, is_read: true })));
            return refresh();
          })
          .catch(() => {});
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openNotification = (item: AppNotification) => {
    if (item.related_entity_type === 'service_request' && item.related_entity_id) {
      router.push({
        pathname: '/(mechanic)/request/[id]',
        params: { id: item.related_entity_id },
      });
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Notifikasi" subtitle="Request baru & info terbaru" />

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
              hint="Saat ada request baru di sekitarmu, pemberitahuannya muncul di sini."
            />
          ) : (
            items.map((item) => {
              const actionable =
                item.related_entity_type === 'service_request' && item.related_entity_id != null;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole={actionable ? 'button' : undefined}
                  disabled={!actionable}
                  onPress={() => openNotification(item)}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <View style={styles.iconBox}>
                    <Ionicons name={iconFor(item.type)} size={18} color={Brand.primary} />
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.title}>{item.title}</Text>
                    {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
                    <Text style={styles.time}>{formatDateTime(item.created_at)}</Text>
                  </View>
                  {!item.is_read ? <View style={styles.unreadDot} /> : null}
                  {actionable ? (
                    <Ionicons name="chevron-forward" size={15} color={Brand.textMuted} />
                  ) : null}
                </Pressable>
              );
            })
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
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.md,
    marginBottom: Space.md,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  pressed: { opacity: 0.8 },
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
  },
});
