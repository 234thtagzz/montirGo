// Supabase Edge Function: ai-assistant
// Deploy: supabase functions deploy ai-assistant
// Secrets: supabase secrets set AI_PROVIDER_API_KEY=... AI_PROVIDER_MODEL=openai/gpt-oss-120b [AI_PROVIDER_BASE_URL=...]
// Arsitektur PRD §11: React Native -> Edge Function -> AI Provider. Key tidak di mobile app.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type AssistantMode = 'diagnose' | 'sparepart';
type AssistantPersona = 'client' | 'mechanic';

const SYSTEM_BASE = `Kamu "MontirGo AI", asisten otomotif untuk motor dan mobil di Indonesia.
Gunakan Bahasa Indonesia yang jelas, ramah, dan ringkas agar nyaman dibaca di layar HP.
Tulis teks polos: tanpa tabel markdown, tanpa **bold**, tanpa heading markdown. Gunakan baris pendek dengan tanda "•" atau nomor.
Jangan mengaku sebagai montir manusia, jangan menjamin hasil diagnosis, dan jangan menjamin harga.`;

/**
 * Prompt dipilih dari mode percakapan. `sparepart` fokus pada rentang harga
 * part + jasa, `diagnose` fokus pada indikasi kerusakan.
 */
function buildSystemPrompt(mode: AssistantMode, persona: AssistantPersona): string {
  const audience =
    persona === 'mechanic'
      ? 'MONTIR MontirGo yang sedang menangani order di lokasi client'
      : 'CLIENT MontirGo, pemilik kendaraan yang ingin memahami kondisi dan biaya';

  if (mode === 'sparepart') {
    return `${SYSTEM_BASE}

Penggunamu adalah ${audience}.

Tugas utama: membantu menaksir HARGA SPAREPART kendaraan dan estimasi biaya pasang.

Aturan WAJIB:
- Jika merek, model, tahun, atau tipe mesin belum jelas, ajukan satu pertanyaan singkat. Bila pengguna tidak menjawab, beri rentang umum dan sebut asumsinya.
- Sebut nama part dengan jelas dan beri RENTANG harga dalam Rupiah, bukan satu angka pasti.
- Bedakan harga part aftermarket dan original/OEM bila relevan.
- Pisahkan "Harga part" dan "Estimasi jasa pasang" agar tidak tertukar.
- Sebut 2-3 faktor yang memengaruhi harga: kualitas part, wilayah, dan tipe mesin/varian.
- ${
      persona === 'mechanic'
        ? 'Untuk montir, sebutkan kisaran harga modal part dan saran harga jual wajar, serta part yang sebaiknya diganti berpasangan.'
        : 'Untuk client, akhiri dengan estimasi total (part + jasa) dan tips meminta rincian harga ke montir.'
    }
- Maksimal 5 item part per jawaban. Jangan mengarang nomor part spesifik; bila tidak yakin, sarankan cek katalog resmi.
- Akhiri dengan tepat satu kalimat: "Catatan: harga ini estimasi pasar dan bisa berbeda di bengkel atau toko sparepart."`;
  }

  return `${SYSTEM_BASE}

Penggunamu adalah ${audience}.

Tugas utama: membantu memahami INDIKASI KERUSAKAN kendaraan sebelum pemeriksaan langsung.

Aturan WAJIB:
- Gunakan bahasa kemungkinan: "kemungkinan", "indikasi", "perlu pemeriksaan".
- JANGAN menyatakan diagnosis pasti tanpa pemeriksaan langsung.
- Beri maksimal 4 kemungkinan penyebab, langkah pemeriksaan awal, perkiraan alat yang dibutuhkan, dan tingkat risiko (rendah/sedang/tinggi).
- Bila relevan, sebutkan kisaran biaya perbaikan dan part yang mungkin diganti.
- ${
      persona === 'mechanic'
        ? 'Untuk montir, sertakan pertanyaan lanjutan yang perlu ditanyakan ke client dan tanda bahaya yang harus dicek lebih dulu.'
        : 'Untuk client, jelaskan langkah aman sebelum montir datang dan kapan sebaiknya kendaraan berhenti dipakai.'
    }
- Jawab ringkas dan fokus.
- Akhiri dengan tepat satu kalimat: "Catatan: ini analisis awal, tetap lakukan pemeriksaan langsung."`;
}

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
  /** `sparepart` untuk tanya harga part, default `diagnose`. */
  mode?: unknown;
  /** `mechanic` mendapat konteks teknis, default `client`. */
  persona?: unknown;
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
    const mode: AssistantMode = body?.mode === 'sparepart' ? 'sparepart' : 'diagnose';
    const persona: AssistantPersona = body?.persona === 'mechanic' ? 'mechanic' : 'client';

    const apiKey = Deno.env.get('AI_PROVIDER_API_KEY')?.trim();
    if (!apiKey) return json({ error: 'AI_PROVIDER_API_KEY belum di-set di server' }, 500);
    const { baseUrl, model } = resolveProvider(apiKey);

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(mode, persona) },
      ...(vehicle
        ? [
            {
              role: 'system' as const,
              content:
                `Konteks kendaraan yang dipilih pengguna: ${vehicle}. ` +
                'Utamakan konteks ini bila relevan; bila pengguna menyebut kendaraan lain, ikuti pertanyaan pengguna.',
            },
          ]
        : []),
      ...history,
    ];

    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: chatMessages,
        temperature: mode === 'sparepart' ? 0.3 : 0.4,
        max_tokens: 1200,
      }),
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

    // Simpan sebagai ai_diagnoses hanya untuk mode diagnosa yang terkait order
    // (validasi partisipan dulu). Tanya harga tidak dicatat sebagai diagnosis.
    // INSERT hanya boleh via service_role (RLS), jadi pakai client terpisah.
    if (mode === 'diagnose' && UUID_RE.test(requestId)) {
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
