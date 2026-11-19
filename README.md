# montirGo

Aplikasi mobile layanan montir panggilan — client memesan montir, montir menerima
order, mengerjakan perbaikan, lalu membuat tagihan terperinci. Dibangun dengan
Expo Router, React Native, Supabase, dan TypeScript.

## Menjalankan

```bash
npm install
npm start        # sama dengan: npx expo start --go
```

Lalu buka **Expo Go** di HP dan pindai QR yang muncul. Proyek ini memakai Expo
SDK 58, jadi **Expo Go terbaru dari App Store / Play Store sudah cukup** —
development build tidak wajib.

### iPhone lewat Expo Go

1. **Login Expo di komputer (wajib untuk iPhone).** Expo Go di perangkat iOS
   hanya mau membuka project bila akun Expo Go dan Expo CLI sama. Jalankan
   `npm run login` (atau `npx expo login`), lalu masuk dengan akun yang tampil
   di Expo Go — mis. `alybaee`. Cek dengan `npx expo whoami`.
2. Pasang **Expo Go** dari App Store. Versi Expo Go saat ini mendukung SDK 58.
3. Pastikan iPhone dan komputer berada di jaringan Wi-Fi yang sama.
4. Jalankan `npm start`, lalu pindai QR dari aplikasi **Kamera** iOS.
5. Saat iOS menanyakan **Local Network**, pilih **Allow** — tanpa izin ini HP
   tidak bisa menghubungi Metro.
6. Bila QR tetap gagal terhubung (jaringan kantor, AP isolation, atau firewall
   Windows memblokir port 8081), jalankan `npm run start:tunnel`.

> Pesan *"You're signed in to Expo Go as ... but not signed in to Expo CLI"*
> berarti langkah 1 belum dilakukan. Cukup `npm run login`, lalu tekan
> **Try Again** di Expo Go — dev server tidak perlu di-restart.

Catatan Expo Go:

- Peta perjalanan memakai renderer WebView
  (`src/features/mechanic/components/trip/trip-map.tsx`), jadi tetap tampil
  tanpa Google Maps SDK / API key.
- Notifikasi lokal (banner saat aplikasi berjalan) berfungsi. Notifikasi push
  saat aplikasi ditutup butuh development build.
- Development build (`eas build --profile development` atau `npm run ios:build`)
  memerlukan `npx expo install expo-dev-client` lebih dulu. Tanpa paket itu
  `expo start` selalu memakai Expo Go.

## Skrip

| Skrip | Keterangan |
| --- | --- |
| `npm start` | Start dev server Expo Go |
| `npm run login` | Login Expo CLI lewat browser (akun harus sama dengan Expo Go) |
| `npm run start:tunnel` | Start via tunnel Expo (bila LAN tidak bisa diakses HP) |
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
- Database memiliki tiga role: `client`, `mechanic`, `admin`. Aplikasi mobile
  hanya menampilkan pilihan client/montir; akun admin diblokir di mobile dan
  hanya boleh memakai panel web `montirgo-admin`.
- Panduan deploy ada di [`DEPLOY.md`](./DEPLOY.md).
- Aturan kontribusi ada di [`AGENTS.md`](./AGENTS.md).
