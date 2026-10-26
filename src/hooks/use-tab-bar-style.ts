import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand } from '@/constants/brand';

/** Tinggi area ikon + label tab (tanpa inset sistem). */
const CONTENT_HEIGHT = 56;
/**
 * Jarak minimum dari tepi bawah untuk perangkat yang tidak melaporkan inset
 * (mis. navigasi tombol fisik). Mencegah tab bar menempel di tepi layar.
 */
const MIN_BOTTOM_INSET = 8;
const TOP_PADDING = 6;

/**
 * Gaya tab bar bawah yang mengikuti safe-area perangkat.
 *
 * Padding bawah dihitung dari `insets.bottom` supaya tombol tab tidak
 * bertabrakan dengan home indicator iOS atau tombol navigasi Android
 * (gesture maupun 3 tombol). Nilai inset otomatis berubah ketika pengguna
 * mengganti mode navigasi di pengaturan HP.
 */
export function useTabBarStyle() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, MIN_BOTTOM_INSET);

  return {
    height: CONTENT_HEIGHT + bottomInset,
    paddingTop: TOP_PADDING,
    paddingBottom: bottomInset,
    backgroundColor: Brand.surface,
    borderTopColor: Brand.border,
  };
}
