import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space } from '@/constants/brand';
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
  /** Label kecil di atas nama kendaraan. */
  title?: string;
  /** `full` untuk layar detail (foto besar), `compact` untuk ringkasan/form. */
  variant?: 'full' | 'compact';
  /** Aksi tambahan, mis. tombol tambah/ganti foto. */
  footer?: ReactNode;
}

function TypeBadge({ type }: { type?: string | null }) {
  const meta = getVehicleTypeMeta(type);
  return (
    <View style={[styles.typeBadge, { backgroundColor: meta.background }]}>
      <Ionicons name={meta.icon} size={12} color={meta.color} />
      <Text style={[styles.typeText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

/**
 * Ringkasan kendaraan (jenis + foto + identitas) yang bisa dipakai di sisi
 * client maupun montir. Montir memakai kartu ini untuk menganalisis kendaraan
 * sebelum/sesudah menerima order.
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
  const meta = getVehicleTypeMeta(type);
  const name = formatVehicleName(brand, model, year);

  if (variant === 'compact') {
    return (
      <View style={styles.compactCard}>
        <VehiclePhoto value={photo} height={78} style={styles.compactPhoto} emptyLabel={null} />
        <View style={styles.compactCopy}>
          <View style={styles.compactTop}>
            <TypeBadge type={type} />
            {year ? <Text style={styles.compactYear}>{year}</Text> : null}
          </View>
          <Text style={styles.compactName} numberOfLines={1}>
            {name || 'Kendaraan tidak dicantumkan'}
          </Text>
          {plate ? <Text style={styles.compactPlate}>{plate}</Text> : null}
          {notes ? (
            <Text style={styles.compactNotes} numberOfLines={1}>
              {notes}
            </Text>
          ) : null}
          {footer}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <VehiclePhoto value={photo} height={172} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <TypeBadge type={type} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {year ? <Text style={styles.year}>{year}</Text> : null}
        </View>

        <Text style={styles.name}>{name || 'Kendaraan tidak dicantumkan'}</Text>

        <View style={styles.metaRow}>
          <Ionicons name={meta.icon} size={13} color={meta.color} />
          <Text style={styles.metaText}>{meta.label}</Text>
          {plate ? (
            <>
              <View style={styles.dot} />
              <View style={styles.plate}>
                <Text style={styles.plateText}>{plate}</Text>
              </View>
            </>
          ) : null}
        </View>

        {notes ? (
          <View style={styles.notesBox}>
            <Ionicons name="create-outline" size={13} color={Brand.textMuted} />
            <Text style={styles.notes}>{notes}</Text>
          </View>
        ) : null}

        {footer}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    overflow: 'hidden',
  },
  body: { padding: Space.md, gap: Space.xs },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  typeText: { fontSize: 10.5, fontWeight: '700' },
  title: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: Brand.textMuted,
  },
  year: { fontSize: 11, fontWeight: '600', color: Brand.textMuted },
  name: { fontSize: 15.5, fontWeight: '700', color: Brand.text, marginTop: 2 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  metaText: { fontSize: 11.5, color: Brand.textSecondary },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Brand.textMuted,
    marginHorizontal: 2,
  },
  plate: {
    backgroundColor: Brand.background,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  plateText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Brand.text,
    letterSpacing: 0.5,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: Space.xs,
  },
  notes: {
    flex: 1,
    fontSize: 11,
    color: Brand.textSecondary,
    lineHeight: 16,
  },

  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.sm,
  },
  compactPhoto: { width: 96 },
  compactCopy: { flex: 1, gap: 2 },
  compactTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
  },
  compactYear: { fontSize: 10.5, color: Brand.textMuted, fontWeight: '600' },
  compactName: { fontSize: 13.5, fontWeight: '700', color: Brand.text },
  compactPlate: { fontSize: 11, color: Brand.textSecondary, fontWeight: '600' },
  compactNotes: { fontSize: 10.5, color: Brand.textMuted },
});
