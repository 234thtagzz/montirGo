import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { Brand, Radius, Space, Type } from '@/constants/brand';

type Role = 'CLIENT' | 'MONTIR';

const OPTIONS: {
  key: Role;
  title: string;
  description: string;
  icon: IconName;
  points: string[];
}[] = [
  {
    key: 'CLIENT',
    title: 'Client',
    description: 'Butuh bantuan montir',
    icon: 'car-sport-outline',
    points: ['Pesan montir ke lokasimu', 'Lacak perjalanan realtime'],
  },
  {
    key: 'MONTIR',
    title: 'Montir',
    description: 'Tawarkan jasa bantuan',
    icon: 'construct-outline',
    points: ['Terima permintaan terdekat', 'Kelola penghasilan & saldo'],
  },
];

export default function ChooseRoleScreen() {
  const [role, setRole] = useState<Role>('CLIENT');
  const router = useRouter();

  return (
    <AuthScreen
      showBack
      title="Pilih peranmu"
      subtitle="Peran menentukan tampilan dan fitur yang kamu pakai. Bisa berbeda antar akun."
    >
      <View style={styles.list}>
        {OPTIONS.map((option) => {
          const active = role === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Pilih peran ${option.title}`}
              onPress={() => setRole(option.key)}
              style={({ pressed }) => [
                styles.option,
                active && styles.optionActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.optionTop}>
                <View style={[styles.iconBox, active && styles.iconBoxActive]}>
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={active ? Brand.volt : Brand.textSecondary}
                  />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>
                    {option.title}
                  </Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
              </View>

              <View style={styles.points}>
                {option.points.map((point) => (
                  <View key={point} style={styles.point}>
                    <Ionicons
                      name="checkmark"
                      size={12}
                      color={active ? Brand.primary : Brand.textMuted}
                    />
                    <Text style={styles.pointText}>{point}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Button
        label="Lanjut Daftar"
        icon="arrow-forward"
        onPress={() => router.push(`/(auth)/register?role=${role}`)}
        style={styles.submit}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Space.md },
  option: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    padding: Space.md,
  },
  optionActive: { borderColor: Brand.ink, backgroundColor: Brand.surface },
  pressed: { opacity: 0.85 },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: { backgroundColor: Brand.ink },
  optionCopy: { flex: 1 },
  optionTitle: { ...Type.bodyStrong, fontSize: 15, fontWeight: '700', color: Brand.text },
  optionTitleActive: { color: Brand.text },
  optionDescription: { ...Type.meta, color: Brand.textSecondary, marginTop: 1 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Brand.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: Brand.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Brand.primary },
  points: {
    marginTop: Space.md,
    paddingTop: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.divider,
    gap: 5,
  },
  point: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pointText: { fontSize: 11, color: Brand.textSecondary },
  submit: { marginTop: Space.xl },
});
