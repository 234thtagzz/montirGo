import { StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ui/state';
import { Brand } from '@/constants/brand';

/**
 * Ditampilkan saat sesi belum bisa diverifikasi karena gangguan jaringan.
 * Berbeda dari sesi berakhir: pengguna tidak dipaksa logout, cukup coba lagi.
 */
export function SessionRetryScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.screen}>
      <ErrorState
        message="Tidak dapat memeriksa sesi karena koneksi bermasalah. Periksa internet lalu coba lagi."
        onRetry={onRetry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.background,
    justifyContent: 'center',
  },
});
