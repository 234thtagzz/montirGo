# Database Schema, Views, RPC & Matriks RLS

Dokumen ini menjelaskan struktur tabel, view, fungsi RPC, kebijakan Row Level Security (RLS), serta aturan Storage di **MontirGo**.

---

## 1. Entity Relationship Ringkas

```mermaid
erDiagram
    profiles ||--o| profile_identities : "1:1 (NIK 16 digit)"
    profiles ||--o| mechanic_profiles : "1:1 (role=mechanic)"
    profiles ||--o| mechanic_wallets : "1:1 (role=mechanic)"
    profiles ||--o{ vehicles : "owns"
    profiles ||--o{ device_push_tokens : "has"
    profiles ||--o{ mechanic_payout_accounts : "has"

    service_requests }o--|| profiles : "client_id"
    service_requests }o--o| profiles : "mechanic_id"
    service_requests }o--o| vehicles : "vehicle_id"
    service_requests ||--o{ service_request_status_history : "audits"
    service_requests ||--o{ service_request_assignment_rejections : "blocks re-apply"
    service_requests ||--o{ order_invoice_items : "line items + locked callout"
    service_requests ||--o{ ai_diagnoses : "preliminary analysis"
    service_requests ||--o{ mechanic_locations : "trip breadcrumbs"
    service_requests ||--o{ payments : "1:N attempts (max 1 paid)"
    service_requests ||--o| earnings : "1:1 settlement"
    service_requests ||--o| reviews : "1:1 rating"
    service_requests ||--o{ complaints : "disputes"

    payments ||--o{ payment_events : "webhook audit"
    withdrawals ||--o{ withdrawal_events : "payout audit"
    mechanic_wallets ||--o{ wallet_transactions : "bucketed ledger"
```

---

## 2. Tabel Inti & Kolom Tambahan

- **Identitas & Profil**:
  - `profiles`: `id`, `role` (`app_role`: `client | mechanic | admin`), `full_name`, `email`, `phone_number`, `avatar_url`. *(Kolom `identity_number` diisolasi ke `profile_identities`).*
  - `profile_identities`: `profile_id` (PK), `identity_number` (16 digit unik, permanen untuk user).
  - `mechanic_profiles`: profil bengkel, `skills`, `vehicle_specialization`, `certifications`, `workshop_photos[]`, `vehicle_label` (opsional, maks 80 karakter), `vehicle_plate` (opsional, maks 20 karakter), `service_radius_km`, `is_online`, `is_available`, `is_verified`, `rating_avg`, `rating_count`, `total_jobs`, `current_lat`, `current_lng`, `location` (`geography(Point, 4326)`).
    - **Privasi Kendaraan Montir**: `vehicle_label` dan `vehicle_plate` **tidak** ditampilkan di `mechanic_directory` maupun `list_nearby_mechanics`; keduanya hanya diekspos pasca-penugasan melalui `mechanic_assignment_profile` dan `assigned_order_mechanic_view`.
- **Order & Operasional**:
  - `vehicles`: data kendaraan client + `photo_url` (path privat).
  - `service_requests`: order layanan + `location` (`geography(Point, 4326)`), `route_polyline`, `route_distance_m`, `route_duration_s`, `route_updated_at`, `price_amount` (`bigint`), `callout_fee_tier` (`'motor' | 'mobil' | 'derek'`), `callout_fee_amount` (`bigint` di-snapshot saat order dibuat), `quote_status` (`'draft' | 'pending_approval' | 'approved' | 'callout_only'`), `quote_submitted_at`, `quote_approved_at`, `quote_expires_at`, `quote_revision_note`, `quote_photo_paths` (`text[]`, maks 3), dan `rejected_quote_snapshot` (`jsonb`).
  - `order_invoice_items`: rincian tagihan (`description text`, `amount bigint`, `item_type` (`'callout_fee' | 'service' | 'parts' | 'addon'`), `is_locked boolean`, `approved_at timestamptz`, `voided_at timestamptz`, `quote_photo_paths text[]`). Trigger `trg_protect_order_invoice_items` melarang non-RPC/non-admin mengubah atau menghapus baris `callout_fee`/`is_locked = true` maupun memalsukan `approved_at`/`voided_at`.
  - `service_request_status_history`, `service_request_assignment_rejections`, `mechanic_locations`, `activity_logs`, `notifications`, `device_push_tokens`, `reviews`, `complaints`.
- **AI**:
  - `ai_diagnoses`: khusus hasil JSON analisis awal `analyze-request`.
  - `ai_chat_messages`: riwayat percakapan `ai-assistant` per user/order/mode.
  - `ai_usage_logs`: pencatatan rate limit per jam/hari per user per endpoint.
