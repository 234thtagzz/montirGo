import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space } from '@/constants/brand';

interface AssignmentPendingCardProps {
  /** Batas waktu client mengonfirmasi; null bila tidak diketahui. */
  expiresAt?: string | null;
  onPress?: () => void;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Pemberitahuan untuk montir bahwa pengajuannya masih menunggu konfirmasi
 * client. Selama status `mechanic_assigned`, montir belum boleh berangkat
 * atau mengubah status order.
 */
export function AssignmentPendingCard({ expiresAt, onPress }: AssignmentPendingCardProps) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [expiresAt]);

  const remaining =
    expiresAt == null || now === 0 ? null : Math.max(0, new Date(expiresAt).getTime() - now);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel="Menunggu konfirmasi client"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="hourglass-outline" size={20} color={Brand.amber} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Menunggu konfirmasi client</Text>
        <Text style={styles.desc}>
          Client sedang meninjau rating, ulasan, dan profil bengkelmu. Kamu bisa berangkat
          setelah client menyetujui pengajuan.
        </Text>
      </View>
      {remaining != null ? (
        <View style={styles.countdown}>
          <Ionicons name="time-outline" size={12} color={Brand.amber} />
          <Text style={styles.countdownText}>{formatRemaining(remaining)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.amber,
    padding: Space.lg,
    marginTop: Space.md,
  },
  pressed: { opacity: 0.9 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: { fontSize: 13.5, fontWeight: '800', color: Brand.text },
  desc: { fontSize: 11, color: Brand.textSecondary, lineHeight: 16, marginTop: 3 },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Brand.surface,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  countdownText: { fontSize: 11, fontWeight: '800', color: Brand.amber },
});
