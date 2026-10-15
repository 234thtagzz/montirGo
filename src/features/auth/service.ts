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

async function fetchProfile(userId: string): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, full_name, phone_number')
    .eq('id', userId)
    .single();
  if (error || !data) {
    throw new Error(
      'Profil tidak ditemukan di database. Pastikan migrasi SQL sudah dijalankan (trigger handle_new_user).',
    );
  }
  return data as ProfileRow;
}

export async function signIn(data: { email: string; password: string }): Promise<{ user: AuthUser }> {
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });
  if (error) throw error;
  if (!authData.user) throw new Error('Login gagal. Coba lagi.');
  const profile = await fetchProfile(authData.user.id);
  // Bersihkan sisa token backend lama (migrasi Express -> Supabase).
  await AsyncStorage.multiRemove(['montirgo_token', 'montirgo_user', 'montirgo_user_role']).catch(
    () => {},
  );
  return {
    user: {
      id: authData.user.id,
      fullName: profile.full_name ?? '',
      email: authData.user.email ?? data.email,
      phoneNumber: profile.phone_number,
      role: toAppRole(profile.role),
    },
  };
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
  return {
    user: {
      id: authData.user.id,
      fullName: profile.full_name ?? data.name,
      email: authData.user.email ?? data.email,
      phoneNumber: profile.phone_number ?? data.phone,
      role: toAppRole(profile.role),
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
  try {
    const profile = await fetchProfile(session.user.id);
    return {
      id: session.user.id,
      fullName: profile.full_name ?? '',
      email: session.user.email ?? '',
      phoneNumber: profile.phone_number,
      role: toAppRole(profile.role),
    };
  } catch {
    return null;
  }
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
