import { useState, type ReactNode } from 'react';
import {
  TextInput,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TargetedEvent,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string | null;
  touched?: boolean;
  showError?: boolean;
  required?: boolean;
  leftIcon?: IconName;
  rightAccessory?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: TextInputProps['style'];
}

/**
 * Input teks berstandar WCAG AA (border >= 3:1) dengan validasi inline
 * yang muncul setelah blur, disentuh, atau submit (`showError`).
 */
export function TextField({
  label,
  hint,
  error,
  touched = false,
  showError = false,
  required = false,
  leftIcon,
  rightAccessory,
  containerStyle,
  inputStyle,
  editable = true,
  onFocus,
  onBlur,
  multiline,
  ...rest
}: TextFieldProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const [blurred, setBlurred] = useState(false);

  const hasVisibleError = Boolean(error && (blurred || touched || showError));

  const handleFocus = (e: NativeSyntheticEvent<TargetedEvent>) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: NativeSyntheticEvent<TargetedEvent>) => {
    setFocused(false);
    setBlurred(true);
    onBlur?.(e);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <AppText variant="label" tone="primary">
            {label}
          </AppText>
          {required ? (
            <AppText variant="label" tone="danger" accessibilityLabel="Wajib diisi">
              *
            </AppText>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          focused && styles.fieldFocused,
          hasVisibleError && styles.fieldError,
          !editable && styles.fieldDisabled,
        ]}
      >
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={18}
            color={
              hasVisibleError
                ? theme.colors.statusDangerFg
                : focused
                  ? theme.colors.borderFocus
                  : theme.colors.textMuted
            }
            style={multiline ? styles.iconTop : undefined}
          />
        ) : null}

        <TextInput
          editable={editable}
          multiline={multiline}
          placeholderTextColor={theme.components.input.placeholderColor}
          selectionColor={theme.colors.borderFocus}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
          {...rest}
        />

        {rightAccessory ? <View style={styles.rightAccessory}>{rightAccessory}</View> : null}
      </View>

      {hasVisibleError ? (
        <View style={styles.feedbackRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={theme.colors.statusDangerFg} />
          <AppText variant="caption" tone="danger" style={styles.feedbackText}>
            {error}
          </AppText>
        </View>
      ) : hint ? (
        <AppText variant="caption" tone="muted" style={styles.hint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  container: {
    gap: theme.spacing.xs,
  },
  labelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xxs,
  },
  field: {
    minHeight: theme.components.input.minHeight,
    borderRadius: theme.components.input.radius,
    borderCurve: theme.components.input.borderCurve,
    borderWidth: 1.5,
    borderColor: theme.components.input.borderColor,
    backgroundColor: theme.components.input.bg,
    paddingHorizontal: theme.components.input.paddingHorizontal,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  fieldMultiline: {
    alignItems: 'flex-start' as const,
    paddingVertical: theme.spacing.md,
  },
  fieldFocused: {
    borderColor: theme.components.input.focusBorderColor,
  },
  fieldError: {
    borderColor: theme.components.input.errorBorderColor,
  },
  fieldDisabled: {
    backgroundColor: theme.colors.bgSurfaceSubtle,
    opacity: 0.72,
  },
  iconTop: {
    marginTop: theme.spacing.xxs,
  },
  input: {
    flex: 1,
    fontFamily: theme.fontFamily.regular,
    fontSize: 15,
    lineHeight: 21,
    color: theme.components.input.textColor,
    paddingVertical: theme.spacing.sm,
  },
  inputMultiline: {
    minHeight: 84,
    textAlignVertical: 'top' as const,
    paddingVertical: theme.spacing.none,
  },
  rightAccessory: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  feedbackRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  feedbackText: {
    flex: 1,
  },
  hint: {
    marginTop: theme.spacing.xxs,
  },
});
