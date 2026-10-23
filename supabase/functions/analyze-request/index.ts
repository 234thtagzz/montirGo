// Supabase Edge Function: analyze-request
// Deploy: supabase functions deploy analyze-request
// Secrets: AI_PROVIDER_API_KEY=... AI_PROVIDER_MODEL=openai/gpt-oss-120b [AI_PROVIDER_BASE_URL=...]
// Arsitektur PRD §11: React Native -> Edge Function -> AI Provider.
// Hasil disimpan server-side (service_role) agar tidak bisa dipalsukan dari app.

import { createClient } from 'npm:@supabase/supabase-js@2';

const DISCLAIMER = 'Hasil AI adalah indikasi awal dan memerlukan pemeriksaan langsung oleh montir.';

const SYSTEM_PROMPT =
  `Kamu asisten mekanik kendaraan (motor & mobil) di Indonesia untuk aplikasi MontirGo.
Tugasmu memberi ANALISIS AWAL dari keluhan client sebelum montir datang.

Aturan WAJIB:
- Gunakan bahasa kemungkinan: "kemungkinan", "indikasi", "perlu pemeriksaan".
- JANGAN menyatakan diagnosis pasti tanpa pemeriksaan langsung.
- Maksimal 4 kemungkinan penyebab.
- Ringkas, Bahasa Indonesia, cocok dibaca di HP.

Balas HANYA dengan JSON valid (tanpa markdown/code fence) dengan bentuk:
{
  "possible_issues": [
    { "title": "string", "likelihood": "tinggi|sedang|rendah", "note": "string singkat" }
  ],
  "symptoms_summary": "string singkat",
  "risk_level": "low|medium|high|critical",
  "recommended_checks": ["langkah pemeriksaan awal", "..."],
  "suggested_tools": ["alat yang mungkin dibutuhkan", "..."],
  "estimated_complexity": "ringan|sedang|berat",
  "questions_for_client": ["pertanyaan lanjutan bila info kurang", "..."]
}`;

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
const COMPLEXITIES = ['ringan', 'sedang', 'berat'] as const;

type RiskLevel = (typeof RISK_LEVELS)[number];
type Complexity = (typeof COMPLEXITIES)[number];

interface PossibleIssue {
  title: string;
  likelihood: string | null;
  note: string | null;
}

interface Analysis {
  possible_issues: PossibleIssue[];
  symptoms_summary: string | null;
  risk_level: RiskLevel;
  recommended_checks: string[];
  suggested_tools: string[];
  estimated_complexity: Complexity | null;
  questions_for_client: string[];
  disclaimer: string;
}

interface Vehicle {
  type?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
}

interface ServiceRequestRow {
  id: string;
  client_id: string;
  mechanic_id: string | null;
  issue_description: string | null;
  symptoms: string | null;
  additional_notes: string | null;
  status: string;
  vehicles: Vehicle | Vehicle[] | null;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: 'Konfigurasi Supabase belum lengkap di server' }, 500);
    }
    if (!serviceRoleKey) {
      return json({ error: 'SUPABASE_SERVICE_ROLE_KEY tidak tersedia di server' }, 500);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json().catch(() => null)) as { requestId?: unknown } | null;
    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : '';
    if (!UUID_RE.test(requestId)) {
      return json({ error: 'requestId tidak valid' }, 400);
    }

    // Ambil request + kendaraan. RLS peserta sudah membatasi client/montir terkait.
    const { data: request, error: requestError } = await sb
      .from('service_requests')
      .select(
        'id, client_id, mechanic_id, issue_description, symptoms, additional_notes, status, ' +
          'vehicles ( type, brand, model, year )',
      )
      .eq('id', requestId)
      .maybeSingle<ServiceRequestRow>();
    if (requestError) return json({ error: requestError.message }, 400);
    if (!request) return json({ error: 'Request tidak ditemukan' }, 404);

    const isParticipant = request.client_id === user.id ||
      (request.mechanic_id != null && request.mechanic_id === user.id);
    if (!isParticipant) {
      return json({ error: 'Kamu tidak berhak menganalisis request ini' }, 403);
    }
    if (request.status === 'cancelled' || request.status === 'paid') {
      return json({ error: 'Request sudah selesai/dibatalkan' }, 409);
    }

    const apiKey = Deno.env.get('AI_PROVIDER_API_KEY')?.trim();
    if (!apiKey) return json({ error: 'AI_PROVIDER_API_KEY belum di-set di server' }, 500);
    const { baseUrl, model } = resolveProvider(apiKey);

    const vehicle = firstVehicle(request.vehicles);
    const userPrompt = [
      'Data permintaan client:',
      `- Keluhan: ${request.issue_description?.trim() || 'tidak dicantumkan'}`,
      `- Gejala: ${request.symptoms?.trim() || 'tidak dicantumkan'}`,
      `- Catatan: ${request.additional_notes?.trim() || 'tidak dicantumkan'}`,
      `- Kendaraan: ${formatVehicle(vehicle) || 'tidak dicantumkan'}`,
      '',
      'Berikan analisis awal sesuai format JSON yang diminta.',
    ].join('\n');

    const reply = await callProvider({ baseUrl, apiKey, model, userPrompt });
    const analysis = normalize(parseJson(reply), reply);

    // Tulis lewat service_role: policy ai_diagnoses hanya mengizinkan SELECT
    // untuk partisipan, INSERT hanya service_role (anti pemalsuan).
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: inserted, error: insertError } = await admin
      .from('ai_diagnoses')
      .insert({
        request_id: requestId,
        possible_issues: analysis.possible_issues,
        symptoms_summary: analysis.symptoms_summary,
        risk_level: analysis.risk_level,
        recommended_checks: analysis.recommended_checks,
        suggested_tools: analysis.suggested_tools,
        estimated_complexity: analysis.estimated_complexity,
        questions_for_client: analysis.questions_for_client,
        raw_response: { model, reply: reply.slice(0, 6000) },
        disclaimer: analysis.disclaimer,
      })
      .select('id, created_at')
      .single();
    if (insertError) {
      return json({ error: `Gagal menyimpan analisis: ${insertError.message}` }, 500);
    }

    // Ringkasan singkat untuk daftar order (pelengkap, jangan gagalkan respons).
    const summary = buildSummary(analysis);
    await admin.from('service_requests').update({ ai_summary: summary }).eq('id', requestId);

    return json({
      analysis: {
        ...analysis,
        id: inserted.id,
        created_at: inserted.created_at,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    const timeout = /abort|timeout|timed out/i.test(message);
    console.error('analyze-request failed:', message);
    return json(
      { error: timeout ? 'AI timeout. Coba analisis ulang.' : message },
      timeout ? 504 : 500,
    );
  }
});

