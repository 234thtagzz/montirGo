// Data layer notifikasi in-app (dipakai section montir maupun client).
import { supabase } from '@/lib/supabase';

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
}

async function getMyId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesi berakhir. Silakan login kembali.');
  return user.id;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const id = await getMyId();
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', id)
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function listMyNotifications(limit = 50): Promise<AppNotification[]> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('notifications')
    .select(
      'id, title, body, type, is_read, created_at, related_entity_type, related_entity_id',
    )
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function markAllNotificationsRead(): Promise<void> {
  const id = await getMyId();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', id)
    .eq('is_read', false);
  if (error) throw error;
}
