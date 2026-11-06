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
import { formatDayLabel, formatTime } from '@/utils/format';

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
    items.forEach((item) => {
      const label = formatDayLabel(item.created_at);
      const existing = map.get(label);
      if (existing) existing.items.push(item);
      else map.set(label, { key: label, label, items: [item] });
    });
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
          ) : groups.length === 0 ? (
            <EmptyState
              icon="notifications-outline"
              message="Belum ada notifikasi"
              hint="Pemberitahuan tentang pesanan dan montir akan muncul di sini."
            />
          ) : (
            groups.map((group) => (
              <View key={group.key} style={styles.group}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                <View style={styles.groupCard}>
                  {group.items.map((item, index) => {
                    const visual = getVisual(item.type);
                    const targetId =
                      item.related_entity_type === 'service_request'
                        ? item.related_entity_id
                        : null;
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
                        style={({ pressed }) => [
                          styles.row,
                          index === group.items.length - 1 && styles.rowLast,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={[styles.iconBox, { backgroundColor: visual.background }]}>
                          <Ionicons name={visual.icon} size={17} color={visual.color} />
                        </View>
                        <View style={styles.copy}>
                          <View style={styles.titleRow}>
                            <Text style={styles.title} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text style={styles.time}>{formatTime(item.created_at)}</Text>
                          </View>
                          {item.body ? (
                            <Text style={styles.body} numberOfLines={2}>
                              {item.body}
                            </Text>
                          ) : null}
                        </View>
                        {!item.is_read ? <View style={styles.unreadDot} /> : null}
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
  content: { paddingHorizontal: ScreenPadding, paddingBottom: Space.xxxl },
  group: { marginTop: Space.lg },
  groupLabel: {
    ...Type.micro,
    color: Brand.textMuted,
    marginBottom: Space.sm,
    textTransform: 'uppercase',
  },
  groupCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
    padding: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  pressed: { opacity: 0.75 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, ...Type.label, fontSize: 13, fontWeight: '700', color: Brand.text },
  time: { fontSize: 10, color: Brand.textMuted },
  body: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 3, lineHeight: 16 },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Brand.primary,
    marginTop: 5,
  },
});
