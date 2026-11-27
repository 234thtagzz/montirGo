// Role di database (PRD §6): 'client' | 'mechanic' | 'admin'.
// Role di UI mobile: 'CLIENT' | 'MONTIR'. 'ADMIN' hanya dipakai untuk
// mendeteksi akun admin lalu mengarahkannya ke panel web (bukan role pilihan).
export type DbRole = 'client' | 'mechanic' | 'admin';
export type UserRole = 'CLIENT' | 'MONTIR' | 'ADMIN';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  /** Nomor identitas (KTP/NIK) 16 digit. */
  identityNumber?: string | null;
  role: UserRole;
}

export interface ProfileRow {
  role: DbRole;
  full_name: string | null;
  phone_number: string | null;
  identity_number?: string | null;
}
