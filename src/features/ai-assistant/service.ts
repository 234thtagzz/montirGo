// Chat asisten via Supabase Edge Function `ai-assistant`.
// API key AI tetap di server (PRD §11) — aplikasi tidak pernah memanggil provider langsung.
import { supabase } from '@/lib/supabase';
import { describeFunctionError } from '@/lib/edge-functions';
import type { AssistantMode, AssistantPersona } from './constants';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskAssistantOptions {
  requestId?: string;
  vehicle?: string;
  /** Fokus percakapan: diagnosa kerusakan atau harga sparepart. */
  mode?: AssistantMode;
  /** Client mendapat bahasa awam, montir mendapat konteks teknis. */
  persona?: AssistantPersona;
}

export async function askAssistant(
  messages: ChatMessage[],
  opts?: AskAssistantOptions,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: {
      messages,
      requestId: opts?.requestId,
      vehicle: opts?.vehicle,
      mode: opts?.mode,
      persona: opts?.persona,
    },
  });
  if (error) {
    throw await describeFunctionError(error, 'ai-assistant', 'Layanan AI tidak tersedia.');
  }
  const reply = (data as { reply?: string } | null)?.reply;
  if (!reply) throw new Error('Respons AI kosong. Coba lagi.');
  return reply;
}
