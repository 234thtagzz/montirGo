# Sistem Pembayaran, Biaya Panggil, Komisi Cash & Dompet Montir

Dokumen ini menjelaskan seluruh alur uang di **MontirGo** agar konsisten, tahan race condition, dan dapat diaudit (*auditable ledger*).

---

## 1. Biaya Panggil Pasti & Persetujuan Estimasi Digital (`arrived`)

1. **Snapshot Biaya Panggil saat Request Dibuat**:
   - Client memilih tier `Motor` (`callout_fee_motor`, default `Rp25.000`), `Mobil` (`callout_fee_mobil`, default `Rp45.000`), atau `Derek` (`callout_fee_derek`, default `Rp100.000`) saat memanggil `create_service_request`.
   - Seluruh tarif biaya panggil wajib `>= min_order_price` (`Rp10.000`) dan di-snapshot ke kolom `service_requests.callout_fee_tier` dan `service_requests.callout_fee_amount` di server.
2. **Baris `callout_fee` Terkunci**:
   - Saat montir tiba (`transition_order_status('arrived')`), server otomatis membuat 1 baris `order_invoice_items` bertipe `callout_fee` (`is_locked = true`).
   - Baris ini selalu ditambahkan di atas rincian jasa/suku cadang dalam **1x pembayaran akhir** dan tidak dapat diubah atau dihapus montir (dilindungi RLS + trigger `trg_protect_order_invoice_items`).
3. **Persetujuan Estimasi & Biaya Tambahan**:
   - Montir mengirim estimasi via `submit_order_quote` (`quote_status: 'draft' -> 'pending_approval'`), opsional melampirkan maks 3 foto kerusakan di bucket privat `quote-photos`.
   - Client memilih:
     - **Setujui Estimasi** (`respond_to_quote('approve')`): menandai item aktif `approved_at = now()`, membuka pengerjaan. Jika ditemukan kerusakan tambahan di tengah perbaikan, montir mengajukan via `request_quote_addon` untuk persetujuan ulang client.
     - **Minta Revisi** (`respond_to_quote('request_revision', note)`): mengembalikan `quote_status = 'draft'`.
     - **Tolak & Bayar Biaya Panggil Saja** (`respond_to_quote('callout_only', note)`): menyimpan item ditolak ke `rejected_quote_snapshot`, melakukan soft-void (`voided_at = now()`) pada item non-`callout_fee`, mengunci tagihan ke `callout_fee_amount`, dan langsung memindahkan order ke `status = 'payment'`.
4. **Finalisasi & Buka Ulang Tagihan**:
   - `finalize_order_invoice` hanya boleh dipanggil jika `quote_status in ('approved', 'callout_only')` dan semua item aktif sudah ber-`approved_at`. Total `SUM(amount)` item aktif divalidasi dalam `[min_order_price, max_order_price]`.
   - `reopen_order_invoice` membatalkan `payments` `pending`, mereset status ke `arrived` dengan `quote_status = 'draft'`, dan mengosongkan `approved_at` item non-callout agar persetujuan client wajib diulang. `reopen_order_invoice` diblokir pada `quote_status = 'callout_only'` (`CALLOUT_ONLY_LOCKED`).
5. **Akuntansi `callout_only`**:
   - Memakai komisi platform standar (`fee_percent = 10%`) dan jalur pembayaran Xendit / tunai yang sama.
   - `complaints` dan `reviews` tetap terbuka untuk kedua pihak.
   - Dikecualikan dari increment `mechanic_profiles.total_jobs` di `refresh_mechanic_jobs` karena perbaikan tidak dilakukan.

---

## 2. Pembayaran Online (Xendit Payment Sessions)

1. Client memilih bayar online → `choose_payment_method(request_id, 'online')` → memanggil Edge Function `xendit-create-payment`.
2. `xendit-create-payment`:
   - Menghitung `fee_percent` secara aman via `parseFeePercent` (menghindari bug `"" -> 0%`).
   - Memeriksa apakah ada sesi `pending` yang masih berlaku **dengan `amount` yang sama**.
   - Menyisipkan baris baru di `payments` (`status = 'pending'`, dijamin unik per order oleh index parsial `payments_one_pending_per_request`) sebelum memanggil `POST /sessions` Xendit dengan header `idempotency-key: <payment.id>`.
3. Pelunasan dapat terjadi dari salah satu jalur yang **sama-sama memanggil `finalize_payment(p_payment_id)` secara idempoten**:
   - **Webhook (`xendit-webhook`)**: Memverifikasi `x-callback-token` dengan `timingSafeEqual`, memvalidasi `request_amount` & `currency === 'IDR'`, mencatat event idempoten di `payment_events`, lalu menjalankan `finalize_payment`.
   - **Sinkronisasi (`xendit-sync-payment`)**: Dipanggil saat client kembali dari browser checkout, fokus layar, atau tombol cek status (dengan backoff 15s → 30s → 60s), memverifikasi langsung `GET /sessions/{id}` ke Xendit.

