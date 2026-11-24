import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// `supabase.channel(topic)` mengembalikan channel yang sudah ada bila topic-nya
// sama. Karena `removeChannel()` bersifat async, React StrictMode (atau remount
// cepat) bisa mengambil channel lama yang masih joined lalu memanggil `.on()`
// dan memicu error "cannot add postgres_changes callbacks ... after subscribe()".
// Setiap subscription mendapat topic unik agar selalu channel baru.
let channelSequence = 0;

export function createRealtimeChannel(topic: string): RealtimeChannel {
  channelSequence += 1;
  return supabase.channel(`${topic}#${channelSequence}`);
}

/**
 * Subscribe dengan sinkronisasi ulang setelah koneksi sempat putus.
 *
 * Saat jaringan hilang, channel bisa berstatus `CHANNEL_ERROR` / `TIMED_OUT`.
 * Supabase akan mencoba menyambung lagi sendiri, tetapi perubahan data yang
 * terjadi selama terputus tidak dikirim ulang. `onResync` dipanggil sekali
 * setelah channel kembali `SUBSCRIBED` supaya layar memuat data terbaru.
 */
export function subscribeWithResync(channel: RealtimeChannel, onResync: () => void): RealtimeChannel {
  let interrupted = false;
  return channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      interrupted = true;
      return;
    }
    if (status === 'SUBSCRIBED' && interrupted) {
      interrupted = false;
      onResync();
    }
  });
}
