# Katalog Komponen UI (`src/components/ui/`)

Seluruh primitif di `src/components/ui/` bersifat **domain-free**, mendukung Light & Dark Mode lewat `useAppTheme()` / `useThemedStyles()`, bebas dari warna hardcode maupun `fontSize < 11`, dan memenuhi target sentuh minimum `48px`.

---

## 1. Primitif Dasar & Layout

### `Surface` & `Card` (`src/components/ui/surface.tsx`)
Kontainer permukaan dengan `borderCurve: 'continuous'`.
- **Props**: `variant?: 'default' | 'subtle' | 'elevated' | 'outlined' | 'inverse'`, `padding?: 'none' | 'sm' | 'md' | 'lg'`, `radius?: 'sm' | 'md' | 'lg'`.
- `Card` adalah preset dengan default `variant="default"`, `padding="lg"`, `radius="lg"`.

### `AppText` / `Text` (`src/components/ui/text.tsx`)
Pembungkus `RNText` yang mengikat skala `Typography` (`Plus Jakarta Sans` terpetakan per bobot) dan `tone` semantik.
- **Props**: `variant?: TypographyVariant` (default `'body'`), `tone?: 'primary' | 'secondary' | 'muted' | 'inverse' | 'inverseMuted' | SemanticTone`, `tabular?: boolean`, `align?: 'left' | 'center' | 'right'`.

### `ScreenHeader` (`src/components/ui/screen-header.tsx`)
Header layar pendalaman dengan tombol kembali `48x48` dan fallback navigasi sadar-role (`useSegments()` + optional `fallbackHref`).
- Jika `router.canGoBack()` bernilai `false` (mis. dibuka lewat deep link notifikasi), tombol kembali otomatis mengarah ke `fallbackHref`, lalu ke root role aktif (`/(mechanic)/(tabs)`, `/(auth)/login`, atau `/(client)/(tabs)`).

### `SectionHeader` (`src/components/ui/section-header.tsx`)
Judul bagian dengan `eyebrow` (`overline` 11px) dan tombol aksi `>= 48px` tinggi sentuh.

### `ThemeSwitcher` (`src/components/ui/theme-switcher.tsx`)
Pemilih tema 3 arah (`Ikuti Sistem` / `Terang` / `Gelap`) yang terhubung langsung ke `useAppTheme()`.

---

## 2. Aksi, Input & Pilihan

### `Button` (`src/components/ui/button.tsx`)
- **Variants**:
  - `'primary'` (`#0F172A` Light / `#60A5FA` Dark)
  - `'emergency'` (`#C2410C` Light / `#FB923C` Dark — khusus CTA darurat)
  - `'secondary'`, `'ghost'`, `'danger'`, `'dangerSubtle'`, `'whatsapp'`
  - Alias kompatibilitas sementara: `'ink'` -> `'primary'`, `'volt'` -> `'emergency'`
- **Sizes**: `'cta'` (`56px`), `'md'` (`50px`), `'compact'` (`48px`, atau prop `compact`).

### `TextField` (`src/components/ui/text-field.tsx`)
Input teks dengan border `>= 3:1`, focus ring, dan validasi inline pasca-blur / submit.
- **Props**: `label`, `hint`, `error`, `touched`, `showError`, `required`, `leftIcon`, `rightAccessory`, plus semua `TextInputProps`.
- Pesan error muncul saat `error && (blurred || touched || showError)` dengan `accessibilityLiveRegion="polite"`.

### `Chip` (`src/components/ui/chip.tsx`)
Chip pilihan / quick-pick dengan `minHeight: 48`, `accessibilityRole="button"`, dan `accessibilityState={{ selected, disabled }}`.

### `Segmented` (`src/components/ui/segmented.tsx`)
Kontrol tab tersegmentasi (`minHeight: 48` per item) dengan `tabular-nums`.

### `SwipeAction` (`src/components/ui/swipe-action.tsx`)
Tombol geser Reanimated + RNGH v3 khusus aksi berisiko tinggi (`Mulai Perjalanan`, `Sampai di Lokasi`, `Konfirmasi Terima Tunai`).
- **Kontrak Keamanan & Aksesibilitas**:
  - `edgeInset` default `20px` agar track geser aman dari gestur *system back* di tepi layar Android.
  - Memicu `onConfirm()` setelah geseran melewati ambang `82%` (`CONFIRM_THRESHOLD`) lewat `scheduleOnRN`.
  - Menyertakan `accessibilityActions={[{ name: 'activate', label }]}` dan `onAccessibilityAction` sehingga pengguna TalkBack/VoiceOver tetap dapat memicu aksi tanpa gestur geser.
  - Menghormati `useReducedMotion()`.

---

## 3. Umpan Balik, Overlay & Status

### `Badge` / `StatusPill` (`src/components/ui/badge.tsx`)
Pil status semantik (`tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'emergency'`), opsional `dot` dan `icon`, teks minimum `11px`.

### `ToastProvider` & `useToast` (`src/components/ui/toast.tsx`)
Banner non-blocking di bawah safe-area atas dengan animasi Reanimated (`useReducedMotion()`), `accessibilityLiveRegion="polite"`, dan tombol tutup ber-`hitSlop`.

### `BottomSheet` (`src/components/ui/bottom-sheet.tsx`)
Panel bawah Reanimated + RNGH v3 di dalam `<Modal transparent statusBarTranslucent>` dengan `GestureHandlerRootView` tersendiri (wajib di Android agar gestur berjalan di atas window Modal). Mendukung swipe-down dismiss, tap backdrop, dan tombol Back Android.

### `ConfirmSheet` (`src/components/ui/confirm-sheet.tsx`)
Sheet konfirmasi di atas `BottomSheet` untuk aksi finansial dan pembatalan.

### `LoadingState`, `EmptyState`, `ErrorState` (`src/components/ui/state.tsx`)
Tiga state standar daftar dan layar dengan tombol retry/aksi `>= 48px`.

---

## 4. Data Display & Media

### `Money` (`src/components/ui/money.tsx`)
Format nominal Rupiah (`id-ID`) dengan `TabularNums` dan `FontFamily`.
- **Penting**: Selalu beri prop `inline` jika `<Money>` dirender di dalam komponen `<Text>` agar tidak menaruh `<View>` di dalam `<Text>`.

### `Avatar` (`src/components/ui/avatar.tsx`)
Memakai `expo-image` (`contentFit="cover"`, `cachePolicy="memory-disk"`) untuk foto profil, dan palet kontras WCAG AA (`theme.avatar.palette`) untuk inisial fallback.

### `Skeleton` (`src/components/ui/skeleton.tsx`)
Placeholder loading berbasis `react-native-reanimated` yang otomatis menonaktifkan animasi denyut saat `useReducedMotion()` aktif.

### `TabIcon` (`src/components/ui/tab-icon.tsx`)
Ikon tab bawah dengan latar kapsul aktif dari `theme.colors.tabActiveBg`.
