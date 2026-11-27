# Guardrail Design System & Kualitas UI

Dokumen ini menjelaskan mekanisme otomatis yang menjaga disiplin **Zero Hardcode**, aksesibilitas, dan performa UI MontirGo di lokal maupun CI.

---

## 1. Aturan ESLint 9 AST (`scripts/eslint-design-tokens.cjs`)

Terintegrasi langsung ke `eslint.config.js` (dijalankan oleh `npm run lint` dan `npx eslint src --no-cache`):

1. **`design-tokens/no-hardcoded-values`**:
   - Melarang literal warna CSS (`#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`, `rgb(...)`, `rgba(...)`, `hsl(...)`, `hsla(...)`) pada properti style/warna, prop JSX warna, maupun array/objek palet di luar `src/theme/**`.
   - Melarang nilai `fontSize < 11` pada properti `fontSize` di seluruh `src/` di luar `src/theme/**`.
2. **`design-tokens/no-alert-alert`**:
   - Melarang panggilan `Alert.alert(...)` agar seluruh umpan balik memakai validasi inline, `Toast`, atau `BottomSheet`/`ConfirmSheet`.

---

## 2. Mekanisme Ratchet (`scripts/design-token-ratchet.json`)

Selama migrasi bertahap (Tahap 1 -> Tahap 3), file layar/fitur lama yang belum dimigrasikan tercatat batas maksimal pelanggarannya di `scripts/design-token-ratchet.json`.

Aturan penegakan ratchet:
- **File baru** (tidak ada di ratchet): wajib **0 pelanggaran** sejak baris pertama.
- **File di `src/theme/**` dan `src/components/ui/**`**: wajib **0 pelanggaran** (tidak pernah boleh masuk allowlist ratchet).
- **Penambahan pelanggaran**: jika jumlah pelanggaran di suatu file melebihi nilai allowlist-nya, ESLint gagal dengan error.
- **Anti-stale ratchet**: jika suatu file sudah selesai dimigrasikan hingga mencapai **0 pelanggaran** namun entri-nya masih tertinggal di `scripts/design-token-ratchet.json`, ESLint akan **gagal** dan meminta penghapusan entri tersebut dari ratchet.
- Pada akhir Tahap 3, `hardcodedValues` dan `alertCalls` di `scripts/design-token-ratchet.json` harus kosong `{}`.

Untuk meregenerasi baseline saat migrasi bertahap (hanya untuk pengurangan atau pembersihan path):

```bash
node scripts/generate-design-ratchet.mjs
```

---

## 3. Integrasi CI (`.github/workflows/ci.yml`)

Pipeline CI berjalan otomatis pada branch `main`, `dapin/**`, dan `feat/**`, serta pada setiap Pull Request. Gate wajib sebelum merge:

```bash
npx tsc --noEmit
npm run lint
```

---

## 4. Checklist Review PR UI

- [ ] Tidak ada `#HEX` / `rgba()` / `fontSize < 11` baru di luar `src/theme/`.
- [ ] Tidak ada `fontWeight` yang digabungkan dengan `fontFamily` kustom `Plus Jakarta Sans`.
- [ ] Tidak ada `<View>` di dalam `<Text>` (gunakan `<Money inline />` bila di dalam teks).
- [ ] Seluruh tombol/chip/ikon interaktif memiliki target sentuh `>= 48px` (`56px` untuk CTA utama).
- [ ] Layar baru/termigrasi sudah diverifikasi di **Light Mode** dan **Dark Mode**.
- [ ] `concepts_brief.md` tidak pernah di-stage atau di-commit ke Git.
