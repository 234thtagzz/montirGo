import { forgetSignedUrl, readSignedUrl, writeSignedUrl } from '@/lib/signed-url-cache';
import { supabase } from '@/lib/supabase';

export const QUOTE_PHOTO_BUCKET = 'quote-photos';

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const CACHE_NAMESPACE = 'quote-photos';

/** Ambil signed URL tunggal untuk foto bukti estimasi di bucket privat `quote-photos`. */
export async function resolveQuotePhotoUrl(
  path: string | null | undefined,
  options?: { force?: boolean },
): Promise<string | null> {
  if (!path) return null;
  if (!options?.force) {
    const cached = readSignedUrl(CACHE_NAMESPACE, path);
    if (cached) return cached;
  }

  const { data, error } = await supabase.storage
    .from(QUOTE_PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  writeSignedUrl(CACHE_NAMESPACE, path, data.signedUrl, SIGNED_URL_SECONDS_FALLBACK);
  return data.signedUrl;
}

const SIGNED_URL_SECONDS_FALLBACK = SIGNED_URL_TTL_SECONDS;

/** Selesaikan beberapa path foto estimasi menjadi map `{ [path]: signedUrl }`. */
export async function resolveQuotePhotoUrls(
  paths: readonly string[],
  options?: { force?: boolean },
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};

  const entries = await Promise.all(
    unique.map(async (path) => [path, await resolveQuotePhotoUrl(path, options)] as const),
  );
  const result: Record<string, string> = {};
  for (const [path, url] of entries) {
    if (url) result[path] = url;
  }
  return result;
}

export function forgetQuotePhotoUrl(path: string | null | undefined): void {
  if (!path) return;
  forgetSignedUrl(CACHE_NAMESPACE, path);
}
