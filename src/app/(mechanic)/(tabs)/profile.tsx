import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { ScreenHeader } from '@/components/ui/screen-header';
import { LoadingState } from '@/components/ui/state';
import { ProfileFormsSection } from '@/features/mechanic/profile/profile-forms-section';
import { ProfileHeroAndStatus } from '@/features/mechanic/profile/profile-hero-and-status';
import { useMechanicProfile } from '@/features/mechanic/profile/use-mechanic-profile';
import { useThemedStyles, type AppTheme } from '@/theme';

export default function MechanicProfileScreen() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const state = useMechanicProfile();

  if (state.loading || state.sessionLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Profil Montir" showBack={false} />
        <LoadingState message="Memuat profil montir..." />
      </View>
    );
  }

  const displayName =
    state.fullName.trim() || state.sessionUser?.fullName || 'Montir MontirGo';

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 48 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ProfileHeroAndStatus
            name={displayName}
            email={state.sessionUser?.email ?? '-'}
            avatarUrl={state.avatarUrl}
            profile={state.profile}
            online={state.online}
            uploadingAvatar={state.uploadingAvatar}
            onPickAvatar={() => void state.pickAvatar()}
            onToggleOnline={(value) => void state.toggleOnline(value)}
          />

          <ProfileFormsSection
            fullName={state.fullName}
            onChangeFullName={state.setFullName}
            fullNameError={state.fullNameError}
            submitAttempted={state.submitAttempted}
            phone={state.phone}
            onChangePhone={state.setPhone}
            identityNumber={state.sessionUser?.identityNumber}
            bio={state.bio}
            onChangeBio={state.setBio}
            experience={state.experience}
            onChangeExperience={state.setExperience}
            vehicleLabel={state.vehicleLabel}
            onChangeVehicleLabel={state.setVehicleLabel}
            vehiclePlate={state.vehiclePlate}
            onChangeVehiclePlate={state.setVehiclePlate}
            workshop={state.workshop}
            onChangeWorkshop={state.setWorkshop}
            workshopAddress={state.workshopAddress}
            onChangeWorkshopAddress={state.setWorkshopAddress}
            workshopPhotos={state.workshopPhotos}
            workshopPhotoUrls={state.workshopPhotoUrls}
            uploadingWorkshop={state.uploadingWorkshop}
            onAddWorkshopPhoto={() => void state.addWorkshopPhoto()}
            onRemoveWorkshopPhoto={(path) => void state.removeWorkshopPhoto(path)}
            skills={state.skills}
            onChangeSkills={state.setSkills}
            specializations={state.specializations}
            onToggleSpecialization={state.toggleSpecialization}
            certifications={state.certifications}
            onAddCertification={state.addCertification}
            onUpdateCertification={state.updateCertification}
            onRemoveCertification={state.removeCertification}
            reviews={state.reviews}
            saving={state.saving}
            onSave={() => void state.handleSave()}
            onOpenLogout={() => state.setLogoutConfirmOpen(true)}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmSheet
        visible={state.logoutConfirmOpen}
        title="Keluar dari akun?"
        message="Kamu perlu login kembali untuk menerima order."
        confirmLabel="Keluar"
        cancelLabel="Batal"
        icon="log-out-outline"
        destructive
        loading={state.loggingOut}
        onConfirm={() => void state.confirmLogout()}
        onCancel={() => state.setLogoutConfirmOpen(false)}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: theme.spacing.xxxl,
  },
});
