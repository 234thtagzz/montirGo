import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useToast } from '@/components/ui/toast';
import {
  cancelServiceRequest,
  getAssignedOrderMechanic,
  getRequest,
  getReviewForRequest,
  listOrderInvoiceItems,
  listStatusHistory,
  respondToQuote,
  submitReview,
  type AssignedOrderMechanic,
  type AssignmentDecision,
  type ClientOrder,
  type ClientReview,
  type OrderInvoiceItem,
  type OrderStatusEvent,
} from '@/features/client/service';
import {
  choosePaymentMethod,
  createPaymentSession,
  getPaymentForRequest,
  syncPaymentStatus,
  type OrderPayment,
} from '@/features/finance/service';
import {
  analyzeRequest,
  getRequestAnalysis,
  type AiAnalysis,
} from '@/features/service-request/ai';
import { expireStaleAssignments } from '@/features/service-request/assignments';
import {
  forgetQuotePhotoUrl,
  resolveQuotePhotoUrls,
} from '@/features/service-request/quote-photo-urls';
import { useRefreshOnForeground } from '@/hooks/use-foreground';
import { createRealtimeChannel, subscribeWithResync } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { openWhatsApp } from '@/utils/whatsapp';

export function useClientOrder(id: string | undefined) {
  const router = useRouter();
  const { showToast } = useToast();

  const [order, setOrder] = useState<ClientOrder | null>(null);
  const [assignedMechanic, setAssignedMechanic] = useState<AssignedOrderMechanic | null>(null);
  const [history, setHistory] = useState<OrderStatusEvent[]>([]);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [cancelling, setCancelling] = useState(false);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cashVisible, setCashVisible] = useState(false);

  const [payment, setPayment] = useState<OrderPayment | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<OrderInvoiceItem[]>([]);
  const [quotePhotoUrls, setQuotePhotoUrls] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [choosingCash, setChoosingCash] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState<null | 'approve' | 'request_revision' | 'callout_only'>(null);

  const [review, setReview] = useState<ClientReview | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  const [assignmentVisible, setAssignmentVisible] = useState(false);
  const assignmentAutoOpened = useRef<string | null>(null);

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
      const [detail, events, existingReview, items, pay] = await Promise.all([
        getRequest(id),
        listStatusHistory(id),
        getReviewForRequest(id).catch(() => null),
        listOrderInvoiceItems(id).catch(() => [] as OrderInvoiceItem[]),
        getPaymentForRequest(id).catch(() => null),
      ]);

      setOrder(detail);
      setHistory(events);
      setInvoiceItems(items);
      setReview(existingReview);
      setPayment(pay);

      if (existingReview) {
        setReviewRating(existingReview.rating);
        setReviewComment(existingReview.comment ?? '');
      }

      if (detail?.mechanic_id) {
        const assigned = await getAssignedOrderMechanic(id).catch(() => null);
        setAssignedMechanic(assigned);
      } else {
        setAssignedMechanic(null);
      }

      const photoPaths = [
        ...(detail?.quote_photo_paths ?? []),
        ...items.flatMap((item) => item.quote_photo_paths ?? []),
      ];
      if (photoPaths.length > 0) {
        const urls = await resolveQuotePhotoUrls(photoPaths).catch(() => ({}));
        setQuotePhotoUrls(urls);
      } else {
        setQuotePhotoUrls({});
      }

      if (detail?.status === 'mechanic_assigned' && detail.mechanic_id) {
        if (assignmentAutoOpened.current !== detail.id) {
          assignmentAutoOpened.current = detail.id;
          setAssignmentVisible(true);
        }
      } else {
        assignmentAutoOpened.current = null;
        setAssignmentVisible(false);
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
    const channel = createRealtimeChannel(`client-order-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `id=eq.${id}` },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `request_id=eq.${id}` },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_invoice_items', filter: `request_id=eq.${id}` },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_diagnoses', filter: `request_id=eq.${id}` },
        () => {
          void loadAnalysis();
        },
      );
    subscribeWithResync(channel, () => void load());
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load, loadAnalysis]);

  const handleAssignmentResolved = useCallback(
    async (decision: AssignmentDecision) => {
      setAssignmentVisible(false);
      if (decision === 'reject_and_cancel') {
        assignmentAutoOpened.current = null;
        await load();
        showToast({
          tone: 'info',
          title: 'Pesanan dibatalkan',
          message: 'Kamu dapat membuat pesanan baru kapan saja.',
        });
        return;
      }
      assignmentAutoOpened.current = decision === 'accept' ? order?.id ?? null : null;
      await load();
      if (decision === 'accept') {
        showToast({
          tone: 'success',
          title: 'Montir dikonfirmasi',
          message: 'Montir akan segera menuju lokasimu.',
        });
      }
    },
    [load, order?.id, showToast],
  );

  const retryAnalysis = useCallback(async () => {
    if (!id || analyzing) return;
    setAnalyzing(true);
    try {
      await analyzeRequest(id);
      await loadAnalysis();
    } catch (e) {
      setAnalysisError(
        e instanceof Error ? e.message : 'Analisis AI gagal. Coba lagi beberapa saat lagi.',
      );
    } finally {
      setAnalyzing(false);
    }
  }, [id, analyzing, loadAnalysis]);

  const checkPayment = useCallback(async (): Promise<boolean> => {
    if (!id) return false;
    try {
      const result = await syncPaymentStatus(id);
      if (result.status === 'paid') {
        await load();
        return true;
      }
    } catch {
      // Polling berikutnya akan mencoba lagi.
    }
    return false;
  }, [id, load]);

  useEffect(() => {
    if (!id || order?.status !== 'payment' || !payment?.payment_session_id) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const delays = [15_000, 30_000, 60_000];
    let attempt = 0;

    const tick = async () => {
      const paid = await checkPayment();
      if (!active || paid) return;
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
  }, [id, order?.status, payment?.payment_session_id, checkPayment]);

  const manualCheckPayment = useCallback(async () => {
    if (!id || checkingPayment) return;
    setCheckingPayment(true);
    try {
      const paid = await checkPayment();
      if (!paid) {
        await load();
        showToast({
          tone: 'info',
          title: 'Belum terkonfirmasi lunas',
          message: 'Selesaikan pembayaran di checkout lalu ketuk cek lagi.',
        });
      } else {
        showToast({
          tone: 'success',
          title: 'Pembayaran lunas',
          message: 'Status pesanan sudah diperbarui.',
        });
      }
    } finally {
      setCheckingPayment(false);
    }
  }, [id, checkingPayment, checkPayment, load, showToast]);

  const doCancel = useCallback(async () => {
    if (!id) return;
    setCancelling(true);
    try {
      await cancelServiceRequest(id);
      setCancelVisible(false);
      await load();
      showToast({
        tone: 'info',
        title: 'Pesanan dibatalkan',
        message: 'Pesanan berhasil dibatalkan.',
      });
    } catch (cancelError) {
      showToast({
        tone: 'danger',
        title: 'Gagal membatalkan',
        message: cancelError instanceof Error ? cancelError.message : 'Coba lagi.',
      });
    } finally {
      setCancelling(false);
    }
  }, [id, load, showToast]);

  const chatMechanic = useCallback(async () => {
    if (!order) return;
    const phone = assignedMechanic?.phone_number ?? order.mechanic_phone;
    const res = await openWhatsApp(
      phone,
      `Halo, saya client MontirGo terkait pesanan #${order.id.slice(0, 8).toUpperCase()}.`,
    );
    if (!res.ok) {
      showToast({
        tone: 'warning',
        title: 'WhatsApp tidak dapat dibuka',
        message: res.error ?? 'Coba hubungi lewat detail pesanan.',
      });
    }
  }, [order, assignedMechanic?.phone_number, showToast]);

  const payOrder = useCallback(async () => {
    if (!id || paying) return;
    setPaying(true);
    try {
      await choosePaymentMethod(id, 'online').catch(() => null);
      const session = await createPaymentSession(id);
      if (session.alreadyPaid) {
        await load();
        showToast({
          tone: 'success',
          title: 'Sudah lunas',
          message: 'Pembayaran pesanan ini sudah diterima.',
        });
        return;
      }
      await openBrowserAsync(session.paymentUrl);
      await syncPaymentStatus(id).catch(() => null);
      await load();
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal membuka pembayaran',
        message: e instanceof Error ? e.message : 'Coba lagi beberapa saat lagi.',
      });
    } finally {
      setPaying(false);
    }
  }, [id, paying, load, showToast]);

  const chooseCash = useCallback(async () => {
    if (!id || choosingCash || paying) return;
    setChoosingCash(true);
    try {
      await choosePaymentMethod(id, 'cash');
      setCashVisible(false);
      await load();
      showToast({
        tone: 'info',
        title: 'Pembayaran tunai dipilih',
        message: 'Bayar langsung ke montir dan tunggu konfirmasi montir.',
      });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal memilih metode',
        message: e instanceof Error ? e.message : 'Coba lagi beberapa saat lagi.',
      });
    } finally {
      setChoosingCash(false);
    }
  }, [id, choosingCash, paying, load, showToast]);

  const approveQuote = useCallback(async () => {
    if (!id || quoteBusy) return;
    setQuoteBusy('approve');
    try {
      await respondToQuote(id, 'approve');
      await load();
      showToast({
        tone: 'success',
        title: 'Estimasi disetujui',
        message: 'Montir dapat melanjutkan perbaikan sesuai rincian yang disetujui.',
      });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal menyetujui estimasi',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
    } finally {
      setQuoteBusy(null);
    }
  }, [id, quoteBusy, load, showToast]);

  const requestQuoteRevision = useCallback(
    async (note: string): Promise<boolean> => {
      if (!id || quoteBusy) return false;
      setQuoteBusy('request_revision');
      try {
        await respondToQuote(id, 'request_revision', note);
        await load();
        showToast({
          tone: 'info',
          title: 'Permintaan revisi dikirim',
          message: 'Montir akan meninjau catatanmu dan memperbarui estimasi.',
        });
        return true;
      } catch (e) {
        showToast({
          tone: 'danger',
          title: 'Gagal meminta revisi',
          message: e instanceof Error ? e.message : 'Coba lagi.',
        });
        return false;
      } finally {
        setQuoteBusy(null);
      }
    },
    [id, quoteBusy, load, showToast],
  );

  const acceptCalloutOnly = useCallback(async () => {
    if (!id || quoteBusy) return;
    setQuoteBusy('callout_only');
    try {
      await respondToQuote(id, 'callout_only');
      await load();
      showToast({
        tone: 'info',
        title: 'Hanya biaya panggil',
        message: 'Perbaikan dibatalkan. Tagihan dikunci sebesar biaya panggil pasti.',
      });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal memproses keputusan',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
    } finally {
      setQuoteBusy(null);
    }
  }, [id, quoteBusy, load, showToast]);

  const retryQuotePhoto = useCallback(async (path: string) => {
    forgetQuotePhotoUrl(path);
    const next = await resolveQuotePhotoUrls([path], { force: true }).catch(
      (): Record<string, string> => ({}),
    );
    const refreshed = next[path];
    if (refreshed) {
      setQuotePhotoUrls((prev) => ({ ...prev, [path]: refreshed }));
    }
  }, []);

  const sendReview = useCallback(async () => {
    if (!id || submittingReview) return;
    if (reviewRating < 1) {
      setReviewError('Ketuk 1 sampai 5 bintang terlebih dahulu.');
      return;
    }
    setReviewError(null);
    setSubmittingReview(true);
    try {
      await submitReview({
        requestId: id,
        rating: reviewRating,
        comment: reviewComment,
      });
      showToast({
        tone: 'success',
        title: 'Ulasan tersimpan',
        message: 'Terima kasih, penilaianmu membantu pengguna lain.',
      });
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim ulasan. Coba lagi.';
      setReviewError(msg);
      showToast({
        tone: 'danger',
        title: 'Gagal mengirim ulasan',
        message: msg,
      });
    } finally {
      setSubmittingReview(false);
    }
  }, [id, submittingReview, reviewRating, reviewComment, load, showToast]);

  const refreshAll = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const refreshAssignment = useCallback(() => {
    void expireStaleAssignments().then(() => load());
  }, [load]);

  return {
    router,
    order,
    assignedMechanic,
    history,
    analysis,
    analysisError,
    analyzing,
    loading,
    refreshing,
    error,
    cancelling,
    cancelVisible,
    setCancelVisible,
    cashVisible,
    setCashVisible,
    payment,
    invoiceItems,
    quotePhotoUrls,
    paying,
    checkingPayment,
    choosingCash,
    quoteBusy,
    review,
    reviewRating,
    setReviewRating: (rating: number) => {
      setReviewRating(rating);
      setReviewError(null);
    },
    reviewComment,
    setReviewComment,
    reviewError,
    submittingReview,
    assignmentVisible,
    setAssignmentVisible,
    load,
    refreshAll,
    refreshAssignment,
    handleAssignmentResolved,
    retryAnalysis,
    manualCheckPayment,
    doCancel,
    chatMechanic,
    payOrder,
    chooseCash,
    approveQuote,
    requestQuoteRevision,
    acceptCalloutOnly,
    retryQuotePhoto,
    sendReview,
  };
}
