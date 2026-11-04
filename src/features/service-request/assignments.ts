import { supabase } from '@/lib/supabase';

/**
 * Kembalikan pengajuan montir yang sudah melewati batas konfirmasi ke kolam.
 *
 * Sumber utama kedaluwarsa adalah jadwal pg_cron di database. Pemanggilan ini
 * menjadi jaring pengaman saat aplikasi dibuka: tidak masalah bila RPC belum
 * tersedia (migrasi belum dijalankan) karena kegagalan diabaikan.
 */
export async function expireStaleAssignments(): Promise<void> {
  try {
    await supabase.rpc('expire_stale_assignments');
  } catch {
    // Fitur konfirmasi belum aktif atau jaringan sedang bermasalah.
  }
}
