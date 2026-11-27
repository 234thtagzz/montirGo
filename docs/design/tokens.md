# Design Tokens — Calm Utility & High-Trust

Dokumen ini mendefinisikan arsitektur token visual **MontirGo** (`src/theme/`) dengan arah desain **Calm Utility & High-Trust**: antarmuka berkontras tinggi yang tenang di situasi darurat pinggir jalan, terbaca di bawah terik matahari maupun malam hari, serta mendukung **Light Mode**, **Dark Mode**, dan pilihan **Ikuti Sistem** secara instan.

---

## 1. Arsitektur 3 Lapis (`Primitive -> Semantic -> Component`)

1. **Lapisan 1 — Primitive (`src/theme/primitives.ts`)**:
   - Satu-satunya file di `src/` yang boleh mendeklarasikan nilai warna mentah (`#HEX`, `rgba(...)`).
   - Menyimpan skala `Palette`, `AvatarPaletteLight`, `AvatarPaletteDark`, `Spacing`, `Radii`, `TouchTarget`, dan `Motion`.
2. **Lapisan 2 — Semantic (`src/theme/tokens.ts`)**:
   - Memetakan primitif ke peran antarmuka (`bgCanvas`, `bgSurface`, `textPrimary`, `actionPrimaryBg`, `actionEmergencyBg`, `borderInput`, `statusSuccessFg/Bg/Border`, dll.) dalam dua objek statis terbekukan: `lightTheme` dan `darkTheme`.
   - Seluruh layar, fitur, dan komponen membaca token dari `useAppTheme().theme` atau `useThemedStyles(createStyles)`.
3. **Lapisan 3 — Component (`theme.components`)**:
   - Token spesifik komponen (`button`, `card`, `input`, `chip`, `badge`, `sheet`, `swipeAction`) termasuk `borderCurve: 'continuous'`, radius `12–16px` (`24px` untuk sheet), tinggi CTA `56px`, dan `edgeInset: 20` untuk `SwipeAction`.

### Performa React Compiler & `useThemedStyles`

`src/theme/use-themed-styles.ts` men-cache hasil `StyleSheet.create(factory(theme))` memakai `WeakMap<StyleFactory, WeakMap<AppTheme, ...>>`. Karena `lightTheme` dan `darkTheme` merupakan dua referensi objek statis, setiap `createStyles` dievaluasi maksimal dua kali sepanjang aplikasi berjalan tanpa alokasi ulang per render.

```tsx
import { useThemedStyles, type AppTheme } from '@/theme';

const createStyles = (theme: AppTheme) => ({
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    padding: theme.spacing.lg,
  },
});

function ExampleCard() {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.card} />;
}
```

---

## 2. Palet Warna & Kontras WCAG AA Terverifikasi

### Light Mode (`lightTheme`)

| Peran Token | Nilai | Pasangan Latar / Teks | Rasio Kontras |
| --- | --- | --- | --- |
| `bgCanvas` | `#F8FAFC` | Latar halaman utama | — |
| `bgSurface` | `#FFFFFF` | Latar kartu / input / tab bar | — |
| `bgSurfaceSubtle` | `#F1F5F9` | Latar sekunder / segmented track | — |
| `textPrimary` | `#0F172A` | di atas `bgSurface` (`#FFFFFF`) | **17.85:1** |
| `textSecondary` | `#475569` | di atas `bgSurface` (`#FFFFFF`) | **7.58:1** |
| `textMuted` | `#64748B` | di atas `bgSurface` / `bgCanvas` | **4.76:1 / 4.55:1** |
| `actionPrimaryBg` / `Fg` | `#0F172A` / `#FFFFFF` | Tombol utama | **17.85:1** |
| `actionPrimaryAltBg` / `Fg` | `#1E3A8A` / `#FFFFFF` | Aksi primer biru trust | **10.36:1** |
| `actionEmergencyBg` / `Fg` | `#C2410C` / `#FFFFFF` | CTA darurat (Order / Derek) | **5.18:1** |
| `whatsappBg` / `Fg` | `#15803D` / `#FFFFFF` | Tombol hubungi WhatsApp | **5.02:1** |
| `borderInput` | `#74849A` | di atas `bgSurface` / `bgCanvas` | **3.81:1 / 3.64:1** (>= 3:1 UI) |
| `statusSuccessFg` / `Bg` | `#047857` / `#ECFDF5` | Lunas / Terverifikasi / SIAGA | **5.21:1** |
| `statusWarningFg` / `Bg` | `#B45309` / `#FFFBEB` | Menunggu / Tunggakan | **4.84:1** |
| `statusDangerFg` / `Bg` | `#B91C1C` / `#FEF2F2` | Batal / Gagal / Error | **5.91:1** |
| `statusInfoFg` / `Bg` | `#1E3A8A` / `#EFF6FF` | Menuju lokasi / Info | **9.52:1** |

### Dark Mode (`darkTheme`)

