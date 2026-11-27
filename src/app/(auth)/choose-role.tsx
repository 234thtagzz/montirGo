import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

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
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
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
                    color={
                      active ? theme.colors.actionPrimaryFg : theme.colors.textSecondary
                    }
                  />
                </View>
                <View style={styles.optionCopy}>
                  <AppText variant="title">{option.title}</AppText>
                  <AppText variant="caption" tone="secondary">
                    {option.description}
                  </AppText>
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
                      size={14}
                      color={active ? theme.colors.statusInfoFg : theme.colors.textMuted}
                    />
                    <AppText variant="caption" tone="secondary">
                      {point}
                    </AppText>
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
        size="cta"
        onPress={() => router.push(`/(auth)/register?role=${role}`)}
      />
    </AuthScreen>
  );
}

const createStyles = (theme: AppTheme) => ({
  list: { gap: theme.spacing.md },
  option: {
    borderRadius: theme.radii.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.bgSurface,
    padding: theme.spacing.md,
  },
  optionActive: {
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.statusInfoBg,
  },
  pressed: { opacity: 0.85 },
  optionTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgCanvas,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  iconBoxActive: {
    backgroundColor: theme.colors.actionPrimaryAltBg,
  },
  optionCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDefault,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  radioActive: {
    borderColor: theme.colors.borderFocus,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.actionPrimaryAltBg,
  },
  points: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    gap: theme.spacing.xs,
  },
  point: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
});
