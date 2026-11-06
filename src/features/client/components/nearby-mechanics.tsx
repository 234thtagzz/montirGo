import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/avatar';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space, Type } from '@/constants/brand';
import type { NearbyMechanic } from '@/features/client/types';
import { formatSpecializations } from '@/features/mechanic/specializations';
import { resolveWorkshopPhotoUrls } from '@/features/mechanic/photo';

interface NearbyMechanicsProps {
  mechanics: NearbyMechanic[];
}

/** Foto bengkel (path privat) → signed URL, dimuat sekali untuk semua kartu. */
function useWorkshopPhotos(mechanics: NearbyMechanic[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = mechanics.map((item) => item.workshop_photo ?? '').join('|');

  useEffect(() => {
    const paths = mechanics.map((item) => item.workshop_photo).filter((path): path is string => !!path);
    if (paths.length === 0) return;
    let active = true;
    resolveWorkshopPhotoUrls(paths)
      .then((resolved) => {
        if (active) setUrls(resolved);
      })
      .catch(() => {
        // Foto bersifat pelengkap — kartu tetap tampil tanpa foto.
      });
    return () => {
      active = false;
    };
    // `key` mewakili isi daftar foto; `mechanics` sendiri dibuat ulang tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}

export function NearbyMechanics({ mechanics }: NearbyMechanicsProps) {
  const photoUrls = useWorkshopPhotos(mechanics);

  if (mechanics.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="moon-outline" size={18} color={Brand.textSecondary} />
        <View style={styles.emptyCopy}>
          <Text style={styles.emptyTitle}>Belum ada montir online</Text>
          <Text style={styles.emptyHint}>
            Kamu tetap bisa membuat permintaan — montir yang online akan menerimanya.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {mechanics.map((mechanic) => {
        const name = mechanic.full_name?.trim() || 'Montir MontirGo';
        const specialization = formatSpecializations(mechanic.vehicle_specialization);
        const workshopPhoto = mechanic.workshop_photo
          ? photoUrls[mechanic.workshop_photo]
          : null;
        const workshopName = mechanic.workshop_name?.trim() || 'Montir panggilan';

        return (
          <View key={mechanic.profile_id} style={styles.card}>
            <View style={styles.media}>
              {workshopPhoto ? (
                <Image
                  source={{ uri: workshopPhoto }}
                  style={styles.workshopPhoto}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <View style={styles.mediaFallback}>
                  <Avatar name={name} uri={mechanic.avatar_url} size={48} />
                </View>
              )}
              {workshopPhoto ? (
                <View style={styles.avatarOverlay}>
                  <Avatar name={name} uri={mechanic.avatar_url} size={36} />
                </View>
              ) : null}
              <View style={styles.onlineChip}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            </View>

            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.workshop} numberOfLines={1}>
              {workshopName}
            </Text>

            <View style={styles.ratingRow}>
              <Ionicons name="star" size={11} color="#E8A317" />
              <Text style={styles.rating}>{mechanic.rating_avg.toFixed(1)}</Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.jobs}>{mechanic.total_jobs} pekerjaan</Text>
            </View>

            {specialization ? (
              <View style={styles.specChip}>
                <Text style={styles.specText} numberOfLines={1}>
                  {specialization}
                </Text>
              </View>
            ) : (
              <Text style={styles.specPlaceholder} numberOfLines={1}>
                {mechanic.experience_years
                  ? `${mechanic.experience_years} tahun pengalaman`
                  : 'Montir terverifikasi'}
              </Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Space.md, paddingRight: Space.xs },
  card: {
    width: 172,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.md,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  media: { marginBottom: Space.md },
  workshopPhoto: {
    width: '100%',
    height: 76,
    borderRadius: Radius.md,
    backgroundColor: Brand.background,
  },
  mediaFallback: {
    height: 76,
    borderRadius: Radius.md,
    backgroundColor: Brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    position: 'absolute',
    left: 6,
    bottom: -12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Brand.surface,
  },
  onlineChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(11,18,32,0.78)',
  },
  onlineDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Brand.volt },
  onlineText: { fontSize: 9, fontWeight: '700', color: Brand.white },
  name: { ...Type.label, fontSize: 13, fontWeight: '700', color: Brand.text },
  workshop: { fontSize: 11, color: Brand.textSecondary, marginTop: 1 },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Space.sm,
  },
  rating: { fontSize: 11.5, fontWeight: '700', color: Brand.text },
  dot: { fontSize: 11, color: Brand.textMuted },
  jobs: { fontSize: 10.5, color: Brand.textMuted },
  specChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.xs,
    backgroundColor: Brand.primarySoft,
    marginTop: Space.sm,
  },
  specText: { fontSize: 9.5, fontWeight: '600', color: Brand.primary },
  specPlaceholder: { fontSize: 10, color: Brand.textMuted, marginTop: Space.sm },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.lg,
  },
  emptyCopy: { flex: 1 },
  emptyTitle: { fontSize: 13, fontWeight: '700', color: Brand.text },
  emptyHint: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2, lineHeight: 16 },
});
