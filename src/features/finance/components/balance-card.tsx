import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/ui/icon';
import { Brand, CardShadow, Gradient, Radius, Space } from '@/constants/brand';
import type { MechanicWallet } from '@/features/finance/types';
import { formatIDR } from '@/utils/format';

interface BalanceCardProps {
  wallet: MechanicWallet | null;
  loading?: boolean;
  onPressWithdraw?: () => void;
  onPressAccounts?: () => void;
}

/** Kartu saldo montir: saldo bisa ditarik + pendapatan yang masih ditahan. */
export function BalanceCard({
  wallet,
  loading = false,
  onPressWithdraw,
  onPressAccounts,
}: BalanceCardProps) {
  const available = wallet?.available_balance ?? 0;
  const pending = wallet?.pending_balance ?? 0;
  const held = wallet?.held_balance ?? 0;

  return (
    <LinearGradient
      colors={Gradient.promoGreen}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View style={styles.labelRow}>
          <Ionicons name="wallet-outline" size={14} color="rgba(255,255,255,0.9)" />
          <Text style={styles.label}>Saldo bisa ditarik</Text>
        </View>
        <View style={styles.livePill}>
          <Text style={styles.livePillText}>{loading ? 'Memuat…' : 'MontirGo Pay'}</Text>
        </View>
      </View>

      <Text style={styles.value} numberOfLines={1}>
        {formatIDR(available)}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Menunggu settlement</Text>
          <Text style={styles.metaValue}>{formatIDR(pending)}</Text>
        </View>
        {held > 0 ? (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Sedang dicairkan</Text>
            <Text style={styles.metaValue}>{formatIDR(held)}</Text>
          </View>
        ) : (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Total pendapatan</Text>
            <Text style={styles.metaValue}>{formatIDR(wallet?.total_earned ?? 0)}</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tarik saldo"
          disabled={!onPressWithdraw}
          onPress={onPressWithdraw}
          style={({ pressed }) => [
            styles.actionPrimary,
            pressed && styles.pressed,
            !onPressWithdraw && styles.disabled,
          ]}
        >
          <Ionicons name="arrow-up-circle-outline" size={16} color={Brand.green} />
          <Text style={styles.actionPrimaryText}>Tarik Saldo</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rekening pencairan"
          disabled={!onPressAccounts}
          onPress={onPressAccounts}
          style={({ pressed }) => [
            styles.actionGhost,
            pressed && styles.pressed,
            !onPressAccounts && styles.disabled,
          ]}
        >
          <Ionicons name="card-outline" size={16} color={Brand.white} />
          <Text style={styles.actionGhostText}>Rekening</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Space.lg,
    marginTop: Space.md,
    ...CardShadow,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  livePill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  livePillText: { color: Brand.white, fontSize: 9.5, fontWeight: '700' },
  value: {
    color: Brand.white,
    fontSize: 28,
    fontWeight: '700',
    marginTop: Space.sm,
    letterSpacing: -0.5,
  },
  metaRow: { flexDirection: 'row', gap: Space.lg, marginTop: Space.md },
  metaItem: { flex: 1 },
  metaLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10.5, fontWeight: '600' },
  metaValue: { color: Brand.white, fontSize: 13, fontWeight: '700', marginTop: 2 },
  actions: { flexDirection: 'row', gap: Space.sm, marginTop: Space.lg },
  actionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Brand.white,
    borderRadius: Radius.md,
    paddingVertical: 10,
  },
  actionPrimaryText: { fontSize: 12.5, fontWeight: '700', color: Brand.green },
  actionGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: 10,
  },
  actionGhostText: { fontSize: 12.5, fontWeight: '700', color: Brand.white },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.6 },
});