---

## 3. Pembayaran Tunai (Cash) & Komisi Platform (`commission_debt`)

1. Client memilih tunai (`choose_payment_method(request_id, 'cash')`).
2. Setelah menerima uang tunai, montir menekan konfirmasi → memanggil Edge Function **`confirm-cash-payment`** (bukan RPC langsung):
   - **Anti-Double-Charge Guard**: Jika ada `payments` berstatus `pending` dengan `payment_session_id`, server memeriksa `GET /sessions/{id}` ke Xendit terlebih dahulu. Jika ternyata client sudah membayar online (`COMPLETED`), server menuntaskan order sebagai **online (`finalize_payment`)** dan menolak pencatatan cash ganda (`HTTP 409 ALREADY_PAID_ONLINE`).
   - Jika belum dibayar online, server memanggil RPC `confirm_cash_payment(request_id, mechanic_id)` (`service_role` only).
3. **Pemotongan Komisi 10% pada Pembayaran Tunai**:
   - Pendapatan dicatat di `earnings` dengan `status = 'settled_cash'`, `payment_method = 'cash'`.
   - Komisi platform (`platform_fee`) dipotong otomatis:
     - Sebanyak mungkin dari `mechanic_wallets.available_balance`.
     - Sisa yang belum tertutupi masuk ke `mechanic_wallets.commission_debt`.
   - Jika `commission_debt >= max_cash_commission_debt` (default `Rp100.000`), montir **diblokir menerima order baru** (`accept_service_request` melempar `COMMISSION_DEBT_LIMIT_EXCEEDED`) sampai utang komisi berkurang lewat order online berikutnya atau top-up admin (`record_commission_topup`).

---

## 4. Dompet Montir & Auditable Ledger (`wallet_transactions`)

`mechanic_wallets` memiliki 4 bucket terpisah:
- `pending_balance`: pendapatan order online yang masih dalam masa tahan (`hold_days`, default 2 hari).
- `available_balance`: saldo siap ditarik.
- `held_balance`: saldo yang sedang ditahan selama proses payout Xendit.
- `commission_debt`: kewajiban komisi platform dari order tunai.

Setiap mutasi di `wallet_transactions` wajib mencantumkan:
- `bucket`: `'pending' | 'available' | 'held' | 'commission_debt'`
- `amount`: bertanda (`+` untuk penambahan bucket, `-` untuk pengurangan bucket)
- `balance_after`: saldo akhir **bucket tersebut** setelah transaksi.

Invariant audit: untuk setiap `(mechanic_id, bucket)`, `SUM(amount) == mechanic_wallets.<bucket>`.

---

## 5. Settlement & Payout (Xendit v3)

1. **Pelepasan Saldo Matang (`release_matured_earnings`)**:
   - Dijalankan terjadwal setiap 15 menit via `pg_cron` (batch maks 200 baris dengan `FOR UPDATE SKIP LOCKED`), dan secara spesifik per montir saat montir memanggil `refresh_my_wallet` atau mengajukan penarikan.
   - Saat saldo matang keluar dari `pending_balance`, sistem **otomatis melunasi `commission_debt` terlebih dahulu** (`commission_debt_offset`) sebelum mengkredit sisanya ke `available_balance`.
2. **Penarikan Saldo (`xendit-request-withdrawal`)**:
   - Montir dengan `commission_debt > 0` wajib melunasi utang komisinya sebelum menarik dana.
   - RPC `request_withdrawal` (`service_role` only) memindahkan dana `available_balance -> held_balance` dan membuat baris `withdrawals` (`status = 'requested'`).
   - Edge Function memanggil `POST /v3/payouts` dengan `idempotency-key: withdrawal.id` (timeout 15 detik):
     - Jika Xendit menolak secara **deterministik** (`4xx` non-408/429) → panggil `settle_withdrawal('failed')` dan refund ke `available_balance`.
     - Jika terjadi error **ambigu** (timeout, network error, `5xx`, `429`) → **JANGAN auto-refund**; tandai `processing` (HTTP 202) agar diselesaikan oleh webhook atau rekonsiliasi.
3. **Webhook & Rekonsiliasi (`xendit-payout-webhook` & `xendit-sync-withdrawal`)**:
   - `xendit-payout-webhook` tetap mengeksekusi `settle_withdrawal` jika event duplikat (`23505`) diterima untuk `withdrawals` yang belum berstatus terminal.
   - `xendit-sync-withdrawal` memeriksa langsung `GET /v3/payouts/{id}` ke Xendit untuk menyelesaikan withdrawal yang menggantung.
