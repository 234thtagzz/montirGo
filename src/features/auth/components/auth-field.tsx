import { useState, type ComponentProps } from 'react';
import { Pressable, TextInput, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface AuthFieldProps extends ComponentProps<typeof TextInput> {
  label: string;
  icon: IconName;
  error?: string | null;
  showError?: boolean;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Input form auth berbasis `TextField` dengan toggle lihat kata sandi & validasi inline.
 */
export function AuthField({
  label,
  icon,
  error,
  showError = false,
  required = false,
  containerStyle,
  secureTextEntry,
  ...inputProps
}: AuthFieldProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [visible, setVisible] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  return (
    <TextField
      {...inputProps}
      label={label}
      leftIcon={icon}
      required={required}
      error={error}
      showError={showError}
      containerStyle={containerStyle}
      secureTextEntry={isPassword && !visible}
      rightAccessory={
        isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            hitSlop={8}
            onPress={() => setVisible((current) => !current)}
            style={({ pressed }) => [styles.eye, pressed && styles.pressed]}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        ) : undefined
      }
    />
  );
}

const createStyles = (theme: AppTheme) => ({
  eye: {
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pressed: { opacity: 0.65 },
});
