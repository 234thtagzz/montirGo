import { useState, type ComponentProps } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, Space } from '@/constants/brand';

interface AuthFieldProps extends ComponentProps<typeof TextInput> {
  label: string;
  icon: IconName;
  /** Gaya untuk pembungkus (input + label). */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Input berlabel dengan ikon dan state fokus, mengikuti gaya form client
 * (`features/client`): sudut membulat, border halus, aksen biru saat fokus.
 */
export function AuthField({
  label,
  icon,
  containerStyle,
  secureTextEntry,
  onFocus,
  onBlur,
  ...inputProps
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocused]}>
        <Ionicons
          name={icon}
          size={18}
          color={focused ? Brand.primary : Brand.textMuted}
        />
        <TextInput
          {...inputProps}
          secureTextEntry={isPassword && !visible}
          placeholderTextColor={Brand.textMuted}
          selectionColor={Brand.primary}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={styles.input}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            hitSlop={8}
            onPress={() => setVisible((current) => !current)}
            style={({ pressed }) => [styles.eye, pressed && styles.pressed]}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={19}
              color={Brand.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: Space.lg },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Brand.text,
    marginBottom: Space.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: '#F7F9FC',
  },
  fieldFocused: {
    borderColor: Brand.primary,
    backgroundColor: Brand.surface,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: Brand.text,
  },
  eye: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