/**
 * Tentukan endpoint + model AI dari secret.
 *
 * Mendukung provider OpenAI-compatible (Groq, xAI, dll). Bila
 * AI_PROVIDER_BASE_URL tidak diisi, deteksi dari prefix key: key Groq (`gsk_`)
 * otomatis memakai api.groq.com, bukan api.x.ai.
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

async function callProvider(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  userPrompt: string;
}): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: input.userPrompt },
  ];

  const request = (jsonMode: boolean) =>
    fetch(`${input.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages,
        temperature: 0.2,
        max_tokens: 1200,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(30_000),
    });

  let res = await request(true);
  // Sebagian provider tidak mendukung response_format; ulangi tanpa itu.
  if (!res.ok && res.status === 400) {
    await res.text().catch(() => '');
    res = await request(false);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI provider error (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = data.choices?.[0]?.message?.content ?? '';
  if (!reply.trim()) throw new Error('Respons AI kosong');
  return reply;
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const direct: unknown = JSON.parse(text);
    return typeof direct === 'object' && direct !== null
      ? (direct as Record<string, unknown>)
      : null;
  } catch {
    // lanjut ke ekstraksi blok JSON
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const parsed: unknown = JSON.parse(text.slice(start, end + 1));
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function normalize(parsed: Record<string, unknown> | null, rawReply: string): Analysis {
  const possibleIssues = normalizeIssues(parsed?.possible_issues).slice(0, 4);
  const fallbackIssue = possibleIssues.length
    ? possibleIssues
    : [{ title: 'Perlu pemeriksaan langsung', likelihood: null, note: null }];

  return {
    possible_issues: fallbackIssue,
    symptoms_summary: asText(parsed?.symptoms_summary) ??
      (possibleIssues.length ? null : rawReply.replace(/\s+/g, ' ').slice(0, 280)),
    risk_level: normalizeRisk(parsed?.risk_level),
    recommended_checks: asStringArray(parsed?.recommended_checks, 6),
    suggested_tools: asStringArray(parsed?.suggested_tools, 6),
    estimated_complexity: normalizeComplexity(parsed?.estimated_complexity),
    questions_for_client: asStringArray(parsed?.questions_for_client, 4),
    disclaimer: DISCLAIMER,
  };
}

function normalizeIssues(value: unknown): PossibleIssue[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: unknown): PossibleIssue | null => {
      if (typeof item === 'string') {
        return { title: item.trim().slice(0, 160), likelihood: null, note: null };
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const title = asText(record.title) ?? asText(record.issue) ?? asText(record.name);
        if (!title) return null;
        return {
          title: title.slice(0, 160),
          likelihood: asText(record.likelihood)?.toLowerCase() ?? null,
          note: asText(record.note) ?? asText(record.description) ?? null,
        };
      }
      return null;
    })
    .filter((item: PossibleIssue | null): item is PossibleIssue => item !== null);
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: unknown) => asText(item))
    .filter((item: string | null): item is string => item !== null)
    .slice(0, limit);
}

function normalizeRisk(value: unknown): RiskLevel {
  const text = asText(value)?.toLowerCase() ?? '';
  if (text.includes('critical') || text.includes('kritis')) return 'critical';
  if (text.includes('high') || text.includes('tinggi')) return 'high';
  if (text.includes('low') || text.includes('rendah')) return 'low';
  return 'medium';
}

function normalizeComplexity(value: unknown): Complexity | null {
  const text = asText(value)?.toLowerCase() ?? '';
  if (text.includes('berat')) return 'berat';
  if (text.includes('ringan')) return 'ringan';
  if (text.includes('sedang')) return 'sedang';
  return null;
}

function buildSummary(analysis: Analysis): string {
  if (analysis.symptoms_summary) {
    return analysis.symptoms_summary.slice(0, 280);
  }
  const firstIssue = analysis.possible_issues[0]?.title ?? 'Perlu pemeriksaan';
  return `${firstIssue} (risiko ${analysis.risk_level}).`.slice(0, 280);
}

/** Relasi `vehicles` bisa berbentuk objek (many-to-one) atau array. */
function firstVehicle(value: Vehicle | Vehicle[] | null): Vehicle | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function formatVehicle(vehicle: Vehicle | null): string {
  if (!vehicle) return '';
  return [vehicle.type, vehicle.brand, vehicle.model, vehicle.year]
    .filter((part) => part != null && String(part).trim() !== '')
    .map((part) => String(part).trim().slice(0, 40))
    .join(' ');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
