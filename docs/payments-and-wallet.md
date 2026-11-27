# Sistem Pembayaran, Komisi Cash & Dompet Montir

Dokumen ini menjelaskan seluruh alur uang di **MontirGo** agar konsisten, tahan race condition, dan dapat diaudit (*auditable ledger*).

---

## 1. Alur Tagihan & Revisi

1. Setelah tiba di lokasi (`status = 'arrived'`), montir mengisi baris rincian pada `order_invoice_items` (`description`, `amount`).
2. Montir memanggil RPC `finalize_order_invoice(p_request_id)` yang menghitung total `SUM(amount)` di server, memvalidasi rentang `[min_order_price, max_order_price]`, dan mengubah status order menjadi `payment`.
3. Jika montir salah menginput tagihan sebelum dibayar, montir dapat memanggil RPC `reopen_order_invoice(p_request_id)` yang:
   - Memastikan belum ada pembayaran `paid`.
   - Membatalkan baris `payments` yang masih `pending`.
   - Mengembalikan order ke `arrived` agar rincian dapat diubah lalu dikirim ulang.

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
   - **Anti-Double-Charge Guard**: Jika ada `payments` berstatus `pending` dengan `payment_session_id`, server memeriksa `GET /sessions/{id}` ke Xendit terlebih dahulu. Jika ternyata client sudah membayar online (`COMPLETED`), server menuntaskan order sebagai **online (`finalize_payment`)** dan menolak pencatatan cash ganda.
   - Jika belum dibayar online, server memanggil RPC `confirm_cash_payment(request_id, mechanic_id)` (`service_role` only).
3. **Pemotongan Komisi 10% pada Pembayaran Tunai**:
   - Pendapatan dicatat di `earnings` dengan `status = 'settled_cash'`, `payment_method = 'cash'`.
   - Komisi platform (`platform_fee`) dipotong otomatis:
     - Sebanyak mungkin dari `mechanic_wallets.available_balance`.
     - Sisa yang belum tertutupi masuk ke `mechanic_wallets.commission_debt`.
   - Jika `commission_debt >= max_cash_commission_debt` (default `Rp100.000`), montir **diblokir menerima order baru** (`accept_service_request` melempar `COMMISSION_DEBT_LIMIT_EXCEEDED`) sampai utang komisi berkurang lewat order online berikutnya atau top-up admin (`record_commission_topup`).
   - Layar detail order montir (`active-order/[id]`) menjelaskan persentase komisi platform dan pencatatan tunggakan pada pembayaran tunai, sedangkan layar **Pendapatan** (`earnings.tsx`) dan **Tarik Saldo** (`withdraw.tsx`) menampilkan banner peringatan aktif saat `commission_debt > 0` dan menjeda pencairan dana hingga tunggakan lunas.

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
   - Dijalankan terjadwal setiap 15 menit via `pg_cron` (batch maks 500 baris dengan `FOR UPDATE SKIP LOCKED`), dan secara spesifik per montir saat montir memanggil `refresh_my_wallet` atau mengajukan penarikan.
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
