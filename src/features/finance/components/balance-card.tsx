import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Money } from '@/components/ui/money';
import { Brand, CardShadow, Radius, Space, Type } from '@/constants/brand';
import type { MechanicWallet } from '@/features/finance/types';

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
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <View style={styles.walletIcon}>
            <Ionicons name="wallet-outline" size={15} color={Brand.primary} />
          </View>
          <Text style={styles.label}>Saldo MontirGo Pay</Text>
        </View>
        <View style={styles.availablePill}>
          <View style={styles.availableDot} />
          <Text style={styles.availableText}>{loading ? 'Memuat' : 'Tersedia'}</Text>
        </View>
      </View>

      <Money
        value={available}
        size="hero"
        color={Brand.text}
        prefixColor={Brand.textSecondary}
        style={styles.amount}
      />

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Menunggu settlement</Text>
          <Money value={pending} size="sm" color={Brand.text} />
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>{held > 0 ? 'Sedang dicairkan' : 'Total pendapatan'}</Text>
          <Money
            value={held > 0 ? held : (wallet?.total_earned ?? 0)}
            size="sm"
            color={Brand.text}
          />
        </View>
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
          <Text style={styles.actionPrimaryText}>Tarik saldo</Text>
          <Ionicons name="arrow-up" size={16} color={Brand.volt} />
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
          <Ionicons name="card-outline" size={16} color={Brand.textSecondary} />
          <Text style={styles.actionGhostText}>Rekening</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    marginTop: Space.md,
    borderWidth: 1,
    borderColor: Brand.border,
    ...CardShadow,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  walletIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.xs,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...Type.label, color: Brand.textSecondary, fontWeight: '600' },
  availablePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Brand.greenSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  availableDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Brand.green },
  availableText: { ...Type.micro, color: Brand.green, fontSize: 9, letterSpacing: 0.4 },
  amount: { marginTop: Space.md },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    marginTop: Space.lg,
    paddingTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: Brand.divider,
  },
  metaItem: { flex: 1 },
  metaDivider: { width: 1, height: 26, backgroundColor: Brand.divider },
  metaLabel: { ...Type.meta, color: Brand.textMuted, marginBottom: 3 },
  actions: { flexDirection: 'row', gap: Space.sm, marginTop: Space.lg },
  actionPrimary: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: Brand.ink,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
  },
  actionPrimaryText: { ...Type.label, color: Brand.white, fontWeight: '700' },
  actionGhost: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
  },
  actionGhostText: { ...Type.label, color: Brand.textSecondary, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
