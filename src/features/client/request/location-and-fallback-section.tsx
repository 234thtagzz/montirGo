import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { openPhoneDialer, openWhatsApp } from '@/utils/whatsapp';

interface LocationAndFallbackSectionProps {
  coords: { lat: number; lng: number } | null;
  address: string;
  locating: boolean;
  locationError: string | null;
  coordsError: string | null;
  networkError: string | null;
  submitted: boolean;
  csWhatsApp: string | null;
  issueSummary: string;
  onChangeAddress: (text: string) => void;
  onDetectLocation: () => void;
  onOpenPinPicker: () => void;
}

export function LocationAndFallbackSection({
  coords,
  address,
  locating,
  locationError,
  coordsError,
  networkError,
  submitted,
  csWhatsApp,
  issueSummary,
  onChangeAddress,
  onDetectLocation,
  onOpenPinPicker,
}: LocationAndFallbackSectionProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const [fallbackExpanded, setFallbackExpanded] = useState(false);

  const showFallback = fallbackExpanded || Boolean(locationError || networkError);
  const activeLocationTone = coords
    ? theme.tones.success
    : submitted && coordsError
      ? theme.tones.danger
      : theme.tones.info;

  const contactCsWhatsApp = async () => {
    const res = await openWhatsApp(
      csWhatsApp,
      `Halo CS MontirGo, saya butuh bantuan darurat.\nKeluhan: ${issueSummary || '-'}\nAlamat/patokan: ${address || '-'}`,
    );
    if (!res.ok) {
      showToast({
        tone: 'warning',
        title: 'WhatsApp CS tidak tersedia',
        message: res.error ?? 'Gunakan tombol Telepon CS.',
      });
    }
  };

  const callCs = async () => {
    const res = await openPhoneDialer(csWhatsApp);
    if (!res.ok) {
      showToast({
        tone: 'warning',
        title: 'Gagal membuka telepon',
        message: res.error ?? 'Nomor CS belum dikonfigurasi.',
      });
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <AppText variant="label">3. Lokasi kendaraan</AppText>
        <AppText variant="label" tone="danger">
          *
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onDetectLocation}
        disabled={locating}
        style={({ pressed }) => [
          styles.locationBtn,
          {
            backgroundColor: activeLocationTone.bg,
            borderColor: activeLocationTone.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.locationIcon}>
          <Ionicons
            name={coords ? 'checkmark-circle' : 'locate-outline'}
            size={20}
            color={activeLocationTone.fg}
          />
        </View>
        <View style={styles.locationCopy}>
          <AppText variant="label" style={{ color: activeLocationTone.fg }}>
            {locating
              ? 'Mengambil titik GPS…'
              : coords
                ? 'Titik GPS siap digunakan'
                : 'Gunakan lokasi GPS saat ini'}
          </AppText>
          <AppText variant="caption" tone="secondary" style={theme.tabularNums}>
            {coords
              ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
              : 'Ketuk untuk membaca koordinat perangkatmu'}
          </AppText>
        </View>
        {locating ? <ActivityIndicator size="small" color={activeLocationTone.fg} /> : null}
      </Pressable>

      <Button
        label="Geser Pin di Peta"
        icon="map-outline"
        variant="secondary"
        size="compact"
        onPress={onOpenPinPicker}
      />

      {locationError || (submitted && coordsError) ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={15} color={theme.colors.statusDangerFg} />
          <AppText variant="caption" tone="danger" style={styles.flexCopy}>
            {locationError ?? coordsError}
          </AppText>
        </View>
      ) : null}

      <TextField
        label="Alamat / patokan lokasi"
        placeholder="Contoh: Depan Indomaret Jl. Sudirman, dekat halte"
        value={address}
        onChangeText={onChangeAddress}
        leftIcon="location-outline"
        hint="Isi patokan jelas jika sinyal lemah atau berada di area basement/gang."
      />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showFallback }}
        onPress={() => setFallbackExpanded((prev) => !prev)}
        style={({ pressed }) => [styles.fallbackToggle, pressed && styles.pressed]}
      >
        <Ionicons
          name="cellular-outline"
          size={16}
          color={theme.colors.statusWarningFg}
        />
        <AppText variant="caption" tone="warning" style={styles.flexCopy}>
          Sinyal lemah atau GPS bermasalah? Ketuk untuk jalur CS darurat
        </AppText>
        <Ionicons
          name={showFallback ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.colors.textMuted}
        />
      </Pressable>

      {showFallback ? (
        <View style={styles.fallbackCard}>
          <AppText variant="label">Jalur Cadangan Sinyal Lemah</AppText>
          <AppText variant="caption" tone="secondary">
            Tulis alamat manual di kolom atas lalu hubungi Tim CS MontirGo agar kami bantu teruskan ke montir terdekat.
          </AppText>
          <View style={styles.fallbackActions}>
            <Button
              label="WhatsApp CS"
              icon="logo-whatsapp"
              variant="whatsapp"
              size="compact"
              onPress={contactCsWhatsApp}
              style={styles.fallbackBtn}
            />
            <Button
              label="Telepon CS"
              icon="call-outline"
              variant="secondary"
              size="compact"
              onPress={callCs}
              style={styles.fallbackBtn}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  section: {
    gap: theme.spacing.sm,
  },
  labelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xxs,
  },
  locationBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    minHeight: 60,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1.5,
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  locationCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  errorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  flexCopy: { flex: 1 },
  fallbackToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusWarningBg,
    borderWidth: 1,
    borderColor: theme.colors.statusWarningBorder,
  },
  fallbackCard: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  fallbackActions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  fallbackBtn: {
    flex: 1,
  },
  pressed: { opacity: 0.8 },
});
