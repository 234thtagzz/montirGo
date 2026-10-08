# PRD — MONTIRGO

## 1. PROJECT OVERVIEW

### Nama Produk

MontirGo

### Jenis Produk

Mobile application untuk menghubungkan client yang mengalami kerusakan kendaraan dengan montir/bengkel yang dapat memberikan bantuan di lokasi.

### Platform

* Android — prioritas utama
* iOS — dirancang agar dapat dikembangkan setelah MVP stabil

### Teknologi Utama

* React Native
* Expo
* TypeScript
* Expo Router
* Supabase
* PostgreSQL
* Supabase Auth
* Supabase Storage
* Supabase Edge Functions
* Google Maps / mapping service
* AI API
* Payment Gateway yang mendukung QRIS dan metode pembayaran Indonesia

---

# 2. PRODUCT VISION

MontirGo bertujuan menjadi platform bantuan kendaraan di perjalanan yang memungkinkan client mendapatkan bantuan montir dengan cepat berdasarkan lokasi dan kondisi kendaraan.

Konsep utama:

```text
CLIENT
  │
  │ Kendaraan bermasalah
  ▼
MontirGo
  │
  ├── Analisis awal kerusakan dengan AI
  │
  ├── Menentukan lokasi client
  │
  ├── Mencari montir yang sesuai
  │
  ├── Menampilkan estimasi jarak/waktu
  │
  ├── Navigasi montir menuju client
  │
  └── Pembayaran
          │
          ▼
       MONTIR
```

---

# 3. CORE PROBLEM

Client sering mengalami masalah kendaraan ketika:

* Tidak mengetahui penyebab kerusakan.
* Tidak mengetahui lokasi secara pasti.
* Tidak mengetahui bengkel atau montir terdekat.
* Kesulitan menjelaskan kondisi kendaraan kepada montir.
* Kesulitan memperkirakan biaya.
* Kesulitan mendapatkan bantuan dengan cepat.

Montir juga menghadapi masalah:

* Informasi kerusakan dari client tidak lengkap.
* Tidak mengetahui lokasi client dengan akurat.
* Sulit memperkirakan jenis pekerjaan sebelum tiba.
* Membutuhkan sistem untuk mengelola order.
* Membutuhkan pencatatan penghasilan dan aktivitas.

---

# 4. PRODUCT GOALS

## Primary Goal

Mempermudah client mendapatkan bantuan montir di lokasi kendaraan mengalami masalah.

## Secondary Goals

1. Membantu montir memahami indikasi kerusakan sebelum datang.
2. Mengurangi waktu komunikasi antara client dan montir.
3. Membantu montir menemukan lokasi client.
4. Menyediakan navigasi menuju client.
5. Mencatat aktivitas layanan.
6. Membantu montir melihat penghasilan.
7. Menyediakan pembayaran digital.
8. Membangun sistem layanan roadside assistance yang dapat dikembangkan menjadi platform bisnis.

---

# 5. USER ROLES

## Client

Client adalah pengguna yang membutuhkan bantuan montir.

Client dapat:

* Register
* Login
* Mengelola profil
* Menambahkan kendaraan
* Membuat permintaan bantuan
* Menjelaskan kerusakan
* Menggunakan lokasi perangkat
* Melihat lokasi montir
* Melihat status order
* Melihat estimasi perjalanan
* Melihat detail biaya
* Membayar
* Memberikan rating/review
* Melihat riwayat layanan
* Melihat aktivitas akun

---

## Montir

Montir adalah penyedia jasa.

Montir dapat:

* Register
* Login
* Mengelola profil
* Mengatur status online/offline
* Menerima permintaan layanan
* Melihat informasi kerusakan
* Melihat analisis AI
* Melihat lokasi client
* Menggunakan navigasi
* Mengubah status pekerjaan
* Menentukan biaya sesuai aturan sistem
* Melihat penghasilan
* Melihat riwayat pekerjaan
* Melihat aktivitas
* Menerima pembayaran

---

## Admin

Admin digunakan untuk pengelolaan sistem.

Admin dapat:

* Mengelola client
* Mengelola montir
* Memverifikasi montir
* Mengelola bengkel
* Melihat order
* Melihat transaksi
* Melihat laporan
* Menangani laporan/complaint
* Mengelola konfigurasi sistem

