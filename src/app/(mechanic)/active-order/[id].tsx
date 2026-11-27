import { useCallback, useRef } from 'react';
import {
  RefreshControl,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip } from '@/components/ui/chip';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Money } from '@/components/ui/money';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { AppText } from '@/components/ui/text';
import { OrderDetailsAndCancel } from '@/features/mechanic/active-order/order-details-and-cancel';
import { OrderHeroAndStage } from '@/features/mechanic/active-order/order-hero-and-stage';
import { QuoteAndBillingSection } from '@/features/mechanic/active-order/quote-and-billing-section';
import { useMechanicActiveOrder } from '@/features/mechanic/active-order/use-mechanic-active-order';
import { MECHANIC_CANCEL_REASONS } from '@/features/mechanic/constants';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatIDR } from '@/utils/format';

export default function MechanicOrderDetailScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const scrollRef = useRef<ScrollViewInstance>(null);
  const billingOffset = useRef<number | null>(null);
  const scrolledToBilling = useRef(false);

  const state = useMechanicActiveOrder(id);

  const handleBillingLayout = useCallback(
    (event: LayoutChangeEvent) => {
      billingOffset.current = event.nativeEvent.layout.y;
      if (focus !== 'invoice' || scrolledToBilling.current) return;
      scrolledToBilling.current = true;
      const y = Math.max(0, billingOffset.current - theme.spacing.md);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y, animated: true });
      });
    },
    [focus, theme.spacing.md],
  );

  if (state.loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Order" />
        <LoadingState message="Memuat order..." />
      </View>
    );
  }

  if (state.error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Order" />
        <ErrorState onRetry={() => void state.load()} />
      </View>
    );
  }

  if (!state.order) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Order" />
        <EmptyState
          icon="construct-outline"
          message="Order tidak ditemukan"
          hint="Order mungkin sudah selesai atau bukan milikmu."
          actionLabel="Kembali ke Beranda"
          onPressAction={() => router.replace('/(mechanic)/(tabs)')}
        />
      </View>
    );
  }

  const order = state.order;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Detail Order"
        subtitle={`#${order.id.slice(0, 8).toUpperCase()}`}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: theme.spacing.xxxl + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => {
              state.setRefreshing(true);
              void state.load();
            }}
            tintColor={theme.colors.actionPrimaryBg}
            colors={[theme.colors.actionPrimaryBg]}
          />
        }
      >
        <OrderHeroAndStage
          order={order}
          updatingStage={state.updatingStage}
          onChatClient={() => void state.chatClient()}
          onOpenTrip={() =>
            router.push({
              pathname: '/(mechanic)/trip/[id]',
              params: { id: order.id },
            })
          }
          onAdvanceStage={(toStatus) => void state.advanceStage(toStatus)}
        />

        <View onLayout={handleBillingLayout} />
        <QuoteAndBillingSection
          order={order}
          invoiceItems={state.invoiceItems}
          invoiceTotal={state.invoiceTotal}
          minPrice={state.minPrice}
          maxPrice={state.maxPrice}
          feePercent={state.feePercent}
          platformFee={state.platformFee}
          netPrice={state.netPrice}
          totalError={state.totalError}
          canSendInvoice={state.canSendInvoice}
          draftType={state.draftType}
          onChangeDraftType={state.setDraftType}
          draftDescription={state.draftDescription}
          onChangeDraftDescription={state.setDraftDescription}
          draftAmountText={state.draftAmountText}
          onChangeDraftAmountText={state.setDraftAmountText}
          addingItem={state.addingItem}
          removingItemId={state.removingItemId}
          quotePhotoPaths={state.quotePhotoPaths}
          quotePhotoUrls={state.quotePhotoUrls}
          uploadingPhoto={state.uploadingPhoto}
          submittingQuote={state.submittingQuote}
          withdrawingQuote={state.withdrawingQuote}
          addonDescription={state.addonDescription}
          onChangeAddonDescription={state.setAddonDescription}
          addonAmountText={state.addonAmountText}
          onChangeAddonAmountText={state.setAddonAmountText}
          submittingAddon={state.submittingAddon}
          sendingInvoice={state.sendingInvoice}
          reopeningInvoice={state.reopeningInvoice}
          checkingPayment={state.checkingPayment}
          confirmingCash={state.confirmingCash}
          onAddItem={(override) => void state.addItem(override)}
          onRemoveItem={(item) => void state.removeItem(item)}
          onAddPhoto={(source) => void state.addDamagePhoto(source)}
          onRemovePhoto={(path) => void state.removeDamagePhoto(path)}
          onSubmitQuote={() => void state.submitQuote()}
          onOpenWithdrawQuote={() => state.setWithdrawConfirmOpen(true)}
          onSubmitAddon={() => void state.submitAddon()}
          onOpenInvoiceConfirm={() => state.setInvoiceConfirmOpen(true)}
          onOpenReopenConfirm={() => state.setReopenConfirmOpen(true)}
          onManualCheckPayment={() => void state.manualCheckPayment()}
          onConfirmCash={() => void state.submitCash()}
        />

        <OrderDetailsAndCancel
          order={order}
          history={state.history}
          analysis={state.analysis}
          analysisError={state.analysisError}
          analyzing={state.analyzing}
          canCancel={state.canCancel}
          cancelling={state.cancelling}
          onRetryAnalysis={() => void state.retryAnalysis()}
          onOpenComplaint={() =>
            router.push({
              pathname: '/(mechanic)/complaints',
              params: { requestId: order.id },
            })
          }
          onOpenCancel={state.openCancel}
        />
      </ScrollView>

      <ConfirmSheet
        visible={state.withdrawConfirmOpen}
        title="Tarik & edit estimasi?"
        message="Estimasi dikembalikan ke draf agar kamu dapat mengubah rincian sebelum disetujui client."
        confirmLabel="Ya, tarik estimasi"
        icon="create-outline"
        loading={state.withdrawingQuote}
        onConfirm={() => void state.withdrawQuote()}
        onCancel={() => state.setWithdrawConfirmOpen(false)}
      />

      <ConfirmSheet
        visible={state.invoiceConfirmOpen}
        title="Finalisasi & kirim tagihan?"
        message={`Client akan menerima tagihan resmi sebesar ${formatIDR(state.invoiceTotal)} (${state.invoiceItems.length} item) dan memilih metode pembayaran.`}
        confirmLabel="Kirim tagihan"
        icon="receipt-outline"
        loading={state.sendingInvoice}
        onConfirm={() => void state.sendInvoice()}
        onCancel={() => state.setInvoiceConfirmOpen(false)}
      >
        <View style={styles.sheetBox}>
          {state.invoiceItems.map((item) => (
            <View key={item.id} style={styles.sheetRow}>
              <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.sheetLabel}>
                {item.description}
              </AppText>
              <AppText variant="label" tabular>
                {formatIDR(item.amount)}
              </AppText>
            </View>
          ))}
          <View style={styles.sheetDivider} />
          <View style={styles.sheetRow}>
            <AppText variant="caption" tone="secondary">
              Total
            </AppText>
            <Money value={state.invoiceTotal} size="sm" color={theme.colors.textPrimary} />
          </View>
          <View style={styles.sheetRow}>
            <AppText variant="caption" tone="secondary">
              Fee platform ({state.feePercent}%)
            </AppText>
            <AppText variant="caption" tabular>
              − {formatIDR(state.platformFee)}
            </AppText>
          </View>
          <View style={styles.sheetDivider} />
          <View style={styles.sheetRow}>
            <AppText variant="label">Kamu terima</AppText>
            <Money value={state.netPrice} size="md" color={theme.colors.statusSuccessFg} />
          </View>
        </View>
      </ConfirmSheet>

      <ConfirmSheet
        visible={state.reopenConfirmOpen}
        title="Revisi tagihan?"
        message="Link pembayaran Xendit yang belum dibayar akan dibatalkan dan estimasi dibuka ulang sebagai draf (memerlukan persetujuan ulang client)."
        confirmLabel="Ya, revisi tagihan"
        icon="create-outline"
        loading={state.reopeningInvoice}
        onConfirm={() => void state.submitReopenInvoice()}
        onCancel={() => {
          if (!state.reopeningInvoice) state.setReopenConfirmOpen(false);
        }}
      />

      <ConfirmSheet
        visible={state.cancelOpen}
        title="Batalkan pesanan?"
        message={
          order.status === 'arrived'
            ? 'Setelah tiba di lokasi, alasan pembatalan wajib dipilih sebelum menghentikan pesanan.'
            : 'Pesanan akan dilepas agar client dapat ditangani montir lain.'
        }
        confirmLabel="Ya, batalkan"
        cancelLabel="Kembali"
        icon="close-circle-outline"
        destructive
        loading={state.cancelling}
        onConfirm={() => void state.submitCancel()}
        onCancel={() => {
          if (!state.cancelling) state.setCancelOpen(false);
        }}
      >
        <View style={styles.cancelSheet}>
          <AppText variant="label" tone="secondary">
            {order.status === 'arrived' ? 'Alasan (wajib)' : 'Alasan (opsional)'}
          </AppText>
          <View style={styles.reasonWrap}>
            {MECHANIC_CANCEL_REASONS.map((reason) => {
              const active = state.cancelReason === reason;
              return (
                <Chip
                  key={reason}
                  label={reason}
                  tone="danger"
                  selected={active}
                  disabled={state.cancelling}
                  onPress={() => state.setCancelReason(active ? null : reason)}
                />
              );
            })}
          </View>
        </View>
      </ConfirmSheet>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  content: {
    padding: theme.spacing.screenPadding,
    gap: theme.spacing.md,
  },
  sheetBox: {
    backgroundColor: theme.colors.bgSurfaceSubtle,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  sheetRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
  },
  sheetLabel: {
    flex: 1,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: theme.colors.borderSubtle,
    marginVertical: theme.spacing.xs,
  },
  cancelSheet: {
    gap: theme.spacing.sm,
  },
  reasonWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.xs,
  },
});
