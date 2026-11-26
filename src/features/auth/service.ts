import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ensureFreshSession,
  getCurrentUserId,
  isAuthError,
  readSession,
  SessionUnavailableError,
} from '@/lib/auth-session';
import { clearSignedUrlCaches } from '@/lib/signed-url-cache';
import { supabase } from '@/lib/supabase';
import { unregisterPushToken } from '@/features/notifications/push';
import type { AuthUser, DbRole, ProfileRow, UserRole } from './types';

export * from './types';

export function toAppRole(role: DbRole): UserRole {
  if (role === 'admin') return 'ADMIN';
  return role === 'mechanic' ? 'MONTIR' : 'CLIENT';
}

function toDbRole(role: UserRole): 'client' | 'mechanic' {
  return role === 'MONTIR' ? 'mechanic' : 'client';
}

// Terjemahkan error Supabase Auth ke Bahasa Indonesia.
export function getAuthErrorMessage(error: unknown, fallback: string): string {
  const raw =
    (typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : '') || '';
  if (/invalid login credentials/i.test(raw)) return 'Email atau kata sandi salah.';
  if (/user already registered|already exists/i.test(raw)) return 'Email sudah terdaftar. Silakan login.';
  if (/email not confirmed/i.test(raw)) return 'Email belum diverifikasi. Cek inbox lalu login kembali.';
  if (/password should be at least/i.test(raw)) return 'Kata sandi minimal 6 karakter.';
  if (/invalid email/i.test(raw)) return 'Format email tidak valid.';
  if (/profile_identities_pkey|IDENTITY_ALREADY_SET/i.test(raw))
    return 'Nomor identitas sudah tersimpan dan bersifat permanen.';
  if (/profiles_identity_number_key|profile_identities_identity_number_key|IDENTITY_NUMBER_ALREADY_USED|duplicate key/i.test(raw))
    return 'Nomor identitas (KTP) sudah terdaftar. Gunakan nomor lain atau login.';
  if (/profiles_identity_number_format|profile_identities_identity_number_check|INVALID_IDENTITY_NUMBER/i.test(raw))
    return 'Nomor identitas (KTP) harus 16 digit angka.';
  if (/nomor identitas.*(permanen|tidak dapat diubah)/i.test(raw))
    return 'Nomor identitas (KTP) bersifat permanen dan tidak dapat diubah.';
  if (/network|fetch|failed/i.test(raw))
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet.';
  return raw || fallback;
}

/**
 * Baca profil + NIK dari tabel database (bukan metadata client).
 * Kegagalan jaringan/RLS melempar `SessionUnavailableError` agar layar retry tampil
 * alih-alih mempercayai role dari `user_metadata`.
 */
async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const run = () =>
    Promise.all([
      supabase
        .from('profiles')
        .select('role, full_name, phone_number')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('profile_identities')
        .select('identity_number')
        .eq('profile_id', userId)
        .maybeSingle(),
    ]);

  let [profileResult, identityResult] = await run();
  if (profileResult.error && isAuthError(profileResult.error)) {
    const session = await ensureFreshSession({ force: true });
    if (session) [profileResult, identityResult] = await run();
  }
  if (profileResult.error) {
    throw new SessionUnavailableError();
  }
  const row = profileResult.data as ProfileRow | null;
  if (!row) return null;
  return {
    ...row,
    identity_number:
      (identityResult.data as { identity_number?: string | null } | null)?.identity_number ?? null,
  };
}

type SessionUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/**
 * Susun AuthUser dari baris `profiles` (role selalu dari database).
 * Fallback metadata hanya digunakan sesaat setelah `signUp` bila trigger DB belum selesai.
 */
