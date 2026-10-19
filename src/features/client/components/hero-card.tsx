import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { Brand, CardShadow, Radius, Space } from '@/constants/brand';

interface HeroCardProps {
  onPressRequest: () => void;
  onPressOrders: () => void;
}

export function HeroCard({ onPressRequest, onPressOrders }: HeroCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.copy}>
          <Text style={styles.title}>Kendaraan bermasalah?</Text>
          <Text style={styles.subtitle}>Montir siap datang ke lokasimu.</Text>
        </View>
        <View style={styles.iconCircle}>
          <Ionicons name="construct-outline" size={24} color={Brand.primary} />
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="Cari Montir"
          icon="flash-outline"
          onPress={onPressRequest}
          compact
          style={styles.primary}
        />
        <Button
          label="Pesanan"
          icon="receipt-outline"
          variant="secondary"
          onPress={onPressOrders}
          compact
          style={styles.secondary}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    marginTop: -44,
    ...CardShadow,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  copy: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: Brand.text },
  subtitle: { fontSize: 12.5, color: Brand.textSecondary, marginTop: 2 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: Space.sm, marginTop: Space.lg },
  primary: { flex: 1.4 },
  secondary: { flex: 1 },
});
