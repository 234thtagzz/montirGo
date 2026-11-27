import { View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import type { ClientOrder, InvoiceItemType, OrderInvoiceItem } from '@/features/client/types';
import type { OrderPayment } from '@/features/finance/service';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDateTime, formatIDR } from '@/utils/format';

const ITEM_TYPE_LABEL: Record<InvoiceItemType, string> = {
  callout_fee: 'Biaya panggil',
  service: 'Jasa',
  parts: 'Suku cadang',
  addon: 'Tambahan',
};

interface InvoiceAndPaymentSectionProps {
  order: ClientOrder;
  invoiceItems: OrderInvoiceItem[];
  payment: OrderPayment | null;
  cashSelected: boolean;
  paidWithCash: boolean;
  paying: boolean;
  checkingPayment: boolean;
  choosingCash: boolean;
  onPayOnline: () => void;
  onManualCheckPayment: () => void;
  onOpenCashConfirm: () => void;
}

export function InvoiceAndPaymentSection({
  order,
  invoiceItems,
  payment,
  cashSelected,
  paidWithCash,
  paying,
  checkingPayment,
  choosingCash,
  onPayOnline,
  onManualCheckPayment,
  onOpenCashConfirm,
}: InvoiceAndPaymentSectionProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  if (order.status !== 'payment' && order.status !== 'paid') return null;

  const isCalloutOnly = order.quote_status === 'callout_only';

  return (
    <View style={styles.wrap}>
      <SectionHeader eyebrow="TAGIHAN" title="Pembayaran" />

      {invoiceItems.length > 0 ? (
        <Surface variant="default" padding="lg" style={styles.card}>
          <View style={styles.headerRow}>
            <AppText variant="title">Rincian tagihan</AppText>
            {isCalloutOnly ? (
              <Badge label="Biaya panggil saja" tone="neutral" size="sm" />
            ) : null}
          </View>

          {invoiceItems.map((item) => (
            <View key={item.id} style={styles.invoiceRow}>
              <View style={styles.itemCopy}>
                <AppText variant="body">{item.description}</AppText>
                <AppText variant="caption" tone="muted">
                  {ITEM_TYPE_LABEL[item.item_type] ?? 'Jasa'}
                  {item.is_locked ? ' · Terkunci' : ''}
                </AppText>
              </View>
              <AppText variant="label" style={theme.tabularNums}>
                {formatIDR(item.amount)}
              </AppText>
            </View>
          ))}

          <View style={styles.totalRow}>
            <AppText variant="label" tone="secondary">
              Total
            </AppText>
            <AppText variant="title" style={theme.tabularNums}>
              {formatIDR(invoiceItems.reduce((sum, item) => sum + item.amount, 0))}
            </AppText>
          </View>
        </Surface>
      ) : null}

      <Surface variant="default" padding="lg" style={styles.card}>
        <View style={styles.paymentTop}>
          <View style={styles.paymentAmountWrap}>
            <AppText variant="caption" tone="muted">
              Total tagihan
            </AppText>
            <AppText variant="display" style={theme.tabularNums}>
              {formatIDR(order.price_amount ?? payment?.amount ?? 0)}
            </AppText>
          </View>
          <Badge
            label={
              order.status === 'paid'
                ? 'Lunas'
                : cashSelected
                  ? 'Tunai'
                  : 'Belum dibayar'
            }
            tone={order.status === 'paid' ? 'success' : 'warning'}
          />
        </View>

        {isCalloutOnly ? (
          <View style={styles.calloutOnlyNote}>
            <Ionicons name="receipt-outline" size={16} color={theme.colors.textSecondary} />
            <AppText variant="caption" tone="secondary" style={styles.flexCopy}>
              Transaksi ini hanya menagihkan Biaya Panggil Pasti (tanpa perbaikan lanjutan).
            </AppText>
          </View>
        ) : null}

        {order.status === 'paid' ? (
          <View style={styles.paidRow}>
            <Ionicons name="checkmark-circle" size={18} color={theme.colors.statusSuccessFg} />
            <AppText variant="label" tone="success" style={styles.flexCopy}>
              {paidWithCash ? 'Pembayaran tunai dikonfirmasi montir' : 'Pembayaran diterima'}
              {payment?.paid_at ? ` · ${formatDateTime(payment.paid_at)}` : ''}.
            </AppText>
          </View>
        ) : cashSelected ? (
          <View style={styles.cashWrap}>
            <View style={styles.cashCard}>
              <View style={styles.cashHeader}>
                <Ionicons name="cash-outline" size={18} color={theme.colors.statusWarningFg} />
                <AppText variant="label" tone="warning">
                  Bayar tunai ke montir
                </AppText>
              </View>
              <AppText variant="body" tone="secondary">
                Siapkan uang tunai{' '}
                <AppText variant="label" style={theme.tabularNums}>
                  {formatIDR(order.price_amount ?? payment?.amount ?? 0)}
                </AppText>{' '}
                dan bayar langsung ke {order.mechanic_name ?? 'montir'}. Pembayaran dicatat setelah montir menekan konfirmasi.
              </AppText>
              <View style={styles.cashStatus}>
                <Ionicons name="time-outline" size={14} color={theme.colors.statusWarningFg} />
                <AppText variant="caption" tone="warning">
                  Menunggu konfirmasi montir
                </AppText>
              </View>
            </View>
            <Button
              label="Ganti ke Pembayaran Online"
              icon="card-outline"
              variant="secondary"
              loading={paying}
              onPress={onPayOnline}
            />
          </View>
        ) : (
          <View style={styles.payActions}>
            <AppText variant="body" tone="secondary">
              Bayar dengan QRIS, GoPay, OVO, DANA, atau ShopeePay di halaman aman Xendit. Status pesanan diperbarui otomatis setelah pembayaran berhasil.
            </AppText>
            {payment?.expires_at ? (
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
                <AppText variant="caption" tone="muted">
                  Link pembayaran berlaku sampai {formatDateTime(payment.expires_at)}
                </AppText>
              </View>
            ) : null}
            <Button
              label="Bayar Sekarang"
              icon="card-outline"
              variant="primary"
              size="cta"
              loading={paying}
              onPress={onPayOnline}
            />
            {payment?.payment_session_id ? (
              <Button
                label="Cek Status Pembayaran"
                icon="refresh-outline"
                variant="secondary"
                loading={checkingPayment}
                disabled={paying}
                onPress={onManualCheckPayment}
              />
            ) : null}
            <Button
              label="Bayar Tunai ke Montir"
              icon="cash-outline"
              variant="secondary"
              loading={choosingCash}
              disabled={paying}
              onPress={onOpenCashConfirm}
            />
          </View>
        )}
      </Surface>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    gap: theme.spacing.md,
  },
  card: {
    gap: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  invoiceRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  itemCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  totalRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingTop: theme.spacing.sm,
  },
  paymentTop: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
  },
  paymentAmountWrap: {
    gap: theme.spacing.xxs,
  },
  calloutOnlyNote: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.bgSurfaceSubtle,
    borderRadius: theme.radii.sm,
    padding: theme.spacing.md,
  },
  paidRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  cashWrap: {
    gap: theme.spacing.md,
  },
  cashCard: {
    backgroundColor: theme.colors.statusWarningBg,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.statusWarningBorder,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cashHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  cashStatus: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  payActions: {
    gap: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  flexCopy: { flex: 1 },
});
