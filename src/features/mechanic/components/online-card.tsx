import { StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Brand, CardShadow, Radius, Space, Type } from '@/constants/brand';

interface OnlineCardProps {
  online: boolean;
  onToggle: (value: boolean) => void;
}

/** Kartu utama dashboard: saklar siap menerima order (PRD §8). */
export function OnlineCard({ online, onToggle }: OnlineCardProps) {
  return (
    <View style={[styles.card, online && styles.cardOnline]}>
      <View style={styles.top}>
        <View style={[styles.iconCircle, online && styles.iconCircleOnline]}>
          <Ionicons
            name="power"
            size={20}
            color={online ? Brand.ink : Brand.textSecondary}
          />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>{online ? 'Siap menerima order' : 'Kamu sedang offline'}</Text>
          <Text style={styles.subtitle}>
            {online
              ? 'Request client terdekat akan masuk ke tab Request.'
              : 'Aktifkan agar client bisa menemukanmu.'}
          </Text>
        </View>

        <Switch
          value={online}
          onValueChange={onToggle}
          trackColor={{ false: '#D7DEE9', true: Brand.ink }}
          thumbColor={online ? Brand.volt : Brand.white}
          ios_backgroundColor="#D7DEE9"
          accessibilityLabel="Status menerima order"
        />
      </View>

      <View style={styles.footer}>
        <View style={[styles.statusDot, { backgroundColor: online ? Brand.green : Brand.textMuted }]} />
        <Text style={styles.footerText}>
          {online ? 'Status online tersinkron ke server MontirGo' : 'Kamu tidak akan menerima request baru'}
        </Text>
        {online ? (
          <View style={styles.liveTag}>
            <Text style={styles.liveTagText}>LIVE</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    marginTop: -40,
    borderWidth: 1,
    borderColor: Brand.border,
    ...CardShadow,
  },
  cardOnline: { borderColor: '#D7E4F8' },
  top: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleOnline: { backgroundColor: Brand.volt },
  copy: { flex: 1 },
  title: { ...Type.title, color: Brand.text },
  subtitle: { ...Type.meta, color: Brand.textSecondary, marginTop: 2, lineHeight: 16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Brand.divider,
    paddingTop: Space.md,
    marginTop: Space.md,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  footerText: { ...Type.meta, color: Brand.textSecondary, flex: 1, lineHeight: 15 },
  liveTag: {
    backgroundColor: Brand.greenSoft,
    borderRadius: Radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveTagText: { ...Type.micro, color: Brand.green, fontSize: 9, letterSpacing: 0.8 },
});