Admin tidak menjadi fokus MVP mobile dan dapat dibuat sebagai dashboard web pada fase berikutnya.

---

# 6. AUTHENTICATION & ROLE SYSTEM

Sistem menggunakan authentication.

Saat user login:

```text
Login
   │
   ▼
Authentication
   │
   ▼
Get User Profile
   │
   ├── role = client
   │       ↓
   │   Client Dashboard
   │
   ├── role = mechanic
   │       ↓
   │   Mechanic Dashboard
   │
   └── role = admin
           ↓
       Admin System
```

Role harus ditentukan dari database, bukan hanya dari data yang dikirim oleh client.

Gunakan:

* Supabase Auth
* PostgreSQL profile table
* Role-based access control
* Row Level Security

Jangan mempercayai role dari aplikasi client tanpa validasi server/database.

---

# 7. CLIENT DASHBOARD

Dashboard client harus menyediakan:

* Greeting
* Status kendaraan
* Tombol utama "Butuh Bantuan Montir"
* Lokasi saat ini
* Order aktif
* Status montir
* Riwayat layanan
* Aktivitas
* Profile

Primary CTA:

> "Cari Bantuan Montir"

---

# 8. MECHANIC DASHBOARD

Dashboard montir harus menyediakan:

* Status Online/Offline
* Permintaan layanan baru
* Order aktif
* Lokasi saat ini
* Jarak menuju client
* Estimasi waktu perjalanan
* Penghasilan hari ini
* Penghasilan bulan ini
* Riwayat pekerjaan
* Aktivitas

Primary CTA:

> "Online / Siap Menerima Order"

---

# 9. CORE FEATURE — SERVICE REQUEST

Client dapat membuat permintaan bantuan.

Form minimal:

* Kendaraan
* Jenis kendaraan
* Merek
* Model
* Tahun
* Deskripsi masalah
* Gejala
* Foto kendaraan/komponen jika diperlukan
* Lokasi
* Nomor kontak
* Catatan tambahan

Status order:

```text
requested
   ↓
matching
   ↓
mechanic_assigned
   ↓
mechanic_accepted
   ↓
on_the_way
   ↓
arrived
   ↓
diagnosing
   ↓
repairing
   ↓
completed
   ↓
payment
   ↓
paid
```

Jika order dibatalkan:

```text
requested
   ↓
cancelled
```

---

# 10. AI VEHICLE ANALYSIS

AI digunakan sebagai **alat bantu analisis awal**, bukan sebagai pengganti diagnosis profesional montir.

Client memberikan:

* Deskripsi kerusakan
* Gejala
* Kondisi kendaraan
* Foto jika tersedia

Data dikirim ke backend.

Backend memanggil AI API.

AI menghasilkan:

```text
Possible Issues
Symptoms
Risk Level
Recommended Initial Checks
Suggested Tools
Estimated Complexity
Questions for Client
```

Contoh:

```text
Kemungkinan masalah:
- Aki lemah
- Sistem starter
- Kabel kelistrikan

Tingkat risiko:
Medium

Pemeriksaan awal:
- Periksa tegangan aki
- Periksa terminal aki
- Periksa suara starter

Catatan:
Hasil AI bukan diagnosis final.
Montir tetap harus melakukan pemeriksaan langsung.
```

AI harus menggunakan bahasa:

* "kemungkinan"
* "indikasi"
* "perlu pemeriksaan"

dan tidak boleh menyatakan diagnosis sebagai kepastian tanpa pemeriksaan langsung.

---

# 11. AI ARCHITECTURE

Jangan memanggil AI provider menggunakan secret API key langsung dari React Native.

Gunakan:

```text
React Native
     │
     ▼
Supabase Edge Function / Backend
     │
     ▼
AI Provider
     │
     ▼
Structured AI Response
     │
     ▼
Database
     │
     ▼
React Native
```

AI API key hanya boleh berada di server environment.

---

# 12. GEOLOCATION

Aplikasi membutuhkan geolocation.

## Client

Client dapat:

* Mengambil lokasi saat ini.
* Mengubah marker lokasi.
* Mengonfirmasi lokasi.
* Menggunakan lokasi manual jika GPS tidak akurat.

