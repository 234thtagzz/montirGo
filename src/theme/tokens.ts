import type { ViewStyle } from 'react-native';
import {
  AvatarPaletteDark,
  AvatarPaletteLight,
  Motion,
  Palette,
  Radii,
  Spacing,
  TouchTarget,
} from '@/theme/primitives';
import { FontFamily, TabularNums, Typography } from '@/theme/typography';

export type ThemeMode = 'light' | 'dark';
export type SemanticTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'emergency';

export interface ToneTokens {
  readonly fg: string;
  readonly bg: string;
  readonly border: string;
}

export interface ThemeColors {
  readonly bgCanvas: string;
  readonly bgSurface: string;
  readonly bgSurfaceSubtle: string;
  readonly bgSurfaceElevated: string;
  readonly bgInverse: string;

  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly textInverse: string;
  readonly textInverseMuted: string;

  readonly actionPrimaryBg: string;
  readonly actionPrimaryAltBg: string;
  readonly actionPrimaryFg: string;
  readonly actionPrimaryPressed: string;
  readonly actionEmergencyBg: string;
  readonly actionEmergencyFg: string;
  readonly actionEmergencyPressed: string;
  readonly actionSecondaryBg: string;
  readonly actionSecondaryFg: string;
  readonly actionSecondaryBorder: string;
  readonly actionDangerBg: string;
  readonly actionDangerFg: string;
  readonly actionDangerSubtleBg: string;
  readonly actionDangerSubtleFg: string;
  readonly whatsappBg: string;
  readonly whatsappFg: string;

  readonly borderSubtle: string;
  readonly borderDefault: string;
  readonly borderInput: string;
  readonly borderFocus: string;

  readonly statusSuccessFg: string;
  readonly statusSuccessBg: string;
  readonly statusSuccessBorder: string;
  readonly statusWarningFg: string;
  readonly statusWarningBg: string;
  readonly statusWarningBorder: string;
  readonly statusDangerFg: string;
  readonly statusDangerBg: string;
  readonly statusDangerBorder: string;
  readonly statusInfoFg: string;
  readonly statusInfoBg: string;
  readonly statusInfoBorder: string;
  readonly statusNeutralFg: string;
  readonly statusNeutralBg: string;
  readonly statusNeutralBorder: string;
  readonly statusEmergencyFg: string;
  readonly statusEmergencyBg: string;
  readonly statusEmergencyBorder: string;

  readonly skeletonBase: string;
  readonly skeletonHighlight: string;
  readonly overlayScrim: string;
  readonly tabBarBg: string;
  readonly tabBarBorder: string;
  readonly tabActive: string;
  readonly tabActiveBg: string;
  readonly tabInactive: string;
  readonly shadowColor: string;
  readonly transparent: string;
}

const LIGHT_COLORS: ThemeColors = {
  bgCanvas: Palette.slate[50],
  bgSurface: Palette.white,
  bgSurfaceSubtle: Palette.slate[100],
  bgSurfaceElevated: Palette.white,
  bgInverse: Palette.slate[900],

  textPrimary: Palette.slate[900],
  textSecondary: Palette.slate[600],
  textMuted: Palette.slate[500],
  textInverse: Palette.white,
  textInverseMuted: Palette.slate[300],

  actionPrimaryBg: Palette.slate[900],
  actionPrimaryAltBg: Palette.blue[900],
  actionPrimaryFg: Palette.white,
  actionPrimaryPressed: Palette.slate[800],
  actionEmergencyBg: Palette.orange[700],
  actionEmergencyFg: Palette.white,
  actionEmergencyPressed: Palette.orange[800],
  actionSecondaryBg: Palette.white,
  actionSecondaryFg: Palette.slate[900],
  actionSecondaryBorder: Palette.slate[450],
  actionDangerBg: Palette.red[700],
  actionDangerFg: Palette.white,
  actionDangerSubtleBg: Palette.red[50],
  actionDangerSubtleFg: Palette.red[700],
  whatsappBg: Palette.whatsapp.light,
  whatsappFg: Palette.white,

  borderSubtle: Palette.slate[200],
  borderDefault: Palette.slate[300],
  borderInput: Palette.slate[450],
  borderFocus: Palette.blue[900],

  statusSuccessFg: Palette.emerald[700],
  statusSuccessBg: Palette.emerald[50],
  statusSuccessBorder: Palette.emerald[200],
  statusWarningFg: Palette.amber[700],
  statusWarningBg: Palette.amber[50],
  statusWarningBorder: Palette.amber[200],
  statusDangerFg: Palette.red[700],
  statusDangerBg: Palette.red[50],
  statusDangerBorder: Palette.red[200],
  statusInfoFg: Palette.blue[900],
  statusInfoBg: Palette.blue[50],
  statusInfoBorder: Palette.blue[200],
  statusNeutralFg: Palette.slate[700],
  statusNeutralBg: Palette.slate[100],
  statusNeutralBorder: Palette.slate[300],
  statusEmergencyFg: Palette.orange[700],
  statusEmergencyBg: Palette.orange[50],
  statusEmergencyBorder: Palette.orange[200],

  skeletonBase: Palette.slate[200],
  skeletonHighlight: Palette.slate[100],
  overlayScrim: Palette.scrim.light,
  tabBarBg: Palette.white,
  tabBarBorder: Palette.slate[200],
  tabActive: Palette.blue[900],
  tabActiveBg: Palette.blue[50],
  tabInactive: Palette.slate[500],
  shadowColor: Palette.shadow.light,
  transparent: Palette.transparent,
};

