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

```bash
npm run supabase:verify
```

Harus muncul `OK ... aktif` untuk kedua fungsi. Selama masih `404 NOT_FOUND`,
aplikasi akan menampilkan *"Fitur AI belum aktif di server (Edge Function tidak
ditemukan)"*.

Alternatif tanpa CLI (kalau `supabase login` tidak bisa):

1. Dashboard → **Edge Functions** → **Deploy a new function**.
2. Slug: `analyze-request`, tempel isi
   `supabase/functions/analyze-request/index.ts`, deploy.
3. Ulangi untuk slug `ai-assistant` dengan file
   `supabase/functions/ai-assistant/index.ts`.
4. Pastikan **Verify JWT** aktif untuk keduanya.

Setelah deploy, uji ulang:

- Analisis: buat request baru dari akun client; kartu "Analisis AI" harus terisi.
- Chat: buka tab **AI Asisten** sebagai montir, kirim pertanyaan.

## 5. Pembayaran Xendit (status lunas otomatis)

Migrasi pembayaran/dompet wajib diterapkan lebih dulu:

- `20261024000000_xendit_payments_wallets.sql` — tabel pembayaran, dompet,
  `set_order_price`, `finalize_payment`, pencairan, dan realtime.

Deploy semua function pembayaran:

```bash
npx supabase functions deploy xendit-create-payment
npx supabase functions deploy xendit-sync-payment
npx supabase functions deploy xendit-webhook --no-verify-jwt
npx supabase functions deploy xendit-request-withdrawal
npx supabase functions deploy xendit-payout-webhook --no-verify-jwt
```

Secret yang dibutuhkan:

```bash
npx supabase secrets set \
  XENDIT_SECRET_KEY=<secret-key-xendit> \
  XENDIT_WEBHOOK_TOKEN=<verification-token-dashboard-xendit> \
  XENDIT_PAYOUT_WEBHOOK_TOKEN=<token-payout> \
  APP_PAYMENT_RETURN_URL=https://montirgo.app/payment-return \
  PLATFORM_FEE_PERCENT=10
```

`XENDIT_WEBHOOK_TOKEN` **harus sama** dengan *Webhook Verification Token* di
Dashboard Xendit. Bila belum di-set, function webhook membalas `500` dengan
pesan `XENDIT_WEBHOOK_TOKEN belum di-set di server`.

Daftarkan URL webhook di Dashboard Xendit:

- **Payment session** → `https://biifjpuvbwdwrstkatem.supabase.co/functions/v1/xendit-webhook`
- **Payout** → `https://biifjpuvbwdwrstkatem.supabase.co/functions/v1/xendit-payout-webhook`

Verifikasi alur pembayaran:

1. Montir mengirim tagihan → order berstatus **Menunggu pembayaran**.
2. Client menekan **Bayar Sekarang** dan menyelesaikan pembayaran.
3. Kembali ke aplikasi: status order berubah menjadi **Lunas** di sisi client
   dan montir, saldo pending montir bertambah.

Bila webhook belum terdaftar atau telat, aplikasi tetap menyinkronkan status
langsung ke Xendit lewat `xendit-sync-payment` (dipanggil otomatis saat layar
order/pembayaran dibuka dan setiap beberapa detik selama status masih
`payment`).

## 6. Restart aplikasi

```bash
npx expo start --clear
```

## Troubleshooting

- **Muncul "Edge Function returned a non-2xx status code"** — ini bukan bug kode
  AI, melainkan respons server. Cek dulu `npm run supabase:verify`:
  - `404` → fungsi belum dideploy (penyebab paling umum).
  - `401` → fungsi sudah ada, tapi sesi login di aplikasi kedaluwarsa.
  - `500` dengan pesan `AI_PROVIDER_API_KEY` → secret belum di-set.
