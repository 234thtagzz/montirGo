// Kartu satu keluhan pada tab Riwayat.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space, Type } from '@/constants/brand';
import { formatDateTime } from '@/utils/format';
import { resolveComplaintPhotoUrl } from '../photo';
import { COMPLAINT_CATEGORY_META, COMPLAINT_STATUS_META, type Complaint } from '../types';

const MAX_THUMBNAILS = 3;

export function ComplaintCard({ complaint }: { complaint: Complaint }) {
  const meta = COMPLAINT_STATUS_META[complaint.status];
  const category = COMPLAINT_CATEGORY_META[complaint.category] ?? {
    label: complaint.category,
    icon: 'alert-circle-outline' as const,
  };
  const [photoUrls, setPhotoUrls] = useState<(string | null)[]>([]);

  const paths = complaint.photo_paths.slice(0, MAX_THUMBNAILS);
  const pathsKey = paths.join('|');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const urls = await Promise.all(paths.map((path) => resolveComplaintPhotoUrl(path)));
      if (alive) setPhotoUrls(urls);
    };
    load();
    return () => {
      alive = false;
    };
    // `pathsKey` merangkum isi `paths`, cukup untuk memicu pemuatan ulang.
  }, [pathsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.statusChip, { backgroundColor: meta.background }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={styles.date}>{formatDateTime(complaint.created_at)}</Text>
      </View>

      <Text style={styles.subject}>{complaint.subject}</Text>
      <Text style={styles.description} numberOfLines={3}>
        {complaint.description}
      </Text>

      <View style={styles.metaRow}>
        <Ionicons name={category.icon} size={12} color={Brand.textMuted} />
        <Text style={styles.metaText}>{category.label}</Text>
        <View style={styles.dot} />
        <Text style={styles.metaText}>#{complaint.request_id.slice(0, 8).toUpperCase()}</Text>
      </View>

      {paths.length > 0 ? (
        <View style={styles.photoRow}>
          {paths.map((path, index) =>
            photoUrls[index] ? (
              <Image
                key={path}
                source={{ uri: photoUrls[index] }}
                style={styles.photo}
                contentFit="cover"
                transition={120}
              />
            ) : (
              <View key={path} style={styles.photoPlaceholder}>
                <Ionicons name="image-outline" size={16} color={Brand.textMuted} />
              </View>
            ),
          )}
        </View>
      ) : null}

      {complaint.admin_reply ? (
        <View style={styles.replyBox}>
          <View style={styles.replyHead}>
            <Ionicons name="chatbubble-ellipses-outline" size={13} color={Brand.primary} />
            <Text style={styles.replyLabel}>Balasan admin</Text>
          </View>
          <Text style={styles.replyText}>{complaint.admin_reply}</Text>
        </View>
      ) : null}
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  statusText: { ...Type.micro, fontSize: 9.5, letterSpacing: 0.2 },
  date: { ...Type.meta, fontSize: 10, color: Brand.textMuted },
  subject: {
    ...Type.bodyStrong,
    fontWeight: '700',
    color: Brand.text,
    marginTop: Space.md,
    lineHeight: 19,
  },
  description: {
    ...Type.meta,
    fontSize: 12,
    lineHeight: 17,
    color: Brand.textSecondary,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Space.md,
  },
  metaText: { ...Type.meta, fontSize: 10, color: Brand.textMuted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Brand.textMuted, marginHorizontal: 2 },
  photoRow: { flexDirection: 'row', gap: 6, marginTop: Space.md },
  photo: { width: 68, height: 68, borderRadius: Radius.sm, backgroundColor: Brand.background },
  photoPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.background,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  replyBox: {
    marginTop: Space.md,
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.md,
    padding: Space.md,
  },
  replyHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  replyLabel: { ...Type.micro, fontSize: 9, color: Brand.primary },
  replyText: { ...Type.meta, fontSize: 12, lineHeight: 17, color: Brand.primaryDark, marginTop: 4 },
});
