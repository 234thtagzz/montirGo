import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Ionicons } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { getStatusMeta } from '@/features/service-request/status';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
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
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ComplaintFormProps {
  draft: ComplaintFormDraft;
  onDraftChange: (draft: ComplaintFormDraft) => void;
  onSubmit: (draft: ComplaintFormDraft) => void;
  submitting: boolean;
  submitted?: boolean;
  transaction?: TransactionSummary | null;
  transactionLocked?: boolean;
  transactionLoading?: boolean;
}

export function ComplaintForm({
  draft,
  onDraftChange,
  onSubmit,
  submitting,
  submitted = false,
  transaction,
  transactionLocked = false,
  transactionLoading = false,
}: ComplaintFormProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
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

  const requestIdError = !draft.requestId.trim()
    ? 'Pilih transaksi yang ingin dilaporkan.'
    : !UUID_PATTERN.test(draft.requestId.trim())
      ? 'ID transaksi tidak valid.'
      : null;
  const subjectError =
    draft.subject.trim().length < 5 ? 'Judul keluhan minimal 5 karakter.' : null;
  const descriptionError =
    draft.description.trim().length < 10 ? 'Deskripsi keluhan minimal 10 karakter.' : null;

  return (
    <View style={styles.form}>
      <View style={styles.block}>
        <AppText variant="label">Kategori keluhan</AppText>
        <View style={styles.chipWrap}>
          {CATEGORIES.map((value) => {
            const meta = COMPLAINT_CATEGORY_META[value];
            return (
              <Chip
                key={value}
                label={meta.label}
                icon={meta.icon}
                selected={draft.category === value}
                onPress={() => onDraftChange({ ...draft, category: value })}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <AppText variant="label">Transaksi *</AppText>
        {transactionLocked ? (
          <LockedTransaction transaction={transaction ?? null} loading={transactionLoading} />
        ) : (
          <>
            <TextField
              placeholder="Tempel ID transaksi"
              value={draft.requestId}
              onChangeText={(requestId) => onDraftChange({ ...draft, requestId })}
              autoCapitalize="none"
              autoCorrect={false}
              error={requestIdError}
              showError={submitted}
            />
            {transactionLoading ? (
              <View style={styles.lookupRow}>
                <ActivityIndicator size="small" color={theme.colors.actionPrimaryAltBg} />
                <AppText variant="caption" tone="muted">
                  Mencari transaksi…
                </AppText>
              </View>
            ) : transaction ? (
              <AppText variant="caption" tone="secondary" numberOfLines={2}>
                {transaction.issue_description}
              </AppText>
            ) : draft.requestId.trim() ? (
              <AppText variant="caption" tone="danger">
                Transaksi tidak ditemukan. Periksa kembali ID-nya.
              </AppText>
            ) : (
              <AppText variant="caption" tone="muted">
                ID transaksi bisa disalin dari detail pesanan, bagian paling atas.
              </AppText>
            )}
          </>
        )}
      </View>

      <TextField
        label="Judul keluhan"
        required
        placeholder="Ringkas masalahnya dalam satu baris"
        value={draft.subject}
        onChangeText={(subject) => onDraftChange({ ...draft, subject })}
        maxLength={MAX_SUBJECT}
        error={subjectError}
        showError={submitted}
      />

      <View style={styles.block}>
        <TextField
          label="Deskripsi"
          required
          multiline
          placeholder="Ceritakan kronologinya: apa yang terjadi, kapan, dan apa yang kamu harapkan."
          value={draft.description}
          onChangeText={(description) => onDraftChange({ ...draft, description })}
          maxLength={MAX_DESCRIPTION}
          error={descriptionError}
          showError={submitted}
        />
        <View style={styles.counterRow}>
          <AppText variant="caption" tone="muted">
            Minimal 10 karakter.
          </AppText>
          <AppText variant="caption" tone="muted" style={theme.tabularNums}>
            {draft.description.length}/{MAX_DESCRIPTION}
          </AppText>
        </View>
      </View>

      <View style={styles.block}>
        <AppText variant="label">Foto lampiran (opsional)</AppText>
        <AppText variant="caption" tone="muted">
          Maksimal {MAX_COMPLAINT_PHOTOS} foto. Bukti visual mempercepat admin memeriksa laporanmu.
        </AppText>
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
                <Ionicons name="close" size={14} color={theme.colors.textInverse} />
              </Pressable>
            </View>
          ))}
          {draft.photos.length < MAX_COMPLAINT_PHOTOS ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tambah foto lampiran"
              onPress={() => void addPhotos()}
              style={({ pressed }) => [styles.photoAdd, pressed && styles.pressed]}
            >
              {pickingPhotos ? (
                <ActivityIndicator size="small" color={theme.colors.statusInfoFg} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={22} color={theme.colors.statusInfoFg} />
                  <AppText variant="caption" tone="info">
                    Tambah
                  </AppText>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={18} color={theme.colors.statusInfoFg} />
        <AppText variant="caption" tone="info" style={styles.flexCopy}>
          Laporan diteruskan ke admin MontirGo, bukan ke montir atau client lain. Pantau status & balasannya di tab Riwayat.
        </AppText>
      </View>

      <Button
        label="Kirim Keluhan ke Admin"
        icon="send-outline"
        size="cta"
        loading={submitting}
        onPress={() => onSubmit(draft)}
      />
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
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  if (loading && !transaction) {
    return (
      <Surface variant="subtle" padding="md" style={styles.lockedRow}>
        <ActivityIndicator size="small" color={theme.colors.textMuted} />
        <AppText variant="caption" tone="muted">
          Memuat transaksi…
        </AppText>
      </Surface>
    );
  }

  if (!transaction) {
    return (
      <View style={styles.lockedDanger}>
        <Ionicons name="alert-circle-outline" size={16} color={theme.colors.statusDangerFg} />
        <AppText variant="caption" tone="danger">
          Transaksi tidak ditemukan.
        </AppText>
      </View>
    );
  }

  const status = getStatusMeta(transaction.status);

  return (
    <Surface variant="default" padding="lg" style={styles.lockedCard}>
      <View style={styles.lockedTop}>
        <AppText variant="overline" tone="muted">
          TERKUNCI KE TRANSAKSI INI
        </AppText>
        <Ionicons name="lock-closed" size={14} color={theme.colors.textMuted} />
      </View>
      <AppText variant="title" numberOfLines={2}>
        {transaction.issue_description}
      </AppText>
      <View style={styles.lockedFoot}>
        <AppText variant="caption" tone="muted" style={theme.tabularNums}>
          #{transaction.id.slice(0, 8).toUpperCase()}
        </AppText>
        <Badge label={status.shortLabel} tone={status.tone} icon={status.icon} size="sm" />
      </View>
      <AppText variant="caption" tone="muted">
        {formatDateTime(transaction.created_at)}
      </AppText>
    </Surface>
  );
}

const createStyles = (theme: AppTheme) => ({
  form: {
    gap: theme.spacing.xl,
    paddingBottom: theme.spacing.xxxl,
  },
  block: {
    gap: theme.spacing.xs,
  },
  chipWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  counterRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  lookupRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  lockedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  lockedDanger: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.statusDangerBg,
  },
  lockedCard: {
    gap: theme.spacing.xs,
  },
  lockedTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  lockedFoot: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  photoRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  photoItem: { position: 'relative' as const },
  photoImage: {
    width: 88,
    height: 88,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgSurfaceSubtle,
  },
  photoRemove: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.bgInverse,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  photoAdd: {
    width: 88,
    height: 88,
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed' as const,
    borderColor: theme.colors.statusInfoBorder,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.xxs,
  },
  note: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusInfoBg,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  },
  flexCopy: { flex: 1 },
  pressed: { opacity: 0.78 },
});
