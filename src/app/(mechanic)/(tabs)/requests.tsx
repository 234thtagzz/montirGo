import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { OrderCard } from '@/features/mechanic/components/order-card';
import {
  acceptOrder,
  ACTIVE_ORDER_MESSAGE,
  getMyActiveOrderId,
  listIncomingOrders,
  type IncomingOrder,
} from '@/features/mechanic/service';
import { MechanicNotificationBell } from '@/features/notifications/components/notification-bell';
import { formatVehicleLabel } from '@/features/vehicles/constants';
import { useRefreshOnForeground } from '@/hooks/use-foreground';
import { useSessionUser } from '@/hooks/use-session-user';
import { createRealtimeChannel, subscribeWithResync } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

const NEW_REQUEST_BADGE = {
  label: 'Request baru',
  tone: 'warning' as const,
  icon: 'flash-outline' as const,
};

export default function MechanicRequestsScreen() {
  const { user } = useSessionUser();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const router = useRouter();

  const [orders, setOrders] = useState<IncomingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rows, activeId] = await Promise.all([
        listIncomingOrders(),
        getMyActiveOrderId().catch(() => null),
      ]);
      setOrders(rows);
      setActiveOrderId(activeId);
      setError(false);
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

  useRefreshOnForeground(() => {
    void load();
  });

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void load();
      }, 350);
    };

    const ch = createRealtimeChannel(`mechanic-incoming-${userId}`).on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      scheduleReload,
    );
    subscribeWithResync(ch, () => void load());
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [userId, load]);

  const handleAccept = async (id: string) => {
    if (activeOrderId) {
      showToast({
        tone: 'warning',
        title: 'Masih ada order aktif',
        message: ACTIVE_ORDER_MESSAGE,
        actionLabel: 'Buka Order',
        onAction: () => router.push(`/(mechanic)/active-order/${activeOrderId}`),
      });
      return;
    }

    setAcceptingId(id);
    try {
      await acceptOrder(id);
      setOrders((current) => current.filter((order) => order.id !== id));
      showToast({
        tone: 'success',
        title: 'Pengajuan terkirim',
        message: 'Menunggu konfirmasi client dalam 5 menit.',
      });
      router.replace({
        pathname: '/(mechanic)/active-order/[id]',
        params: { id },
      });
      void load();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Order mungkin sudah diambil montir lain.';
      showToast({
        tone: 'danger',
        title: 'Gagal mengajukan diri',
        message,
      });
      if (/diambil montir lain|tidak tersedia/i.test(message)) {
        setOrders((current) => current.filter((order) => order.id !== id));
      }
      void load();
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Request Masuk" showBack={false} />
        <LoadingState message="Mencari request masuk..." />
      </View>
    );
  }

  const headerContent = (
    <View style={styles.headerStack}>
      <Surface variant="default" padding="md" style={styles.liveStrip}>
        <View style={styles.liveLeft}>
          <View style={styles.liveDot} />
          <AppText variant="caption" tone="secondary">
            Memantau request baru secara realtime
          </AppText>
        </View>
        <Ionicons name="radio-outline" size={16} color={theme.colors.textMuted} />
      </Surface>

      {activeOrderId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka order aktif yang sedang berjalan"
          onPress={() => router.push(`/(mechanic)/active-order/${activeOrderId}`)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Surface variant="outlined" padding="md" style={styles.lockCard}>
            <View style={styles.lockIcon}>
              <Ionicons
                name="lock-closed"
                size={16}
                color={theme.colors.statusWarningFg}
              />
            </View>
            <View style={styles.lockCopy}>
              <AppText variant="label">Selesaikan order aktif dulu</AppText>
              <AppText variant="caption" tone="secondary">
                Satu montir hanya memegang satu order. Order #
                {activeOrderId.slice(0, 8).toUpperCase()} masih berjalan.
              </AppText>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.colors.statusWarningFg}
            />
          </Surface>
        </Pressable>
      ) : null}

      {!error && orders.length > 0 ? (
        <View style={styles.listHeader}>
          <AppText variant="overline" tone="muted">
            TERBUKA
          </AppText>
          <View style={styles.countPill}>
            <AppText
              variant="overline"
              tabular
              style={{ color: theme.colors.statusInfoFg }}
            >
              {orders.length}
            </AppText>
          </View>
        </View>
      ) : null}
    </View>
  );

  const emptyContent = error ? (
    <ErrorState onRetry={() => void load()} />
  ) : (
    <EmptyState
      icon="flash-outline"
      message="Belum ada request masuk"
      hint="Request darurat client di sekitarmu akan muncul di sini secara realtime."
      actionLabel="Buka Beranda"
      onPressAction={() => router.push('/(mechanic)/(tabs)')}
    />
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Request Masuk"
        subtitle={
          orders.length > 0
            ? `${orders.length} request terbuka di sekitarmu`
            : 'Permintaan client di sekitarmu'
        }
        showBack={false}
        right={<MechanicNotificationBell />}
      />

      <FlatList
        data={error ? [] : orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={headerContent}
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
        renderItem={({ item }) => (
          <OrderCard
            issue={item.issue_description}
            status={item.status}
            createdAt={item.created_at}
            vehicle={formatVehicleLabel(
              item.vehicle_type,
              item.vehicle_brand,
              item.vehicle_model,
            )}
            clientName={item.client_name}
            address={
              [
                item.address_area,
                item.distance_km != null ? `± ${item.distance_km.toFixed(1)} km` : null,
              ]
                .filter(Boolean)
                .join(' · ') || null
            }
            aiRisk={item.ai_risk_level}
            badge={NEW_REQUEST_BADGE}
            onPress={() =>
              router.push({
                pathname: '/(mechanic)/request/[id]',
                params: { id: item.id },
              })
            }
            action={{
              label: activeOrderId
                ? 'Selesaikan Order Dulu'
                : acceptingId === item.id
                  ? 'Mengajukan...'
                  : 'Ajukan Diri',
              icon: 'paper-plane-outline',
              variant: 'primary',
              loading: acceptingId === item.id,
              disabled: activeOrderId != null,
              onPress: () => void handleAccept(item.id),
            }}
          />
        )}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  content: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.xxxl,
  },
  headerStack: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  liveStrip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  liveLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.statusSuccessFg,
  },
  lockCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.statusWarningBg,
    borderColor: theme.colors.statusWarningBorder,
  },
  lockIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  lockCopy: {
    flex: 1,
    gap: 2,
  },
  listHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.xs,
  },
  pressed: {
    opacity: 0.85,
  },
});
