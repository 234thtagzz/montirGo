import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Ionicons } from '@/components/ui/icon';
import { Money } from '@/components/ui/money';
import { SectionHeader } from '@/components/ui/section-header';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { Surface } from '@/components/ui/surface';
import { SwipeAction } from '@/components/ui/swipe-action';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { MECHANIC_QUOTE_QUICK_PICKS } from '@/features/mechanic/constants';
import { MAX_QUOTE_PHOTOS } from '@/features/mechanic/quote-photo';
import type {
  MechanicOrderDetail,
  OrderInvoiceItem,
} from '@/features/mechanic/service';
import { getQuoteStatusMeta } from '@/features/service-request/status';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatIDR } from '@/utils/format';

interface QuoteAndBillingSectionProps {
  order: MechanicOrderDetail;
  invoiceItems: OrderInvoiceItem[];
  invoiceTotal: number;
  minPrice: number;
  maxPrice: number;
  feePercent: number;
  platformFee: number;
  netPrice: number;
  totalError: string | null;
  canSendInvoice: boolean;
  draftType: 'service' | 'parts';
  onChangeDraftType: (value: 'service' | 'parts') => void;
  draftDescription: string;
  onChangeDraftDescription: (value: string) => void;
  draftAmountText: string;
  onChangeDraftAmountText: (value: string) => void;
  addingItem: boolean;
  removingItemId: string | null;
  quotePhotoPaths: string[];
  quotePhotoUrls: Record<string, string>;
  uploadingPhoto: boolean;
  submittingQuote: boolean;
  withdrawingQuote: boolean;
  addonDescription: string;
  onChangeAddonDescription: (value: string) => void;
  addonAmountText: string;
  onChangeAddonAmountText: (value: string) => void;
  submittingAddon: boolean;
  sendingInvoice: boolean;
  reopeningInvoice: boolean;
  checkingPayment: boolean;
  confirmingCash: boolean;
  onAddItem: (override?: {
    description: string;
    amount: number;
    itemType: 'service' | 'parts';
  }) => void;
  onRemoveItem: (item: OrderInvoiceItem) => void;
  onAddPhoto: (source: 'camera' | 'gallery') => void;
  onRemovePhoto: (path: string) => void;
  onSubmitQuote: () => void;
  onOpenWithdrawQuote: () => void;
  onSubmitAddon: () => void;
  onOpenInvoiceConfirm: () => void;
  onOpenReopenConfirm: () => void;
  onManualCheckPayment: () => void;
  onConfirmCash: () => void;
}

const ITEM_TYPE_OPTIONS: SegmentedOption<'service' | 'parts'>[] = [
  { value: 'service', label: 'Jasa' },
  { value: 'parts', label: 'Suku Cadang' },
];

const ITEM_TYPE_LABEL: Record<OrderInvoiceItem['item_type'], string> = {
  callout_fee: 'Biaya Panggil',
  service: 'Jasa',
  parts: 'Suku Cadang',
  addon: 'Tambahan',
};

