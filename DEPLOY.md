# Deploy Supabase (wajib sekali)

Perbaikan alur request dan fitur AI membutuhkan dua hal di project Supabase:
migrasi database dan deploy Edge Function. Jalankan dari root project.

## 1. Login & link project

```bash
npx supabase login
npx supabase link --project-ref biifjpuvbwdwrstkatem
```

Saat `link`, masukkan password database project (Supabase Dashboard >
Project Settings > Database).

## 2. Terapkan migrasi

Cara cepat (cukup satu file, sudah mencakup policy + view + RPC):

1. Buka **Supabase Dashboard > SQL Editor > New query**.
2. Copy seluruh isi `supabase/migrations/20261023000000_fix_request_accept_flow.sql`.
3. Klik **Run**.

Atau lewat CLI (akan menjalankan semua migrasi yang belum tercatat):

```bash
npx supabase db push
```

Migrasi yang relevan:

- `20261015000001_mechanic_actions.sql` — policy montir menerima/memajukan order
- `20261019000000_client_home.sql` — direktori montir online
- `20261022000000_request_ai_analysis.sql` — view request terbuka + akses AI
- `20261023000000_fix_request_accept_flow.sql` — RPC ambil order atomik + perbaikan view

Jika `db push` menolak karena riwayat migrasi remote tidak cocok, gunakan cara
SQL Editor di atas (file migrasi idempotent, aman dijalankan ulang).

## 3. Set secret AI (Groq)

```bash
npx supabase secrets set AI_PROVIDER_API_KEY=<key-groq-anda> AI_PROVIDER_MODEL=openai/gpt-oss-120b AI_PROVIDER_BASE_URL=https://api.groq.com/openai/v1
```

Gunakan key dari `.env.local` (`AI_PROVIDER_API_KEY`). Jangan pernah memakai
prefix `EXPO_PUBLIC_` untuk key ini.

## 4. Deploy Edge Function

```bash
npx supabase functions deploy analyze-request
npx supabase functions deploy ai-assistant
```

Cek cepat bahwa function sudah hidup:

- Analisis: buat request baru dari akun client; kartu "Analisis AI" harus terisi.
- Chat: buka tab **AI Asisten** sebagai montir, kirim pertanyaan.

## 5. Restart aplikasi

```bash
npx expo start --clear
```

## Verifikasi alur request

1. Client membuat request baru → status **Mencari montir**.
2. Akun montir membuka tab **Request** → request terlihat.
3. Montir menekan **Terima Order** → request hilang dari tab Request dan muncul
   di **Beranda > Order aktif** milik montir tersebut.
4. Akun montir lain tidak lagi melihat request itu.