## Mechanic

Montir dapat:

* Mengambil lokasi saat ini.
* Mengirim posisi ketika sedang menjalankan order.
* Melihat lokasi client.
* Melihat estimasi jarak.

Jangan melakukan tracking lokasi terus-menerus jika tidak diperlukan.

Gunakan tracking terutama ketika:

```text
mechanic -> accepted order
```

sampai:

```text
mechanic -> arrived/completed
```

Location permission harus dijelaskan kepada pengguna.

---

# 13. MAP

Gunakan map component untuk:

* Current location
* Client marker
* Mechanic marker
* Route/polyline
* Destination
* Map controls

Contoh:

```text
             MECHANIC
                🚗
                 │
                 │ Route
                 │
                 ▼
               CLIENT
                 📍
```

Map harus dapat menampilkan:

* Jarak
* Estimasi waktu
* Route
* Current location
* Destination

---

# 14. ROUTING / NAVIGATION

Routing harus menggunakan layanan directions/routing yang sesuai.

Sistem harus menghitung:

* Distance
* Estimated travel time
* Route
* Alternative route jika tersedia

Jangan hanya menghitung jarak garis lurus.

Prioritaskan route berdasarkan:

1. Jalan yang dapat dilalui kendaraan.
2. Waktu tempuh.
3. Jarak.
4. Kondisi route jika data tersedia.

Navigasi dapat menyediakan tombol:

> "Mulai Navigasi"

yang membuka native mapping application jika full turn-by-turn navigation belum menjadi bagian MVP.

---

# 15. MECHANIC MATCHING

Setelah client membuat request:

```text
Client Request
      ↓
Get Client Location
      ↓
Find Available Mechanics
      ↓
Calculate Distance
      ↓
Filter Mechanics
      ↓
Rank Candidates
      ↓
Send Request
```

Ranking dapat mempertimbangkan:

* Jarak
* Status online
* Rating
* Jenis keahlian
* Ketersediaan
* Riwayat pekerjaan

Untuk MVP gunakan algoritma sederhana berdasarkan:

```text
online + available + distance
```

Sistem matching yang lebih kompleks dapat dibuat pada fase berikutnya.

---

# 16. ORDER MANAGEMENT

Setiap order harus memiliki:

* Order ID
* Client ID
* Mechanic ID
* Vehicle ID
* Location
* Problem description
* AI analysis
* Status
* Price
* Payment status
* Created time
* Accepted time
* Arrived time
* Completed time

Semua perubahan status harus tercatat.

---

# 17. PAYMENT

Aplikasi harus mendukung pembayaran digital.

Target metode:

* QRIS
* GoPay
* DANA
* metode lain yang tersedia melalui payment gateway

Jangan membuat integrasi pembayaran langsung hanya berdasarkan asumsi API masing-masing e-wallet.

Gunakan payment gateway yang secara resmi mendukung metode pembayaran yang diperlukan.

Arsitektur:

```text
Client
   │
   ▼
Backend
   │
   ▼
Payment Gateway
   │
   ├── QRIS
   ├── GoPay
   └── DANA
```

Payment status:

```text
pending
paid
failed
expired
cancelled
refunded
```

Payment verification harus dilakukan melalui backend/webhook, bukan hanya berdasarkan status dari aplikasi client.

---

# 18. MECHANIC EARNINGS

Montir dapat melihat:

### Hari ini

* Total order
* Pendapatan
* Fee platform
* Pendapatan bersih

### Minggu ini

* Total pekerjaan
* Total pendapatan

### Bulan ini

* Total pekerjaan
* Gross revenue
* Platform fee
* Net revenue

Contoh:

```text
Gross        : Rp500.000
Platform Fee : Rp50.000
Net Income   : Rp450.000
```

Angka hanya contoh.

Perhitungan final harus dilakukan di backend agar tidak dapat dimanipulasi oleh client.

---

# 19. ACTIVITY HISTORY

Client:

* Login
* Request dibuat
* Mechanic ditemukan
* Order diterima
* Mechanic datang
* Service selesai
* Payment
* Rating

Mechanic:

* Login
* Online
* Request diterima
* Request diterima/ditolak
* Berangkat
* Sampai
* Diagnosis
* Repair
* Order selesai
* Payment diterima

