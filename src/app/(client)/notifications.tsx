import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';
import {
  listNotifications,
  markNotificationsRead,
  type ClientNotification,
} from '@/features/client/service';
import { formatDateTime } from '@/utils/format';

interface NotificationVisual {
  icon: IconName;
  color: string;
  background: string;
}

const VISUALS: Record<string, NotificationVisual> = {
  assignment_requested: {
    icon: 'person-add-outline',
    color: Brand.amber,
    background: Brand.amberSoft,
  },
  assignment_confirmed: {
    icon: 'checkmark-circle-outline',
    color: Brand.green,
    background: Brand.greenSoft,
  },
  assignment_rejected: {
    icon: 'close-circle-outline',
    color: Brand.red,
    background: Brand.redSoft,
  },
  assignment_expired: {
    icon: 'time-outline',
    color: Brand.red,
    background: Brand.redSoft,
  },
  assignment_cancelled: {
    icon: 'close-circle-outline',
    color: Brand.red,
    background: Brand.redSoft,
  },
  payment: {
    icon: 'wallet-outline',
    color: Brand.primary,
    background: Brand.primarySoft,
  },
  review: {
    icon: 'star-outline',
    color: Brand.amber,
    background: Brand.amberSoft,
  },
};

const FALLBACK_VISUAL: NotificationVisual = {
  icon: 'notifications-outline',
  color: Brand.primary,
  background: Brand.primarySoft,
};

function getVisual(type: string): NotificationVisual {
  return VISUALS[type] ?? FALLBACK_VISUAL;
}

export default function NotificationsScreen() {
  const router = useRouter();
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
            items.map((item) => {
              const visual = getVisual(item.type);
              const targetId =
                item.related_entity_type === 'service_request' ? item.related_entity_id : null;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  disabled={!targetId}
                  onPress={() => {
                    if (!targetId) return;
                    router.push({
                      pathname: '/(client)/orders/[id]',
                      params: { id: targetId },
                    });
                  }}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <View style={[styles.iconBox, { backgroundColor: visual.background }]}>
                    <Ionicons name={visual.icon} size={18} color={visual.color} />
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.title}>{item.title}</Text>
                    {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
                    <Text style={styles.time}>{formatDateTime(item.created_at)}</Text>
                  </View>
                  {!item.is_read ? <View style={styles.unreadDot} /> : null}
                  {targetId ? (
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
  pressed: { opacity: 0.8 },
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
