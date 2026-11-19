// Layar Keluhan: satu komponen dipakai client & montir.
//   "Ajukan"  -> form ajuan ke admin (melekat pada transaksi via ?requestId=)
//   "Riwayat" -> daftar keluahan milik sendiri (tanpa transaksi yang dipilih)
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Brand, Radius, ScreenPadding, Space, Type } from '@/constants/brand';
import { ComplaintBadge } from '../components/complaint-badge';
import { ComplaintCard } from '../components/complaint-card';
import { ComplaintForm } from '../components/complaint-form';
import {
  getTransactionSummary,
  listMyComplaints,
  submitComplaint,
} from '../service';
import type { Complaint, ComplaintFormDraft, TransactionSummary } from '../types';

type Segment = 'ajukan' | 'riwayat';

const SEGMENTED: SegmentedOption<Segment>[] = [
  { value: 'ajukan', label: 'Ajukan' },
  { value: 'riwayat', label: 'Riwayat' },
];

export interface ComplaintsScreenProps {
  role: 'client' | 'mechanic';
  initialRequestId?: string | null;
}

function validateDraft(draft: ComplaintFormDraft): string | null {
  if (!draft.requestId.trim()) return 'Isi transaksi / ID pesanan.';
  if (draft.subject.trim().length < 5) return 'Judul keluahan minimal 5 karakter.';
  if (draft.description.trim().length < 10) return 'Deskripsi keluahan minimal 10 karakter.';
  return null;
}

export function ComplaintsScreen({ role, initialRequestId }: ComplaintsScreenProps) {
  const [segment, setSegment] = useState<Segment>('ajukan');
  const [draft, setDraft] = useState<ComplaintFormDraft>(() => ({
    category: 'pesanan',
    requestId: initialRequestId ?? '',
    subject: '',
    description: '',
    photos: [],
  }));
  const [txState, setTxState] = useState<{
    requestId: string;
    summary: TransactionSummary;
  } | null>(null);
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

  // Riwayat selalu fresh saat layar dibuka (focus) & refresh pull-to-refresh.
  useFocusEffect(useCallback(() => { void loadComplaints(); }, [loadComplaints]));

  const requestId = draft.requestId.trim();
  const transaction = txState && txState.requestId === requestId ? txState.summary : null;

  useEffect(() => {
    if (!requestId) return;
    let alive = true;
    getTransactionSummary(requestId)
      .then((summary) => {
        if (alive) setTxState({ requestId, summary });
      })
      .catch(() => {
        // Transaksi tidak ditemukan — biarkan kartu tanpa kartu riwayat ditampilkan.
      });
    return () => {
      alive = false;
    };
  }, [requestId]);

  const doSubmit = useCallback(async () => {
    const error = validateDraft(draft);
    if (error) {
      Alert.alert('Validasi', error);
      return;
    }
    setSubmitting(true);
    try {
      await submitComplaint({
        ...draft,
        subject: draft.subject.trim(),
        description: draft.description.trim(),
      });
      Alert.alert('Berhasil', 'Keluhan dikirimkan ke admin.');
      setDraft((current) => ({
        ...current,
        subject: '',
        description: '',
        photos: [],
        requestId: current.requestId,
      }));
      void loadComplaints();
    } catch (err) {
      Alert.alert('Gagal', err instanceof Error ? err.message : 'Coba lagi.');
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
            ? 'Ajukan keluahan transaksi atau lihat riwayatnya.'
            : 'Ajukan keluahan terhadap transaksi/job, atau lihat riwayatnya.'
        }
      />
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
          <>
            {transaction ? <TransactionSummaryCard summary={transaction} /> : null}
            <ComplaintForm
              draft={draft}
              onDraftChange={setDraft}
              onSubmit={doSubmit}
              submitting={submitting}
            />
          </>
        ) : (
          <>
            {complaintsLoading ? (
              <LoadingState message="Memuat keluahan..." />
            ) : complaintsError ? (
              <ErrorState onRetry={loadComplaints} />
            ) : complaints.length === 0 ? (
              <EmptyState
                icon="alert-circle-outline"
                message="Belum ada keluahan"
                hint="Keluhan yang pernah Anda ajukan muncul di sini beserta status balasan admin."
              />
            ) : (
              complaints.map((item) => <ComplaintCard key={item.id} complaint={item} />)
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TransactionSummaryCard({ summary }: { summary: TransactionSummary }) {
  return (
    <View style={styles.txCard}>
      <Text style={styles.txLabel}>Transaksi terkait</Text>
      <Text style={styles.txTitle} numberOfLines={1}>
        {summary.issue_description}
      </Text>
      <View style={styles.txFoot}>
        <Text style={styles.txTime}>
          {new Date(summary.created_at).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
        <ComplaintBadge />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: {
    paddingHorizontal: ScreenPadding,
    paddingVertical: Space.md,
    paddingBottom: Space.xxxl,
  },
  segmented: { marginTop: Space.sm, marginBottom: Space.lg },
  txCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Space.lg,
    marginBottom: Space.lg,
  },
  txLabel: { ...Type.micro, color: Brand.textMuted },
  txTitle: { ...Type.bodyStrong, color: Brand.text, marginTop: 2, lineHeight: 20 },
  txFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  txTime: { ...Type.meta, color: Brand.textMuted },
});
