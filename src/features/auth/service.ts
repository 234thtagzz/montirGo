import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { AuthUser, DbRole, ProfileRow, UserRole } from './types';

export * from './types';

export function toAppRole(role: DbRole): UserRole {
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
  if (/network|fetch|failed/i.test(raw))
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet.';
  return raw || fallback;
}

/**
 * Profil bisa gagal dibaca karena RLS/jaringan tanpa berarti sesi tidak valid.
 * Kembalikan null agar pemanggil dapat memakai metadata auth sebagai cadangan
 * alih-alih menganggap pengguna sudah logout.
 */
async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, full_name, phone_number')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as ProfileRow | null) ?? null;
}

type SessionUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/**
 * Susun AuthUser dari baris `profiles`; bila baris belum ada / gagal dibaca,
 * pakai metadata yang ditulis saat sign-up supaya riwayat & pesanan tetap
 * dapat dimuat tanpa memaksa pengguna login ulang.
 */
function toAuthUser(sessionUser: SessionUser, profile: ProfileRow | null): AuthUser {
  const meta = (sessionUser.user_metadata ?? {}) as {
    full_name?: unknown;
    role?: unknown;
  };
  const metaRole = meta.role === 'mechanic' ? 'mechanic' : 'client';
  const role: DbRole = profile?.role ?? metaRole;
  return {
    id: sessionUser.id,
    fullName:
      profile?.full_name?.trim() ||
      (typeof meta.full_name === 'string' ? meta.full_name : '') ||
      '',
    email: sessionUser.email ?? '',
    phoneNumber: profile?.phone_number ?? null,
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
  if (!profile && !authData.user.user_metadata?.role) {
    throw new Error(
      'Profil tidak ditemukan di database. Pastikan migrasi SQL sudah dijalankan (trigger handle_new_user).',
    );
  }
  // Bersihkan sisa token backend lama (migrasi Express -> Supabase).
  await AsyncStorage.multiRemove(['montirgo_token', 'montirgo_user', 'montirgo_user_role']).catch(
    () => {},
  );
  return { user: toAuthUser(authData.user, profile) };
}

export async function signUp(data: {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
}): Promise<{ user: AuthUser | null; needsConfirmation: boolean }> {
  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.name,
        phone: data.phone,
        role: toDbRole(data.role),
      },
    },
  });
  if (error) throw error;
  // Jika verifikasi email aktif di Supabase, session null -> user harus login setelah verifikasi.
  if (!authData.session || !authData.user) {
    return { user: null, needsConfirmation: true };
  }
  const profile = await fetchProfile(authData.user.id);
  await AsyncStorage.multiRemove(['montirgo_token', 'montirgo_user', 'montirgo_user_role']).catch(
    () => {},
  );
  const user = toAuthUser(authData.user, profile);
  return {
    user: {
      ...user,
      fullName: user.fullName || data.name,
      email: user.email || data.email,
      phoneNumber: user.phoneNumber ?? data.phone,
    },
    needsConfirmation: false,
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await AsyncStorage.multiRemove(['montirgo_token', 'montirgo_user', 'montirgo_user_role']).catch(
    () => {},
  );
}

// Dipakai root index/_layout untuk routing berbasis sesi + role dari database.
export async function getSessionUser(): Promise<AuthUser | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;
  // Profil mungkin belum terbaca (RLS/jaringan). Sesi tetap dianggap valid dan
  // metadata auth dipakai sebagai cadangan agar layar tidak kosong.
  const profile = await fetchProfile(session.user.id);
  return toAuthUser(session.user, profile);
}

export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
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
