// Supabase Edge Function: ai-assistant
// Deploy: supabase functions deploy ai-assistant
// Secrets: supabase secrets set AI_PROVIDER_API_KEY=... AI_PROVIDER_MODEL=openai/gpt-oss-120b [AI_PROVIDER_BASE_URL=...]
// Arsitektur PRD §11: React Native -> Edge Function -> AI Provider. Key tidak di mobile app.

import { type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  enforceAiRateLimit,
  resolveAiProvider,
  sanitizeContextText,
} from '../_shared/ai.ts';
import { authenticate, cors, getServiceClient, isValidUuid, json } from '../_shared/http.ts';

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
- SELALU sesuaikan komponen dan kisaran harga dengan jenis kendaraan yang dipilih pengguna (sepeda motor vs mobil). Jika kendaraan adalah sepeda motor (mis. Honda Vario, Beat, NMAX, Supra), JANGAN pernah menyebut komponen atau kisaran harga mobil — gunakan kisaran harga suku cadang dan jasa bengkel motor di Indonesia.
- Patokan pasar bengkel Indonesia agar estimasi realistis: untuk SEPEDA MOTOR (matic/bebek/sport), aki kering 12V 3.5-6Ah umumnya Rp150.000-Rp380.000 (aftermarket Rp150.000-Rp250.000, OEM seperti GS Astra/Yuasa Rp230.000-Rp380.000) + jasa pasang Rp15.000-Rp50.000; oli mesin motor Rp45.000-Rp95.000; busi motor Rp20.000-Rp90.000; kampas rem motor Rp35.000-Rp120.000. Harga aki Rp500.000-Rp1.500.000 HANYA berlaku untuk MOBIL, bukan sepeda motor.
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
- SELALU sesuaikan komponen dan kisaran harga dengan jenis kendaraan yang dipilih pengguna (sepeda motor vs mobil). Jika kendaraan adalah sepeda motor (mis. Honda Vario, Beat, NMAX, Supra), JANGAN pernah menyebut komponen atau kisaran harga mobil — gunakan kisaran harga suku cadang dan jasa bengkel motor di Indonesia.
- Patokan pasar bengkel Indonesia agar estimasi realistis: untuk SEPEDA MOTOR (matic/bebek/sport), aki kering 12V 3.5-6Ah umumnya Rp150.000-Rp380.000 (aftermarket Rp150.000-Rp250.000, OEM seperti GS Astra/Yuasa Rp230.000-Rp380.000) + jasa pasang Rp15.000-Rp50.000; oli mesin motor Rp45.000-Rp95.000; busi motor Rp20.000-Rp90.000; kampas rem motor Rp35.000-Rp120.000. Harga aki Rp500.000-Rp1.500.000 HANYA berlaku untuk MOBIL, bukan sepeda motor.
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
    const { user } = await authenticate(req);

    const body = (await req.json().catch(() => null)) as AssistantBody | null;
    const history = sanitizeMessages(body?.messages);
    if (history.length === 0) {
      return json({ error: 'messages wajib diisi' }, 400);
    }

    const svc = getServiceClient();
    const rate = await enforceAiRateLimit(svc, user.id, 'ai-assistant', 30, 150);
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Batas penggunaan asisten AI tercapai. Coba lagi beberapa saat lagi.',
          retryAfterSeconds: rate.retryAfterSeconds ?? 60,
        }),
        {
          status: 429,
          headers: { ...cors, 'Retry-After': String(rate.retryAfterSeconds ?? 60) },
        },
      );
    }

    // Persona diambil dari role DB, bukan klaim body client.
    const { data: profileRow } = await svc
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role?: string }>();
    const persona: AssistantPersona = profileRow?.role === 'mechanic' ? 'mechanic' : 'client';

    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : '';
    const vehicle = sanitizeContextText(body?.vehicle, 120);
    const mode: AssistantMode = body?.mode === 'sparepart' ? 'sparepart' : 'diagnose';

    let baseUrl: string;
    let model: string;
    let apiKey: string;
    try {
      ({ baseUrl, model, apiKey } = resolveAiProvider());
    } catch {
      return json({ error: 'AI_PROVIDER_API_KEY belum di-set di server' }, 500);
    }

    // Konteks kendaraan dimasukkan sebagai pesan user, bukan system prompt (anti prompt injection).
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(mode, persona) },
      ...(vehicle
        ? [
            {
              role: 'user' as const,
              content: `[Konteks kendaraan dipilih: ${vehicle}]`,
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
      signal: AbortSignal.timeout(25_000),
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

    const lastUserMessage = [...history].reverse().find((m) => m.role === 'user')?.content ?? '';
    await saveChatMessages({
      svc,
      userId: user.id,
      requestId: isValidUuid(requestId) ? requestId : null,
      mode,
      persona,
      userContent: lastUserMessage,
      reply,
      model,
    });

    return json({ reply });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    if (message === 'UNAUTHORIZED') return json({ error: 'Unauthorized' }, 401);
    const timeout = /abort|timeout|timed out/i.test(message);
    console.error('ai-assistant failed:', message);
    return json(
      { error: timeout ? 'AI timeout. Coba kirim ulang.' : message },
      timeout ? 504 : 500,
    );
  }
});

async function saveChatMessages(input: {
  svc: SupabaseClient;
  userId: string;
  requestId: string | null;
  mode: AssistantMode;
  persona: AssistantPersona;
  userContent: string;
  reply: string;
  model: string;
}): Promise<void> {
  try {
    let linkedRequestId: string | null = null;
    if (input.requestId) {
      const { data: sr } = await input.svc
        .from('service_requests')
        .select('id, client_id, mechanic_id')
        .eq('id', input.requestId)
        .maybeSingle<{ id: string; client_id: string; mechanic_id: string | null }>();
      if (sr && (sr.client_id === input.userId || sr.mechanic_id === input.userId)) {
        linkedRequestId = sr.id;
      }
    }

    const rows = [
      ...(input.userContent
        ? [
            {
              user_id: input.userId,
              request_id: linkedRequestId,
              mode: input.mode,
              persona: input.persona,
              role: 'user' as const,
              content: input.userContent.slice(0, 4000),
              model_used: input.model,
            },
          ]
        : []),
      {
        user_id: input.userId,
        request_id: linkedRequestId,
        mode: input.mode,
        persona: input.persona,
        role: 'assistant' as const,
        content: input.reply.slice(0, 6000),
        model_used: input.model,
      },
    ];

    await input.svc.from('ai_chat_messages').insert(rows);
  } catch (e) {
    console.error('ai-assistant gagal menyimpan chat:', e instanceof Error ? e.message : e);
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

// Helper CORS, JSON response, dan resolver provider berada di `_shared/http.ts` & `_shared/ai.ts`.