const DARK_COLORS: ThemeColors = {
  bgCanvas: Palette.slate[950],
  bgSurface: Palette.darkSurface,
  bgSurfaceSubtle: Palette.slate[800],
  bgSurfaceElevated: Palette.slate[800],
  bgInverse: Palette.slate[50],

  textPrimary: Palette.slate[50],
  textSecondary: Palette.slate[300],
  textMuted: Palette.slate[400],
  textInverse: Palette.slate[950],
  textInverseMuted: Palette.slate[600],

  actionPrimaryBg: Palette.blue[400],
  actionPrimaryAltBg: Palette.blue[400],
  actionPrimaryFg: Palette.slate[950],
  actionPrimaryPressed: Palette.blue[500],
  actionEmergencyBg: Palette.orange[400],
  actionEmergencyFg: Palette.slate[950],
  actionEmergencyPressed: Palette.orange[500],
  actionSecondaryBg: Palette.slate[800],
  actionSecondaryFg: Palette.slate[50],
  actionSecondaryBorder: Palette.slate[500],
  actionDangerBg: Palette.red[400],
  actionDangerFg: Palette.slate[950],
  actionDangerSubtleBg: Palette.red[950],
  actionDangerSubtleFg: Palette.red[400],
  whatsappBg: Palette.whatsapp.dark,
  whatsappFg: Palette.slate[950],

  borderSubtle: Palette.slate[800],
  borderDefault: Palette.slate[700],
  borderInput: Palette.slate[500],
  borderFocus: Palette.blue[400],

  statusSuccessFg: Palette.emerald[400],
  statusSuccessBg: Palette.emerald[950],
  statusSuccessBorder: Palette.emerald[800],
  statusWarningFg: Palette.amber[400],
  statusWarningBg: Palette.amber[950],
  statusWarningBorder: Palette.amber[900],
  statusDangerFg: Palette.red[400],
  statusDangerBg: Palette.red[950],
  statusDangerBorder: Palette.red[900],
  statusInfoFg: Palette.blue[400],
  statusInfoBg: Palette.blue[950],
  statusInfoBorder: Palette.blue[800],
  statusNeutralFg: Palette.slate[300],
  statusNeutralBg: Palette.slate[800],
  statusNeutralBorder: Palette.slate[700],
  statusEmergencyFg: Palette.orange[400],
  statusEmergencyBg: Palette.orange[950],
  statusEmergencyBorder: Palette.orange[900],

  skeletonBase: Palette.slate[800],
  skeletonHighlight: Palette.slate[700],
  overlayScrim: Palette.scrim.dark,
  tabBarBg: Palette.darkSurface,
  tabBarBorder: Palette.slate[800],
  tabActive: Palette.blue[400],
  tabActiveBg: Palette.blue[950],
  tabInactive: Palette.slate[400],
  shadowColor: Palette.shadow.dark,
  transparent: Palette.transparent,
};

function buildTones(colors: ThemeColors): Record<SemanticTone, ToneTokens> {
  return {
    info: {
      fg: colors.statusInfoFg,
      bg: colors.statusInfoBg,
      border: colors.statusInfoBorder,
    },
    success: {
      fg: colors.statusSuccessFg,
      bg: colors.statusSuccessBg,
      border: colors.statusSuccessBorder,
    },
    warning: {
      fg: colors.statusWarningFg,
      bg: colors.statusWarningBg,
      border: colors.statusWarningBorder,
    },
    danger: {
      fg: colors.statusDangerFg,
      bg: colors.statusDangerBg,
      border: colors.statusDangerBorder,
    },
    neutral: {
      fg: colors.statusNeutralFg,
      bg: colors.statusNeutralBg,
      border: colors.statusNeutralBorder,
    },
    emergency: {
      fg: colors.statusEmergencyFg,
      bg: colors.statusEmergencyBg,
      border: colors.statusEmergencyBorder,
    },
  };
}

