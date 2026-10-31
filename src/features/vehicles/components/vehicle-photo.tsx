import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space } from '@/constants/brand';
import { resolveVehiclePhotoUrl } from '../photo';

interface VehiclePhotoProps {
  /** Path objek di bucket `vehicle-photos` atau URL foto lama. */
  value?: string | null;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  /** Tampilkan keterangan saat kendaraan belum punya foto. */
  emptyLabel?: string | null;
}

/**
 * Foto kendaraan dengan signed URL otomatis.
 * Bucket foto privat, jadi path di database tidak bisa dipakai langsung
 * sebagai `source` sebelum ditukar menjadi signed URL.
 */
export function VehiclePhoto({
  value,
  height,
  borderRadius = Radius.md,
  style,
  emptyLabel = 'Belum ada foto kendaraan',
}: VehiclePhotoProps) {
  // `resolved` menyimpan hasil signed URL beserta nilai sumbernya. Dengan
  // membandingkan key, perubahan nilai bisa ditampilkan sebagai loading tanpa
  // memanggil setState sinkron di dalam effect.
  const [resolved, setResolved] = useState<{ key: string; uri: string | null } | null>(null);

  useEffect(() => {
    if (!value) return;
    let active = true;

    resolveVehiclePhotoUrl(value)
      .then((url) => {
        if (active) setResolved({ key: value, uri: url });
      })
      .catch(() => {
        if (active) setResolved({ key: value, uri: null });
      });

    return () => {
      active = false;
    };
  }, [value]);

  const uri = value && resolved?.key === value ? resolved.uri : null;
  const loading = Boolean(value) && resolved?.key !== value;

  return (
    <View
      style={[
        styles.frame,
        { height, borderRadius },
        !uri && styles.placeholder,
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="cover"
          transition={150}
        />
      ) : loading ? (
        <ActivityIndicator size="small" color={Brand.primary} />
      ) : (
        <>
          <Ionicons name="image-outline" size={24} color={Brand.textMuted} />
          {emptyLabel ? <Text style={styles.emptyText}>{emptyLabel}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: Brand.background,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.xs,
    borderWidth: 1,
    borderColor: Brand.border,
    borderStyle: 'dashed',
  },
  image: { width: '100%', height: '100%' },
  emptyText: {
    fontSize: 10.5,
    color: Brand.textMuted,
    textAlign: 'center',
    paddingHorizontal: Space.md,
  },
});
