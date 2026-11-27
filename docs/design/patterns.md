# Pola UX & Arsitektur Layar — Calm Utility & High-Trust

Dokumen ini menjadi panduan desain interaksi untuk seluruh alur Client dan Montir di **MontirGo**.

---

## 1. Beranda Action-First & Aturan 3-Tap (Client)

Pengendara yang mogok di pinggir jalan sering berada dalam kondisi panik, satu tangan, cahaya terik/malam hari, dan sinyal lemah:
1. **Beranda Action-First**:
   - Strip GPS ringkas di bagian atas untuk status lokasi terkini.
   - Kartu order aktif ditempatkan paling atas saat ada pesanan berjalan.
   - **Triase Visual 2x3**: 6 kategori inti (`Butuh Montir`, `Aki & Kelistrikan`, `Ban & Roda`, `Derek & Towing`, `Bensin Darurat`, `Servis Ringan`) dengan label warna semantik.
   - Pre-warm GPS (`getLastKnownPositionAsync`), daftar Garasi, dan tarif biaya panggil dilakukan sejak Beranda dimuat.
2. **Alur 3-Tap (`request/new`)**:
   - **Tap 1**: Pilih kategori di Beranda (atau kartu `Butuh Derek`).
   - **Tap 2**: Pilih/konfirmasi kendaraan atau pill 1-ketukan `Motor | Mobil | Derek` (otomatis terisi jika Garasi punya 1 kendaraan atau dari kartu Derek).
   - **Tap 3**: Tekan CTA darurat `56px` setelah melihat **Biaya Panggil Pasti** tepat di atas tombol.
3. **Kesiapan Sinyal Lemah & Offline**:
   - Draf form permintaan disimpan otomatis di `AsyncStorage` per user dengan TTL 2 jam.
   - Leaflet 1.9.4 dibundel lokal (tanpa CDN eksternal) dan dimuat **lazy** hanya saat client ingin menggeser pin lokasi atau saat melacak perjalanan aktif.
   - Jika jaringan/GPS gagal, sediakan input alamat manual serta jalur bantuan langsung CS via WhatsApp dan telepon `tel:`.

---

## 2. Alur Kerja Montir di Lapangan

Montir bekerja di ruang bising dengan tangan kotor/basah dan butuh aksi cepat saat menerima order, namun perlindungan ekstra pada aksi berisiko:
1. **Beranda Action-First**:
   - Saklar besar `SIAGA / OFFLINE` sebagai kontrol utama di atas ringkasan saldo/pendapatan.
   - Kartu order aktif tampil untuk **seluruh tahap status** (dari diterima hingga menunggu pembayaran).
2. **Respon Cepat vs Pengaman Gestur**:
   - Pada feed request masuk (`requested`), gunakan tombol standar **56px** (`Ajukan Diri`) agar cepat ditekan — client tetap memegang konfirmasi 5 menit (`mechanic_assigned`).
   - Gunakan **`SwipeAction`** (`edgeInset >= 20px`) khusus pada 3 transisi pasca-terima yang berisiko tinggi:
     1. `Mulai Perjalanan` (`mechanic_accepted` -> `on_the_way`)
     2. `Sampai di Lokasi` (`on_the_way` -> `arrived`)
     3. `Konfirmasi Terima Tunai` (`payment` -> `paid` jalur cash)

---

## 3. Persetujuan Estimasi Digital di Dalam `arrived`

Tanpa mengubah kontrak **8 status resmi** (`service_requests.status`), proses persetujuan biaya pra-kerja dimodelkan melalui sub-status `quote_status` (`draft | pending_approval | approved | callout_only`) di dalam status `arrived`:
- Montir mengisi rincian menggunakan quick-pick chip (`Jasa` / `Suku Cadang`) + foto bukti kerusakan opsional (terkompresi <= 300 KB, maks 3 foto — upload terpisah agar tidak memblokir pengiriman estimasi di sinyal 1-bar).
- Baris `Biaya Panggil` (`callout_fee`) selalu terkunci otomatis dan ditambahkan di atas jasa/suku cadang dalam 1x pembayaran akhir.
- Client dapat menyetujui estimasi, meminta revisi, atau memilih **Bayar Biaya Panggil Saja** (`callout_only`).

---

## 4. Hierarki Umpan Balik (Pengganti `Alert.alert`)

`Alert.alert()` dilarang di UI produksi. Gunakan hierarki berikut:
1. **Validasi Inline (`TextField`)**: untuk kesalahan input form (tampil pasca-blur atau submit).
2. **Banner Non-Blocking (`Toast` / `useToast`)**: untuk konfirmasi sukses ringan, info sinkronisasi, atau error jaringan sementara.
3. **Panel Bawah (`ConfirmSheet` / `BottomSheet`)**: untuk keputusan penting, konfirmasi finansial, pembatalan, atau penghapusan data.

---

## 5. Dark Mode & Peta Leaflet

- Peta Leaflet mendukung `window.TripMap.setTheme(tokens)` melalui `injectJavaScript` tanpa memuat ulang WebView:
  - Di Dark Mode, filter CSS diterapkan khusus pada `.leaflet-tile-pane` sehingga marker, rute polyline, dan label posisi tetap tajam dan kontras.
  - Opsional mendukung tile provider gelap via `EXPO_PUBLIC_MAP_TILE_URL_DARK` di environment produksi.
