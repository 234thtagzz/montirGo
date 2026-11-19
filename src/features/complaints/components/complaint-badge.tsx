// Pill kecil "Ada keluhan" — dipakai pada riwayat transaksi (lihat
// `listMyComplaintRequestIds`). Gambaran, bukan aksi: tiap transaksi sudah
// punya pintasan detail di tiap layar transaksi.
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Type } from '@/constants/brand';

export function ComplaintBadge() {
  return (
    <View style={styles.badge}>
      <Ionicons name="alert-circle-outline" size={12} color={Brand.red} />
      <Text style={styles.badgeText}>Ada keluhan</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Brand.redSoft,
  },
  badgeText: { ...Type.micro, fontWeight: '700', color: Brand.red },
});