function toAuthUser(
  sessionUser: SessionUser,
  profile: ProfileRow | null,
  allowSignupMetadataFallback = false,
): AuthUser {
  const meta = (sessionUser.user_metadata ?? {}) as {
    full_name?: unknown;
    role?: unknown;
    identity_number?: unknown;
  };
  const metaRole = meta.role === 'mechanic' ? 'mechanic' : 'client';
  const role: DbRole = profile?.role ?? (allowSignupMetadataFallback ? metaRole : 'client');
  return {
    id: sessionUser.id,
    fullName:
      profile?.full_name?.trim() ||
      (typeof meta.full_name === 'string' ? meta.full_name : '') ||
      '',
    email: sessionUser.email ?? '',
    phoneNumber: profile?.phone_number ?? null,
    identityNumber:
      profile?.identity_number ??
      (allowSignupMetadataFallback && typeof meta.identity_number === 'string'
        ? meta.identity_number
        : null),
    role: toAppRole(role),
  };
}

export async function signIn(data: { email: string; password: string }): Promise<{ user: AuthUser }> {
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });
  if (error) throw error;
  if (!authData.user) throw new Error('Login gagal. Coba lagi.');
  const profile = await fetchProfile(authData.user.id);
  if (!profile) {
    throw new Error(
      'Profil tidak ditemukan di database. Pastikan migrasi SQL sudah dijalankan (trigger handle_new_user).',
    );
  }
  // Bersihkan sisa token backend lama (migrasi Express -> Supabase).
  await AsyncStorage.multiRemove(['montirgo_token', 'montirgo_user', 'montirgo_user_role']).catch(
    () => {},
  );
  clearSignedUrlCaches();
  return { user: toAuthUser(authData.user, profile) };
}

export async function signUp(data: {
  name: string;
  email: string;
  password: string;
  phone: string;
  identityNumber: string;
  role: UserRole;
}): Promise<{ user: AuthUser | null; needsConfirmation: boolean }> {
  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.name,
        phone: data.phone,
        identity_number: data.identityNumber,
        role: toDbRole(data.role),
      },
    },
  });
  if (error) throw error;
  // Jika verifikasi email aktif di Supabase, session null -> user harus login setelah verifikasi.
  if (!authData.session || !authData.user) {
    return { user: null, needsConfirmation: true };
  }
  const profile = await fetchProfile(authData.user.id).catch(() => null);
  await AsyncStorage.multiRemove(['montirgo_token', 'montirgo_user', 'montirgo_user_role']).catch(
    () => {},
  );
  clearSignedUrlCaches();
  const user = toAuthUser(authData.user, profile, true);
  return {
    user: {
      ...user,
      fullName: user.fullName || data.name,
      email: user.email || data.email,
      phoneNumber: user.phoneNumber ?? data.phone,
      identityNumber: user.identityNumber ?? data.identityNumber,
    },
    needsConfirmation: false,
  };
}

/**
 * Simpan nomor identitas untuk akun yang belum memilikinya (akun lama).
 * Hanya bisa diisi sekali melalui RPC atomik; nilai bersifat permanen.
 */
export async function setMyIdentityNumber(identityNumber: string): Promise<void> {
  const normalized = identityNumber.replace(/\D/g, '');
  if (!/^\d{16}$/.test(normalized)) {
    throw new Error('Nomor identitas (KTP) harus 16 digit angka.');
  }
  await getCurrentUserId();
  const { error } = await supabase.rpc('set_my_identity_number', {
    p_identity_number: normalized,
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await unregisterPushToken();
  await supabase.auth.signOut();
  clearSignedUrlCaches();
  await AsyncStorage.multiRemove(['montirgo_token', 'montirgo_user', 'montirgo_user_role']).catch(
    () => {},
  );
}

// Dipakai root index/_layout untuk routing berbasis sesi + role dari database.
export async function getSessionUser(): Promise<AuthUser | null> {
  const session = await readSession();
  if (!session?.user) return null;
  const profile = await fetchProfile(session.user.id);
  if (!profile) {
    throw new SessionUnavailableError();
  }
  return toAuthUser(session.user, profile);
}

export async function getAccessToken(): Promise<string | null> {
  const session = await readSession();
  return session?.access_token ?? null;
}

// Kompatibel dengan pemakaian useAuth() lama agar layar lain tidak perlu diubah logikanya.
export const useAuth = () => {
  return {
    login: signIn,
    register: signUp,
    getCurrentUser: getSessionUser,
    getAuthToken: getAccessToken,
    logout: signOut,
  };
};
