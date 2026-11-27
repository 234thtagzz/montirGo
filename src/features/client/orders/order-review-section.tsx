import { Pressable, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import type { ClientOrder, ClientReview } from '@/features/client/types';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';

interface OrderReviewSectionProps {
  order: ClientOrder;
  review: ClientReview | null;
  rating: number;
  comment: string;
  reviewError: string | null;
  submitting: boolean;
  onChangeRating: (rating: number) => void;
  onChangeComment: (text: string) => void;
  onSubmitReview: () => void;
}

export function OrderReviewSection({
  order,
  review,
  rating,
  comment,
  reviewError,
  submitting,
  onChangeRating,
  onChangeComment,
  onSubmitReview,
}: OrderReviewSectionProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  if (order.status !== 'paid') return null;

  const isCalloutOnly = order.quote_status === 'callout_only';

  return (
    <View style={styles.wrap}>
      <SectionHeader eyebrow="PENGALAMANMU" title="Ulasan montir" />

      {review ? (
        <Surface variant="default" padding="lg" style={styles.card}>
          <View style={styles.reviewHeader}>
            <View style={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Ionicons
                  key={index}
                  name={index < review.rating ? 'star' : 'star-outline'}
                  size={18}
                  color={theme.colors.statusWarningFg}
                />
              ))}
            </View>
            <AppText variant="caption" tone="muted">
              {formatDateTime(review.created_at)}
            </AppText>
          </View>

          {isCalloutOnly ? (
            <Badge label="Biaya panggil saja" tone="neutral" size="sm" />
          ) : null}

          {review.comment ? (
            <AppText variant="body">{review.comment}</AppText>
          ) : (
            <AppText variant="caption" tone="muted">
              Kamu tidak menulis komentar.
            </AppText>
          )}

          {review.mechanic_reply ? (
            <View style={styles.reviewReply}>
              <AppText variant="overline" tone="info">
                Balasan montir
              </AppText>
              <AppText variant="body">{review.mechanic_reply}</AppText>
            </View>
          ) : null}
        </Surface>
      ) : (
        <Surface variant="default" padding="lg" style={styles.card}>
          <View style={styles.topRow}>
            <AppText variant="title" style={styles.flexCopy}>
              Bagaimana pelayanan montir?
            </AppText>
            {isCalloutOnly ? (
              <Badge label="Biaya panggil saja" tone="neutral" size="sm" />
            ) : null}
          </View>
          <AppText variant="body" tone="secondary">
            Penilaian dan ulasanmu membantu pelanggan lain memilih montir yang tepat.
          </AppText>

          <View style={styles.ratingPicker}>
            {Array.from({ length: 5 }).map((_, index) => {
              const value = index + 1;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`Beri ${value} bintang`}
                  hitSlop={6}
                  onPress={() => onChangeRating(value)}
                  style={styles.starBtn}
                >
                  <Ionicons
                    name={value <= rating ? 'star' : 'star-outline'}
                    size={30}
                    color={theme.colors.statusWarningFg}
                  />
                </Pressable>
              );
            })}
          </View>

          {reviewError ? (
            <AppText variant="caption" tone="danger" style={styles.center}>
              {reviewError}
            </AppText>
          ) : null}

          <TextField
            value={comment}
            onChangeText={onChangeComment}
            placeholder="Tulis pengalamanmu (opsional)"
            multiline
          />

          <Button
            label="Kirim Ulasan"
            icon="send-outline"
            loading={submitting}
            onPress={onSubmitReview}
          />
        </Surface>
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    gap: theme.spacing.md,
  },
  card: {
    gap: theme.spacing.md,
  },
  topRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  flexCopy: { flex: 1 },
  reviewHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  starsRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.xxs,
  },
  reviewReply: {
    backgroundColor: theme.colors.statusInfoBg,
    borderRadius: theme.radii.sm,
    padding: theme.spacing.md,
    gap: theme.spacing.xxs,
  },
  ratingPicker: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.sm,
  },
  starBtn: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  center: {
    textAlign: 'center' as const,
  },
});
