import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useToast } from '@/components/ui/toast';
import {
  confirmCashPayment,
  getFinanceSettings,
  syncPaymentStatus,
  type FinanceSettings,
} from '@/features/finance/service';
import {
  deleteQuotePhoto,
  MAX_QUOTE_PHOTOS,
  pickQuotePhoto,
  resolveQuotePhotoUrls,
  uploadQuotePhoto,
} from '@/features/mechanic/quote-photo';
import {
  addOrderInvoiceItem,
  cancelOrderAsMechanic,
  canMechanicCancel,
  deleteOrderInvoiceItem,
  getMyId,
  getMyOrder,
  listOrderInvoiceItems,
  listOrderStatusHistory,
  reopenOrderInvoice,
  requestQuoteAddon,
  sendOrderInvoice,
  submitOrderQuote,
  updateOrderStatus,
  withdrawOrderQuote,
  type MechanicOrderDetail,
  type OrderInvoiceItem,
  type OrderStatusEvent,
} from '@/features/mechanic/service';
import {
  analyzeRequest,
  getRequestAnalysis,
  type AiAnalysis,
} from '@/features/service-request/ai';
import { useRefreshOnForeground } from '@/hooks/use-foreground';
import { createRealtimeChannel, subscribeWithResync } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { formatIDR } from '@/utils/format';
import { openWhatsApp } from '@/utils/whatsapp';

