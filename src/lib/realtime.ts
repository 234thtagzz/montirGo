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