| Peran Token | Nilai | Pasangan Latar / Teks | Rasio Kontras |
| --- | --- | --- | --- |
| `bgCanvas` | `#0B1120` | Latar halaman utama | — |
| `bgSurface` | `#111827` | Latar kartu / tab bar / sheet | — |
| `bgSurfaceSubtle` | `#1E293B` | Latar kartu sekunder | — |
| `textPrimary` | `#F8FAFC` | di atas `bgCanvas` (`#0B1120`) | **18.00:1** |
| `textSecondary` | `#CBD5E1` | di atas `bgSurface` (`#111827`) | **11.95:1** |
| `textMuted` | `#94A3B8` | di atas `bgSurface` / `bgSurfaceSubtle` | **6.92:1 / 5.71:1** |
| `actionPrimaryBg` / `Fg` | `#60A5FA` / `#0B1120` | Tombol utama mode gelap | **7.41:1** |
| `actionEmergencyBg` / `Fg` | `#FB923C` / `#0B1120` | CTA darurat mode gelap | **8.32:1** |
| `whatsappBg` / `Fg` | `#4ADE80` / `#0B1120` | Tombol WhatsApp mode gelap | **10.81:1** |
| `borderInput` | `#64748B` | di atas `bgSurface` (`#111827`) | **3.73:1** (>= 3:1 UI) |
| `statusSuccessFg` / `Bg` | `#34D399` / `#064E3B` | Status sukses | **5.06:1** |
| `statusWarningFg` / `Bg` | `#FBBF24` / `#451A03` | Status menunggu / peringatan | **8.97:1** |
| `statusDangerFg` / `Bg` | `#F87171` / `#450A0A` | Status gagal / batal | **5.84:1** |
| `statusInfoFg` / `Bg` | `#60A5FA` / `#172554` | Status informasi / aktif | **5.78:1** |

---

## 3. Tipografi (`Plus Jakarta Sans`)

Font dimuat saat boot di `src/app/_layout.tsx` menggunakan `useFonts` dari `@expo-google-fonts/plus-jakarta-sans`.

**Aturan Android Penting**: Jangan pernah memasangkan `fontWeight` dengan `fontFamily` kustom — setiap bobot sudah dipetakan ke nama file font masing-masing di `FontFamily` (`PlusJakartaSans_400Regular`, `500Medium`, `600SemiBold`, `700Bold`, `800ExtraBold`).

| Variant | FontFamily | Size / LineHeight | Letter Spacing | Pemakaian |
| --- | --- | --- | --- | --- |
| `display` | `extrabold` | `32 / 38` | `-0.8` | Nominal hero saldo |
| `h1` | `extrabold` | `24 / 30` | `-0.5` | Judul layar utama / header profil |
| `h2` | `bold` | `18 / 24` | `-0.3` | Judul section & modal sheet |
| `title` | `bold` | `16 / 22` | `-0.2` | Judul kartu |
| `body` | `regular` | `14 / 21` | `0` | Teks utama & deskripsi |
| `bodyMedium` | `medium` | `14 / 21` | `0` | Teks isi penekanan ringan |
| `bodyStrong` | `semibold` | `14 / 21` | `0` | Nilai baris info |
| `label` | `semibold` | `13 / 18` | `0` | Label tombol, chip, tab |
| `caption` | `medium` | `12 / 17` | `0` | Metadata, hint, pesan error form |
| `overline` | `bold` | `11 / 15` | `0.6` | Eyebrow & badge mini (**batas minimum 11px**) |

Gunakan `TabularNums` (`fontVariant: ['tabular-nums']`) atau `<AppText tabular>` pada seluruh nominal Rupiah, jarak `km`, durasi ETA, dan timer hitung mundur.

---

## 4. Spasi, Radius, Target Sentuh & Tema Sistem

- **Spacing**: `none (0)`, `xxs (2)`, `xs (4)`, `sm (8)`, `md (12)`, `lg (16)`, `xl (20)`, `xxl (24)`, `xxxl (32)`, `huge (40)`, `screenPadding (20)`.
- **Radii (`borderCurve: 'continuous'`)**: `xs (8)`, `sm (12)`, `md (14)`, `lg (16)`, `xl (20)`, `sheet (24)`, `pill (999)`.
- **Touch Target**: Minimum `48px` (`TouchTarget.min`) untuk seluruh kontrol interaktif; `56px` (`TouchTarget.cta`) untuk CTA primer dan `SwipeAction`.
- **Sinkronisasi Sistem (`AppThemeProvider`)**:
  - Preferensi (`system | light | dark`) disimpan di `AsyncStorage` (`@montirgo/theme_preference`).
  - Menyinkronkan `expo-system-ui` (`setBackgroundColorAsync`), `expo-status-bar` (`light` / `dark`), `Appearance.setColorScheme`, dan React Navigation `ThemeProvider`.

---

## 5. Referensi Token Web (`montirgo-admin`)

Untuk menjaga konsistensi lintas platform tanpa menyentuh repo terpisah `montirgo-admin`, panel admin web dapat memetakan variabel CSS berikut ke palet yang sama:

```css
:root {
  --bg-canvas: #F8FAFC;
  --bg-surface: #FFFFFF;
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --action-primary: #1E3A8A;
  --action-emergency: #C2410C;
  --status-success: #047857;
  --status-warning: #B45309;
  --status-danger: #B91C1C;
}
```
