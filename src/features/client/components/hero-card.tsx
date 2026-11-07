import { Button } from "@/components/ui/button";
import { Ionicons } from "@/components/ui/icon";
import { Brand, CardShadow, Radius, Space, Type } from "@/constants/brand";
import { StyleSheet, Text, View } from "react-native";

interface HeroCardProps {
  onPressRequest: () => void;
  onPressOrders: () => void;
}

/**
 * Kartu aksi utama yang menumpuk di atas header. Fokusnya satu: mulai
 * permintaan; "Pesanan" disediakan sebagai jalur sekunder.
 */
export function HeroCard({ onPressRequest, onPressOrders }: HeroCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.iconTile}>
          <Ionicons name="construct-outline" size={22} color={Brand.volt} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.kicker}>BANTUAN DARURAT</Text>
          <Text style={styles.title}>Kendaraan bermasalah?</Text>
          <Text style={styles.subtitle}>
            Montir terdekat datang ke lokasimu.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="Cari Montir"
          icon="flash-outline"
          onPress={onPressRequest}
          style={styles.primary}
        />
        <Button
          label="Pesanan"
          icon="receipt-outline"
          variant="secondary"
          onPress={onPressOrders}
          style={styles.secondary}
        />
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
  top: { flexDirection: "row", alignItems: "center", gap: Space.md },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Brand.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  kicker: { ...Type.micro, color: Brand.primary, letterSpacing: 0.9 },
  title: { ...Type.title, color: Brand.text, marginTop: 2 },
  subtitle: { ...Type.meta, color: Brand.textSecondary, marginTop: 2 },
  actions: { flexDirection: "row", marginTop: Space.lg, gap: 7, fontSize: 9 },
  primary: { flex: 1.6 },
  secondary: { flex: 1 },
});
