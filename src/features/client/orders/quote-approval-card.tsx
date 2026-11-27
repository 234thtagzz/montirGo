import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Ionicons } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import type { ClientOrder, InvoiceItemType, OrderInvoiceItem } from '@/features/client/types';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatIDR } from '@/utils/format';

const ITEM_TYPE_META: Record<InvoiceItemType, { label: string; tone: 'info' | 'neutral' | 'warning' }> = {
  callout_fee: { label: 'Biaya panggil', tone: 'info' },
  service: { label: 'Jasa', tone: 'neutral' },
  parts: { label: 'Suku cadang', tone: 'neutral' },
  addon: { label: 'Tambahan', tone: 'warning' },
};

function formatCountdown(expiresAt: string | null, now: number): string | null {
  if (!expiresAt || now <= 0) return null;
  const diff = Math.max(0, new Date(expiresAt).getTime() - now);
  if (diff === 0) return 'Batas waktu terlewati';
  const totalSec = Math.ceil(diff / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

interface QuoteApprovalCardProps {
  order: ClientOrder;
  invoiceItems: OrderInvoiceItem[];
  quotePhotoUrls: Record<string, string>;
  busyAction: null | 'approve' | 'request_revision' | 'callout_only';
  onApprove: () => Promise<void>;
  onRequestRevision: (note: string) => Promise<boolean>;
  onAcceptCalloutOnly: () => Promise<void>;
  onRetryPhoto: (path: string) => void;
}

/**
 * Kartu Persetujuan Estimasi Digital di dalam status `arrived`.
 */
export function QuoteApprovalCard({
  order,
  invoiceItems,
  quotePhotoUrls,
  busyAction,
  onApprove,
  onRequestRevision,
  onAcceptCalloutOnly,
  onRetryPhoto,
}: QuoteApprovalCardProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const [reviseOpen, setReviseOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  const [revisionTouched, setRevisionTouched] = useState(false);
  const [calloutConfirmOpen, setCalloutConfirmOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (order.quote_status !== 'pending_approval' || !order.quote_expires_at) return;
    const initTimer = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, [order.quote_status, order.quote_expires_at]);

  if (order.status !== 'arrived') return null;

  const activeItems = invoiceItems.filter((item) => !item.voided_at);
  const totalAmount = activeItems.reduce((sum, item) => sum + item.amount, 0);
  const photoPaths = Array.from(
    new Set([
      ...(order.quote_photo_paths ?? []),
      ...activeItems.flatMap((item) => item.quote_photo_paths ?? []),
    ]),
  ).slice(0, 3);
  const countdown = formatCountdown(order.quote_expires_at, now);
  const revisionError =
    revisionNote.trim().length < 4 ? 'Tulis alasan revisi minimal 4 karakter.' : null;

  if (order.quote_status === 'draft') {
    return (
      <Surface variant="default" padding="lg" style={styles.card}>
        <View style={styles.topRow}>
          <Badge label="Pemeriksaan Awal" tone="info" icon="construct-outline" size="sm" />
          <AppText variant="caption" tone="muted" style={theme.tabularNums}>
            Biaya panggil {formatIDR(order.callout_fee_amount)}
          </AppText>
        </View>
        <AppText variant="title">Montir sedang memeriksa kendaraan</AppText>
        <AppText variant="body" tone="secondary">
          Montir akan mengirim rincian estimasi biaya ke layar ini untuk kamu setujui sebelum pengerjaan dimulai.
        </AppText>
        {order.quote_revision_note ? (
          <View style={styles.noteBox}>
            <AppText variant="overline" tone="warning">
              CATATAN REVISIMU
            </AppText>
            <AppText variant="body">{order.quote_revision_note}</AppText>
          </View>
        ) : null}
      </Surface>
    );
  }

  if (order.quote_status === 'callout_only') {
    return (
      <Surface variant="default" padding="lg" style={styles.card}>
        <View style={styles.topRow}>
          <Badge label="Biaya panggil saja" tone="neutral" icon="receipt-outline" />
          <AppText variant="title" style={theme.tabularNums}>
            {formatIDR(order.callout_fee_amount)}
          </AppText>
        </View>
        <AppText variant="body" tone="secondary">
          Perbaikan lanjutan tidak dijalankan. Montir akan mengirim tagihan sebesar biaya panggil pasti untuk diselesaikan.
        </AppText>
      </Surface>
    );
  }

  if (order.quote_status === 'approved') {
    return (
      <Surface variant="default" padding="lg" style={styles.card}>
        <View style={styles.topRow}>
          <Badge label="Estimasi Disetujui" tone="success" icon="checkmark-circle-outline" />
          <AppText variant="title" style={theme.tabularNums}>
            {formatIDR(totalAmount || order.callout_fee_amount)}
          </AppText>
        </View>
        <AppText variant="body" tone="secondary">
          Montir sedang mengerjakan perbaikan. Rincian yang disetujui:
        </AppText>
        <InvoiceItemsPreview items={activeItems} />
      </Surface>
    );
  }

  // pending_approval
  return (
    <Surface variant="default" padding="lg" style={styles.pendingCard}>
      <View style={styles.topRow}>
        <Badge label="Persetujuan Estimasi" tone="warning" icon="document-text-outline" />
        {countdown ? (
          <Badge label={countdown} tone="warning" icon="time-outline" size="sm" />
        ) : null}
      </View>

      <AppText variant="h2">Tinjau estimasi biaya perbaikan</AppText>
      <AppText variant="body" tone="secondary">
        Pastikan rincian jasa dan suku cadang sesuai sebelum montir mulai memperbaiki.
      </AppText>

      <InvoiceItemsPreview items={activeItems} />

      <View style={styles.totalBar}>
        <AppText variant="label" tone="secondary">
          Total estimasi (termasuk biaya panggil)
        </AppText>
        <AppText variant="h2" style={theme.tabularNums}>
          {formatIDR(totalAmount)}
        </AppText>
      </View>

      {photoPaths.length > 0 ? (
        <View style={styles.photosSection}>
          <AppText variant="caption" tone="muted">
            Foto bukti kerusakan dari montir (ketuk untuk perbesar)
          </AppText>
          <View style={styles.photosRow}>
            {photoPaths.map((path) => {
              const url = quotePhotoUrls[path];
              return (
                <Pressable
                  key={path}
                  accessibilityRole="button"
                  accessibilityLabel="Lihat foto bukti kerusakan"
                  onPress={() => {
                    if (url) setPreviewUrl(url);
                    else onRetryPhoto(path);
                  }}
                  style={({ pressed }) => [styles.photoThumbWrap, pressed && styles.pressed]}
                >
                  {url ? (
                    <Image
                      source={{ uri: url }}
                      style={styles.photoThumb}
                      contentFit="cover"
                      transition={150}
                      onError={() => onRetryPhoto(path)}
                    />
                  ) : (
                    <View style={styles.photoFallback}>
                      <Ionicons name="image-outline" size={20} color={theme.colors.textMuted} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Setujui Estimasi"
          icon="checkmark-circle-outline"
          variant="primary"
          size="cta"
          loading={busyAction === 'approve'}
          disabled={busyAction !== null}
          onPress={() => void onApprove()}
        />

        <Button
          label={reviseOpen ? 'Tutup Form Revisi' : 'Minta Revisi'}
          icon="create-outline"
          variant="secondary"
          size="md"
          disabled={busyAction !== null}
          onPress={() => setReviseOpen((prev) => !prev)}
        />

        {reviseOpen ? (
          <View style={styles.reviseBox}>
            <TextField
              label="Alasan / permintaan revisi"
              required
              multiline
              value={revisionNote}
              onChangeText={setRevisionNote}
              placeholder="Contoh: Cukup tambal ban saja, kampas rem nanti."
              error={revisionError}
              showError={revisionTouched}
            />
            <Button
              label="Kirim Permintaan Revisi"
              icon="send-outline"
              variant="secondary"
              loading={busyAction === 'request_revision'}
              disabled={busyAction !== null}
              onPress={async () => {
                setRevisionTouched(true);
                if (revisionError) return;
                const ok = await onRequestRevision(revisionNote.trim());
                if (ok) {
                  setRevisionNote('');
                  setRevisionTouched(false);
                  setReviseOpen(false);
                }
              }}
            />
          </View>
        ) : null}

        <Button
          label={`Tolak & Bayar Biaya Panggil Saja (${formatIDR(order.callout_fee_amount)})`}
          icon="close-circle-outline"
          variant="dangerSubtle"
          size="md"
          loading={busyAction === 'callout_only'}
          disabled={busyAction !== null}
          onPress={() => setCalloutConfirmOpen(true)}
        />
      </View>

      <ConfirmSheet
        visible={calloutConfirmOpen}
        destructive
        loading={busyAction === 'callout_only'}
        icon="receipt-outline"
        title="Tolak perbaikan & bayar biaya panggil saja?"
        message={`Perbaikan lanjutan dibatalkan dan total tagihan dikunci sebesar biaya panggil pasti (${formatIDR(order.callout_fee_amount)}).`}
        confirmLabel="Ya, Biaya Panggil Saja"
        cancelLabel="Kembali"
        onConfirm={() => {
          setCalloutConfirmOpen(false);
          void onAcceptCalloutOnly();
        }}
        onCancel={() => setCalloutConfirmOpen(false)}
      />

      <Modal
        visible={Boolean(previewUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUrl(null)}
      >
        <View style={styles.lightboxBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup foto"
            onPress={() => setPreviewUrl(null)}
            style={styles.lightboxClose}
          >
            <Ionicons name="close" size={24} color={theme.colors.textInverse} />
          </Pressable>
          {previewUrl ? (
            <Image
              source={{ uri: previewUrl }}
              style={styles.lightboxImage}
              contentFit="contain"
            />
          ) : null}
        </View>
      </Modal>
    </Surface>
  );
}

function InvoiceItemsPreview({ items }: { items: OrderInvoiceItem[] }) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  if (items.length === 0) return null;

  return (
    <View style={styles.itemsList}>
      {items.map((item) => {
        const meta = ITEM_TYPE_META[item.item_type] ?? ITEM_TYPE_META.service;
        return (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <AppText variant="body">{item.description}</AppText>
              <View style={styles.itemTagRow}>
                <Badge label={meta.label} tone={meta.tone} size="sm" />
                {item.is_locked ? (
                  <Ionicons name="lock-closed" size={12} color={theme.colors.textMuted} />
                ) : null}
              </View>
            </View>
            <AppText variant="label" style={theme.tabularNums}>
              {formatIDR(item.amount)}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  card: {
    gap: theme.spacing.sm,
  },
  pendingCard: {
    gap: theme.spacing.md,
    borderColor: theme.colors.statusWarningBorder,
    borderWidth: 1.5,
  },
  topRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
    flexWrap: 'wrap' as const,
  },
  noteBox: {
    backgroundColor: theme.colors.statusWarningBg,
    borderRadius: theme.radii.sm,
    padding: theme.spacing.md,
    gap: theme.spacing.xxs,
  },
  itemsList: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    paddingTop: theme.spacing.xs,
  },
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  itemLeft: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  itemTagRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  totalBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: theme.colors.bgSurfaceSubtle,
    borderRadius: theme.radii.sm,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  photosSection: {
    gap: theme.spacing.xs,
  },
  photosRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    flexWrap: 'wrap' as const,
  },
  photoThumbWrap: {
    width: 84,
    height: 84,
    borderRadius: theme.radii.md,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  photoThumb: {
    width: '100%' as const,
    height: '100%' as const,
  },
  photoFallback: {
    flex: 1,
    backgroundColor: theme.colors.bgSurfaceSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  actions: {
    gap: theme.spacing.sm,
  },
  reviseBox: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgSurfaceSubtle,
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlayScrim,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: theme.spacing.lg,
  },
  lightboxClose: {
    position: 'absolute' as const,
    top: 48,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.bgInverse,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 10,
  },
  lightboxImage: {
    width: '100%' as const,
    height: '80%' as const,
  },
  pressed: { opacity: 0.78 },
});
