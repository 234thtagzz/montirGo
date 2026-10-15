// Chat asisten montir via Supabase Edge Function `ai-assistant`.
// API key AI tetap di server (PRD §11) — aplikasi tidak pernah memanggil provider langsung.
import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askAssistant(
  messages: ChatMessage[],
  opts?: { requestId?: string; vehicle?: string },
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: { messages, requestId: opts?.requestId, vehicle: opts?.vehicle },
  });
  if (error) {
    const msg = error.message ?? '';
    if (/not found|404/i.test(msg)) {
      throw new Error(
        'Layanan AI belum aktif. Deploy dulu: supabase functions deploy ai-assistant',
      );
    }
    throw new Error(msg || 'Layanan AI tidak tersedia. Coba lagi nanti.');
  }
  const reply = (data as { reply?: string } | null)?.reply;
  if (!reply) throw new Error('Respons AI kosong. Coba lagi.');
  return reply;
}