- **Finansial**:
  - `platform_settings`: `fee_percent`, `hold_days`, `min_withdrawal`, `min_order_price`, `max_order_price`, `max_cash_commission_debt`, `default_match_radius_km`, `request_expire_minutes`, `callout_fee_motor` (`25000`), `callout_fee_mobil` (`45000`), `callout_fee_derek` (`100000`), `quote_expire_minutes` (`15`), `cs_whatsapp_number`.
  - `payments`, `payment_events`, `earnings`, `mechanic_payout_accounts`, `mechanic_wallets`, `withdrawals`, `withdrawal_events`, `wallet_transactions`.

---

## 3. Matriks RLS & Proteksi Kolom

| Tabel / View | Client | Mechanic | Admin | Service Role | Catatan Penting |
| --- | --- | --- | --- | --- | --- |
| `profiles` | SELECT own & counterpart; INSERT `role='client'`; UPDATE own (role immutable) | Sama | ALL | ALL | Tanpa NIK; admin ubah role via `set_user_role`. |
| `profile_identities` | SELECT own; INSERT once via RPC `set_my_identity_number` | Sama | ALL | ALL | Trigger menolak UPDATE oleh non-admin. |
| `mechanic_profiles` | *(Tidak ada SELECT langsung)* | SELECT/INSERT/UPDATE own | ALL | ALL | Client membaca profil publik via `mechanic_directory` / `list_nearby_mechanics`, dan pasca-penugasan (`vehicle_label`/`vehicle_plate`) via `mechanic_assignment_profile` / `assigned_order_mechanic_view`. `refresh_mechanic_jobs` menghitung order `paid` dengan `quote_status <> 'callout_only'`. |
| `reviews` | SELECT public; INSERT own (order `paid`, termasuk `callout_only`) | SELECT own | ALL | ALL | Trigger `trg_reviews_refresh_rating` otomatis memperbarui `rating_avg` & `rating_count`. |
| `service_requests` | SELECT own | SELECT assigned | ALL | ALL | **Tidak ada INSERT/UPDATE/DELETE langsung dari SDK.** Semua mutasi via RPC. |
| `order_invoice_items` | SELECT saat `status in ('payment','paid')` atau `status = 'arrived' and quote_status in ('pending_approval','approved','callout_only')` | SELECT assigned; INSERT/UPDATE/DELETE item non-locked saat `status='arrived'` & `quote_status='draft'` | ALL | ALL | Baris `callout_fee` dibuat server & dilindungi `trg_protect_order_invoice_items`. |
| `complaints` | SELECT & INSERT own (order miliknya, termasuk `callout_only`) | Sama | ALL | ALL | Trigger `complaints_prepare_insert` memvalidasi partisipan & memaksa `status='open'`. |
| `payments`, `earnings`, `mechanic_wallets`, `withdrawals`, `wallet_transactions` | SELECT partisipan (`payments`) | SELECT own | ALL | ALL | Seluruh mutasi **hanya** lewat `service_role` / RPC `SECURITY DEFINER`. |
| `ai_diagnoses` | SELECT partisipan | SELECT partisipan + verified mechanic di open request | ALL | ALL | INSERT/UPDATE hanya via Edge Function (`service_role`). |
| `ai_chat_messages`, `device_push_tokens` | ALL own | ALL own | ALL | ALL | Terisolasi per `auth.uid()`. |

---

## 4. Kebijakan Storage Buckets

| Bucket | Visibilitas | Aturan Akses |
| --- | --- | --- |
| `avatars` | Public | Read untuk authenticated; upload di folder `<auth.uid()>/...`. |
| `vehicle-photos` | Private (Signed URL) | Pemilik, montir yang ditugaskan, **montir terverifikasi** saat request terbuka (`status='requested'`), atau admin. |
| `workshop-photos` | Private (Signed URL) | Pemilik, admin, client yang punya order dengan montir tsb, atau authenticated user khusus foto sampul (`workshop_photos[1]`) dari montir `is_online=true AND is_verified=true`. |
| `complaint-photos` | Private (Signed URL) | Pelapor (`folder[1] = auth.uid()`) dapat read/insert/delete; admin dapat read/manage semua. |
| `quote-photos` | Private (Signed URL) | Path `<request_id>/<mechanic_id>/<filename>`, maks 512 KB (`jpeg/png/webp`), maks 3 foto per order. Upload/delete oleh montir tertugas saat `status = 'arrived'`; read oleh client & montir partisipan order serta admin. Dibersihkan otomatis oleh `cleanup_old_operational_data()` setelah 90 hari jika order terminal (`paid`/`cancelled`) dan tidak memiliki `complaints` aktif. |
