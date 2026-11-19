// Kartu satu baris keluahan dalam daftar riwayat (riwayat tidak ditampilkan di profil).
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space, Type } from '@/constants/brand';
import { formatDateTime } from '@/utils/format';
import { resolveComplaintPhotoUrl } from '../photo';
import { COMPLAINT_CATEGORY_META, COMPLAINT_STATUS_META, type Complaint } from '../types';

export function ComplaintCard({ complaint }: { complaint: Complaint }) {
  const meta = COMPLAINT_STATUS_META[complaint.status];
  const category = COMPLAINT_CATEGORY_META[complaint.category] ?? { label: complaint.category, icon: 'alert-circle-outline' };
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const firstPhoto = complaint.photo_paths[0];
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const url = firstPhoto ? await resolveComplaintPhotoUrl(firstPhoto) : null;
      if (alive) setPhotoUrl(url);
    };
    load();
    return () => {
      alive = false;
    };
  }, [firstPhoto]);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.chip, { backgroundColor: meta.background }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={styles.id}>#{complaint.request_id.slice(0, 8).toUpperCase()}</Text>
      </View>

      <Text style={styles.subject} numberOfLines={2}>
        {complaint.subject}
      </Text>
      <Text style={styles.category} numberOfLines={1}>
        {category.label}
      </Text>
      {complaint.photo_paths.length > 0 && (
        <View style={styles.photoCluster}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="image-outline" size={14} color={Brand.textMuted} />
            </View>
          )}
          {complaint.photo_paths.length > 1 ? (
            <View style={styles.photoMore}>
              <Text style={styles.photoMoreText}>+{complaint.photo_paths.length}</Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.foot}>
        <Text style={styles.time}>{formatDateTime(complaint.created_at)}</Text>
        {complaint.admin_reply ? (
          <Text style={styles.reply} numberOfLines={1}>
            Balasan admin: {complaint.admin_reply}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Space.lg,
    marginBottom: Space.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  chipText: { ...Type.micro, fontSize: 9.5, letterSpacing: 0.2 },
  id: { ...Type.meta, fontSize: 10, color: Brand.textMuted },
  subject: { ...Type.bodyStrong, fontSize: 13.5, color: Brand.text, marginTop: Space.sm, lineHeight: 18 },
  category: { ...Type.meta, color: Brand.textSecondary, marginTop: 3 },
  photoCluster: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: Space.sm },
  photo: { width: 72, height: 56, borderRadius: Radius.sm },
  photoPlaceholder: {
    width: 72,
    height: 56,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.background,
  },
  photoMore: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    opacity: 0.95,
  },
  photoMoreText: { fontSize: 10, color: Brand.white, fontWeight: '700' },
  foot: { marginTop: Space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm },
  time: { ...Type.meta, color: Brand.textMuted, fontSize: 10 },
  reply: { ...Type.meta, color: Brand.primary, fontSize: 10 },
});
