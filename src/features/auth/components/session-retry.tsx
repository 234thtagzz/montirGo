import { View } from 'react-native';
import { ErrorState } from '@/components/ui/state';
import { useThemedStyles, type AppTheme } from '@/theme';

/**
 * Ditampilkan saat sesi belum bisa diverifikasi karena gangguan jaringan.
 */
export function SessionRetryScreen({ onRetry }: { onRetry: () => void }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.screen}>
      <ErrorState
        message="Tidak dapat memeriksa sesi karena koneksi bermasalah. Periksa internet lalu coba lagi."
        onRetry={onRetry}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
    justifyContent: 'center' as const,
  },
});
