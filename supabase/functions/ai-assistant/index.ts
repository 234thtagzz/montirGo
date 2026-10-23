// Supabase Edge Function: ai-assistant
// Deploy: supabase functions deploy ai-assistant
// Secrets: supabase secrets set AI_PROVIDER_API_KEY=... AI_PROVIDER_MODEL=openai/gpt-oss-120b [AI_PROVIDER_BASE_URL=...]
// Arsitektur PRD §11: React Native -> Edge Function -> AI Provider. Key tidak di mobile app.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const SYSTEM_PROMPT =
  `Kamu asisten montir kendaraan (motor & mobil) di Indonesia untuk aplikasi MontirGo.
Tugasmu membantu MONTIR memahami indikasi kerusakan sebelum/saat menangani order.

Aturan WAJIB:
- Gunakan bahasa kemungkinan: "kemungkinan", "indikasi", "perlu pemeriksaan".
- JANGAN menyatakan diagnosis pasti tanpa pemeriksaan langsung.
- Beri: kemungkinan penyebab (maks 4), pemeriksaan awal langkah-demi-langkah, perkiraan alat yang dibutuhkan, tingkat risiko (rendah/sedang/tinggi), dan pertanyaan lanjutan ke client bila info kurang.
- Jawab ringkas, Bahasa Indonesia, format cocok dibaca di HP.
- Akhiri dengan satu kalimat: "Catatan: ini analisis awal, tetap lakukan pemeriksaan langsung."`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AssistantBody {
  messages?: unknown;
  requestId?: unknown;
  vehicle?: unknown;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return json({ error: 'Konfigurasi Supabase belum lengkap di server' }, 500);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const sb = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json().catch(() => null)) as AssistantBody | null;
    const history = sanitizeMessages(body?.messages);
    if (history.length === 0) {
      return json({ error: 'messages wajib diisi' }, 400);
    }

    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : '';
    const vehicle = typeof body?.vehicle === 'string' ? body.vehicle.trim().slice(0, 120) : '';

    const apiKey = Deno.env.get('AI_PROVIDER_API_KEY')?.trim();
    if (!apiKey) return json({ error: 'AI_PROVIDER_API_KEY belum di-set di server' }, 500);
    const { baseUrl, model } = resolveProvider(apiKey);

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(vehicle ? [{ role: 'system' as const, content: `Konteks kendaraan: ${vehicle}` }] : []),
      ...history,
    ];

    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: chatMessages, temperature: 0.4, max_tokens: 1000 }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error('ai-assistant provider error:', aiRes.status, t.slice(0, 300));
      return json({ error: `AI provider error (${aiRes.status}): ${t.slice(0, 300)}` }, 502);
    }

    const aiJson = (await aiRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = aiJson.choices?.[0]?.message?.content?.trim() ?? '';
    if (!reply) return json({ error: 'Respons AI kosong' }, 502);

    // Simpan sebagai ai_diagnoses bila terkait order (validasi partisipan dulu).
    // INSERT hanya boleh via service_role (RLS), jadi pakai client terpisah.
    if (UUID_RE.test(requestId)) {
      await saveTranscript({ supabaseUrl, sb, userId: user.id, requestId, reply, model });
    }

    return json({ reply });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    const timeout = /abort|timeout|timed out/i.test(message);
    console.error('ai-assistant failed:', message);
    return json(
      { error: timeout ? 'AI timeout. Coba kirim ulang.' : message },
      timeout ? 504 : 500,
    );
  }
});

async function saveTranscript(input: {
  supabaseUrl: string;
  sb: SupabaseClient;
  userId: string;
  requestId: string;
  reply: string;
  model: string;
}): Promise<void> {
  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) return;

    const { data: sr } = await input.sb
      .from('service_requests')
      .select('id, client_id, mechanic_id')
      .eq('id', input.requestId)
      .maybeSingle<{ id: string; client_id: string; mechanic_id: string | null }>();

    if (!sr || (sr.client_id !== input.userId && sr.mechanic_id !== input.userId)) return;

    const admin = createClient(input.supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.from('ai_diagnoses').insert({
      request_id: input.requestId,
      possible_issues: [{ summary: input.reply.slice(0, 2000) }],
      disclaimer: 'Hasil AI adalah indikasi awal dan memerlukan pemeriksaan langsung oleh montir.',
      raw_response: { reply: input.reply, model: input.model },
    });
  } catch (e) {
    // Penyimpanan pelengkap — chat tetap berhasil walau gagal simpan.
    console.error('ai-assistant gagal menyimpan transkrip:', e instanceof Error ? e.message : e);
  }
}

/** Batasi riwayat & normalisasi role agar tidak bisa menyisipkan system prompt. */
function sanitizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-20)
    .map((item: unknown): ChatMessage | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const content = typeof record.content === 'string' ? record.content.trim() : '';
      if (!content) return null;
      return {
        role: record.role === 'assistant' ? 'assistant' : 'user',
        content: content.slice(0, 2000),
      };
    })
    .filter((item: ChatMessage | null): item is ChatMessage => item !== null);
}

/**
 * Tentukan endpoint + model AI dari secret.
 * Key Groq (`gsk_`) otomatis diarahkan ke api.groq.com/openai/v1.
 */
function resolveProvider(apiKey: string): { baseUrl: string; model: string } {
  const configuredBase = Deno.env.get('AI_PROVIDER_BASE_URL')?.trim();
  const isGroq = apiKey.startsWith('gsk_') || /groq\.com/i.test(configuredBase ?? '');
  const baseUrl = configuredBase ||
    (isGroq ? 'https://api.groq.com/openai/v1' : 'https://api.x.ai/v1');

  const configuredModel = Deno.env.get('AI_PROVIDER_MODEL')?.trim();
  const invalidForGroq = !configuredModel ||
    configuredModel === 'groq-ai' ||
    configuredModel === 'grok-4.7' ||
    configuredModel === 'gpt-4o-mini';
  const model = isGroq && invalidForGroq ? 'openai/gpt-oss-120b' : configuredModel || 'grok-4.7';

  return { baseUrl: baseUrl.replace(/\/+$/, ''), model };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
