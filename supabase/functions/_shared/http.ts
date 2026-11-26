import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

export function requireEnv(name: string): string {
  const val = Deno.env.get(name)?.trim();
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

export function optionalEnv(name: string): string | null {
  const val = Deno.env.get(name)?.trim();
  return val || null;
}

export function getServiceClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization') ?? '';
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticate(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('UNAUTHORIZED');
  const client = getUserClient(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('UNAUTHORIZED');
  return { user: data.user, client, sb: client };
}

export function isValidUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