Activity log harus memiliki:

* User ID
* Activity type
* Description
* Timestamp
* Related entity

---

# 20. VEHICLE MANAGEMENT

Client dapat menyimpan kendaraan.

Data:

```text
Vehicle
├── id
├── owner_id
├── type
├── brand
├── model
├── year
├── license_plate
└── notes
```

Client dapat memiliki lebih dari satu kendaraan.

---

# 21. DATABASE

Gunakan PostgreSQL melalui Supabase.

Minimal tabel:

```text
profiles
vehicles
mechanic_profiles
service_requests
service_request_status_history
ai_diagnoses
locations
mechanic_locations
payments
payment_events
earnings
activity_logs
notifications
reviews
```

Relasi utama:

```text
profiles
   │
   ├── vehicles
   │
   ├── service_requests
   │
   ├── activity_logs
   │
   └── notifications

service_requests
   │
   ├── ai_diagnoses
   ├── status_history
   ├── payment
   ├── review
   └── mechanic_location
```

Gunakan:

* UUID
* Foreign keys
* Index
* Constraints
* Timestamps
* RLS

---

# 22. SECURITY

Wajib:

* Supabase Auth
* RLS
* Role validation
* Server-side authorization
* Secure environment variables
* HTTPS
* Input validation
* Payment webhook validation
* AI API key di server
* Tidak menyimpan secret key di mobile app

Jangan mempercayai:

```text
role
price
payment_status
mechanic_id
order_status
```

yang dikirim langsung oleh client.

Nilai sensitif harus divalidasi oleh backend.

---

# 23. PROJECT STRUCTURE

Gunakan struktur modular:

```text
montirGo/
│
├── app/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   │
│   ├── (client)/
│   │   ├── index.tsx
│   │   ├── request/
│   │   ├── orders/
│   │   ├── vehicles/
│   │   └── profile/
│   │
│   ├── (mechanic)/
│   │   ├── index.tsx
│   │   ├── requests/
│   │   ├── active-order/
│   │   ├── earnings/
│   │   └── profile/
│   │
│   └── _layout.tsx
│
├── components/
│   ├── ui/
│   ├── map/
│   ├── forms/
│   └── cards/
│
├── features/
│   ├── auth/
│   ├── client/
│   ├── mechanic/
│   ├── service-request/
│   ├── vehicle/
│   ├── location/
│   ├── payment/
│   ├── ai-diagnosis/
│   └── notification/
│
├── lib/
│   ├── supabase.ts
│   ├── api.ts
│   └── maps.ts
│
├── hooks/
│
├── store/
│
├── types/
│
├── constants/
│
├── utils/
│
├── assets/
│
├── supabase/
│   ├── migrations/
│   └── functions/
│
├── .env
├── .env.example
├── app.json
├── package.json
└── README.md
```

---

# 24. UI DESIGN DIRECTION

Gunakan desain:

* Modern
* Professional
* Automotive
* Clean
* Trustworthy
* Mobile-first

Jangan membuat UI terlalu ramai.

Prioritas:

```text
Clear information
      ↓
Easy interaction
      ↓
Fast action
      ↓
Visual polish
```

Client harus dapat meminta bantuan dalam sesedikit mungkin langkah.

---

# 25. CLIENT MAIN FLOW

```text
Open App
    ↓
Login/Register
    ↓
Client Dashboard
    ↓
"Need Mechanic?"
    ↓
Select Vehicle
    ↓
Describe Problem
    ↓
Add Photo (optional)
    ↓
Confirm Location
    ↓
AI Preliminary Analysis
    ↓
Find Mechanic
    ↓
Mechanic Accepts
    ↓
Track Mechanic
    ↓
Mechanic Arrives
    ↓
Repair
    ↓
Service Completed
    ↓
Payment
    ↓
Rating
    ↓
History
```

---

# 26. MECHANIC MAIN FLOW

```text
Open App
    ↓
Login
    ↓
Mechanic Dashboard
    ↓
Online
    ↓
Receive Request
    ↓
View Client + Vehicle + Problem
    ↓
View AI Analysis
    ↓
Accept
    ↓
Navigate to Client
    ↓
Arrived
    ↓
Diagnosis
    ↓
Repair
    ↓
Set Final Service Cost
    ↓
Complete Order
    ↓
Payment
    ↓
Earnings Updated
    ↓
Activity Recorded
```

