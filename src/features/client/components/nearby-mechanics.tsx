import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/avatar';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space } from '@/constants/brand';
import type { NearbyMechanic } from '@/features/client/types';

interface NearbyMechanicsProps {
  mechanics: NearbyMechanic[];
}

export function NearbyMechanics({ mechanics }: NearbyMechanicsProps) {
  if (mechanics.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="construct-outline" size={20} color={Brand.primary} />
        </View>
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
        return (
          <View key={mechanic.profile_id} style={styles.card}>
            <View style={styles.avatarRow}>
              <Avatar name={name} uri={mechanic.avatar_url} size={46} />
              <View style={styles.onlineDot} />
            </View>

            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.workshop} numberOfLines={1}>
              {mechanic.workshop_name?.trim() || 'Montir panggilan'}
            </Text>

            <View style={styles.stats}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.rating}>{mechanic.rating_avg.toFixed(1)}</Text>
              <Text style={styles.jobs}>• {mechanic.total_jobs} job</Text>
            </View>

            <View style={styles.onlineBadge}>
              <View style={styles.badgeDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Space.md, paddingRight: Space.xs },
  card: {
    width: 152,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.md,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-start' },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Brand.green,
    borderWidth: 2,
    borderColor: Brand.surface,
    marginLeft: -12,
    marginTop: 32,
  },
  name: { fontSize: 13, fontWeight: '700', color: Brand.text, marginTop: Space.sm },
  workshop: { fontSize: 11, color: Brand.textSecondary, marginTop: 1 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: Space.sm },
  rating: { fontSize: 11.5, fontWeight: '700', color: Brand.text },
  jobs: { fontSize: 10.5, color: Brand.textMuted },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Brand.greenSoft,
    marginTop: Space.sm,
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Brand.green },
  onlineText: { fontSize: 9.5, fontWeight: '700', color: Brand.green },
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
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: { flex: 1 },
  emptyTitle: { fontSize: 13, fontWeight: '600', color: Brand.text },
  emptyHint: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2, lineHeight: 16 },
});
