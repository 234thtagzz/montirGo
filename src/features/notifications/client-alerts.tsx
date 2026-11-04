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
import { createRealtimeChannel } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { prepareNotifications, presentLocalAlert } from './local';
import { getUnreadNotificationCount } from './service';

interface ClientAlertsValue {
  /** Jumlah notifikasi yang belum dibaca. */
  unread: number;
  /** Muat ulang jumlah notifikasi belum dibaca. */
  refresh: () => Promise<void>;
}

const ClientAlertsContext = createContext<ClientAlertsValue>({
  unread: 0,
  refresh: async () => {},
});

export function useClientAlerts(): ClientAlertsValue {
  return useContext(ClientAlertsContext);
}

interface RawNotificationRow {
  title?: string | null;
  body?: string | null;
  type?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
}

/**
 * Menyiapkan notifikasi HP + menghitung notifikasi in-app untuk client.
 *
 * Pengajuan montir (`mechanic_assigned`) harus dikonfirmasi client dalam 5
 * menit. Provider ini menampilkan banner lokal begitu notifikasi
 * `assignment_requested` masuk, dan mengarahkan ke detail pesanan saat diketuk
 * — di sana lembar konfirmasi montir terbuka otomatis.
 */
export function ClientAlertsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
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
        | { requestId?: unknown; audience?: unknown }
        | undefined;
      if (!data || data.audience !== 'client' || typeof data.requestId !== 'string') return;
      router.push({
        pathname: '/(client)/orders/[id]',
        params: { id: data.requestId },
      });
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;

      void refresh();

      channel = createRealtimeChannel(`client-notifications-${user.id}`)
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
            setUnread((count) => count + 1);
            void presentLocalAlert({
              title: row.title ?? 'Notifikasi baru',
              body: row.body ?? null,
              audience: 'client',
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
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  const value = useMemo(() => ({ unread, refresh }), [unread, refresh]);

  return <ClientAlertsContext.Provider value={value}>{children}</ClientAlertsContext.Provider>;
}
