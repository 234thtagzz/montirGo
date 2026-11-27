import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createRealtimeChannel, subscribeWithResync } from '@/lib/realtime';
import { readSession } from '@/lib/auth-session';
import { useForegroundEpoch } from '@/hooks/use-foreground';
import { supabase } from '@/lib/supabase';
import { prepareNotifications, presentLocalAlert } from './local';
import { registerPushToken } from './push';
import { getUnreadNotificationCount } from './service';

interface MechanicAlertsValue {
  /** Jumlah notifikasi yang belum dibaca. */
  unread: number;
  /** Muat ulang jumlah notifikasi belum dibaca. */
  refresh: () => Promise<void>;
}

const MechanicAlertsContext = createContext<MechanicAlertsValue>({
  unread: 0,
  refresh: async () => {},
});

export function useMechanicAlerts(): MechanicAlertsValue {
  return useContext(MechanicAlertsContext);
}

interface RawNotificationRow {
  title?: string | null;
  body?: string | null;
  type?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
}

/**
 * Menyiapkan notifikasi HP + menghitung notifikasi in-app untuk montir.
 *
 * Notifikasi lokal dipicu oleh INSERT pada tabel `notifications` milik user
 * yang sedang login (lihat migration new_request_notifications). Dengan begitu
 * satu sumber data melayani daftar in-app sekaligus banner di notification
 * shade HP.
 */
export function MechanicAlertsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const foregroundEpoch = useForegroundEpoch();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setUnread(await getUnreadNotificationCount());
    } catch {
      // Hitungan bersifat pelengkap; biarkan nilai terakhir bila gagal.
    }
  }, []);

  // Izin notifikasi + aksi saat notifikasi HP diketuk.
  useEffect(() => {
    void prepareNotifications();

    const openFromResponse = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as
        | {
            requestId?: unknown;
            audience?: unknown;
            type?: unknown;
            relatedEntityType?: unknown;
            relatedEntityId?: unknown;
          }
        | undefined;
      if (!data || data.audience === 'client') return;
      const requestId =
        typeof data.requestId === 'string'
          ? data.requestId
          : data.relatedEntityType === 'service_request' && typeof data.relatedEntityId === 'string'
            ? data.relatedEntityId
            : null;
      if (!requestId) return;
      const isOpenRequest =
        typeof data.type !== 'string' || data.type === 'new_request';
      router.push(
        isOpenRequest
          ? {
              pathname: '/(mechanic)/request/[id]',
              params: { id: requestId },
            }
          : {
              pathname: '/(mechanic)/active-order/[id]',
              params: { id: requestId },
            },
      );
      // Hindari navigasi ulang bila respons yang sama dibaca lagi.
      Notifications.clearLastNotificationResponse();
    };

    // Aplikasi dibuka dari notifikasi (cold start).
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openFromResponse(response);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    return () => subscription.remove();
  }, [router]);

  // Jumlah belum dibaca + realtime notifikasi baru.
  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const session = await readSession().catch(() => null);
      const user = session?.user;
      if (!active || !user) return;

      void registerPushToken();
      void refresh();

      channel = createRealtimeChannel(`mechanic-notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (!active) return;
            const row = payload.new as RawNotificationRow;
            void refresh();
            void presentLocalAlert({
              title: row.title ?? 'Notifikasi baru',
              body: row.body ?? null,
              audience: 'mechanic',
              type: row.type ?? null,
              requestId:
                row.related_entity_type === 'service_request'
                  ? (row.related_entity_id ?? null)
                  : null,
            });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            if (active) void refresh();
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            if (active) void refresh();
          },
        );
      subscribeWithResync(channel, () => {
        if (active) void refresh();
      });
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
    // `foregroundEpoch` membuat langganan dipasang ulang setelah app kembali aktif.
  }, [refresh, foregroundEpoch]);

  const value = useMemo(() => ({ unread, refresh }), [unread, refresh]);

  return (
    <MechanicAlertsContext.Provider value={value}>{children}</MechanicAlertsContext.Provider>
  );
}
