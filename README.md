# montirGo

Aplikasi mobile layanan montir panggilan — client memesan montir terdekat (PostGIS matching), memantau perjalanan secara real-time, memeriksa rincian tagihan terperinci, membayar lewat QRIS / e-wallet Xendit maupun tunai langsung, memberi rating & ulasan, mengajukan keluhan, serta berkonsultasi dengan Asisten AI otomotif. Dibangun dengan Expo Router, React Native, Supabase, dan TypeScript.

## Menjalankan

### 1. Supabase Lokal (Docker) & Edge Functions

Prasyarat: **Docker Desktop** berjalan + **Node.js 20+**.

```bash
npm install
npm run supabase:start     # jalankan Postgres + PostGIS + Auth + Storage + Realtime
npm run supabase:reset     # terapkan semua migrasi & seed akun uji (supabase/seed.sql)
npx supabase functions serve --env-file supabase/.env.local
```

> Variabel environment mobile disiapkan di `.env.local` (contoh: [`.env.example`](./.env.example)), sedangkan secret server Edge Functions disimpan di `supabase/.env.local` / `supabase/.env` (contoh: [`supabase/.env.example`](./supabase/.env.example)).

### 2. Aplikasi Mobile (Development Build vs Expo Go)

Proyek sudah memasang `expo-dev-client` dan mengonfigurasi plugin native di `app.json` + `app.config.ts` (`expo-location` foreground service & background tracking, `expo-secure-store`, `expo-image`, `expo-web-browser`, serta custom sound notifikasi).

- **Development Build (disarankan untuk E2E penuh: push notification FCM/APNs, suara notifikasi custom, & background GPS tracking)**:

  ```bash
  npx eas-cli@latest build --profile development --platform android
  npx expo start --dev-client --port 8082
  ```

  Untuk pengujian 2 perangkat sekaligus (mis. HP Android Client + Android Emulator Montir via ADB):

  ```bash
  adb -s <SERIAL_PERANGKAT> reverse tcp:54321 tcp:54321
  adb -s <SERIAL_PERANGKAT> reverse tcp:8082 tcp:8082
  ```

- **Expo Go** (`npm start` / `npm run start:tunnel`): tetap dapat digunakan untuk pengembangan UI non-native (peta memakai renderer WebView + tile OpenStreetMap sehingga tetap tampil tanpa Google Maps native SDK, dan notifikasi berjalan lewat banner lokal saat aplikasi terbuka).

### iPhone lewat Expo Go

1. **Login Expo di komputer (wajib untuk iPhone).** Expo Go di perangkat iOS hanya mau membuka project bila akun Expo Go dan Expo CLI sama. Jalankan `npm run login` (atau `npx expo login`), lalu cek dengan `npx expo whoami`.
2. Pasang **Expo Go** dari App Store (mendukung SDK 58).
3. Pastikan iPhone dan komputer berada di jaringan Wi-Fi yang sama, jalankan `npm start`, lalu pindai QR dari **Kamera** iOS.
4. Izinkan akses **Local Network** saat diminta iOS. Bila jaringan memblokir port Metro, gunakan `npm run start:tunnel`.

## Skrip

| Skrip | Keterangan |
| --- | --- |
| `npm start` | Start dev server Expo Go (`npx expo start --go`) |
| `npm run start:tunnel` | Start via tunnel Expo (bila LAN diblokir) |
| `npm run login` | Login Expo CLI lewat browser |
| `npm run android` / `npm run ios` / `npm run web` | Jalankan Expo Go di platform tertentu |
| `npm run android:build` / `npm run ios:build` | Build native lokal (`expo run:android` / `expo run:ios`) |
| `npm run lint` | ESLint (`expo lint`) |
| `npx tsc --noEmit` | Typecheck TypeScript aplikasi mobile |
| `npm run supabase:start` / `supabase:stop` | Kelola stack Supabase lokal (Docker) |
| `npm run supabase:reset` | Reset DB lokal, terapkan migrasi, dan seed data uji |
| `npm run supabase:types` | Regenerasi `src/lib/database.types.ts` dari skema lokal |
| `npm run supabase:push` | Terapkan migrasi database ke project target |
| `npm run supabase:deploy` | Deploy seluruh 10 Edge Functions |
| `npm run supabase:check` | Typecheck semua Edge Functions (Deno) |
| `npm run supabase:test:functions` | Jalankan unit test Edge Functions (Deno) |
| `npm run supabase:verify` | Verifikasi fungsi AI terhadap server target |
| `npm run test:backend` | Jalankan test integrasi RLS, state machine, & ledger backend |

## Struktur

```
.github/workflows/ci.yml  Pipeline CI (tsc, lint, Deno check/test, Supabase RLS & ledger tests)
assets/sounds/            Suara alert notifikasi custom (montirgo_alert.mp3 / _ios.aiff)
docs/                     Dokumentasi arsitektur, DB/RLS, state machine, pembayaran, & deploy
src/
  app/                    Route Expo Router (client, mechanic, auth)
  components/             Komponen UI bersama
  features/               Logika per fitur (auth, service-request, mechanic, finance, ai-assistant, ...)
  constants/              Token brand & gaya global
  lib/                    Klien Supabase, SecureStore, realtime resync, helper
supabase/
  functions/              10 Edge Functions (AI, pembayaran & payout Xendit, cash guard, webhook, push)
  migrations/             Migrasi SQL bertimestamp (schema hardening, PostGIS, ledger, triggers)
  tests/                  Test integrasi backend Node (`rls_and_workflow.test.mjs`)
  seed.sql                Data awal & akun uji lokal
```

## Dokumentasi

- [`DEPLOY.md`](./DEPLOY.md) — Panduan ringkas deploy Supabase, secrets, & webhook
- [`docs/architecture.md`](./docs/architecture.md) — Arsitektur sistem & trust boundaries
- [`docs/order-state-machine.md`](./docs/order-state-machine.md) — 8 status resmi order & aturan transisi
- [`docs/database-and-rls.md`](./docs/database-and-rls.md) — Skema database, views, trigger, & matriks RLS
- [`docs/payments-and-wallet.md`](./docs/payments-and-wallet.md) — Tagihan, Xendit checkout/payout, cash & `commission_debt`
- [`docs/development-and-deploy.md`](./docs/development-and-deploy.md) — Pemisahan environment, migrasi CLI, EAS build & ADB
- [`docs/design/tokens.md`](./docs/design/tokens.md) — Token desain 3 lapis, palet Light/Dark WCAG AA, & tipografi
- [`docs/design/components.md`](./docs/design/components.md) — Katalog primitif UI (`src/components/ui/`)
- [`docs/design/patterns.md`](./docs/design/patterns.md) — Pola UX Action-First, 3-Tap, sinyal lemah, & Dark Mode peta
- [`docs/design/guardrails.md`](./docs/design/guardrails.md) — Guardrail ESLint Zero Hardcode & ratchet migrasi
- [`AGENTS.md`](./AGENTS.md) — Aturan pengembangan Expo / React Native

## Catatan

- Konfigurasi native diatur lewat [`app.json`](./app.json) + [`app.config.ts`](./app.config.ts). Jangan membuat atau mengedit folder `android/` maupun `ios/` secara manual.
- Database memiliki tiga role (`client`, `mechanic`, `admin`). Aplikasi mobile hanya menampilkan pilihan `client`/`mechanic`; akun `admin` diblokir di mobile dan khusus panel web `montirgo-admin`.
