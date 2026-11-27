import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useMechanicAlerts } from '@/features/notifications/mechanic-alerts';
import {
  listMyNotifications,
  markAllNotificationsRead,
  type AppNotification,
} from '@/features/notifications/service';
import { useAppTheme, useThemedStyles, type AppTheme, type SemanticTone } from '@/theme';
import { formatDateTime } from '@/utils/format';

interface NotificationMeta {
  icon: IconName;
  tone: SemanticTone;
}

function metaFor(type: string): NotificationMeta {
  if (type === 'new_request') {
    return { icon: 'flash-outline', tone: 'info' };
  }
  if (type === 'payment' || type === 'assignment_confirmed' || type === 'quote_approved') {
    return { icon: 'checkmark-circle-outline', tone: 'success' };
  }
  if (
    type === 'assignment_requested' ||
    type === 'assignment_expired' ||
    type === 'quote_submitted' ||
    type === 'quote_revision_requested' ||
    type === 'quote_addon_requested'
  ) {
    return { icon: 'time-outline', tone: 'warning' };
  }
  if (type === 'assignment_rejected' || type === 'assignment_cancelled') {
    return { icon: 'close-circle-outline', tone: 'danger' };
  }
  if (type === 'quote_callout_only' || type === 'quote_withdrawn') {
    return { icon: 'receipt-outline', tone: 'neutral' };
  }
  return { icon: 'notifications-outline', tone: 'neutral' };
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
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface DayGroup {
  key: string;
  label: string;
  items: AppNotification[];
}

export default function MechanicNotificationsScreen() {
  const router = useRouter();
  const { refresh } = useMechanicAlerts();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await listMyNotifications();
      setItems(rows);
      setError(false);
      if (rows.some((row) => !row.is_read)) {
        markAllNotificationsRead()
          .then(() => {
            setItems((current) =>
              current.map((row) => ({ ...row, is_read: true })),
            );
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
      void load();
    }, [load]),
  );

  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    for (const item of items) {
      const key = dayKey(item.created_at);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(key, { key, label: dayLabel(item.created_at), items: [item] });
      }
    }
    return Array.from(map.values());
  }, [items]);

  const openNotification = (item: AppNotification) => {
    if (item.related_entity_type === 'service_request' && item.related_entity_id) {
      if (item.type === 'new_request') {
        router.push({
          pathname: '/(mechanic)/request/[id]',
          params: { id: item.related_entity_id },
        });
        return;
      }
      router.push({
        pathname: '/(mechanic)/active-order/[id]',
        params: { id: item.related_entity_id },
      });
    }
  };

  const emptyContent = error ? (
    <ErrorState onRetry={() => void load()} />
  ) : (
    <EmptyState
      icon="notifications-outline"
      message="Belum ada notifikasi"
      hint="Saat ada request baru atau pembaruan estimasi, pemberitahuannya muncul di sini."
    />
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Notifikasi"
        subtitle="Request baru & info terbaru"
      />

      {loading ? (
        <LoadingState message="Memuat notifikasi..." />
      ) : (
        <FlatList
          data={error ? [] : groups}
          keyExtractor={(group) => group.key}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={emptyContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={theme.colors.actionPrimaryBg}
              colors={[theme.colors.actionPrimaryBg]}
            />
          }
          renderItem={({ item: group }) => (
            <View style={styles.group}>
              <AppText variant="overline" tone="muted" style={styles.groupLabel}>
                {group.label}
              </AppText>
              <Surface variant="default" padding="none" style={styles.inbox}>
                {group.items.map((item, index) => {
                  const meta = metaFor(item.type);
                  const palette = theme.tones[meta.tone];
                  const actionable =
                    item.related_entity_type === 'service_request' &&
                    item.related_entity_id != null;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole={actionable ? 'button' : undefined}
                      disabled={!actionable}
                      onPress={() => openNotification(item)}
                      style={({ pressed }) => [
                        styles.row,
                        index > 0 && styles.rowBorder,
                        !item.is_read && styles.rowUnread,
                        pressed && actionable && styles.pressed,
                      ]}
                    >
                      <View
                        style={[styles.iconBox, { backgroundColor: palette.bg }]}
                      >
                        <Ionicons
                          name={meta.icon}
                          size={18}
                          color={palette.fg}
                        />
                      </View>
                      <View style={styles.copy}>
                        <AppText variant="bodyStrong">{item.title}</AppText>
                        {item.body ? (
                          <AppText
                            variant="caption"
                            tone="secondary"
                            numberOfLines={3}
                          >
                            {item.body}
                          </AppText>
                        ) : null}
                        <AppText variant="caption" tone="muted">
                          {formatDateTime(item.created_at)}
                        </AppText>
                      </View>
                      {!item.is_read ? (
                        <View style={styles.unreadDot} />
                      ) : actionable ? (
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={theme.colors.textMuted}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </Surface>
            </View>
          )}
        />
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  content: {
    padding: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.xxxl,
  },
  group: {
    marginBottom: theme.spacing.lg,
  },
  groupLabel: {
    marginBottom: theme.spacing.sm,
  },
  inbox: {
    overflow: 'hidden' as const,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  rowUnread: {
    backgroundColor: theme.colors.statusInfoBg,
  },
  pressed: {
    opacity: 0.78,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: theme.radii.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.actionPrimaryBg,
    marginTop: 6,
  },
});