function formatCountdown(targetIso: string | null, nowMs: number): string | null {
  if (!targetIso || nowMs === 0) return null;
  const remaining = new Date(targetIso).getTime() - nowMs;
  if (remaining <= 0) return 'Waktu respons habis';
  const totalSec = Math.ceil(remaining / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function QuoteAndBillingSection(props: QuoteAndBillingSectionProps) {
  const {
    order,
    invoiceItems,
    invoiceTotal,
    minPrice,
    maxPrice,
    feePercent,
    platformFee,
    netPrice,
    totalError,
    canSendInvoice,
    draftType,
    onChangeDraftType,
    draftDescription,
    onChangeDraftDescription,
    draftAmountText,
    onChangeDraftAmountText,
    addingItem,
    removingItemId,
    quotePhotoPaths,
    quotePhotoUrls,
    uploadingPhoto,
    submittingQuote,
    withdrawingQuote,
    addonDescription,
    onChangeAddonDescription,
    addonAmountText,
    onChangeAddonAmountText,
    submittingAddon,
    sendingInvoice,
    reopeningInvoice,
    checkingPayment,
    confirmingCash,
    onAddItem,
    onRemoveItem,
    onAddPhoto,
    onRemovePhoto,
    onSubmitQuote,
    onOpenWithdrawQuote,
    onSubmitAddon,
    onOpenInvoiceConfirm,
    onOpenReopenConfirm,
    onManualCheckPayment,
    onConfirmCash,
  } = props;

  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [nowMs, setNowMs] = useState(0);
  const [addonOpen, setAddonOpen] = useState(false);

  const isPendingApproval =
    order.status === 'arrived' && order.quote_status === 'pending_approval';

  useEffect(() => {
    if (!isPendingApproval || !order.quote_expires_at) return;
    const init = setTimeout(() => setNowMs(Date.now()), 0);
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      clearTimeout(init);
      clearInterval(interval);
    };
  }, [isPendingApproval, order.quote_expires_at]);

  const quoteMeta = getQuoteStatusMeta(order.quote_status);
  const countdown = formatCountdown(order.quote_expires_at, nowMs);
  const isArrived = order.status === 'arrived';
  const isDraftQuote = isArrived && order.quote_status === 'draft';
  const isApprovedQuote = isArrived && order.quote_status === 'approved';
  const isCalloutOnly = order.quote_status === 'callout_only';
  const cashAmount = order.price_amount ?? 0;

  return (
    <View style={styles.wrap}>
      <SectionHeader
        eyebrow="ESTIMASI & TAGIHAN"
        title={isArrived ? 'Estimasi biaya & persetujuan' : 'Tagihan terperinci'}
      />

      {isArrived ? (
        <Surface variant="default" padding="lg" style={styles.card}>
          <View style={styles.quoteTopRow}>
            <Badge
              size="sm"
              dot
              tone={quoteMeta.tone}
              icon={quoteMeta.icon}
              label={quoteMeta.shortLabel}
            />
            {isPendingApproval && countdown ? (
              <View style={styles.timerChip}>
                <AppText
                  variant="label"
                  tabular
                  style={{ color: theme.colors.statusWarningFg }}
                >
                  {countdown}
                </AppText>
              </View>
            ) : null}
          </View>

          {order.quote_revision_note ? (
            <Surface variant="outlined" padding="md" style={styles.revisionBox}>
              <Ionicons
                name="chatbox-ellipses-outline"
                size={16}
                color={theme.colors.statusWarningFg}
              />
              <View style={styles.revisionCopy}>
                <AppText variant="label">Catatan revisi dari client</AppText>
                <AppText variant="caption" tone="secondary">
                  {order.quote_revision_note}
                </AppText>
              </View>
            </Surface>
          ) : null}

          {invoiceItems.length === 0 ? (
            <AppText variant="caption" tone="muted">
              Biaya panggil ({formatIDR(order.callout_fee_amount ?? 0)}) akan otomatis
              disertakan oleh server saat estimasi dikirim.
            </AppText>
          ) : (
            <InvoiceItemList
              items={invoiceItems}
              editable={isDraftQuote}
              removingItemId={removingItemId}
              onRemove={onRemoveItem}
            />
          )}

          {isDraftQuote ? (
            <View style={styles.editorSection}>
              <AppText variant="label" tone="secondary">
                Pilih cepat tindakan / suku cadang
              </AppText>
              <View style={styles.quickChips}>
                {MECHANIC_QUOTE_QUICK_PICKS.map((pick) => (
                  <Chip
                    key={pick.label}
                    label={`${pick.label} · ${formatIDR(pick.amount)}`}
                    tone="info"
                    disabled={addingItem}
                    onPress={() =>
                      onAddItem({
                        description: pick.label,
                        amount: pick.amount,
                        itemType: pick.itemType,
                      })
                    }
                  />
                ))}
              </View>

              <Segmented
                options={ITEM_TYPE_OPTIONS}
                value={draftType}
                onChange={onChangeDraftType}
              />

              <TextField
                label="Keterangan rincian"
                value={draftDescription}
                onChangeText={onChangeDraftDescription}
                placeholder="Contoh: Ganti oli mesin + jasa pasang"
              />

              <TextField
                label="Nominal (Rp)"
                value={
                  draftAmountText
                    ? Number(draftAmountText).toLocaleString('id-ID')
                    : ''
                }
                onChangeText={(text) =>
                  onChangeDraftAmountText(text.replace(/[^0-9]/g, ''))
                }
                keyboardType="number-pad"
                placeholder="50.000"
              />

              <Button
                label="Tambah ke Estimasi"
                icon="add-outline"
                variant="secondary"
                loading={addingItem}
                disabled={addingItem}
                onPress={() => onAddItem()}
              />

              <View style={styles.photoBox}>
                <View style={styles.photoHeader}>
                  <AppText variant="label">Foto bukti kerusakan (opsional)</AppText>
                  <AppText variant="caption" tone="muted" tabular>
                    {quotePhotoPaths.length}/{MAX_QUOTE_PHOTOS}
                  </AppText>
                </View>
                <AppText variant="caption" tone="muted">
                  Terkompresi &lt;= 300 KB. Tidak wajib agar sinyal lemah tetap lancar.
                </AppText>

                {quotePhotoPaths.length > 0 ? (
                  <View style={styles.photoGrid}>
                    {quotePhotoPaths.map((path, index) => (
                      <View key={path} style={styles.photoItem}>
                        {quotePhotoUrls[path] ? (
                          <Image
                            source={{ uri: quotePhotoUrls[path] }}
                            style={styles.photoThumb}
                            contentFit="cover"
                            transition={120}
                          />
                        ) : (
                          <View style={[styles.photoThumb, styles.photoPlaceholder]}>
                            <Ionicons
                              name="image-outline"
                              size={20}
                              color={theme.colors.textMuted}
                            />
                          </View>
                        )}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Hapus foto bukti ${index + 1}`}
                          hitSlop={8}
                          onPress={() => onRemovePhoto(path)}
                          style={styles.photoRemove}
                        >
                          <Ionicons
                            name="close"
                            size={14}
                            color={theme.colors.textInverse}
                          />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                {quotePhotoPaths.length < MAX_QUOTE_PHOTOS ? (
                  <View style={styles.photoActions}>
                    <Button
                      label="Kamera"
                      icon="camera-outline"
                      variant="ghost"
                      size="compact"
                      loading={uploadingPhoto}
                      disabled={uploadingPhoto}
                      onPress={() => onAddPhoto('camera')}
                      style={styles.photoBtn}
                    />
                    <Button
                      label="Galeri"
                      icon="images-outline"
                      variant="ghost"
                      size="compact"
                      loading={uploadingPhoto}
                      disabled={uploadingPhoto}
                      onPress={() => onAddPhoto('gallery')}
                      style={styles.photoBtn}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {isPendingApproval ? (
            <View style={styles.pendingQuoteBox}>
              {quotePhotoPaths.length > 0 ? (
                <View style={styles.photoGrid}>
                  {quotePhotoPaths.map((path) =>
                    quotePhotoUrls[path] ? (
                      <Image
                        key={path}
                        source={{ uri: quotePhotoUrls[path] }}
                        style={styles.photoThumb}
                        contentFit="cover"
                      />
                    ) : null,
                  )}
                </View>
              ) : null}
              <AppText variant="caption" tone="secondary">
                Menunggu client menyetujui rincian atau meminta revisi. Jangan bongkar
                bagian berbiaya besar sebelum estimasi disetujui.
              </AppText>
              <Button
                label="Tarik & Edit Estimasi"
                icon="create-outline"
                variant="secondary"
                loading={withdrawingQuote}
                onPress={onOpenWithdrawQuote}
              />
            </View>
          ) : null}

          {isApprovedQuote ? (
            <View style={styles.approvedSection}>
              <View style={styles.addonHeader}>
                <AppText variant="label" tone="secondary">
                  Ada temuan komponen rusak tambahan saat pengerjaan?
                </AppText>
                <Button
                  label={addonOpen ? 'Tutup Form Tambahan' : 'Ajukan Biaya Tambahan'}
                  icon={addonOpen ? 'chevron-up-outline' : 'add-circle-outline'}
                  variant="ghost"
                  size="compact"
                  onPress={() => setAddonOpen((prev) => !prev)}
                />
              </View>

              {addonOpen ? (
                <Surface variant="subtle" padding="md" style={styles.addonCard}>
                  <TextField
                    label="Keterangan tambahan"
                    value={addonDescription}
                    onChangeText={onChangeAddonDescription}
                    placeholder="Contoh: Kabel busi putus"
                  />
                  <TextField
                    label="Nominal tambahan (Rp)"
                    value={
                      addonAmountText
                        ? Number(addonAmountText).toLocaleString('id-ID')
                        : ''
                    }
                    onChangeText={(text) =>
                      onChangeAddonAmountText(text.replace(/[^0-9]/g, ''))
                    }
                    keyboardType="number-pad"
                    placeholder="40.000"
                  />
                  <Button
                    label="Kirim Biaya Tambahan"
                    icon="send-outline"
                    variant="secondary"
                    loading={submittingAddon}
                    disabled={submittingAddon}
                    onPress={onSubmitAddon}
                  />
                </Surface>
              ) : null}
            </View>
          ) : null}

          <View style={styles.summaryBox}>
            <View style={styles.totalBand}>
              <View style={styles.netCopy}>
                <AppText variant="label">Total dihitung sistem</AppText>
                <AppText variant="caption" tone="muted">
                  {invoiceItems.length} baris rincian
                </AppText>
              </View>
              <Money
                value={invoiceTotal}
                size="md"
                color={theme.colors.textPrimary}
              />
            </View>

            {totalError ? (
              <AppText variant="caption" tone="danger">
                {totalError}
              </AppText>
            ) : (
              <AppText variant="caption" tone="muted">
                Rentang {formatIDR(minPrice)} – {formatIDR(maxPrice)}
              </AppText>
            )}

            <View style={styles.priceRow}>
              <AppText variant="caption" tone="secondary">
                Fee platform ({feePercent}%)
              </AppText>
              <AppText variant="caption" tabular>
                − {formatIDR(platformFee)}
              </AppText>
            </View>

            <View style={styles.netBand}>
              <View style={styles.netCopy}>
                <AppText variant="label" tone="success">
                  Estimasi diterima montir
                </AppText>
                <AppText variant="caption" tone="muted">
                  Setelah komisi platform
                </AppText>
              </View>
              <Money
                value={netPrice}
                size="md"
                color={theme.colors.statusSuccessFg}
              />
            </View>
          </View>

          {isDraftQuote ? (
            <Button
              label="Kirim Estimasi ke Client"
              icon="paper-plane-outline"
              variant="primary"
              size="cta"
              loading={submittingQuote}
              disabled={submittingQuote || Boolean(totalError)}
              onPress={onSubmitQuote}
            />
          ) : null}

          {isApprovedQuote ? (
            <Button
              label="Finalisasi & Kirim Tagihan"
              icon="receipt-outline"
              variant="primary"
              size="cta"
              loading={sendingInvoice}
              disabled={!canSendInvoice}
              onPress={onOpenInvoiceConfirm}
            />
          ) : null}
        </Surface>
      ) : invoiceItems.length > 0 ? (
        <Surface variant="default" padding="lg" style={styles.card}>
          <View style={styles.quoteTopRow}>
            <AppText variant="label" tone="secondary">
              Rincian tagihan ke client
            </AppText>
            {isCalloutOnly ? (
              <Badge size="sm" tone="neutral" label="Biaya panggil saja" />
            ) : null}
          </View>
          <InvoiceItemList items={invoiceItems} editable={false} />
          <View style={styles.totalBand}>
            <View style={styles.netCopy}>
              <AppText variant="label">Total tagihan</AppText>
              <AppText variant="caption" tone="muted">
                {invoiceItems.length} baris rincian
              </AppText>
            </View>
            <Money
              value={order.price_amount ?? invoiceTotal}
              size="md"
              color={theme.colors.textPrimary}
            />
          </View>
        </Surface>
      ) : (
        <Surface variant="outlined" padding="md" style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={theme.colors.statusInfoFg}
          />
          <AppText variant="caption" tone="secondary" style={styles.infoText}>
            Estimasi dan rincian tagihan dapat diisi setelah kamu tiba di lokasi
            client.
          </AppText>
        </Surface>
      )}

      {!isArrived && order.status === 'payment' ? (
        <View style={styles.paymentStack}>
          <Surface variant="outlined" padding="lg" style={styles.pendingCard}>
            <View style={styles.pendingTop}>
              <Ionicons
                name={order.payment_method === 'cash' ? 'cash-outline' : 'time-outline'}
                size={20}
                color={theme.colors.statusWarningFg}
              />
              <AppText variant="bodyStrong" style={styles.pendingTitle}>
                Tagihan {formatIDR(cashAmount)} menunggu pembayaran
              </AppText>
            </View>
            <AppText variant="caption" tone="secondary">
              {order.payment_method === 'cash'
                ? 'Client memilih bayar tunai. Pastikan uang diterima penuh sebelum menggeser konfirmasi.'
                : 'Menunggu client menyelesaikan pembayaran QRIS / e-wallet.'}
            </AppText>
            {order.payment_method === 'cash' ? (
              <AppText variant="caption" tone="muted">
                Komisi platform {feePercent}% dipotong dari saldo dompet atau dicatat
                sebagai tunggakan komisi.
              </AppText>
            ) : null}
          </Surface>

          {order.payment_method === 'cash' ? (
            <SwipeAction
              label={`Geser: Terima Tunai ${formatIDR(cashAmount)}`}
              completedLabel="Mengonfirmasi pembayaran…"
              icon="cash-outline"
              tone="success"
              edgeInset={20}
              loading={confirmingCash}
              onConfirm={onConfirmCash}
            />
          ) : (
            <Button
              label="Cek Status Pembayaran"
              icon="refresh-outline"
              variant="secondary"
              loading={checkingPayment}
              disabled={reopeningInvoice}
              onPress={onManualCheckPayment}
            />
          )}

          {!isCalloutOnly ? (
            <Button
              label="Revisi Tagihan"
              icon="create-outline"
              variant="ghost"
              loading={reopeningInvoice}
              disabled={confirmingCash}
              onPress={onOpenReopenConfirm}
            />
          ) : (
            <AppText variant="caption" tone="muted" style={styles.calloutNote}>
              Tagihan dikunci ke biaya panggil saja karena perbaikan tidak dilanjutkan.
            </AppText>
          )}
        </View>
      ) : null}

      {!isArrived && order.status === 'paid' ? (
        <Surface variant="outlined" padding="lg" style={styles.doneCard}>
          <Ionicons
            name="checkmark-done-outline"
            size={20}
            color={theme.colors.statusSuccessFg}
          />
          <View style={styles.doneCopy}>
            <AppText variant="body" tone="success">
              {order.payment_method === 'cash'
                ? `Pembayaran tunai ${formatIDR(cashAmount)} sudah dikonfirmasi.`
                : `Pembayaran ${formatIDR(cashAmount)} sudah lunas.`}
            </AppText>
            {isCalloutOnly ? (
              <AppText variant="caption" tone="secondary">
                Order biaya panggil saja — pendapatan masuk sesuai komisi standar
                dan tidak menambah penghitung job perbaikan.
              </AppText>
            ) : null}
          </View>
        </Surface>
      ) : null}
    </View>
  );
}

function InvoiceItemList({
  items,
  editable,
  removingItemId,
  onRemove,
}: {
  items: OrderInvoiceItem[];
  editable: boolean;
  removingItemId?: string | null;
  onRemove?: (item: OrderInvoiceItem) => void;
}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.itemsList}>
      {items.map((item, index) => {
        const removing = removingItemId === item.id;
        return (
          <View
            key={item.id}
            style={[styles.itemRow, index > 0 && styles.itemRowBorder]}
          >
            <View style={styles.itemCopy}>
              <View style={styles.itemTitleRow}>
                <AppText variant="body" style={styles.itemDesc}>
                  {item.description}
                </AppText>
              </View>
              <View style={styles.itemTags}>
                <Badge
                  size="sm"
                  tone={item.is_locked ? 'info' : 'neutral'}
                  icon={item.is_locked ? 'lock-closed-outline' : undefined}
                  label={ITEM_TYPE_LABEL[item.item_type] ?? 'Jasa'}
                />
                {item.approved_at ? (
                  <Badge size="sm" tone="success" label="Disetujui" />
                ) : null}
              </View>
            </View>
            <AppText variant="label" tabular>
              {formatIDR(item.amount)}
            </AppText>
            {editable && !item.is_locked && onRemove ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Hapus ${item.description}`}
                disabled={removing}
                hitSlop={10}
                onPress={() => onRemove(item)}
                style={({ pressed }) => [
                  styles.removeBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={removing ? 'hourglass-outline' : 'trash-outline'}
                  size={17}
                  color={theme.colors.statusDangerFg}
                />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    gap: theme.spacing.sm,
  },
  card: {
    gap: theme.spacing.md,
  },
  quoteTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  timerChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusWarningBg,
    borderWidth: 1,
    borderColor: theme.colors.statusWarningBorder,
  },
  revisionBox: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusWarningBg,
    borderColor: theme.colors.statusWarningBorder,
  },
  revisionCopy: {
    flex: 1,
    gap: 2,
  },
  itemsList: {
    gap: 0,
  },
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  itemRowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  itemCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  itemTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  itemDesc: {
    flex: 1,
  },
  itemTags: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.xs,
  },
  removeBtn: {
    minWidth: theme.touchTarget.min,
    minHeight: theme.touchTarget.min,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  editorSection: {
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    paddingTop: theme.spacing.md,
  },
  quickChips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.xs,
  },
  photoBox: {
    gap: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    paddingTop: theme.spacing.md,
  },
  photoHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  photoGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  photoItem: {
    position: 'relative' as const,
  },
  photoThumb: {
    width: 82,
    height: 82,
    borderRadius: theme.radii.md,
  },
  photoPlaceholder: {
    backgroundColor: theme.colors.bgSurfaceSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  photoRemove: {
    position: 'absolute' as const,
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.statusDangerFg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  photoActions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  photoBtn: {
    flex: 1,
  },
  pendingQuoteBox: {
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    paddingTop: theme.spacing.md,
  },
  approvedSection: {
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    paddingTop: theme.spacing.md,
  },
  addonHeader: {
    gap: theme.spacing.xs,
  },
  addonCard: {
    gap: theme.spacing.sm,
  },
  summaryBox: {
    gap: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    paddingTop: theme.spacing.md,
  },
  totalBand: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
  },
  netCopy: {
    flex: 1,
    gap: 2,
  },
  priceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  netBand: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.statusSuccessBg,
    borderWidth: 1,
    borderColor: theme.colors.statusSuccessBorder,
    marginTop: theme.spacing.xs,
  },
  infoCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusInfoBg,
    borderColor: theme.colors.statusInfoBorder,
  },
  infoText: {
    flex: 1,
  },
  paymentStack: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  pendingCard: {
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.statusWarningBg,
    borderColor: theme.colors.statusWarningBorder,
  },
  pendingTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  pendingTitle: {
    flex: 1,
  },
  calloutNote: {
    textAlign: 'center' as const,
  },
  doneCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusSuccessBg,
    borderColor: theme.colors.statusSuccessBorder,
  },
  doneCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  pressed: {
    opacity: 0.72,
  },
});
