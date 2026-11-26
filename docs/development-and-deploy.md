# Panduan Development, Migrasi & Deploy

Dokumen ini mengatur alur kerja pengembangan lokal, pemisahan environment (`Local -> Staging -> Production`), aturan migrasi database, serta build native mobile.

---

## 1. Environment & Kebijakan Secret

Proyek memisahkan **3 environment**:
1. **Local**: Supabase berjalan di Docker lokal (`npx supabase start`), memakai `.env.local` (untuk Expo) dan `supabase/.env` (untuk Edge Functions lokal).
2. **Staging**: Project Supabase khusus staging + Xendit Test Mode API key + Webhook Staging.
3. **Production**: Project Supabase live + Xendit Live Key.

> **Aturan Keras Secret**:
> - `.env` / `.env.local` di root proyek **HANYA** boleh berisi variabel `EXPO_PUBLIC_*` (lihat `.env.example`).
> - Secret server (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `AI_PROVIDER_API_KEY`, `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`, `PUSH_WEBHOOK_SECRET`, `EXPO_ACCESS_TOKEN`) **TIDAK BOLEH** ditaruh di `.env` mobile root. Untuk lokal simpan di `supabase/.env` (lihat `supabase/.env.example`); untuk Staging/Prod pasang lewat `npx supabase secrets set`.

---

## 2. Setup Supabase Lokal & Testing

Prasyarat: **Docker Desktop** berjalan + **Node.js 20+**.

```bash
# 1. Jalankan container Supabase lokal (Postgres + PostGIS + Auth + Storage + Realtime + Edge Runtime)
npm run supabase:start

# 2. Terapkan seluruh migrasi dari nol dan isi akun uji dari supabase/seed.sql
npm run supabase:reset

# 3. Jalankan Edge Functions lokal untuk menguji AI, checkout/payout Xendit, & cash guard
npx supabase functions serve --env-file supabase/.env.local

# 4. Hasilkan ulang type TypeScript database jika ada perubahan skema
npm run supabase:types

# 5. Jalankan seluruh cek statis & automated test suite (juga dijalankan otomatis di .github/workflows/ci.yml pada branch main & dapin/**)
npx tsc --noEmit
npm run lint
npm run supabase:check
npm run supabase:test:functions
npm run test:backend
```

Akun uji bawaan di `supabase/seed.sql` (password semua akun: `Password123!`):
- Admin: `admin@montirgo.test`
- Client 1 & 2: `client1@montirgo.test`, `client2@montirgo.test`
- Montir Terverifikasi 1 & 2: `mechanic1@montirgo.test`, `mechanic2@montirgo.test`
- Montir Belum Verifikasi: `mechanic_unverified@montirgo.test`

---

## 3. Aturan Migrasi Database (Dilarang Edit Manual SQL Editor)

- **Selalu gunakan CLI** (`npx supabase migration new <nama_migrasi>` atau buat file timestamped baru di `supabase/migrations/`).
- **Dilarang keras** mengubah tabel/policy/RPC langsung lewat SQL Editor di Dashboard Staging/Production, karena menyebabkan *migration drift*.
- Setiap perubahan yang sudah di-merge ke `main` tidak boleh mengedit file migrasi lama; buat migrasi baru yang bersifat idempotent.
- Sebelum push ke Production, setiap migrasi wajib lolos `npm run supabase:reset` + `npm run test:backend` di Local dan `npx supabase db push` di Staging.

---

## 4. Deploy ke Staging / Production

```bash
# 1. Link ke project target (Staging lebih dulu!)
npx supabase link --project-ref <PROJECT_REF>

# 2. Push migrasi DB
npx supabase db push

# 3. Set secrets server (sekali / saat ada key baru)
npx supabase secrets set --env-file supabase/.env

# 4. Deploy seluruh Edge Functions
npm run supabase:deploy
```

Di **Supabase Dashboard → Database → Webhooks** (Staging/Prod):
- Buat webhook pada `INSERT` tabel `public.notifications` → HTTP POST ke `<SUPABASE_URL>/functions/v1/send-push-notification` dengan header `x-webhook-secret: <PUSH_WEBHOOK_SECRET>`.

Di **Xendit Dashboard** (Test Mode untuk Staging, Live Mode untuk Prod):
- Payment Session webhook → `<SUPABASE_URL>/functions/v1/xendit-webhook`
- Payout webhook → `<SUPABASE_URL>/functions/v1/xendit-payout-webhook`

---

## 5. Build Mobile (EAS Development Build & Debugging ADB)

Fitur **Remote Push Notification (FCM/APNs)** dan **Background GPS Tracking** membutuhkan Development/Production build (Expo Go tetap berjalan dengan *graceful degradation* untuk UI/alur non-native):

```bash
# Install dependencies dengan resolver SDK Expo
npx expo install <package>

# Build Development Client Android via EAS atau lokal
npx eas-cli@latest build --profile development --platform android
# atau lokal (butuh JDK 17 + Android SDK):
npx expo run:android
```

Pemantauan live dan uji E2E 2 perangkat lewat ADB terhadap stack Supabase lokal:
```bash
adb devices
adb -s <SERIAL> reverse tcp:54321 tcp:54321
adb -s <SERIAL> reverse tcp:8082 tcp:8082
npx expo start --dev-client --port 8082
adb -s <SERIAL> logcat -d -s ReactNativeJS:W ReactNativeJS:E AndroidRuntime:E
```

> **Catatan Build Android (`AAPT2`)**: nama file aset suara notifikasi di `assets/sounds/` wajib huruf kecil dan garis bawah saja tanpa tanda hubung (`-`), mis. `montirgo_alert.mp3`, agar resource Android valid saat prebuild/Gradle.
