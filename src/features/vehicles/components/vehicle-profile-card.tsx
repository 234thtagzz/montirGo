import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Ionicons } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import {
  formatVehicleName,
  getVehicleTypeMeta,
} from '../constants';
import { VehiclePhoto } from './vehicle-photo';

interface VehicleProfileCardProps {
  photo?: string | null;
  type?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  plate?: string | null;
  notes?: string | null;
  title?: string;
  variant?: 'full' | 'compact';
  footer?: ReactNode;
}

/**
 * Ringkasan kendaraan (jenis + foto + identitas) dengan semantic tokens.
 */
export function VehicleProfileCard({
  photo,
  type,
  brand,
  model,
  year,
  plate,
  notes,
  title,
  variant = 'full',
  footer,
}: VehicleProfileCardProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const meta = getVehicleTypeMeta(type);
  const tonePalette = theme.tones[meta.tone];
  const name = formatVehicleName(brand, model, year);

  if (variant === 'compact') {
    return (
      <Surface variant="default" padding="sm" style={styles.compactCard}>
        <VehiclePhoto value={photo} height={80} style={styles.compactPhoto} emptyLabel={null} />
        <View style={styles.compactCopy}>
          <View style={styles.compactTop}>
            <Badge label={meta.label} tone={meta.tone} icon={meta.icon} size="sm" />
            {year ? (
              <AppText variant="caption" tone="muted" style={theme.tabularNums}>
                {year}
              </AppText>
            ) : null}
          </View>
          <AppText variant="label" numberOfLines={1}>
            {name || 'Kendaraan tidak dicantumkan'}
          </AppText>
          {plate ? (
            <AppText variant="caption" tone="secondary">
              {plate}
            </AppText>
          ) : null}
          {notes ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {notes}
            </AppText>
          ) : null}
          {footer}
        </View>
      </Surface>
    );
  }

  return (
    <Surface variant="default" padding="none" style={styles.card}>
      <VehiclePhoto value={photo} height={172} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Badge label={meta.label} tone={meta.tone} icon={meta.icon} size="sm" />
          {title ? (
            <AppText variant="caption" tone="muted" style={styles.flexCopy}>
              {title}
            </AppText>
          ) : null}
          {year ? (
            <AppText variant="caption" tone="muted" style={theme.tabularNums}>
              {year}
            </AppText>
          ) : null}
        </View>

        <AppText variant="title">{name || 'Kendaraan tidak dicantumkan'}</AppText>

        <View style={styles.metaRow}>
          <Ionicons name={meta.icon} size={14} color={tonePalette.fg} />
          <AppText variant="caption" tone="secondary">
            {meta.label}
          </AppText>
          {plate ? (
            <>
              <View style={styles.dot} />
              <View style={styles.plate}>
                <AppText variant="caption" style={styles.plateText}>
                  {plate}
                </AppText>
              </View>
            </>
          ) : null}
        </View>

        {notes ? (
          <View style={styles.notesBox}>
            <Ionicons name="create-outline" size={14} color={theme.colors.textMuted} />
            <AppText variant="caption" tone="secondary" style={styles.flexCopy}>
              {notes}
            </AppText>
          </View>
        ) : null}

        {footer}
      </View>
    </Surface>
  );
}

const createStyles = (theme: AppTheme) => ({
  card: {
    overflow: 'hidden' as const,
  },
  body: {
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  flexCopy: { flex: 1 },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    marginTop: 2,
    flexWrap: 'wrap' as const,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.textMuted,
  },
  plate: {
    backgroundColor: theme.colors.bgSurfaceSubtle,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  plateText: {
    fontFamily: theme.fontFamily.bold,
    letterSpacing: 0.5,
  },
  notesBox: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xxs,
  },
  compactCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  compactPhoto: { width: 96 },
  compactCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  compactTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
});
