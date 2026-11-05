import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space, Type } from '@/constants/brand';

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
        <Ionicons name="hourglass-outline" size={19} color={Brand.amber} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Menunggu konfirmasi client</Text>
        <Text style={styles.desc}>
          Client sedang meninjau profil & ratingmu. Kamu bisa berangkat setelah pengajuan
          disetujui.
        </Text>
      </View>
      {remaining != null ? (
        <View style={styles.countdown}>
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
    borderColor: '#F2D48A',
    padding: Space.md,
    marginTop: Space.md,
  },
  pressed: { opacity: 0.9 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: { ...Type.bodyStrong, color: Brand.text, fontWeight: '700' },
  desc: { ...Type.meta, color: '#7C5A12', lineHeight: 15, marginTop: 2 },
  countdown: {
    backgroundColor: Brand.surface,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.xs,
  },
  countdownText: { ...Type.label, color: Brand.amber, fontWeight: '800' },
});
