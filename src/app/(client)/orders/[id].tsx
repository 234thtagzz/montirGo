import { RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { AssignmentConfirmationSheet } from '@/features/client/components/assignment/assignment-confirmation-sheet';
import { InvoiceAndPaymentSection } from '@/features/client/orders/invoice-and-payment-section';
import { OrderDetailsAndTimeline } from '@/features/client/orders/order-details-and-timeline';
import { OrderHeroAndMechanic } from '@/features/client/orders/order-hero-and-mechanic';
import { OrderReviewSection } from '@/features/client/orders/order-review-section';
import { QuoteApprovalCard } from '@/features/client/orders/quote-approval-card';
import { useClientOrder } from '@/features/client/orders/use-client-order';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatIDR } from '@/utils/format';

export default function ClientOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const vm = useClientOrder(id);

  if (vm.loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Pesanan" />
        <LoadingState message="Memuat pesanan..." />
      </View>
    );
  }

  if (vm.error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Pesanan" />
        <ErrorState onRetry={vm.load} />
      </View>
    );
  }

  if (!vm.order) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Pesanan" />
        <EmptyState
          icon="receipt-outline"
          message="Pesanan tidak ditemukan"
          hint="Pesanan mungkin sudah dihapus atau bukan milik akun ini."
          actionLabel="Kembali ke Beranda"
          onPressAction={() => vm.router.replace('/(client)/(tabs)')}
        />
      </View>
    );
  }

  const order = vm.order;
  const cashSelected = order.status === 'payment' && order.payment_method === 'cash';
  const paidWithCash = order.status === 'paid' && vm.payment?.method === 'cash';

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Detail Pesanan"
        subtitle={`#${order.id.slice(0, 8).toUpperCase()}`}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: theme.spacing.xxxl + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={vm.refreshing}
            onRefresh={vm.refreshAll}
            tintColor={theme.colors.actionPrimaryAltBg}
            colors={[theme.colors.actionPrimaryAltBg]}
          />
        }
      >
        <OrderHeroAndMechanic
          order={order}
          assignedMechanic={vm.assignedMechanic}
          paidWithCash={paidWithCash}
          cashSelected={cashSelected}
          onOpenTracking={() =>
            vm.router.push({ pathname: '/(client)/tracking/[id]', params: { id: order.id } })
          }
          onOpenAssignment={() => vm.setAssignmentVisible(true)}
          onChatMechanic={() => void vm.chatMechanic()}
        />

        <QuoteApprovalCard
          order={order}
          invoiceItems={vm.invoiceItems}
          quotePhotoUrls={vm.quotePhotoUrls}
          busyAction={vm.quoteBusy}
          onApprove={vm.approveQuote}
          onRequestRevision={vm.requestQuoteRevision}
          onAcceptCalloutOnly={vm.acceptCalloutOnly}
          onRetryPhoto={(path) => void vm.retryQuotePhoto(path)}
        />

        <InvoiceAndPaymentSection
          order={order}
          invoiceItems={vm.invoiceItems}
          payment={vm.payment}
          cashSelected={cashSelected}
          paidWithCash={paidWithCash}
          paying={vm.paying}
          checkingPayment={vm.checkingPayment}
          choosingCash={vm.choosingCash}
          onPayOnline={() => void vm.payOrder()}
          onManualCheckPayment={() => void vm.manualCheckPayment()}
          onOpenCashConfirm={() => vm.setCashVisible(true)}
        />

        <OrderReviewSection
          order={order}
          review={vm.review}
          rating={vm.reviewRating}
          comment={vm.reviewComment}
          reviewError={vm.reviewError}
          submitting={vm.submittingReview}
          onChangeRating={vm.setReviewRating}
          onChangeComment={vm.setReviewComment}
          onSubmitReview={() => void vm.sendReview()}
        />

        <OrderDetailsAndTimeline
          order={order}
          history={vm.history}
          analysis={vm.analysis}
          analysisError={vm.analysisError}
          analyzing={vm.analyzing}
          cancelling={vm.cancelling}
          onRetryAnalysis={() => void vm.retryAnalysis()}
          onOpenComplaint={() =>
            vm.router.push({ pathname: '/(client)/complaints', params: { requestId: order.id } })
          }
          onOpenCancel={() => vm.setCancelVisible(true)}
        />
      </ScrollView>

      <ConfirmSheet
        visible={vm.cancelVisible}
        destructive
        loading={vm.cancelling}
        icon="close-circle-outline"
        title="Batalkan pesanan?"
        message="Montir tidak akan datang jika pesanan dibatalkan. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Ya, batalkan"
        cancelLabel="Tidak"
        onConfirm={() => void vm.doCancel()}
        onCancel={() => (vm.cancelling ? undefined : vm.setCancelVisible(false))}
      />

      <ConfirmSheet
        visible={vm.cashVisible}
        loading={vm.choosingCash}
        icon="cash-outline"
        title="Bayar tunai ke montir?"
        message={`Siapkan uang tunai ${formatIDR(
          order.price_amount ?? vm.payment?.amount ?? 0,
        )} dan bayar langsung ke ${
          order.mechanic_name ?? 'montir'
        }. Pembayaran dicatat setelah montir mengonfirmasi.`}
        confirmLabel="Ya, bayar tunai"
        onConfirm={() => void vm.chooseCash()}
        onCancel={() => (vm.choosingCash ? undefined : vm.setCashVisible(false))}
      />

      <AssignmentConfirmationSheet
        visible={vm.assignmentVisible && order.status === 'mechanic_assigned'}
        order={order}
        onResolved={vm.handleAssignmentResolved}
        onRefresh={vm.refreshAssignment}
      />
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
    gap: theme.spacing.lg,
  },
});
