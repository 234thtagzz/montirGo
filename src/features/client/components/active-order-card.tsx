import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/avatar';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space, Type } from '@/constants/brand';
import { formatDateTime } from '@/utils/format';
import type { ClientOrder } from '@/features/client/types';
import { formatVehicleLabel } from '@/features/vehicles/constants';
import { getProgressLabel, getStatusMeta, TOTAL_STEPS } from '@/features/service-request/status';

interface ActiveOrderCardProps {
  order: ClientOrder;
  onPress: () => void;
}

/**
 * Kartu pesanan aktif — memakai tata bahasa "job ticket" yang sama dengan
 * OrderCard montir: rail status di kiri, chip status, isi ringkas, dan aksi
 * di kanan bawah. Progres hanya muncul saat order benar-benar berjalan.
 */
export function ActiveOrderCard({ order, onPress }: ActiveOrderCardProps) {
  const meta = getStatusMeta(order.status);
  const hasMechanic = Boolean(order.mechanic_id);
  const pendingConfirmation = order.status === 'mechanic_assigned' && hasMechanic;
  const vehicle = formatVehicleLabel(
    order.vehicle_type,
    order.vehicle_brand,
    order.vehicle_model,
  );
  const accent = pendingConfirmation ? Brand.amber : meta.color;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pesanan aktif: ${getProgressLabel(order.status)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderLeftColor: accent }, pressed && styles.pressed]}
    >
      <View style={styles.inner}>
        <View style={styles.top}>
          <View style={[styles.chip, { backgroundColor: meta.background }]}>
            <Ionicons name={meta.icon} size={12} color={meta.color} />
            <Text style={[styles.chipText, { color: meta.color }]}>{meta.shortLabel}</Text>
          </View>
          <Text style={styles.time}>{formatDateTime(order.created_at)}</Text>
        </View>

        {meta.step > 0 ? (
          <View style={styles.progress}>
            {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.segment,
                  index < meta.step && { backgroundColor: accent },
                ]}
              />
            ))}
          </View>
        ) : null}

        <Text style={styles.title}>{getProgressLabel(order.status)}</Text>
        <Text style={styles.issue} numberOfLines={1}>
          {vehicle ? `${vehicle} · ` : ''}
          {order.issue_description}
        </Text>

        <View style={styles.footer}>
          <View style={styles.mechanicRow}>
            {hasMechanic ? (
              <>
                <Avatar
                  name={order.mechanic_name ?? 'Montir'}
                  uri={order.mechanic_avatar}
                  size={28}
                />
                <View style={styles.mechanicText}>
                  <Text style={styles.mechanicName} numberOfLines={1}>
                    {order.mechanic_name ?? 'Montir MontirGo'}
                  </Text>
                  <Text
                    style={[
                      styles.mechanicRole,
                      pendingConfirmation && styles.mechanicRolePending,
                    ]}
                  >
                    {pendingConfirmation ? 'Menunggu konfirmasimu' : 'Montir menuju lokasi'}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.searching}>
                  <ActivityIndicator size="small" color={Brand.primary} />
                </View>
                <Text style={styles.mechanicName}>Mencari montir terdekat…</Text>
              </>
            )}
          </View>

          <View style={styles.action}>
            <Text style={styles.actionText}>
              {pendingConfirmation ? 'Konfirmasi' : 'Lacak'}
            </Text>
            <Ionicons name="arrow-forward" size={13} color={Brand.volt} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    borderLeftWidth: 3,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85 },
  inner: { padding: Space.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  chipText: { ...Type.micro, fontSize: 9.5, letterSpacing: 0.2 },
  time: { ...Type.meta, color: Brand.textMuted },
  progress: { flexDirection: 'row', gap: 4, marginTop: Space.md },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Brand.divider },
  title: { ...Type.bodyStrong, color: Brand.text, marginTop: Space.md, lineHeight: 20 },
  issue: { fontSize: 12, color: Brand.textSecondary, marginTop: 2 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: Brand.divider,
    paddingTop: Space.md,
    gap: Space.md,
  },
  mechanicRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, flex: 1 },
  mechanicText: { flex: 1 },
  mechanicName: { fontSize: 12.5, fontWeight: '600', color: Brand.text },
  mechanicRole: { fontSize: 10.5, color: Brand.textMuted, marginTop: 1 },
  mechanicRolePending: { color: Brand.amber, fontWeight: '700' },
  searching: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Space.md,
    minHeight: 34,
    borderRadius: Radius.pill,
    backgroundColor: Brand.ink,
  },
  actionText: { fontSize: 11.5, fontWeight: '700', color: Brand.white },
});
