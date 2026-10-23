// Chat asisten montir via Supabase Edge Function `ai-assistant`.
// API key AI tetap di server (PRD §11) — aplikasi tidak pernah memanggil provider langsung.
import { supabase } from '@/lib/supabase';
import { describeFunctionError } from '@/lib/edge-functions';

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
    throw await describeFunctionError(error, 'ai-assistant', 'Layanan AI tidak tersedia.');
  }
  const reply = (data as { reply?: string } | null)?.reply;
  if (!reply) throw new Error('Respons AI kosong. Coba lagi.');
  return reply;
}