export function useMechanicActiveOrder(id: string | undefined) {
  const { showToast } = useToast();

  const [order, setOrder] = useState<MechanicOrderDetail | null>(null);
  const [history, setHistory] = useState<OrderStatusEvent[]>([]);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<OrderInvoiceItem[]>([]);

  // Form draf estimasi / item
  const [draftType, setDraftType] = useState<'service' | 'parts'>('service');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftAmountText, setDraftAmountText] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  // Foto bukti kerusakan (opsional, maks 3)
  const [quotePhotoPaths, setQuotePhotoPaths] = useState<string[]>([]);
  const [quotePhotoUrls, setQuotePhotoUrls] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Aksi Digital Approval & Tagihan
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [withdrawingQuote, setWithdrawingQuote] = useState(false);
  const [addonDescription, setAddonDescription] = useState('');
  const [addonAmountText, setAddonAmountText] = useState('');
  const [submittingAddon, setSubmittingAddon] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [reopeningInvoice, setReopeningInvoice] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [confirmingCash, setConfirmingCash] = useState(false);

  // Sheets konfirmasi
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false);
  const [invoiceConfirmOpen, setInvoiceConfirmOpen] = useState(false);
  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);

  const loadAnalysis = useCallback(async () => {
    if (!id) return;
    try {
      setAnalysis(await getRequestAnalysis(id));
      setAnalysisError(null);
    } catch {
      setAnalysisError('Analisis AI gagal dimuat. Periksa koneksi lalu coba lagi.');
    }
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [detail, events, items] = await Promise.all([
        getMyOrder(id),
        listOrderStatusHistory(id),
        listOrderInvoiceItems(id).catch((): OrderInvoiceItem[] => []),
      ]);
      setOrder(detail);
      setHistory(events);
      setInvoiceItems(items);
      const serverPhotos = detail?.quote_photo_paths ?? [];
      setQuotePhotoPaths((prev) =>
        detail?.quote_status === 'draft' && prev.length > 0 && serverPhotos.length === 0
          ? prev
          : serverPhotos,
      );
      const allPhotoPaths = Array.from(
        new Set([
          ...serverPhotos,
          ...items.flatMap((item) => item.quote_photo_paths ?? []),
        ]),
      );
      if (allPhotoPaths.length > 0) {
        const urls = await resolveQuotePhotoUrls(allPhotoPaths).catch(
          (): Record<string, string> => ({}),
        );
        setQuotePhotoUrls((prev) => ({ ...prev, ...urls }));
      }
      setError(false);
      await loadAnalysis();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, loadAnalysis]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useRefreshOnForeground(() => {
    void load();
  });

  useEffect(() => {
    if (!id) return;
    const channel = createRealtimeChannel(`mechanic-order-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `id=eq.${id}` },
        () => void load(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_invoice_items',
          filter: `request_id=eq.${id}`,
        },
        () => void load(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_diagnoses', filter: `request_id=eq.${id}` },
        () => void loadAnalysis(),
      );
    subscribeWithResync(channel, () => void load());
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load, loadAnalysis]);

  // Polling Xendit cadangan dengan backoff saat menunggu pembayaran online.
  const orderStatus = order?.status;
  const orderPaymentMethod = order?.payment_method;
  useEffect(() => {
    if (!id || orderStatus !== 'payment' || orderPaymentMethod === 'cash') return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const delays = [15_000, 30_000, 60_000];
    let attempt = 0;

    const tick = async () => {
      try {
        const result = await syncPaymentStatus(id);
        if (!active) return;
        if (result.status === 'paid') {
          await load();
          return;
        }
      } catch {
        // Coba lagi sesuai jadwal backoff.
      }
      if (!active) return;
      const delay = delays[Math.min(attempt, delays.length - 1)];
      attempt += 1;
      timer = setTimeout(() => {
        void tick();
      }, delay);
    };

    void tick();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [id, orderStatus, orderPaymentMethod, load]);

  useEffect(() => {
    let cancelled = false;
    getFinanceSettings()
      .then((value) => {
        if (!cancelled) setSettings(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const invoiceTotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
  const minPrice = settings?.minOrderPrice ?? 10000;
  const maxPrice = settings?.maxOrderPrice ?? 10000000;
  const feePercent = settings?.feePercent ?? 10;
  const platformFee = Math.round((invoiceTotal * feePercent) / 100);
  const netPrice = invoiceTotal - platformFee;
  const totalError =
    invoiceTotal === 0
      ? null
      : invoiceTotal < minPrice
        ? `Minimal total tagihan ${formatIDR(minPrice)}.`
        : invoiceTotal > maxPrice
          ? `Maksimal total tagihan ${formatIDR(maxPrice)}.`
          : null;

  const canSendInvoice =
    !sendingInvoice &&
    order?.status === 'arrived' &&
    order.quote_status === 'approved' &&
    invoiceItems.length > 0 &&
    invoiceTotal >= minPrice &&
    invoiceTotal <= maxPrice &&
    !totalError;

  const advanceStage = async (toStatus: 'on_the_way' | 'arrived') => {
    if (!order || updatingStage) return;
    setUpdatingStage(true);
    try {
      await updateOrderStatus(order.id, toStatus);
      await load();
      showToast({
        tone: 'success',
        message:
          toStatus === 'on_the_way'
            ? 'Perjalanan dimulai. Client dapat memantau lokasimu.'
            : 'Tiba di lokasi! Susun estimasi biaya untuk client.',
      });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal mengubah status',
        message: e instanceof Error ? e.message : 'Coba lagi beberapa saat lagi.',
      });
    } finally {
      setUpdatingStage(false);
    }
  };

  const addItem = async (override?: {
    description: string;
    amount: number;
    itemType: 'service' | 'parts';
  }) => {
    if (!order || addingItem) return;
    const description = (override?.description ?? draftDescription).trim();
    const amount =
      override?.amount ?? (Number(draftAmountText.replace(/[^0-9]/g, '')) || 0);
    const itemType = override?.itemType ?? draftType;

    if (!description) {
      showToast({
        tone: 'warning',
        message: 'Tulis keterangan tindakan atau suku cadang terlebih dahulu.',
      });
      return;
    }
    if (amount <= 0) {
      showToast({
        tone: 'warning',
        message: 'Isi harga rincian lebih dari 0.',
      });
      return;
    }

    setAddingItem(true);
    try {
      const item = await addOrderInvoiceItem(order.id, {
        description,
        amount,
        itemType,
      });
      setInvoiceItems((prev) => [...prev, item]);
      if (!override) {
        setDraftDescription('');
        setDraftAmountText('');
      }
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal menambah rincian',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
    } finally {
      setAddingItem(false);
    }
  };

  const removeItem = async (item: OrderInvoiceItem) => {
    if (removingItemId || item.is_locked) return;
    setRemovingItemId(item.id);
    try {
      await deleteOrderInvoiceItem(item.id);
      setInvoiceItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal menghapus baris',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
    } finally {
      setRemovingItemId(null);
    }
  };

  const addDamagePhoto = async (source: 'camera' | 'gallery') => {
    if (!order || uploadingPhoto) return;
    if (quotePhotoPaths.length >= MAX_QUOTE_PHOTOS) {
      showToast({
        tone: 'warning',
        message: `Maksimal ${MAX_QUOTE_PHOTOS} foto bukti kerusakan.`,
      });
      return;
    }
    setUploadingPhoto(true);
    try {
      const picked = await pickQuotePhoto(source);
      if (!picked) return;
      const mechanicId = await getMyId();
      const path = await uploadQuotePhoto(order.id, mechanicId, picked);
      const nextPaths = [...quotePhotoPaths, path];
      setQuotePhotoPaths(nextPaths);
      const urls = await resolveQuotePhotoUrls(nextPaths).catch(
        (): Record<string, string> => ({}),
      );
      setQuotePhotoUrls((prev) => ({ ...prev, ...urls }));
      showToast({
        tone: 'success',
        message: 'Foto kerusakan terunggah.',
      });
    } catch (e) {
      showToast({
        tone: 'warning',
        title: 'Foto gagal diunggah',
        message:
          e instanceof Error
            ? e.message
            : 'Estimasi tetap bisa dikirim tanpa foto.',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removeDamagePhoto = async (path: string) => {
    setQuotePhotoPaths((prev) => prev.filter((item) => item !== path));
    await deleteQuotePhoto(path).catch(() => {});
  };

  const submitQuote = async () => {
    if (!order || submittingQuote) return;
    if (invoiceItems.length === 0) {
      showToast({
        tone: 'warning',
        message: 'Tambahkan minimal 1 item jasa/suku cadang atau periksa biaya panggil.',
      });
      return;
    }
    if (totalError) {
      showToast({ tone: 'warning', message: totalError });
      return;
    }
    setSubmittingQuote(true);
    try {
      await submitOrderQuote(order.id, quotePhotoPaths);
      setDraftDescription('');
      setDraftAmountText('');
      await load();
      showToast({
        tone: 'success',
        title: 'Estimasi terkirim',
        message: 'Menunggu persetujuan client sebelum pengerjaan dimulai.',
      });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal mengirim estimasi',
        message: e instanceof Error ? e.message : 'Coba lagi beberapa saat.',
      });
    } finally {
      setSubmittingQuote(false);
    }
  };

  const withdrawQuote = async () => {
    if (!order || withdrawingQuote) return;
    setWithdrawingQuote(true);
    try {
      await withdrawOrderQuote(order.id);
      setWithdrawConfirmOpen(false);
      await load();
      showToast({
        tone: 'info',
        message: 'Estimasi ditarik. Silakan sesuaikan rincian lalu kirim ulang.',
      });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal menarik estimasi',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
    } finally {
      setWithdrawingQuote(false);
    }
  };

  const submitAddon = async () => {
    if (!order || submittingAddon) return;
    const desc = addonDescription.trim();
    const amount = Number(addonAmountText.replace(/[^0-9]/g, '')) || 0;
    if (!desc) {
      showToast({ tone: 'warning', message: 'Tulis keterangan biaya tambahan.' });
      return;
    }
    if (amount <= 0) {
      showToast({ tone: 'warning', message: 'Isi nominal tambahan lebih dari 0.' });
      return;
    }
    setSubmittingAddon(true);
    try {
      await requestQuoteAddon(order.id, {
        description: desc,
        amount,
        itemType: 'addon',
      });
      setAddonDescription('');
      setAddonAmountText('');
      await load();
      showToast({
        tone: 'success',
        title: 'Biaya tambahan diajukan',
        message: 'Menunggu persetujuan ulang dari client.',
      });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal mengajukan tambahan',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
    } finally {
      setSubmittingAddon(false);
    }
  };

  const sendInvoice = async () => {
    if (!order || !canSendInvoice) return;
    setSendingInvoice(true);
    try {
      await sendOrderInvoice(order.id);
      setInvoiceConfirmOpen(false);
      await load();
      showToast({
        tone: 'success',
        title: 'Tagihan dikirim',
        message: 'Client dapat langsung memilih pembayaran QRIS/e-wallet atau tunai.',
      });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal mengirim tagihan',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
    } finally {
      setSendingInvoice(false);
    }
  };

  const submitReopenInvoice = async () => {
    if (!order || reopeningInvoice) return;
    setReopeningInvoice(true);
    try {
      await reopenOrderInvoice(order.id);
      setReopenConfirmOpen(false);
      await load();
      showToast({
        tone: 'info',
        message: 'Tagihan dibuka kembali sebagai draf estimasi.',
      });
    } catch (e) {
      setReopenConfirmOpen(false);
      showToast({
        tone: 'danger',
        title: 'Gagal membuka ulang tagihan',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
    } finally {
      setReopeningInvoice(false);
    }
  };

  const submitCash = async () => {
    if (!order || confirmingCash) return;
    setConfirmingCash(true);
    try {
      await confirmCashPayment(order.id);
      await load();
      showToast({
        tone: 'success',
        title: 'Pembayaran tunai terkonfirmasi',
        message: 'Order selesai dan tercatat di menu Pendapatan.',
      });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal mengonfirmasi tunai',
        message: e instanceof Error ? e.message : 'Coba lagi beberapa saat.',
      });
    } finally {
      setConfirmingCash(false);
    }
  };

  const manualCheckPayment = async () => {
    if (!id || checkingPayment) return;
    setCheckingPayment(true);
    try {
      const result = await syncPaymentStatus(id);
      if (result.status === 'paid') {
        await load();
        showToast({
          tone: 'success',
          message: 'Pembayaran online sudah lunas.',
        });
      } else {
        showToast({
          tone: 'info',
          message: 'Client belum menyelesaikan pembayaran online.',
        });
      }
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal memeriksa status',
        message: e instanceof Error ? e.message : 'Coba lagi beberapa saat lagi.',
      });
    } finally {
      setCheckingPayment(false);
    }
  };

  const retryAnalysis = async () => {
    if (!id || analyzing) return;
    setAnalyzing(true);
    try {
      await analyzeRequest(id);
      await loadAnalysis();
    } catch (e) {
      setAnalysisError(
        e instanceof Error
          ? e.message
          : 'Analisis AI gagal. Coba lagi beberapa saat lagi.',
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const chatClient = async () => {
    if (!order) return;
    const phone = order.client_phone ?? order.contact_phone;
    const res = await openWhatsApp(
      phone,
      `Halo, saya montir MontirGo yang menangani pesanan #${order.id
        .slice(0, 8)
        .toUpperCase()}.`,
    );
    if (!res.ok && res.error) {
      showToast({ tone: 'warning', message: res.error });
    }
  };

  const canCancel = order ? canMechanicCancel(order.status) : false;

  const openCancel = () => {
    if (!canCancel || cancelling) return;
    setCancelReason(null);
    setCancelOpen(true);
  };

  const submitCancel = async () => {
    if (!order || cancelling) return;
    if (order.status === 'arrived' && !cancelReason) {
      showToast({
        tone: 'warning',
        message: 'Pilih alasan pembatalan terlebih dahulu.',
      });
      return;
    }
    setCancelling(true);
    try {
      const { returnedToPool } = await cancelOrderAsMechanic(
        order.id,
        cancelReason ?? undefined,
      );
      setCancelOpen(false);
      setCancelReason(null);
      await load();
      showToast({
        tone: 'info',
        title: 'Pesanan dibatalkan',
        message: returnedToPool
          ? 'Pesanan dibuka kembali agar client dapat ditangani montir lain.'
          : 'Client sudah menerima pembaruan pembatalan.',
      });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal membatalkan',
        message: e instanceof Error ? e.message : 'Coba lagi beberapa saat.',
      });
    } finally {
      setCancelling(false);
    }
  };

  return {
    order,
    history,
    analysis,
    analysisError,
    analyzing,
    loading,
    refreshing,
    setRefreshing,
    error,
    updatingStage,
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
    setDraftType,
    draftDescription,
    setDraftDescription,
    draftAmountText,
    setDraftAmountText,
    addingItem,
    removingItemId,
    quotePhotoPaths,
    quotePhotoUrls,
    uploadingPhoto,
    submittingQuote,
    withdrawingQuote,
    addonDescription,
    setAddonDescription,
    addonAmountText,
    setAddonAmountText,
    submittingAddon,
    sendingInvoice,
    reopeningInvoice,
    checkingPayment,
    confirmingCash,
    withdrawConfirmOpen,
    setWithdrawConfirmOpen,
    invoiceConfirmOpen,
    setInvoiceConfirmOpen,
    reopenConfirmOpen,
    setReopenConfirmOpen,
    cancelOpen,
    setCancelOpen,
    cancelling,
    cancelReason,
    setCancelReason,
    canCancel,
    load,
    advanceStage,
    addItem,
    removeItem,
    addDamagePhoto,
    removeDamagePhoto,
    submitQuote,
    withdrawQuote,
    submitAddon,
    sendInvoice,
    submitReopenInvoice,
    submitCash,
    manualCheckPayment,
    retryAnalysis,
    chatClient,
    openCancel,
    submitCancel,
  };
}
