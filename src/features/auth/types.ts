// Role di database (PRD §6): 'client' | 'mechanic' | 'admin'.
// Role di UI: 'CLIENT' | 'MONTIR'. Mapping dijaga di service agar satu pintu.
export type DbRole = 'client' | 'mechanic' | 'admin';
export type UserRole = 'CLIENT' | 'MONTIR';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  role: UserRole;
}

export interface ProfileRow {
  role: DbRole;
  full_name: string | null;
  phone_number: string | null;
}
