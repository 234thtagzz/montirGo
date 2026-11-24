/**
 * Cache signed URL di memori (bukan penyimpanan permanen).
 *
 * Signed URL adalah kredensial sementara. Cache sengaja tidak pernah ditulis
 * ke AsyncStorage/disk, dan seluruh isinya dibersihkan saat logout agar URL
 * yang sudah beredar tidak tetap hidup di perangkat.
 */
interface CacheEntry {
  url: string;
  /** Epoch ms saat URL benar-benar kedaluwarsa. */
  expiresAt: number;
}

const DEFAULT_SAFETY_MS = 5 * 60 * 1000;

const namespaces = new Map<string, Map<string, CacheEntry>>();

function store(namespace: string): Map<string, CacheEntry> {
  let map = namespaces.get(namespace);
  if (!map) {
    map = new Map();
    namespaces.set(namespace, map);
  }
  return map;
}

/** URL yang masih berlaku (dengan margin keamanan), atau null bila perlu di-resolve ulang. */
export function readSignedUrl(
  namespace: string,
  path: string,
  safetyMs = DEFAULT_SAFETY_MS,
): string | null {
  const map = store(namespace);
  const entry = map.get(path);
  if (!entry) return null;
  if (entry.expiresAt - safetyMs <= Date.now()) {
    map.delete(path);
    return null;
  }
  return entry.url;
}

export function writeSignedUrl(
  namespace: string,
  path: string,
  url: string,
  ttlSeconds: number,
): void {
  store(namespace).set(path, {
    url,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/** Buang satu URL (mis. gambar gagal dimuat / objek dihapus) agar di-resolve ulang. */
export function forgetSignedUrl(namespace: string, path: string): void {
  store(namespace).delete(path);
}

/** Hapus semua cache signed URL — dipanggil saat logout. */
export function clearSignedUrlCaches(): void {
  namespaces.clear();
}