function buildComponents(colors: ThemeColors) {
  return {
    button: {
      ctaHeight: TouchTarget.cta,
      mdHeight: 50,
      compactHeight: TouchTarget.min,
      radius: Radii.md,
      borderCurve: 'continuous' as const,
      paddingHorizontal: Spacing.xl,
    },
    card: {
      bg: colors.bgSurface,
      borderColor: colors.borderSubtle,
      borderWidth: 1,
      radius: Radii.lg,
      borderCurve: 'continuous' as const,
      padding: Spacing.lg,
    },
    input: {
      bg: colors.bgSurface,
      borderColor: colors.borderInput,
      focusBorderColor: colors.borderFocus,
      errorBorderColor: colors.statusDangerFg,
      textColor: colors.textPrimary,
      placeholderColor: colors.textMuted,
      minHeight: 52,
      radius: Radii.sm,
      borderCurve: 'continuous' as const,
      paddingHorizontal: Spacing.md,
    },
    chip: {
      minHeight: TouchTarget.min,
      radius: Radii.sm,
      borderCurve: 'continuous' as const,
      paddingHorizontal: Spacing.md,
    },
    badge: {
      radius: Radii.pill,
      borderCurve: 'continuous' as const,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    sheet: {
      bg: colors.bgSurface,
      handleColor: colors.borderDefault,
      scrim: colors.overlayScrim,
      radius: Radii.sheet,
      borderCurve: 'continuous' as const,
    },
    swipeAction: {
      height: TouchTarget.cta,
      thumbSize: TouchTarget.min,
      edgeInset: 20,
      radius: Radii.lg,
      borderCurve: 'continuous' as const,
    },
  } as const;
}

function buildElevation(mode: ThemeMode, shadowColor: string): Record<'none' | 'card' | 'sheet', ViewStyle> {
  if (mode === 'dark') {
    return {
      none: {},
      card: {
        shadowColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      },
      sheet: {
        shadowColor,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 8,
      },
    };
  }

  return {
    none: {},
    card: {
      shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    sheet: {
      shadowColor,
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 10,
    },
  };
}

/** Token khusus untuk layar boot gelap (konsisten di Light/Dark agar tidak berkedip saat splash). */
export const BootTokens = {
  bg: Palette.slate[950],
  surface: Palette.darkSurface,
  surfaceBorder: Palette.overlayBorderLight,
  surfaceOverlay: Palette.overlaySubtleLight,
  track: Palette.overlayTrackLight,
  text: Palette.white,
  textMuted: Palette.slate[300],
  accent: Palette.blue[400],
  emergency: Palette.orange[400],
  glowBlueStart: Palette.overlayBlueGlow,
  glowBlueEnd: Palette.overlayBlueClear,
  glowOrangeStart: Palette.overlayOrangeGlow,
  glowOrangeEnd: Palette.overlayOrangeClear,
  vignetteStart: Palette.overlayVignetteStart,
  vignetteEnd: Palette.overlayVignetteEnd,
  logoTileBg: Palette.slate[50],
  shadow: Palette.black,
} as const;

export interface AppTheme {
  readonly mode: ThemeMode;
  readonly isDark: boolean;
  readonly colors: ThemeColors;
  readonly tones: Record<SemanticTone, ToneTokens>;
  readonly components: ReturnType<typeof buildComponents>;
  readonly elevation: Record<'none' | 'card' | 'sheet', ViewStyle>;
  readonly avatar: {
    readonly palette: readonly string[];
    readonly textColor: string;
  };
  readonly spacing: typeof Spacing;
  readonly radii: typeof Radii;
  readonly touchTarget: typeof TouchTarget;
  readonly motion: typeof Motion;
  readonly fontFamily: typeof FontFamily;
  readonly typography: typeof Typography;
  readonly tabularNums: typeof TabularNums;
}

function createTheme(mode: ThemeMode): AppTheme {
  const isDark = mode === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return Object.freeze({
    mode,
    isDark,
    colors,
    tones: buildTones(colors),
    components: buildComponents(colors),
    elevation: buildElevation(mode, colors.shadowColor),
    avatar: {
      palette: isDark ? AvatarPaletteDark : AvatarPaletteLight,
      textColor: isDark ? Palette.slate[950] : Palette.white,
    },
    spacing: Spacing,
    radii: Radii,
    touchTarget: TouchTarget,
    motion: Motion,
    fontFamily: FontFamily,
    typography: Typography,
    tabularNums: TabularNums,
  });
}

export const lightTheme: AppTheme = createTheme('light');
export const darkTheme: AppTheme = createTheme('dark');
