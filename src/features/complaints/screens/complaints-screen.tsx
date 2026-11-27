import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { useToast } from '@/components/ui/toast';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { ComplaintCard } from '../components/complaint-card';
import { ComplaintForm } from '../components/complaint-form';
import { getTransactionSummary, listMyComplaints, submitComplaint } from '../service';
import type { Complaint, ComplaintFormDraft, TransactionSummary } from '../types';

type Segment = 'ajukan' | 'riwayat';

const SEGMENTED: SegmentedOption<Segment>[] = [
  { value: 'ajukan', label: 'Ajukan' },
  { value: 'riwayat', label: 'Riwayat' },
];

type LookupState =
  | { status: 'idle' }
  | { status: 'loading'; requestId: string }
  | { status: 'found'; requestId: string; summary: TransactionSummary }
  | { status: 'missing'; requestId: string };

export interface ComplaintsScreenProps {
  role: 'client' | 'mechanic';
  initialRequestId?: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateDraft(draft: ComplaintFormDraft): string | null {
  if (!draft.requestId.trim()) return 'Pilih transaksi yang ingin dilaporkan.';
  if (!UUID_PATTERN.test(draft.requestId.trim())) return 'ID transaksi tidak valid.';
  if (draft.subject.trim().length < 5) return 'Judul keluhan minimal 5 karakter.';
  if (draft.description.trim().length < 10) return 'Deskripsi keluhan minimal 10 karakter.';
  return null;
}

export function ComplaintsScreen({ role, initialRequestId }: ComplaintsScreenProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();

  const lockedRequestId = initialRequestId?.trim() || '';
  const [segment, setSegment] = useState<Segment>('ajukan');
  const [draft, setDraft] = useState<ComplaintFormDraft>(() => ({
    category: 'pesanan',
    requestId: lockedRequestId,
    subject: '',
    description: '',
    photos: [],
  }));
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState(true);
  const [complaintsError, setComplaintsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    try {
      setComplaints(await listMyComplaints());
      setComplaintsError(false);
    } catch {
      setComplaintsError(true);
    } finally {
      setComplaintsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadComplaints();
    }, [loadComplaints]),
  );

  const requestId = draft.requestId.trim();

  useEffect(() => {
    if (!requestId) return;
    let alive = true;
    const timer = setTimeout(() => {
      setLookup({ status: 'loading', requestId });
      getTransactionSummary(requestId)
        .then((summary) => {
          if (alive) setLookup({ status: 'found', requestId, summary });
        })
        .catch(() => {
          if (alive) setLookup({ status: 'missing', requestId });
        });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [requestId]);

  const activeLookup: LookupState =
    requestId && lookup.status !== 'idle' && lookup.requestId === requestId
      ? lookup
      : { status: 'idle' };
  const transaction = activeLookup.status === 'found' ? activeLookup.summary : null;
  const transactionLoading =
    Boolean(requestId) && (activeLookup.status === 'idle' || activeLookup.status === 'loading');

  const doSubmit = useCallback(async () => {
    setSubmitted(true);
    const error = validateDraft(draft);
    if (error) {
      showToast({
        tone: 'warning',
        title: 'Lengkapi keluhan dulu',
        message: error,
      });
      return;
    }
    setSubmitting(true);
    try {
      await submitComplaint({
        ...draft,
        subject: draft.subject.trim(),
        description: draft.description.trim(),
      });
      setDraft((current) => ({
        ...current,
        subject: '',
        description: '',
        photos: [],
      }));
      setSubmitted(false);
      setSegment('riwayat');
      void loadComplaints();
      showToast({
        tone: 'success',
        title: 'Keluhan terkirim',
        message: 'Admin akan meninjau laporanmu dan membalas di tab Riwayat.',
      });
    } catch (err) {
      showToast({
        tone: 'danger',
        title: 'Gagal mengirim',
        message: err instanceof Error ? err.message : 'Coba lagi beberapa saat.',
      });
    } finally {
      setSubmitting(false);
    }
  }, [draft, loadComplaints, showToast]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Keluhan Transaksi"
        subtitle={
          role === 'client'
            ? 'Sampaikan masalah transaksi langsung ke admin.'
            : 'Laporkan kendala transaksi atau job ke admin.'
        }
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadComplaints().finally(() => setRefreshing(false));
              }}
              tintColor={theme.colors.actionPrimaryAltBg}
              colors={[theme.colors.actionPrimaryAltBg]}
            />
          }
        >
          <Segmented
            options={SEGMENTED}
            value={segment}
            onChange={setSegment}
            style={styles.segmented}
          />

          {segment === 'ajukan' ? (
            <ComplaintForm
              draft={draft}
              onDraftChange={setDraft}
              onSubmit={() => void doSubmit()}
              submitting={submitting}
              submitted={submitted}
              transaction={transaction}
              transactionLocked={Boolean(lockedRequestId)}
              transactionLoading={transactionLoading}
            />
          ) : (
            <View style={styles.history}>
              {complaintsLoading ? (
                <View style={styles.stateBox}>
                  <LoadingState message="Memuat keluhan..." />
                </View>
              ) : complaintsError ? (
                <View style={styles.stateBox}>
                  <ErrorState onRetry={loadComplaints} />
                </View>
              ) : complaints.length === 0 ? (
                <EmptyState
                  icon="alert-circle-outline"
                  message="Belum ada keluhan"
                  hint="Laporan yang kamu ajukan akan muncul di sini, lengkap dengan status dan balasan admin."
                  actionLabel="Buat laporan"
                  onPressAction={() => setSegment('ajukan')}
                />
              ) : (
                complaints.map((item) => <ComplaintCard key={item.id} complaint={item} />)
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxxl,
  },
  segmented: { marginBottom: theme.spacing.xl },
  history: { paddingTop: theme.spacing.xs },
  stateBox: {
    minHeight: 260,
    justifyContent: 'center' as const,
  },
});
