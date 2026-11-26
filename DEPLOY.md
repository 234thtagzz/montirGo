# Panduan Deploy & Setup Supabase MontirGo

> Panduan lengkap pemisahan environment (`Local -> Staging -> Production`), aturan migrasi CLI, setup database webhook, dan rilis mobile kini tersedia di [`docs/development-and-deploy.md`](./docs/development-and-deploy.md).

## Ringkasan Cepat

### 1. Login & Link ke Project Target (Staging / Production)

Gunakan **Staging** terlebih dahulu sebelum Production:

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
```

### 2. Terapkan Migrasi Database (Wajib via CLI)

> **Penting**: Jangan menyalin-tempel SQL secara manual ke SQL Editor untuk menghindari *migration drift*. Selalu gunakan Supabase CLI.

```bash
npx supabase db push
```

### 3. Pasang Secrets Server-Side

Siapkan `supabase/.env` dari [`supabase/.env.example`](./supabase/.env.example), lalu kirim ke server:

```bash
npx supabase secrets set --env-file supabase/.env
```

Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY`, `XENDIT_SECRET_KEY`, atau `AI_PROVIDER_API_KEY` di `.env` mobile maupun memakai prefix `EXPO_PUBLIC_`.

### 4. Deploy Seluruh Edge Functions

Pastikan seluruh pemeriksaan lokal lulus lebih dulu sebelum deploy:

```bash
npm run supabase:check
npm run supabase:test:functions
npm run test:backend
npm run supabase:deploy
```

Verifikasi cepat fungsi AI:

```bash
npm run supabase:verify
```

### 5. Konfigurasi Webhook Eksternal & Database

- **Xendit Dashboard** (Test Mode untuk Staging, Live Mode untuk Production):
  - Payment Session Webhook → `https://<PROJECT_REF>.supabase.co/functions/v1/xendit-webhook`
  - Payout Webhook → `https://<PROJECT_REF>.supabase.co/functions/v1/xendit-payout-webhook`
- **Supabase Database Webhook** (untuk Push Notification):
  - Tabel `public.notifications`, event `INSERT` → `https://<PROJECT_REF>.supabase.co/functions/v1/send-push-notification`
  - Header: `x-webhook-secret: <PUSH_WEBHOOK_SECRET>`

### 6. Akun Admin (Web-Only)

Role `admin` tidak pernah bisa dibuat lewat registrasi aplikasi mobile. Untuk mempromosikan akun admin pertama, gunakan SQL Editor atau `service_role` dengan RPC:

```sql
select public.set_user_role('<USER_UUID>', 'admin');
```

## Dokumentasi Terkait

- [`docs/architecture.md`](./docs/architecture.md)
- [`docs/order-state-machine.md`](./docs/order-state-machine.md)
- [`docs/database-and-rls.md`](./docs/database-and-rls.md)
- [`docs/payments-and-wallet.md`](./docs/payments-and-wallet.md)
- [`docs/development-and-deploy.md`](./docs/development-and-deploy.md)
