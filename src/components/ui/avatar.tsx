import { Image, StyleSheet, Text, View } from 'react-native';
import { Brand } from '@/constants/brand';

const PALETTE = ['#0B74E5', '#00A651', '#F59E0B', '#8B5CF6', '#EC4899', '#0891B2'];

function initials(name: string): string {
  const clean = name.trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(name: string): string {
  const code = name.trim().charCodeAt(0) || 0;
  return PALETTE[code % PALETTE.length];
}

interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
}

export function Avatar({ name, uri, size = 40 }: AvatarProps) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, dimension]} />;
  }

  return (
    <View style={[styles.fallback, dimension, { backgroundColor: colorFor(name) }]}>
      <Text style={[styles.text, { fontSize: Math.max(11, size * 0.36) }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: Brand.divider },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  text: { color: Brand.white, fontWeight: '700' },
});
