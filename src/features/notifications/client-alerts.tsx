import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { createRealtimeChannel } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { prepareNotifications, presentLocalAlert } from './local';

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

  // Tampilkan banner lokal saat notifikasi baru masuk.
  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;

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
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return <>{children}</>;
}