---

# 27. MVP

MVP harus fokus pada alur inti.

### MVP CLIENT

* Register/Login
* Role client
* Client dashboard
* Profile
* Add vehicle
* Create service request
* GPS location
* Map
* Find mechanic
* Order status
* Mechanic tracking
* Service history

### MVP MECHANIC

* Register/Login
* Role mechanic
* Mechanic dashboard
* Online/offline
* Receive request
* Accept/reject
* Client location
* Map
* Navigation
* Update order status
* Earnings
* Activity history

### MVP BACKEND

* Supabase Auth
* PostgreSQL
* RLS
* Storage
* Realtime untuk status/order/location jika diperlukan
* Edge Functions

### MVP AI

AI preliminary analysis berdasarkan:

* Problem description
* Symptoms
* Vehicle data

Image-based AI analysis dapat menjadi tahap berikutnya jika kualitas dan kebutuhan datanya sudah jelas.

### MVP PAYMENT

Mulai dengan payment gateway yang mendukung QRIS.

GoPay dan DANA dapat ditambahkan setelah alur payment MVP stabil dan provider yang digunakan mendukungnya.

---

# 28. PHASE 2

Tambahkan:

* AI image analysis
* Advanced mechanic matching
* Rating
* Review
* Push notification
* More payment methods
* Detailed earnings
* Promo
* Referral
* Chat
* Call
* Advanced tracking

---

# 29. PHASE 3

Tambahkan:

* Bengkel resmi
* Fleet management
* Subscription
* Corporate account
* Advanced analytics
* Predictive maintenance
* AI troubleshooting assistant
* Admin dashboard
* Multi-city expansion

---

# 30. NON-FUNCTIONAL REQUIREMENTS

Aplikasi harus:

* Responsive
* Stable
* Secure
* Modular
* Maintainable
* Scalable

Perhatikan:

* Network failure
* GPS failure
* API timeout
* AI timeout
* Payment timeout
* Database failure
* Permission denied
* Empty state
* Loading state

---

# 31. TESTING

Minimal test:

### Authentication

* Login client
* Login mechanic
* Invalid login
* Logout
* Session persistence

### Role

* Client tidak dapat mengakses halaman mechanic.
* Mechanic tidak dapat mengakses data private client lain.

### Order

* Create order
* Accept order
* Reject order
* Cancel order
* Complete order

### Location

* Permission granted
* Permission denied
* GPS unavailable
* Location update

### Payment

* Payment created
* Payment success
* Payment failed
* Payment expired
* Webhook verification

### AI

* AI request success
* AI timeout
* Invalid input
* AI unavailable

---

# 32. IMPORTANT PRODUCT RULES

1. AI hanya memberikan preliminary analysis.
2. AI bukan pengganti diagnosis montir.
3. Harga final tidak boleh ditentukan sepenuhnya oleh AI.
4. Payment status harus diverifikasi server-side.
5. Location tracking harus memiliki alasan dan batas waktu.
6. Client harus mengetahui ketika lokasi sedang digunakan.
7. API secret tidak boleh berada di mobile app.
8. Jangan menyimpan data pribadi yang tidak diperlukan.
9. Semua akses data harus menggunakan authorization.
10. Gunakan RLS untuk data Supabase.
11. Jangan menganggap GPS selalu akurat.
12. Jangan menganggap AI selalu benar.
13. Jangan menganggap route selalu optimal.
14. Semua fitur harus mempunyai loading, error, dan empty state.

---

# 33. DEVELOPMENT ROADMAP

## Phase 1

Project setup

## Phase 2

Authentication + Role

## Phase 3

Database

## Phase 4

Client Dashboard

## Phase 5

Mechanic Dashboard

## Phase 6

Vehicle Management

## Phase 7

Service Request

## Phase 8

Geolocation

## Phase 9

Maps + Routing

## Phase 10

Mechanic Matching

## Phase 11

Realtime Order Status

## Phase 12

AI Analysis

## Phase 13

Payment

## Phase 14

Earnings

## Phase 15