- **VS Code menandai error `Deno` / import `npm:` di `supabase/functions`**
  Folder itu berjalan di Deno, bukan bundler React Native. Install ekstensi
  **Deno** (`denoland.vscode-deno`); pengaturan `deno.enablePaths` sudah ada di
  `.vscode/settings.json`, dan `supabase/functions/deno.json` menyediakan
  compiler options-nya. Cek tipe dengan `npm run supabase:check`.
- **Fungsi balas 404** berarti belum dideploy (atau salah nama project).
- **Fungsi balas 500 "AI_PROVIDER_API_KEY belum di-set"** berarti secret belum
  terpasang — ulangi langkah 3.
- **`db push` menolak riwayat migrasi** — pakai SQL Editor seperti di langkah 2.

## Verifikasi alur request

1. Client membuat request baru → status **Mencari montir**.
2. Akun montir membuka tab **Request** → request terlihat.
3. Montir menekan **Terima Order** → request hilang dari tab Request dan muncul
   di **Beranda > Order aktif** milik montir tersebut.
4. Akun montir lain tidak lagi melihat request itu.

# Peta & lokasi

Layar perjalanan montir punya dua renderer peta (lihat `MAP_RENDERER` di
`src/features/mechanic/components/trip/trip-map.tsx`):

- **`webview` (default)** — Leaflet + tile OpenStreetMap di dalam WebView.
  Jalan di **Expo Go** maupun development build, tanpa Google Maps SDK/key.
  Tidak perlu langkah tambahan; cukup `npx expo start`.
- **`google`** — `react-native-maps` native. Lebih halus, tetapi **hanya tampil
  di development build**: Expo Go tidak lagi mendukung Google Maps di Android
  sejak SDK 52 (`MapView` ter-mount tapi petak peta kosong/hitam).

## Rute & ETA (Google Cloud)

Rute + ETA memakai key di `.env.local`:

```bash
EXPO_PUBLIC_MAPS_API_KEY=AIza...
```

Di Google Cloud, pada project key tersebut:
- aktifkan **Maps SDK for Android** (hanya untuk renderer `google`),
- aktifkan **Routes API** untuk rute + ETA (kode otomatis jatuh ke
  **Directions API** lama bila yang aktif justru itu),
- aktifkan billing, lalu batasi key ke API tersebut.

Tanpa key/routing aktif, aplikasi tetap berjalan: rute digambar sebagai garis
lurus putus-putus dan ETA memakai estimasi 25 km/jam (chip "Rute estimasi"
muncul di atas peta).

## Tile peta (opsional)

Default memakai tile OpenStreetMap. Untuk produksi ganti ke penyedia ber-SLA:

```bash
EXPO_PUBLIC_MAP_TILE_URL=https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=xxx
EXPO_PUBLIC_MAP_TILE_ATTRIBUTION=&copy; MapTiler &copy; OpenStreetMap contributors
```

## Development build (hanya untuk renderer `google`)

```bash
npx expo run:android      # build lokal, butuh JDK 17+ & Android SDK
# atau
npx eas-cli build --profile development --platform android
```

Build lokal di Windows butuh environment berikut (sesuaikan path):

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-25.0.4.101-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npx expo run:android
```

Setelah pindah ke dev build, `npm run android` juga menjalankan
`expo run:android`. SHA-1 debug keystore (untuk membatasi key per aplikasi)
bisa dilihat dengan:

```powershell
keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android
```


# Verifikasi alur perjalanan montir

1. Montir menerima request → langsung masuk layar perjalanan.
2. Tekan **Mulai Perjalanan** → status `on_the_way`, posisi mulai dikirim ke
   `mechanic_locations` (butuh migration `20261031000000_mechanic_trip_tracking.sql`
   sudah di-push).
3. Peta mengikuti posisi; sheet menampilkan sisa waktu, jarak, dan jam tiba.
4. Di sekitar lokasi client, muncul penanda "Kamu sudah dekat lokasi client".
5. Tekan **Sampai di Lokasi** → status `arrived`, layar pindah ke detail order.
