// Form Ajukan Keluhan (client & montir): kategori, transaksi, judul, deskripsi, foto.
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Brand, Radius, Space, Type } from '@/constants/brand';
import { getStatusMeta } from '@/features/service-request/status';
import { formatDateTime } from '@/utils/format';
import { MAX_COMPLAINT_PHOTOS, pickComplaintPhotos } from '../photo';
import {
  COMPLAINT_CATEGORY_META,
  type ComplaintCategory,
  type ComplaintFormDraft,
  type TransactionSummary,
} from '../types';

const CATEGORIES = Object.keys(COMPLAINT_CATEGORY_META) as ComplaintCategory[];

const MAX_SUBJECT = 120;
const MAX_DESCRIPTION = 4000;

interface ComplaintFormProps {
  draft: ComplaintFormDraft;
  onDraftChange: (draft: ComplaintFormDraft) => void;
  onSubmit: (draft: ComplaintFormDraft) => void;
  submitting: boolean;
  /** Ringkasan transaksi yang sedang dilaporkan. */
  transaction?: TransactionSummary | null;
  /** `true` saat layar dibuka dari detail transaksi — ID tidak bisa diubah. */
  transactionLocked?: boolean;
  transactionLoading?: boolean;
}

export function ComplaintForm({
  draft,
  onDraftChange,
  onSubmit,
  submitting,
  transaction,
  transactionLocked = false,
  transactionLoading = false,
}: ComplaintFormProps) {
  const [pickingPhotos, setPickingPhotos] = useState(false);

  const addPhotos = async () => {
    const remaining = MAX_COMPLAINT_PHOTOS - draft.photos.length;
    if (remaining <= 0 || pickingPhotos) return;
    setPickingPhotos(true);
    try {
      const picked = await pickComplaintPhotos(remaining);
      if (!picked.length) return;
      onDraftChange({
        ...draft,
        photos: [...draft.photos, ...picked].slice(0, MAX_COMPLAINT_PHOTOS),
      });
    } finally {
      setPickingPhotos(false);
    }
  };

  const removePhoto = (uri: string) => {
    onDraftChange({ ...draft, photos: draft.photos.filter((p) => p.uri !== uri) });
  };

  return (
    <View style={styles.form}>
      <View>
        <FieldLabel label="Kategori keluhan" />
        <View style={styles.chipWrap}>
          {CATEGORIES.map((value) => {
            const meta = COMPLAINT_CATEGORY_META[value];
            const active = draft.category === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onDraftChange({ ...draft, category: value })}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={meta.icon}
                  size={14}
                  color={active ? Brand.volt : Brand.textSecondary}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <FieldLabel label="Transaksi" required />
        {transactionLocked ? (
          <LockedTransaction
            transaction={transaction ?? null}
            loading={transactionLoading}
          />
        ) : (
          <>
            <TextInput
              placeholder="Tempel ID transaksi"
              placeholderTextColor={Brand.textMuted}
              selectionColor={Brand.primary}
              value={draft.requestId}
              onChangeText={(requestId) => onDraftChange({ ...draft, requestId })}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            {transactionLoading ? (
              <View style={styles.lookupRow}>
                <ActivityIndicator size="small" color={Brand.primary} />
                <Text style={styles.helper}>Mencari transaksi…</Text>
              </View>
            ) : transaction ? (
              <Text style={styles.helper} numberOfLines={2}>
                {transaction.issue_description}
              </Text>
            ) : draft.requestId.trim() ? (
              <Text style={[styles.helper, styles.helperDanger]}>
                Transaksi tidak ditemukan. Periksa kembali ID-nya.
              </Text>
            ) : (
              <Text style={styles.helper}>
                ID transaksi bisa disalin dari detail pesanan, bagian paling atas.
              </Text>
            )}
          </>
        )}
      </View>

      <View>
        <FieldLabel label="Judul keluhan" required />
        <TextInput
          placeholder="Ringkas masalahnya dalam satu baris"
          placeholderTextColor={Brand.textMuted}
          selectionColor={Brand.primary}
          value={draft.subject}
          onChangeText={(subject) => onDraftChange({ ...draft, subject })}
          maxLength={MAX_SUBJECT}
          style={styles.input}
        />
      </View>

      <View>
        <FieldLabel label="Deskripsi" required />
        <TextInput
          multiline
          placeholder="Ceritakan kronologinya: apa yang terjadi, kapan, dan apa yang kamu harapkan."
          placeholderTextColor={Brand.textMuted}
          selectionColor={Brand.primary}
          value={draft.description}
          onChangeText={(description) => onDraftChange({ ...draft, description })}
          maxLength={MAX_DESCRIPTION}
          style={styles.textarea}
        />
        <View style={styles.counterRow}>
          <Text style={styles.helper}>Minimal 10 karakter.</Text>
          <Text style={styles.counter}>
            {draft.description.length}/{MAX_DESCRIPTION}
          </Text>
        </View>
      </View>

      <View>
        <FieldLabel label="Foto lampiran" optional />
        <Text style={styles.helper}>
          Opsional, maksimal {MAX_COMPLAINT_PHOTOS} foto. Bukti visual mempercepat admin memeriksa
          laporanmu.
        </Text>
        <View style={styles.photoRow}>
          {draft.photos.map((photo) => (
            <View key={photo.uri} style={styles.photoItem}>
              <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="cover" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hapus foto lampiran"
                hitSlop={6}
                onPress={() => removePhoto(photo.uri)}
                style={({ pressed }) => [styles.photoRemove, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={13} color={Brand.white} />
              </Pressable>
            </View>
          ))}
          {draft.photos.length < MAX_COMPLAINT_PHOTOS ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tambah foto lampiran"
              onPress={addPhotos}
              style={({ pressed }) => [styles.photoAdd, pressed && styles.pressed]}
            >
              {pickingPhotos ? (
                <ActivityIndicator size="small" color={Brand.primary} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={20} color={Brand.primary} />
                  <Text style={styles.photoAddText}>Tambah</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={16} color={Brand.primary} />
        <Text style={styles.noteText}>
          Laporan diteruskan ke admin MontirGo, bukan ke montir atau client lain. Kamu bisa memantau
          status dan balasannya di tab Riwayat.
        </Text>
      </View>

      <Button
        label="Kirim Keluhan ke Admin"
        icon="send-outline"
        loading={submitting}
        onPress={() => onSubmit(draft)}
        style={styles.submit}
      />
    </View>
  );
}

function FieldLabel({
  label,
  required = false,
  optional = false,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      {required ? <Text style={styles.required}>WAJIB</Text> : null}
      {optional ? <Text style={styles.optional}>OPSIONAL</Text> : null}
    </View>
  );
}

function LockedTransaction({
  transaction,
  loading,
}: {
  transaction: TransactionSummary | null;
  loading: boolean;
}) {
  if (loading && !transaction) {
    return (
      <View style={styles.lockedCard}>
        <ActivityIndicator size="small" color={Brand.inkMuted} />
        <Text style={styles.lockedLoading}>Memuat transaksi…</Text>
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={[styles.lockedCard, styles.lockedCardDanger]}>
        <Ionicons name="alert-circle-outline" size={16} color={Brand.red} />
        <Text style={[styles.lockedLoading, { color: Brand.red }]}>
          Transaksi tidak ditemukan.
        </Text>
      </View>
    );
  }

  const status = getStatusMeta(transaction.status);

  return (
    <View style={styles.lockedCard}>
      <View style={styles.lockedTop}>
        <Text style={styles.lockedEyebrow}>TERKUNCI KE TRANSAKSI INI</Text>
        <Ionicons name="lock-closed" size={12} color={Brand.inkMuted} />
      </View>
      <Text style={styles.lockedIssue} numberOfLines={2}>
        {transaction.issue_description}
      </Text>
      <View style={styles.lockedFoot}>
        <Text style={styles.lockedId}>#{transaction.id.slice(0, 8).toUpperCase()}</Text>
        <View style={[styles.statusChip, { backgroundColor: status.background }]}>
          <Ionicons name={status.icon} size={11} color={status.color} />
          <Text style={[styles.statusChipText, { color: status.color }]}>{status.shortLabel}</Text>
        </View>
      </View>
      <Text style={styles.lockedDate}>{formatDateTime(transaction.created_at)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Space.xl, paddingBottom: Space.xxxl },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Space.sm },
  label: { ...Type.label, fontSize: 12.5, fontWeight: '700', color: Brand.text },
  required: {
    ...Type.micro,
    fontSize: 8.5,
    color: Brand.primary,
    backgroundColor: Brand.primarySoft,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  optional: {
    ...Type.micro,
    fontSize: 8.5,
    color: Brand.textMuted,
    backgroundColor: Brand.background,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Space.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  chipActive: { backgroundColor: Brand.ink, borderColor: Brand.ink },
  chipText: { ...Type.label, color: Brand.textSecondary },
  chipTextActive: { color: Brand.white, fontWeight: '700' },

  input: {
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    minHeight: 48,
    fontSize: 13.5,
    color: Brand.text,
  },
  textarea: {
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
    minHeight: 124,
    fontSize: 13.5,
    lineHeight: 20,
    color: Brand.text,
    textAlignVertical: 'top',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
    marginTop: 6,
  },
  counter: { ...Type.meta, fontSize: 10, color: Brand.textMuted },
  helper: { ...Type.meta, color: Brand.textMuted, lineHeight: 16, marginTop: 6 },
  helperDanger: { color: Brand.red },
  lookupRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  lockedCard: {
    backgroundColor: Brand.ink,
    borderRadius: Radius.lg,
    padding: Space.lg,
  },
  lockedCardDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    backgroundColor: Brand.redSoft,
  },
  lockedLoading: { ...Type.meta, color: Brand.inkMuted, marginTop: 6 },
  lockedTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lockedEyebrow: { ...Type.micro, fontSize: 9, color: Brand.inkMuted },
  lockedIssue: {
    ...Type.bodyStrong,
    fontWeight: '700',
    color: Brand.white,
    marginTop: 6,
    lineHeight: 20,
  },
  lockedFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
    marginTop: Space.md,
  },
  lockedId: { ...Type.meta, color: Brand.inkMuted, letterSpacing: 0.4 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  statusChipText: { ...Type.micro, fontSize: 9 },
  lockedDate: { ...Type.meta, fontSize: 10, color: Brand.inkMuted, marginTop: 4 },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, marginTop: Space.md },
  photoItem: { position: 'relative' },
  photoImage: { width: 88, height: 88, borderRadius: Radius.md, backgroundColor: Brand.border },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(11, 18, 32, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 88,
    height: 88,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Brand.primaryBorder,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddText: { ...Type.meta, fontSize: 10, fontWeight: '700', color: Brand.primary },

  note: {
    flexDirection: 'row',
    gap: Space.sm,
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.md,
    padding: Space.md,
  },
  noteText: { ...Type.meta, color: Brand.primaryDark, lineHeight: 17, flex: 1 },
  submit: { marginTop: Space.xs },
  pressed: { opacity: 0.72 },
});
