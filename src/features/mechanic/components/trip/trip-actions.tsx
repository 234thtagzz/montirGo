import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, Space } from '@/constants/brand';

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
  onPress: () => void;
  disabled?: boolean;
}

export function TripActions({ phone, onWhatsApp, onCall, onOpenMaps }: TripActionsProps) {
  const actions: ActionItem[] = [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: 'logo-whatsapp',
      color: Brand.whatsapp,
      background: '#E9FBF0',
      onPress: onWhatsApp,
      disabled: !phone,
    },
    {
      key: 'call',
      label: 'Telepon',
      icon: 'call',
      color: Brand.primary,
      background: Brand.primarySoft,
      onPress: onCall,
      disabled: !phone,
    },
    {
      key: 'maps',
      label: 'Rute',
      icon: 'map',
      color: Brand.textSecondary,
      background: '#F3F6FA',
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
          <View style={[styles.iconWrap, { backgroundColor: action.background }]}>
            <Ionicons name={action.icon} size={19} color={action.color} />
          </View>
          <Text style={styles.label}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Space.md,
  },
  action: { flex: 1, alignItems: 'center', gap: 6 },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, fontWeight: '600', color: Brand.textSecondary },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
