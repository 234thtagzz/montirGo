import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/service';
import {
  deleteWorkshopPhotos,
  MAX_WORKSHOP_PHOTOS,
  pickMechanicPhoto,
  resolveWorkshopPhotoUrls,
  uploadMechanicAvatar,
  uploadWorkshopPhoto,
} from '@/features/mechanic/photo';
import {
  getMechanicProfile,
  getMyProfileRow,
  listMechanicReviews,
  setOnlineStatus,
  updateMechanicProfile,
  updateMyProfileIdentity,
  type MechanicProfile,
  type MechanicReview,
} from '@/features/mechanic/service';
import { useSessionUser } from '@/hooks/use-session-user';

export interface CertificationDraft {
  key: string;
  title: string;
  issuer: string;
  year: string;
}

function makeKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value: string): number | null {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCertification(value: string): CertificationDraft {
  const text = value.trim();
  const yearMatch = text.match(/\((\d{4})\)\s*$/);
  const year = yearMatch ? yearMatch[1] : '';
  const withoutYear = yearMatch ? text.slice(0, yearMatch.index).trim() : text;

  const dashIndex = withoutYear.indexOf('—');
  if (dashIndex === -1) {
    return { key: makeKey(), title: withoutYear, issuer: '', year };
  }
  return {
    key: makeKey(),
    title: withoutYear.slice(0, dashIndex).trim(),
    issuer: withoutYear.slice(dashIndex + 1).trim(),
    year,
  };
}

function formatCertification(draft: CertificationDraft): string {
  const title = draft.title.trim();
  const issuer = draft.issuer.trim();
  const year = draft.year.trim();
  if (!issuer && !year) return title;
  const detail = [issuer, year ? `(${year})` : ''].filter(Boolean).join(' ');
  return `${title} — ${detail}`;
}

export function useMechanicProfile() {
  const { logout } = useAuth();
  const { user: sessionUser, loading: sessionLoading } = useSessionUser();
  const { showToast } = useToast();
  const router = useRouter();

  const [profile, setProfile] = useState<MechanicProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [vehicleLabel, setVehicleLabel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [workshopAddress, setWorkshopAddress] = useState('');
  const [skills, setSkills] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<CertificationDraft[]>([]);
  const [reviews, setReviews] = useState<MechanicReview[]>([]);

  const [workshopPhotos, setWorkshopPhotos] = useState<string[]>([]);
  const [workshopPhotoUrls, setWorkshopPhotoUrls] = useState<Record<string, string>>({});

  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingWorkshop, setUploadingWorkshop] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const userId = sessionUser?.id;

  const load = useCallback(async () => {
    try {
      const [mechanic, identity, reviewRows] = await Promise.all([
        getMechanicProfile(),
        getMyProfileRow(),
        listMechanicReviews().catch(() => []),
      ]);

      setProfile(mechanic);
      setAvatarUrl(identity.avatar_url);
      setFullName(identity.full_name ?? '');
      setPhone(identity.phone_number ?? '');
      setBio(mechanic?.bio ?? '');
      setExperience(mechanic?.experience_years?.toString() ?? '');
      setVehicleLabel(mechanic?.vehicle_label ?? '');
      setVehiclePlate(mechanic?.vehicle_plate ?? '');
      setWorkshop(mechanic?.workshop_name ?? '');
      setWorkshopAddress(mechanic?.workshop_address ?? '');
      setSkills((mechanic?.skills ?? []).join(', '));
      setSpecializations(mechanic?.vehicle_specialization ?? []);
      setCertifications((mechanic?.certifications ?? []).map(parseCertification));
      setOnline(mechanic?.is_online ?? false);
      setReviews(reviewRows);

      const photos = mechanic?.workshop_photos ?? [];
      setWorkshopPhotos(photos);
      setWorkshopPhotoUrls(
        await resolveWorkshopPhotoUrls(photos).catch((): Record<string, string> => ({})),
      );
    } catch (err) {
      showToast({
        tone: 'danger',
        title: 'Gagal memuat profil',
        message: err instanceof Error ? err.message : 'Coba lagi beberapa saat.',
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const toggleOnline = async (value: boolean) => {
    setOnline(value);
    try {
      await setOnlineStatus(value);
      showToast({
        tone: value ? 'success' : 'info',
        message: value ? 'Kamu sekarang SIAGA menerima order.' : 'Mode offline diaktifkan.',
      });
    } catch (err) {
      setOnline(!value);
      showToast({
        tone: 'danger',
        title: 'Gagal mengubah status',
        message: err instanceof Error ? err.message : 'Coba lagi beberapa saat.',
      });
    }
  };

  const toggleSpecialization = (value: string) => {
    setSpecializations((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const addWorkshopPhoto = async () => {
    if (!userId || uploadingWorkshop) return;
    if (workshopPhotos.length >= MAX_WORKSHOP_PHOTOS) {
      showToast({
        tone: 'warning',
        message: `Maksimal ${MAX_WORKSHOP_PHOTOS} foto bengkel.`,
      });
      return;
    }
    try {
      const photo = await pickMechanicPhoto([4, 3]);
      if (!photo) return;
      setUploadingWorkshop(true);
      const path = await uploadWorkshopPhoto(userId, photo);
      const next = [...workshopPhotos, path];
      await updateMechanicProfile({ workshop_photos: next });
      setWorkshopPhotos(next);
      const urls = await resolveWorkshopPhotoUrls(next);
      setWorkshopPhotoUrls(urls);
      showToast({ tone: 'success', message: 'Foto bengkel tersimpan.' });
    } catch (err) {
      showToast({
        tone: 'danger',
        title: 'Gagal mengunggah foto',
        message: err instanceof Error ? err.message : 'Coba lagi.',
      });
    } finally {
      setUploadingWorkshop(false);
    }
  };

  const removeWorkshopPhoto = async (path: string) => {
    try {
      const next = workshopPhotos.filter((item) => item !== path);
      await updateMechanicProfile({ workshop_photos: next });
      setWorkshopPhotos(next);
      setWorkshopPhotoUrls((current) => {
        const copy = { ...current };
        delete copy[path];
        return copy;
      });
      await deleteWorkshopPhotos([path]);
    } catch (err) {
      showToast({
        tone: 'danger',
        title: 'Gagal menghapus foto',
        message: err instanceof Error ? err.message : 'Coba lagi.',
      });
    }
  };

  const pickAvatar = async () => {
    if (!userId || uploadingAvatar) return;
    try {
      const photo = await pickMechanicPhoto([1, 1]);
      if (!photo) return;
      setUploadingAvatar(true);
      const url = await uploadMechanicAvatar(userId, photo);
      await updateMyProfileIdentity({ avatar_url: url });
      setAvatarUrl(url);
      showToast({ tone: 'success', message: 'Foto profil montir diperbarui.' });
    } catch (err) {
      showToast({
        tone: 'danger',
        title: 'Gagal mengganti foto',
        message: err instanceof Error ? err.message : 'Coba lagi.',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const fullNameError = !fullName.trim() ? 'Nama lengkap wajib diisi.' : null;

  const handleSave = async () => {
    setSubmitAttempted(true);
    if (fullNameError) {
      showToast({ tone: 'warning', message: fullNameError });
      return;
    }

    setSaving(true);
    try {
      await Promise.all([
        updateMyProfileIdentity({
          full_name: fullName.trim(),
          phone_number: phone.trim() || null,
        }),
        updateMechanicProfile({
          bio: bio.trim() || null,
          experience_years: parseNumber(experience),
          vehicle_label: vehicleLabel.trim() || null,
          vehicle_plate: vehiclePlate.trim().toUpperCase() || null,
          workshop_name: workshop.trim() || null,
          workshop_address: workshopAddress.trim() || null,
          skills: splitList(skills),
          vehicle_specialization: specializations,
          workshop_photos: workshopPhotos,
          certifications: certifications
            .filter((cert) => cert.title.trim())
            .map(formatCertification),
        }),
      ]);
      showToast({ tone: 'success', message: 'Profil montir tersimpan.' });
      await load();
    } catch (err) {
      showToast({
        tone: 'danger',
        title: 'Gagal menyimpan profil',
        message: err instanceof Error ? err.message : 'Coba lagi.',
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      setLogoutConfirmOpen(false);
      router.replace('/(auth)/login');
    } catch (err) {
      showToast({
        tone: 'danger',
        title: 'Gagal keluar',
        message: err instanceof Error ? err.message : 'Coba lagi.',
      });
    } finally {
      setLoggingOut(false);
    }
  };

  const addCertification = () => {
    setCertifications((current) => [
      ...current,
      { key: makeKey(), title: '', issuer: '', year: '' },
    ]);
  };

  const updateCertification = (
    key: string,
    patch: Partial<CertificationDraft>,
  ) => {
    setCertifications((current) =>
      current.map((cert) => (cert.key === key ? { ...cert, ...patch } : cert)),
    );
  };

  const removeCertification = (key: string) => {
    setCertifications((current) => current.filter((cert) => cert.key !== key));
  };

  return {
    sessionUser,
    sessionLoading,
    profile,
    avatarUrl,
    fullName,
    setFullName,
    fullNameError,
    submitAttempted,
    phone,
    setPhone,
    bio,
    setBio,
    experience,
    setExperience,
    vehicleLabel,
    setVehicleLabel,
    vehiclePlate,
    setVehiclePlate,
    workshop,
    setWorkshop,
    workshopAddress,
    setWorkshopAddress,
    skills,
    setSkills,
    specializations,
    certifications,
    reviews,
    workshopPhotos,
    workshopPhotoUrls,
    online,
    loading,
    saving,
    uploadingAvatar,
    uploadingWorkshop,
    logoutConfirmOpen,
    setLogoutConfirmOpen,
    loggingOut,
    toggleOnline,
    toggleSpecialization,
    addWorkshopPhoto,
    removeWorkshopPhoto,
    pickAvatar,
    handleSave,
    confirmLogout,
    addCertification,
    updateCertification,
    removeCertification,
  };
}
