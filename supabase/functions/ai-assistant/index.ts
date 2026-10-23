// Supabase Edge Function: ai-assistant
// Deploy: supabase functions deploy ai-assistant
// Secrets: supabase secrets set AI_PROVIDER_API_KEY=... AI_PROVIDER_MODEL=grok-4.7 [AI_PROVIDER_BASE_URL=...]
// Arsitektur PRD §11: React Native -> Edge Function -> AI Provider. Key tidak di mobile app.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SYSTEM_PROMPT = `Kamu asisten montir kendaraan (motor & mobil) di Indonesia untuk aplikasi MontirGo.
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
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';
    const sb = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { messages, requestId, vehicle } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages wajib diisi' }, 400);
    }

    const apiKey = Deno.env.get('AI_PROVIDER_API_KEY');
    if (!apiKey) return json({ error: 'AI_PROVIDER_API_KEY belum di-set di server' }, 500);
    const { baseUrl, model } = resolveProvider(apiKey);

    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(vehicle ? [{ role: 'system', content: `Konteks kendaraan: ${vehicle}` }] : []),
      ...messages.slice(-20).map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content).slice(0, 2000),
      })),
    ];

    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: chatMessages, temperature: 0.4, max_tokens: 1000 }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return json({ error: `AI provider error (${aiRes.status}): ${t.slice(0, 300)}` }, 502);
    }
    const aiJson = await aiRes.json();
    const reply: string = aiJson.choices?.[0]?.message?.content ?? '';
    if (!reply) return json({ error: 'Respons AI kosong' }, 502);

    // Simpan sebagai ai_diagnoses bila terkait order (validasi partisipan dulu).
    // INSERT hanya boleh via service_role (RLS), jadi pakai client terpisah.
    if (requestId) {
      try {
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const { data: sr } = await sb
          .from('service_requests')
          .select('id, client_id, mechanic_id')
          .eq('id', requestId)
          .single();
        if (
          serviceRoleKey &&
          sr &&
          (sr.client_id === user.id || sr.mechanic_id === user.id)
        ) {
          const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          await admin.from('ai_diagnoses').insert({
            request_id: requestId,
            possible_issues: [{ summary: reply.slice(0, 2000) }],
            disclaimer:
              'Hasil AI adalah indikasi awal dan memerlukan pemeriksaan langsung oleh montir.',
            raw_response: { reply, model },
          });
        }
      } catch {
        // Penyimpanan pelengkap — chat tetap berhasil walau gagal simpan.
      }
    }

    return json({ reply });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unknown error' }, 500);
  }
});

/**
 * Tentukan endpoint + model AI dari secret.
 * Key Groq (`gsk_`) otomatis diarahkan ke api.groq.com/openai/v1.
 */
function resolveProvider(apiKey: string): { baseUrl: string; model: string } {
  const configuredBase = Deno.env.get('AI_PROVIDER_BASE_URL')?.trim();
  const isGroq = apiKey.startsWith('gsk_') || /groq\.com/i.test(configuredBase ?? '');
  const baseUrl = configuredBase || (isGroq ? 'https://api.groq.com/openai/v1' : 'https://api.x.ai/v1');

  const configuredModel = Deno.env.get('AI_PROVIDER_MODEL')?.trim();
  const invalidForGroq =
    !configuredModel ||
    configuredModel === 'groq-ai' ||
    configuredModel === 'grok-4.7' ||
    configuredModel === 'gpt-4o-mini';
  const model = isGroq && invalidForGroq
    ? 'openai/gpt-oss-120b'
    : configuredModel || 'grok-4.7';

  return { baseUrl, model };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
