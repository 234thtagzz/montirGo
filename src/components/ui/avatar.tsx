import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { FontFamily, useAppTheme } from '@/theme';

function initials(name: string): string {
  const clean = name.trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(name: string, palette: readonly string[]): string {
  const code = name.trim().charCodeAt(0) || 0;
  return palette[code % palette.length];
}

interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
}

export function Avatar({ name, uri, size = 40 }: AvatarProps) {
  const { theme } = useAppTheme();
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        accessibilityLabel={`Foto profil ${name}`}
        style={[
          styles.image,
          { backgroundColor: theme.colors.bgSurfaceSubtle },
          dimension,
        ]}
      />
    );
  }

  return (
    <View
      accessibilityLabel={`Inisial ${name}`}
      style={[
        styles.fallback,
        dimension,
        { backgroundColor: colorFor(name, theme.avatar.palette) },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: theme.avatar.textColor,
            fontSize: Math.max(11, Math.round(size * 0.36)),
          },
        ]}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: FontFamily.bold },
});
