import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CalloutFeeTier } from './types';

export const REQUEST_DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

export interface RequestDraft {
  categoryKey: string;
  calloutTier: CalloutFeeTier;
  vehicleId: string | null;
  issue: string;
  symptoms: string;
  address: string;
  coords: { lat: number; lng: number } | null;
  phone: string | null;
  notes: string;
  savedAt: number;
}

function draftKey(userId: string): string {
  return `@montirgo/request_draft_v1:${userId}`;
}

export async function loadRequestDraft(userId: string): Promise<RequestDraft | null> {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RequestDraft> | null;
    if (!parsed || typeof parsed.savedAt !== 'number') {
      await AsyncStorage.removeItem(draftKey(userId));
      return null;
    }
    if (Date.now() - parsed.savedAt > REQUEST_DRAFT_TTL_MS) {
      await AsyncStorage.removeItem(draftKey(userId));
      return null;
    }
    return {
      categoryKey: typeof parsed.categoryKey === 'string' ? parsed.categoryKey : 'montir',
      calloutTier:
        parsed.calloutTier === 'mobil' || parsed.calloutTier === 'derek'
          ? parsed.calloutTier
          : 'motor',
      vehicleId: typeof parsed.vehicleId === 'string' ? parsed.vehicleId : null,
      issue: typeof parsed.issue === 'string' ? parsed.issue : '',
      symptoms: typeof parsed.symptoms === 'string' ? parsed.symptoms : '',
      address: typeof parsed.address === 'string' ? parsed.address : '',
      coords:
        parsed.coords &&
        typeof parsed.coords.lat === 'number' &&
        typeof parsed.coords.lng === 'number'
          ? parsed.coords
          : null,
      phone: typeof parsed.phone === 'string' ? parsed.phone : null,
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      savedAt: parsed.savedAt,
    };
  } catch {
    await AsyncStorage.removeItem(draftKey(userId)).catch(() => {});
    return null;
  }
}

export async function saveRequestDraft(
  userId: string,
  draft: Omit<RequestDraft, 'savedAt'>,
): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(
      draftKey(userId),
      JSON.stringify({ ...draft, savedAt: Date.now() } satisfies RequestDraft),
    );
  } catch {
    // Penyimpanan draf bersifat pelengkap saat offline / sinyal lemah.
  }
}

export async function clearRequestDraft(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(draftKey(userId));
  } catch {
    // Abaikan kegagalan hapus cache.
  }
}
