import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/avatar';
import { Ionicons } from '@/components/ui/icon';
import { Brand, CardShadow, Radius, Space, Type } from '@/constants/brand';
import { formatDateTime } from '@/utils/format';
import type { ClientOrder } from '@/features/client/types';
import { formatVehicleLabel } from '@/features/vehicles/constants';
import { getProgressLabel, getStatusMeta, TOTAL_STEPS } from '@/features/service-request/status';

interface ActiveOrderCardProps {
  order: ClientOrder;
  onPress: () => void;
}

/**
 * Kartu "perjalanan aktif" — pita status gelap di atas memisahkan kartu ini
 * dari daftar biasa, dan progres hanya muncul saat order benar-benar berjalan.
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
  const accent = pendingConfirmation ? Brand.amber : Brand.volt;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pesanan aktif: ${getProgressLabel(order.status)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.band}>
        <View style={styles.bandRow}>
          <View style={styles.statusRow}>
            <View style={[styles.liveDot, { backgroundColor: accent }]} />
            <Text style={styles.statusText}>{meta.shortLabel}</Text>
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
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {getProgressLabel(order.status)}
        </Text>
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
                  size={30}
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

          <View style={[styles.detailButton, pendingConfirmation && styles.detailButtonPending]}>
            <Text
              style={[styles.detailText, pendingConfirmation && styles.detailTextPending]}
            >
              {pendingConfirmation ? 'Konfirmasi' : 'Lacak'}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={13}
              color={Brand.white}
            />
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
    overflow: 'hidden',
    ...CardShadow,
  },
  pressed: { opacity: 0.95 },
  band: {
    backgroundColor: Brand.ink,
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    paddingBottom: Space.md,
  },
  bandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    ...Type.micro,
    color: Brand.inkText,
    letterSpacing: 0.8,
  },
  time: { fontSize: 10.5, color: Brand.inkMuted },
  progress: { flexDirection: 'row', gap: 4, marginTop: Space.md },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)' },
  body: { padding: Space.lg },
  title: { fontSize: 15.5, fontWeight: '700', color: Brand.text, letterSpacing: -0.2 },
  issue: { fontSize: 12, color: Brand.textSecondary, marginTop: 3 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.lg,
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
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Brand.primary,
    paddingHorizontal: Space.md,
    minHeight: 36,
    borderRadius: Radius.pill,
  },
  detailButtonPending: { backgroundColor: Brand.amber },
  detailText: { fontSize: 11.5, fontWeight: '700', color: Brand.white },
  detailTextPending: { color: Brand.white },
});
