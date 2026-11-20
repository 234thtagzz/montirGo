// Layar Keluhan: satu komponen dipakai client & montir.
//   "Ajukan"  -> form laporan ke admin (melekat pada transaksi via ?requestId=)
//   "Riwayat" -> daftar keluhan milik sendiri beserta status & balasan admin
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Brand, ScreenPadding, Space } from '@/constants/brand';
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

  // Riwayat selalu segar saat layar dibuka (focus) dan saat pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      void loadComplaints();
    }, [loadComplaints]),
  );

  const requestId = draft.requestId.trim();

  // Cari transaksi dengan jeda singkat supaya input manual tidak membanjiri server.
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
    const error = validateDraft(draft);
    if (error) {
      Alert.alert('Lengkapi dulu', error);
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
      setSegment('riwayat');
      void loadComplaints();
      Alert.alert('Keluhan terkirim', 'Admin akan meninjau laporanmu dan membalas di tab Riwayat.');
    } catch (err) {
      Alert.alert('Gagal mengirim', err instanceof Error ? err.message : 'Coba lagi beberapa saat.');
    } finally {
      setSubmitting(false);
    }
  }, [draft, loadComplaints]);

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
                loadComplaints().finally(() => setRefreshing(false));
              }}
              tintColor={Brand.primary}
              colors={[Brand.primary]}
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
              onSubmit={doSubmit}
              submitting={submitting}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Space.md,
    paddingBottom: Space.xxxl,
  },
  segmented: { marginBottom: Space.xl },
  history: { paddingTop: Space.xs },
  stateBox: { minHeight: 260, justifyContent: 'center' },
});