Activity History

## Phase 16

Testing

## Phase 17

Optimization

## Phase 18

Production Build

---

# 34. OPENCODE DEVELOPMENT RULES

OpenCode harus:

1. Membaca file `PRD.rm` sebelum melakukan perubahan.
2. Memahami architecture sebelum coding.
3. Jangan langsung membuat semua fitur sekaligus.
4. Kerjakan satu phase pada satu waktu.
5. Sebelum mengubah file, periksa struktur project yang sudah ada.
6. Jangan menghapus kode tanpa alasan.
7. Jangan membuat API palsu tanpa label MOCK.
8. Jangan menaruh secret API key di source code.
9. Jangan membuat database schema tanpa migration.
10. Jangan membuat payment integration sebelum backend architecture siap.
11. Jangan membuat AI integration langsung dari mobile client jika membutuhkan secret API key.
12. Gunakan TypeScript.
13. Gunakan reusable components.
14. Tangani loading/error/empty state.
15. Jalankan lint/typecheck/test setelah perubahan penting.
16. Jika terjadi error, analisis root cause terlebih dahulu.
17. Jangan mengubah architecture utama tanpa persetujuan.
18. Jika requirement tidak jelas, tanyakan terlebih dahulu.
19. Setelah setiap phase selesai, berikan:

    * perubahan
    * file yang dibuat
    * file yang diubah
    * cara menjalankan
    * hasil testing
    * masalah yang masih tersisa
20. Jangan menganggap fitur selesai sebelum acceptance criteria terpenuhi.

---

# 35. FIRST TASK FOR OPENCODE

Jangan langsung membangun seluruh aplikasi.

Langkah pertama:

1. Baca `PRD.rm`.
2. Inspect project.
3. Periksa `package.json`.
4. Periksa versi Node.js.
5. Periksa versi Expo.
6. Periksa struktur folder.
7. Identifikasi dependency yang sudah terpasang.
8. Identifikasi dependency yang belum tersedia.
9. Berikan rekomendasi architecture.
10. Buat implementation plan.
11. Jangan mengubah source code besar-besaran sebelum plan disetujui.

Setelah itu mulai dari:

```text
PHASE 1
Project Setup
+
Expo Router
+
TypeScript
+
Supabase
+
Basic Design System
```

Kemudian lanjut secara bertahap ke authentication dan role-based navigation.

---

# 36. DEFINITION OF DONE

MontirGo MVP dianggap selesai apabila:

* Client dapat register/login.
* Mechanic dapat register/login.
* Role dapat dibedakan.
* Client diarahkan ke dashboard client.
* Mechanic diarahkan ke dashboard mechanic.
* Client dapat menyimpan kendaraan.
* Client dapat membuat service request.
* Lokasi client dapat diperoleh dengan permission.
* Mechanic dapat menerima request.
* Mechanic dapat melihat lokasi client.
* Map dapat menampilkan client dan mechanic.
* Mechanic dapat melakukan navigasi.
* Order mempunyai lifecycle/status yang jelas.
* AI preliminary analysis dapat digunakan melalui backend.
* Pembayaran MVP dapat dibuat dan diverifikasi.
* Mechanic dapat melihat earnings.
* Client dan mechanic memiliki activity history.
* RLS/security sudah diterapkan.
* Error/loading/empty states tersedia.
* Testing utama berhasil.
* Production build dapat dibuat.

---

# 37. FINAL INSTRUCTION FOR OPENCODE

Anggap dokumen ini sebagai **Single Source of Truth** untuk pengembangan MontirGo.

Jika terdapat konflik antara kode lama dan PRD:

1. Jangan langsung menghapus kode.
2. Analisis dampaknya.
3. Jelaskan konflik.
4. Berikan rekomendasi.
5. Tunggu keputusan jika perubahan bersifat besar.

Prioritas:

```text
USER SAFETY
     ↓
SECURITY
     ↓
CORE FUNCTIONALITY
     ↓
USER EXPERIENCE
     ↓
PERFORMANCE
     ↓
MAINTAINABILITY
     ↓
SCALABILITY
```

Mulai dari **PHASE 1 — Project Setup** dan jangan melompat ke fitur lain sebelum fondasi aplikasi stabil.
