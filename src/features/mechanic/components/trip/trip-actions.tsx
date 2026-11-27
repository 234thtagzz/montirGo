import { Pressable, View } from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface TripActionsProps {
  phone: string | null;
  onWhatsApp: () => void;
  onCall: () => void;
  onOpenMaps: () => void;
}

interface ActionItem {
  key: string;
  label: string;
  icon: IconName;
  color: string;
  background: string;
  border: string;
  onPress: () => void;
  disabled?: boolean;
}

export function TripActions({ phone, onWhatsApp, onCall, onOpenMaps }: TripActionsProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const actions: ActionItem[] = [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: 'logo-whatsapp',
      color: theme.colors.statusSuccessFg,
      background: theme.colors.statusSuccessBg,
      border: theme.colors.statusSuccessBorder,
      onPress: onWhatsApp,
      disabled: !phone,
    },
    {
      key: 'call',
      label: 'Telepon',
      icon: 'call',
      color: theme.colors.statusInfoFg,
      background: theme.colors.statusInfoBg,
      border: theme.colors.statusInfoBorder,
      onPress: onCall,
      disabled: !phone,
    },
    {
      key: 'maps',
      label: 'Rute',
      icon: 'map',
      color: theme.colors.textPrimary,
      background: theme.colors.bgSurfaceSubtle,
      border: theme.colors.borderDefault,
      onPress: onOpenMaps,
    },
  ];

  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{ disabled: action.disabled }}
          disabled={action.disabled}
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.action,
            action.disabled && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: action.background,
                borderColor: action.border,
              },
            ]}
          >
            <Ionicons name={action.icon} size={20} color={action.color} />
          </View>
          <AppText variant="caption" tone="secondary">
            {action.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
  },
  action: {
    flex: 1,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    minHeight: theme.touchTarget.min,
  },
  iconWrap: {
    width: theme.touchTarget.min,
    height: theme.touchTarget.min,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.72,
  },
});
