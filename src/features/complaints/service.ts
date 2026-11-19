// Service Keluhan: ajukan + daftar milik sendiri (client & montir).
import { supabase } from '@/lib/supabase';
import { deleteComplaintPhotos, uploadComplaintPhoto } from './photo';
import type { Complaint, ComplaintFormDraft, TransactionSummary } from './types';

async function getMyId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesi berakhir. Silakan login kembali.');
  return user.id;
}

const COMPLAINT_SELECT =
  'id, reporter_id, reporter_role, request_id, category, subject, description, photo_paths, status, admin_reply, resolved_at, created_at, updated_at';

/** Unggah foto lampiran sebelum insert; bila ajuan gagal, hapus foto yang sudah terunggah. */
async function uploadAndCollect(ownerId: string, draft: ComplaintFormDraft): Promise<string[]> {
  const uploaded: string[] = [];
  try {
    for (const photo of draft.photos) {
      uploaded.push(await uploadComplaintPhoto(ownerId, draft.requestId, photo));
    }
    return uploaded;
  } catch (error) {
    await deleteComplaintPhotos(uploaded);
    throw error;
  }
}

export async function submitComplaint(draft: ComplaintFormDraft): Promise<Complaint> {
  const reporterId = await getMyId();
  const photoPaths = await uploadAndCollect(reporterId, draft);

  const { data, error } = await supabase
    .from('complaints')
    .insert({
      reporter_id: reporterId,
      request_id: draft.requestId,
      category: draft.category,
      subject: draft.subject,
      description: draft.description,
      photo_paths: photoPaths,
    })
    .select(COMPLAINT_SELECT)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Keluhan gagal diajukan. Coba lagi.');
  return data as Complaint;
}

export async function listMyComplaints(limit = 50): Promise<Complaint[]> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('complaints')
    .select(COMPLAINT_SELECT)
    .eq('reporter_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Complaint[];
}

/** Ringkasan transaksi — dipakai kartu teg tangan di luar form ajuan. */
export async function getTransactionSummary(requestId: string): Promise<TransactionSummary> {
  const { data, error } = await supabase
    .from('service_requests')
    .select('id, status, issue_description, created_at')
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Transaksi tidak ditemukan.');
  return data as TransactionSummary;
}

/** Id transaksi yang masih terbuka (ada keluhan terbuka) milik pelapor — sebagai badge. */
export async function listMyComplaintRequestIds(): Promise<string[]> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('complaints')
    .select('request_id')
    .eq('reporter_id', id)
    .in('status', ['open', 'in_progress']);
  if (error) throw error;
  return ((data ?? []).map((row) => row.request_id).filter(Boolean)) as string[];
}
