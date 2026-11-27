import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/ui/badge';
import { ScreenHeader } from '@/components/ui/screen-header';
import { LoadingState } from '@/components/ui/state';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { LocationPinPickerSheet } from '@/features/client/components/location-pin-picker-sheet';
import { CalloutFeeCtaCard } from '@/features/client/request/callout-fee-cta-card';
import { LocationAndFallbackSection } from '@/features/client/request/location-and-fallback-section';
import { TierAndVehicleSection } from '@/features/client/request/tier-and-vehicle-section';
import { useNewRequest } from '@/features/client/request/use-new-request';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

export default function NewServiceRequestScreen() {
  const params = useLocalSearchParams<{ category?: string; vehicleId?: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const req = useNewRequest(params);

  if (req.sessionLoading) {
    return <LoadingState message="Menyiapkan permintaan bantuan..." />;
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Panggil Montir"
        subtitle={req.activeCategory?.description ?? 'Alur cepat 3 ketukan'}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: theme.spacing.xxxl + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Surface variant="subtle" padding="md" style={styles.banner}>
            <View style={styles.bannerRow}>
              <Badge
                label={req.activeCategory?.label ?? 'Butuh Montir'}
                tone={req.activeCategory?.tone ?? 'emergency'}
                icon={req.activeCategory?.icon}
              />
              {req.draftRestored ? (
                <Badge label="Draf dipulihkan" tone="info" size="sm" />
              ) : null}
            </View>
            <AppText variant="caption" tone="secondary">
              Langkah: Pilih kendaraan/derek → Jelaskan keluhan → Pastikan lokasi & kirim.
            </AppText>
          </Surface>

          <TierAndVehicleSection
            calloutTier={req.calloutTier}
            pricing={req.pricing}
            categoryKey={req.categoryKey}
            vehicles={req.vehicles}
            vehicleId={req.vehicleId}
            selectedVehicle={req.selectedVehicle}
            photoBusy={req.photoBusy}
            onSelectTier={req.selectCalloutTier}
            onSelectCategory={req.selectCategory}
            onSelectVehicle={req.selectVehicle}
            onAttachVehiclePhoto={() => void req.attachVehiclePhoto()}
            onAddVehicle={req.goAddVehicle}
          />

          <TextField
            label="Keluhan utama kendaraan"
            required
            multiline
            value={req.issue}
            onChangeText={req.setIssue}
            placeholder="Contoh: mesin mati mendadak, ban belakang bocor"
            error={req.issueError}
            showError={req.submitted}
          />

          <TextField
            label="Gejala tambahan"
            value={req.symptoms}
            onChangeText={req.setSymptoms}
            placeholder="Contoh: lampu indikator aki menyala (opsional)"
          />

          <LocationAndFallbackSection
            coords={req.coords}
            address={req.address}
            locating={req.locating}
            locationError={req.locationError}
            coordsError={req.coordsError}
            networkError={req.networkError}
            submitted={req.submitted}
            csWhatsApp={req.csWhatsApp}
            issueSummary={req.issue}
            onChangeAddress={req.setAddress}
            onDetectLocation={() => void req.detectLocation()}
            onOpenPinPicker={() => req.setPinPickerOpen(true)}
          />

          <TextField
            label="Nomor WhatsApp aktif"
            required
            value={req.contactPhone}
            onChangeText={req.setPhone}
            placeholder="08xxxxxxxxxx"
            keyboardType="phone-pad"
            leftIcon="logo-whatsapp"
            hint="Montir menghubungi nomor ini sebelum berangkat."
            error={req.phoneError}
            showError={req.submitted}
          />

          <TextField
            label="Catatan untuk montir"
            multiline
            value={req.notes}
            onChangeText={req.setNotes}
            placeholder="Contoh: parkir di sisi kanan portal, bawa dongkrak (opsional)"
          />

          <CalloutFeeCtaCard
            tier={req.calloutTier}
            calloutAmount={req.calloutAmount}
            submitting={req.submitting}
            onSubmit={() => void req.submit()}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <LocationPinPickerSheet
        visible={req.pinPickerOpen}
        initialCoords={req.coords}
        gpsCoords={req.prewarmCoords}
        onConfirm={(next) => void req.applyPinnedLocation(next)}
        onClose={() => req.setPinPickerOpen(false)}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  flex: { flex: 1 },
  content: {
    padding: theme.spacing.screenPadding,
    gap: theme.spacing.lg,
  },
  banner: {
    gap: theme.spacing.xs,
  },
  bannerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
    flexWrap: 'wrap' as const,
  },
});
