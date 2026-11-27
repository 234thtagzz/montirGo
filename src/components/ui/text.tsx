import {
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';
import {
  useAppTheme,
  type AppTheme,
  type SemanticTone,
  type TypographyVariant,
} from '@/theme';

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'inverse'
  | 'inverseMuted'
  | SemanticTone;

export interface AppTextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: TextTone;
  tabular?: boolean;
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<TextStyle>;
}

function resolveColor(theme: AppTheme, tone: TextTone): string {
  switch (tone) {
    case 'primary':
      return theme.colors.textPrimary;
    case 'secondary':
      return theme.colors.textSecondary;
    case 'muted':
      return theme.colors.textMuted;
    case 'inverse':
      return theme.colors.textInverse;
    case 'inverseMuted':
      return theme.colors.textInverseMuted;
    default:
      return theme.tones[tone].fg;
  }
}

/**
 * Primitif teks resmi MontirGo.
 * Menggunakan skala `Plus Jakarta Sans` terpetakan per bobot tanpa `fontWeight`.
 */
export function AppText({
  variant = 'body',
  tone = 'primary',
  tabular = false,
  align,
  style,
  ...rest
}: AppTextProps) {
  const { theme } = useAppTheme();

  return (
    <RNText
      style={[
        theme.typography[variant],
        { color: resolveColor(theme, tone) },
        tabular ? theme.tabularNums : null,
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}

export { AppText as Text };
