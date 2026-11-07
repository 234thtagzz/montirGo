import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Type } from '@/constants/brand';
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

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Hari ini';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface DayGroup {
  key: string;
  label: string;
  items: ClientNotification[];
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

  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    for (const item of items) {
      const key = dayKey(item.created_at);
      const existing = map.get(key);
      if (existing) existing.items.push(item);
      else map.set(key, { key, label: dayLabel(item.created_at), items: [item] });
    }
    return Array.from(map.values());
  }, [items]);

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
            groups.map((group) => (
              <View key={group.key} style={styles.group}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                <View style={styles.inbox}>
                  {group.items.map((item, index) => {
                    const visual = getVisual(item.type);
                    const targetId =
                      item.related_entity_type === 'service_request'
                        ? item.related_entity_id
                        : null;
                    const actionable = Boolean(targetId);
                    return (
                      <Pressable
                        key={item.id}
                        accessibilityRole={actionable ? 'button' : undefined}
                        accessibilityLabel={item.title}
                        disabled={!actionable}
                        onPress={() => {
                          if (!targetId) return;
                          router.push({
                            pathname: '/(client)/orders/[id]',
                            params: { id: targetId },
                          });
                        }}
                        style={({ pressed }) => [
                          styles.row,
                          index > 0 && styles.rowBorder,
                          !item.is_read && styles.rowUnread,
                          pressed && actionable && styles.pressed,
                        ]}
                      >
                        <View style={[styles.iconBox, { backgroundColor: visual.background }]}>
                          <Ionicons name={visual.icon} size={17} color={visual.color} />
                        </View>
                        <View style={styles.copy}>
                          <Text style={styles.title}>{item.title}</Text>
                          {item.body ? (
                            <Text style={styles.body} numberOfLines={3}>
                              {item.body}
                            </Text>
                          ) : null}
                          <Text style={styles.time}>{formatDateTime(item.created_at)}</Text>
                        </View>
                        {!item.is_read ? (
                          <View style={styles.unreadDot} />
                        ) : actionable ? (
                          <Ionicons name="chevron-forward" size={15} color={Brand.textMuted} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
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
  group: { marginBottom: Space.xl },
  groupLabel: { ...Type.micro, color: Brand.textMuted, marginBottom: Space.sm },
  inbox: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
    padding: Space.md,
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.divider },
  rowUnread: { backgroundColor: Brand.primarySoft },
  pressed: { opacity: 0.75 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: { ...Type.bodyStrong, color: Brand.text, fontWeight: '700' },
  body: { ...Type.meta, color: Brand.textSecondary, marginTop: 2, lineHeight: 17 },
  time: { ...Type.meta, color: Brand.textMuted, marginTop: 6, fontSize: 10 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.primary,
    marginTop: 6,
  },
});
