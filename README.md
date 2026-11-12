# montirGo

Aplikasi mobile layanan montir panggilan — client memesan montir, montir menerima
order, mengerjakan perbaikan, lalu membuat tagihan terperinci. Dibangun dengan
Expo Router, React Native, Supabase, dan TypeScript.

## Menjalankan

```bash
npm install
npx expo start
```

Butuh development build (`npx expo run:android` / `npx expo run:ios`) karena
proyek memakai modul native seperti maps, notifikasi, dan webview.

## Skrip

| Skrip | Keterangan |
| --- | --- |
| `npm start` | Start dev server Expo |
| `npm run android` / `npm run ios` / `npm run web` | Jalankan di platform tertentu |
| `npm run lint` | ESLint (`expo lint`) |
| `npx tsc --noEmit` | Typecheck |
| `npm run supabase:push` | Terapkan migrasi database |
| `npm run supabase:deploy` | Deploy semua Edge Function |
| `npm run supabase:check` | Typecheck Edge Function (Deno) |
| `npm run supabase:verify` | Verifikasi fungsi AI |

## Struktur

```
src/
  app/          Route Expo Router (client, mechanic, auth)
  components/   Komponen UI bersama
  features/     Logika per fitur (auth, orders, mechanic, finance, AI, ...)
  constants/    Token brand & gaya global
  lib/          Klien Supabase, realtime, helper
supabase/
  functions/    Edge Function (AI, pembayaran Xendit, webhook)
  migrations/   Migrasi database
```

## Catatan

- Konfigurasi native diatur lewat `app.json` + `app.config.ts`. Jangan edit
  `android/` atau `ios/` secara manual.
- Panduan deploy ada di [`DEPLOY.md`](./DEPLOY.md).
- Aturan kontribusi ada di [`AGENTS.md`](./AGENTS.md).
