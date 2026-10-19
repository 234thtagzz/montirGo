import { StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Brand, CardShadow, Radius, Space } from '@/constants/brand';

interface OnlineCardProps {
  online: boolean;
  onToggle: (value: boolean) => void;
}

/** Kartu utama dashboard: saklar siap menerima order (PRD §8). */
export function OnlineCard({ online, onToggle }: OnlineCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.iconCircle, online && styles.iconCircleOnline]}>
          <Ionicons
            name="power-outline"
            size={22}
            color={online ? Brand.primary : Brand.textSecondary}
          />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>{online ? 'Kamu Online' : 'Kamu Offline'}</Text>
          <Text style={styles.subtitle}>
            {online
              ? 'Request masuk akan tampil di tab Request.'
              : 'Nyalakan untuk mulai menerima order.'}
          </Text>
        </View>

        <Switch
          value={online}
          onValueChange={onToggle}
          trackColor={{ false: Brand.border, true: Brand.primary }}
          thumbColor={Brand.white}
          ios_backgroundColor={Brand.border}
        />
      </View>

      <View style={[styles.footer, online ? styles.footerOnline : styles.footerOffline]}>
        <Ionicons
          name={online ? 'flash' : 'moon-outline'}
          size={13}
          color={online ? Brand.green : Brand.textSecondary}
        />
        <Text style={[styles.footerText, { color: online ? Brand.green : Brand.textSecondary }]}>
          {online
            ? 'Kamu siap menerima request dari client terdekat.'
            : 'Aktifkan agar client bisa menemukanmu.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    marginTop: -44,
    ...CardShadow,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleOnline: { backgroundColor: Brand.primarySoft },
  copy: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: Brand.text },
  subtitle: { fontSize: 12, color: Brand.textSecondary, marginTop: 2, lineHeight: 16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    marginTop: Space.lg,
  },
  footerOnline: { backgroundColor: Brand.greenSoft },
  footerOffline: { backgroundColor: Brand.background },
  footerText: { flex: 1, fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
});
