// Cek cepat apakah Edge Function AI sudah dideploy ke project Supabase.
// Pemakaian: node scripts/verify-ai-functions.mjs
//
// Tidak butuh login Supabase CLI — cukup URL + anon key dari .env.local.
// Status yang diharapkan setelah deploy: 401 (butuh login) atau 200/4xx dari
// fungsi itu sendiri. Status 404 berarti fungsi BELUM ada di server.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FUNCTIONS = ['analyze-request', 'ai-assistant'];

function loadEnv() {
  const env = {};
  for (const file of ['.env.local', '.env']) {
    let raw = '';
    try {
      raw = readFileSync(resolve(process.cwd(), file), 'utf8');
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const value = match[2].replace(/^['"]|['"]$/g, '').trim();
      if (!(match[1] in env)) env[match[1]] = value;
    }
  }
  return env;
}

const env = { ...loadEnv(), ...process.env };
const baseUrl = env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!baseUrl || !anonKey) {
  console.error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY tidak ditemukan.');
  process.exit(2);
}

function describe(status) {
  if (status === 404) return 'BELUM dideploy (404)';
  if (status === 401) return 'aktif, menunggu login (401)';
  if (status === 200) return 'aktif (200)';
  if (status === 400) return 'aktif, validasi menolak body kosong (400)';
  return `aktif, balas HTTP ${status}`;
}

let failed = false;
for (const name of FUNCTIONS) {
  const url = `${baseUrl.replace(/\/+$/, '')}/functions/v1/${name}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(20_000),
    });
    let body = '';
    try {
      body = (await res.text()).replace(/\s+/g, ' ').slice(0, 160);
    } catch {
      // abaikan
    }
    const ok = res.status !== 404;
    if (!ok) failed = true;
    console.log(`${ok ? 'OK  ' : 'GAGAL'} ${name}: ${describe(res.status)}`);
    if (body) console.log(`      ${body}`);
  } catch (e) {
    failed = true;
    console.log(`GAGAL ${name}: tidak bisa dihubungi (${e instanceof Error ? e.message : e})`);
  }
}

if (failed) {
  console.log('\nDeploy dulu: npm run supabase:deploy');
  process.exit(1);
}
console.log('\nKedua Edge Function sudah terpasang.');
