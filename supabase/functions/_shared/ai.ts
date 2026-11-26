import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface AiProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface RateLimitDecision {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
}

/** Resolve provider OpenAI-compatible (Groq gsk_ vs xAI vs custom base URL). */
export function resolveAiProvider(): AiProviderConfig {
  const apiKey = Deno.env.get('AI_PROVIDER_API_KEY')?.trim() ?? '';
  if (!apiKey) {
    throw new Error('AI_PROVIDER_API_KEY_MISSING');
  }
  const isGroq = apiKey.startsWith('gsk_');
  const configuredBase = Deno.env.get('AI_PROVIDER_BASE_URL')?.trim();
  const baseUrl = (
    configuredBase && configuredBase.length > 0
      ? configuredBase
      : isGroq
        ? 'https://api.groq.com/openai/v1'
        : 'https://api.x.ai/v1'
  ).replace(/\/+$/, '');

  const configuredModel = Deno.env.get('AI_PROVIDER_MODEL')?.trim();
  const invalidForGroq =
    !configuredModel ||
    configuredModel === 'groq-ai' ||
    configuredModel === 'grok-4.7' ||
    configuredModel === 'gpt-4o-mini';

  const model =
    isGroq && invalidForGroq
      ? 'openai/gpt-oss-120b'
      : configuredModel || 'grok-4.7';

  return { baseUrl, model, apiKey };
}

/** Bersihkan teks input pengguna dari karakter kontrol & batasi panjang untuk cegah prompt stuffing. */
export function sanitizeContextText(input: unknown, maxLen = 500): string {
  if (typeof input !== 'string') return '';
  return input
    // Strip ASCII control chars other than tab/newline.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/** Cek dan catat kuota pemanggilan AI per pengguna di Postgres (`ai_usage_logs`). */
export async function enforceAiRateLimit(
  svc: SupabaseClient,
  userId: string,
  endpoint: 'analyze-request' | 'ai-assistant',
  maxPerHour: number,
  maxPerDay: number,
): Promise<RateLimitDecision> {
  const { data, error } = await svc.rpc('check_and_log_ai_rate_limit', {
    p_user_id: userId,
    p_endpoint: endpoint,
    p_max_per_hour: maxPerHour,
    p_max_per_day: maxPerDay,
  });

  if (error || !data || typeof data !== 'object') {
    console.error('Rate limit RPC failed', error);
    // Fail-open ONLY if RPC itself is unavailable? Better fail-closed only when denied,
    // log clearly otherwise. Here allow so transient DB blip doesn't hard-break chat.
    return { allowed: true };
  }

  const row = data as {
    allowed?: boolean;
    reason?: string;
    retry_after_seconds?: number;
  };
  return {
    allowed: row.allowed !== false,
    reason: row.reason,
    retryAfterSeconds: row.retry_after_seconds ?? 60,
  };
}
