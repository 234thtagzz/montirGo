// MontirGo Edge Function: kirim Remote Push Notification via Expo Push Service.
// Dipanggil oleh Supabase Database Webhook (INSERT di `notifications`) atau service internal.
import { cors, getServiceClient, isValidUuid, json } from '../_shared/http.ts';
import {
  buildPushDataPayload,
  roleToAudience,
  type NotificationPushRecord,
} from '../_shared/push.ts';

interface PushRequestBody {
  record?: NotificationPushRecord;
  userId?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

interface ExpoTicket {
  status?: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function isAuthorized(req: Request): boolean {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
  const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')?.trim() ?? '';

  const authHeader = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  const headerSecret = req.headers.get('x-webhook-secret')?.trim() ?? '';

  if (serviceKey && constantTimeEqual(authHeader, serviceKey)) return true;
  if (webhookSecret && constantTimeEqual(headerSecret, webhookSecret)) return true;
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung' }, 405);

  if (!isAuthorized(req)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const body = (await req.json().catch(() => null)) as PushRequestBody | null;
  const record = body?.record;
  const userId = (record?.user_id ?? body?.userId ?? '').trim();
  const title = (record?.title ?? body?.title ?? 'MontirGo').trim();
  const messageBody = (record?.body ?? body?.body ?? '').trim();

  if (!isValidUuid(userId) || !messageBody) {
    return json({ error: 'user_id dan body wajib diisi' }, 400);
  }

  const svc = getServiceClient();
  const [{ data: tokens, error: tokenError }, { data: profileRow }] = await Promise.all([
    svc
      .from('device_push_tokens')
      .select('id, expo_push_token')
      .eq('user_id', userId)
      .eq('is_active', true),
    svc
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  if (tokenError) {
    return json({ error: tokenError.message }, 500);
  }

  const activeTokens = (tokens ?? []) as { id: string; expo_push_token: string }[];
  if (activeTokens.length === 0) {
    return json({ ok: true, sent: 0, skipped: 'no_active_tokens' });
  }

  const audience = roleToAudience((profileRow as { role?: unknown } | null)?.role);
  const dataPayload = buildPushDataPayload({
    record,
    audience,
    overrideData: body?.data ?? null,
  });

  const messages = activeTokens.map((t) => ({
    to: t.expo_push_token,
    sound: 'default',
    title,
    body: messageBody,
    data: dataPayload,
    priority: 'high',
    channelId: 'montirgo-alerts',
  }));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN')?.trim();
  if (expoAccessToken) {
    headers.Authorization = `Bearer ${expoAccessToken}`;
  }

  let expoRes: Response;
  try {
    expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Expo Push API timeout' },
      504,
    );
  }

  const resJson = (await expoRes.json().catch(() => null)) as
    | { data?: ExpoTicket[] }
    | null;

  if (!expoRes.ok || !Array.isArray(resJson?.data)) {
    return json(
      { error: `Expo Push API error (${expoRes.status})` },
      502,
    );
  }

  const invalidTokenIds: string[] = [];
  let sentCount = 0;

  resJson.data.forEach((ticket, idx) => {
    if (ticket.status === 'ok') {
      sentCount += 1;
    } else if (ticket.details?.error === 'DeviceNotRegistered') {
      const tokenRow = activeTokens[idx];
      if (tokenRow) invalidTokenIds.push(tokenRow.id);
    }
  });

  if (invalidTokenIds.length > 0) {
    await svc
      .from('device_push_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', invalidTokenIds);
  }

  return json({
    ok: true,
    sent: sentCount,
    deactivated: invalidTokenIds.length,
  });
});
