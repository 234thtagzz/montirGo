import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { AppText } from '@/components/ui/text';
import {
  listNotifications,
  markNotificationsRead,
  type ClientNotification,
} from '@/features/client/service';
import { useAppTheme, useThemedStyles, type AppTheme, type SemanticTone } from '@/theme';
import { formatDateTime } from '@/utils/format';

interface NotificationVisual {
  icon: IconName;
  tone: SemanticTone;
}

const VISUALS: Record<string, NotificationVisual> = {
  assignment_requested: { icon: 'person-add-outline', tone: 'warning' },
  assignment_confirmed: { icon: 'checkmark-circle-outline', tone: 'success' },
  assignment_rejected: { icon: 'close-circle-outline', tone: 'danger' },
  assignment_expired: { icon: 'time-outline', tone: 'danger' },
  assignment_cancelled: { icon: 'close-circle-outline', tone: 'danger' },
  quote_submitted: { icon: 'document-text-outline', tone: 'warning' },
  payment: { icon: 'wallet-outline', tone: 'info' },
  review: { icon: 'star-outline', tone: 'warning' },
};

const FALLBACK_VISUAL: NotificationVisual = {
  icon: 'notifications-outline',
  tone: 'info',
};

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

type NotificationListItem =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'item'; key: string; notification: ClientNotification };

export default function NotificationsScreen() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
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
      void load();
    }, [load]),
  );

  const listItems = useMemo<NotificationListItem[]>(() => {
    const out: NotificationListItem[] = [];
    let lastDay = '';
    for (const item of items) {
      const key = dayKey(item.created_at);
      if (key !== lastDay) {
        lastDay = key;
        out.push({ kind: 'header', key: `hdr-${key}`, label: dayLabel(item.created_at) });
      }
      out.push({ kind: 'item', key: item.id, notification: item });
    }
    return out;
  }, [items]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Notifikasi" subtitle="Info terbaru seputar pesananmu" />

      {loading ? (
        <LoadingState message="Memuat notifikasi..." />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              message="Belum ada notifikasi"
              hint="Pemberitahuan tentang pesanan dan montir akan muncul di sini."
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={theme.colors.actionPrimaryAltBg}
              colors={[theme.colors.actionPrimaryAltBg]}
            />
          }
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <AppText variant="overline" tone="muted" style={styles.groupLabel}>
                  {item.label}
                </AppText>
              );
            }
            const notification = item.notification;
            const visual = VISUALS[notification.type] ?? FALLBACK_VISUAL;
            const tonePalette = theme.tones[visual.tone];
            const targetId =
              notification.related_entity_type === 'service_request'
                ? notification.related_entity_id
                : null;
            const actionable = Boolean(targetId);

            return (
              <Pressable
                accessibilityRole={actionable ? 'button' : undefined}
                accessibilityLabel={notification.title}
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
                  !notification.is_read && styles.rowUnread,
                  pressed && actionable && styles.pressed,
                ]}
              >
                <View style={[styles.iconBox, { backgroundColor: tonePalette.bg }]}>
                  <Ionicons name={visual.icon} size={18} color={tonePalette.fg} />
                </View>
                <View style={styles.copy}>
                  <AppText variant="label">{notification.title}</AppText>
                  {notification.body ? (
                    <AppText variant="caption" tone="secondary" numberOfLines={3}>
                      {notification.body}
                    </AppText>
                  ) : null}
                  <AppText variant="caption" tone="muted">
                    {formatDateTime(notification.created_at)}
                  </AppText>
                </View>
                {!notification.is_read ? (
                  <View style={styles.unreadDot} />
                ) : actionable ? (
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                ) : null}
              </Pressable>
            );
          }}
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
  groupLabel: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  rowUnread: {
    backgroundColor: theme.colors.statusInfoBg,
    borderColor: theme.colors.statusInfoBorder,
  },
  pressed: { opacity: 0.78 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: theme.radii.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.actionPrimaryAltBg,
    marginTop: 6,
  },
});
