// Form Ajukan Keluhan (client & montir): kategori, transaksi, deskripsi, foto lampiran.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { Brand, Radius, Space, Type } from '@/constants/brand';
import { pickComplaintPhotos } from '../photo';
import { COMPLAINT_CATEGORY_META, type ComplaintCategory, type ComplaintFormDraft } from '../types';

const CATEGORY_OPTIONS: SegmentedOption<ComplaintCategory>[] = (
  Object.keys(COMPLAINT_CATEGORY_META) as ComplaintCategory[]
).map((value) => ({ value, label: COMPLAINT_CATEGORY_META[value].label }));

interface ComplaintFormProps {
  draft: ComplaintFormDraft;
  onDraftChange: (draft: ComplaintFormDraft) => void;
  onSubmit: (draft: ComplaintFormDraft) => void;
  submitting: boolean;
}

export function ComplaintForm({ draft, onDraftChange, onSubmit, submitting }: ComplaintFormProps) {
  const [photosInput, setPhotosInput] = useState(0);

  const addPhotos = async () => {
    if (draft.photos.length >= 3 || photosInput) return;
    setPhotosInput(1);
    try {
      const picked = await pickComplaintPhotos();
      if (!picked.length) return;
      onDraftChange({ ...draft, photos: [...draft.photos, ...picked].slice(0, 3) });
    } finally {
      setPhotosInput(0);
    }
  };

  const removePhoto = (uri: string) => {
    onDraftChange({ ...draft, photos: draft.photos.filter((p) => p.uri !== uri) });
  };

  return (
    <View style={styles.form}>
      <Text style={styles.sectionLabel}>Kategori</Text>
      <Segmented
        options={CATEGORY_OPTIONS}
        value={draft.category}
        onChange={(category) => onDraftChange({ ...draft, category })}
        style={styles.segmented}
      />

      <Text style={styles.sectionLabel}>Transaksi / ID transaksi</Text>
      <TextInput
        editable
        placeholder="ID transaksi / nomor pesanan"
        placeholderTextColor={Brand.textMuted}
        selectionColor={Brand.primary}
        value={draft.requestId}
        onChangeText={(requestId) => onDraftChange({ ...draft, requestId })}
        style={styles.input}
      />

      <Text style={styles.sectionLabel}>Deskrisi keluhan</Text>
      <TextInput
        multiline
        editable
        placeholder="Jelaskan lengkap masalahnya: gejala, kapan, dan hal apa yang berbeda dengan ekspektasi."
        placeholderTextColor={Brand.textMuted}
        selectionColor={Brand.primary}
        value={draft.description}
        onChangeText={(description) => onDraftChange({ ...draft, description })}
        style={styles.inputMultiline}
      />

      <Text style={styles.sectionLabel}>Foto lampiran</Text>
      <Text style={styles.helper}>
        Opsional, maksimal 3 foto. Lebih baik dengan bukti visual dari kendaraan rusak.
      </Text>
      <View style={styles.photoRow}>
        {draft.photos.map((photo) => (
          <View key={photo.uri} style={styles.photoItem}>
            <Image
              source={{ uri: photo.uri }}
              style={styles.photoImage}
              contentFit="cover"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hapus foto lampiran"
              onPress={() => removePhoto(photo.uri)}
              style={styles.photoRemove}
            >
              <Ionicons name="close" size={12} color={Brand.white} />
            </Pressable>
          </View>
        ))}
        {draft.photos.length < 3 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tambah foto lampiran"
            onPress={addPhotos}
            style={({ pressed }) => [styles.photoAdd, pressed && styles.pressed]}
          >
            <Ionicons name={photosInput ? 'hourglass-outline' : 'add-outline'} size={16} color={Brand.primary} />
          </Pressable>
        ) : null}
      </View>

      <Button
        label="Ajukan Keluhan"
        icon="alert-circle-outline"
        loading={submitting}
        onPress={() => onSubmit(draft)}
        style={styles.submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { paddingBottom: Space.xxxl, gap: Space.xl },
  sectionLabel: { ...Type.label, fontWeight: '700', marginTop: Space.lg },
  segmented: { marginTop: Space.sm },
  input: {
    marginTop: Space.sm,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    minHeight: 48,
    fontSize: 13.5,
    color: Brand.text,
  },
  inputMultiline: {
    marginTop: Space.sm,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.lg,
    minHeight: 96,
    fontSize: 13.5,
    color: Brand.text,
    textAlignVertical: 'top',
  },
  helper: { ...Type.meta, color: Brand.textMuted, lineHeight: 17 },
  photoRow: { flexDirection: 'row', gap: Space.sm, marginTop: Space.sm },
  photoItem: { position: 'relative' },
  photoImage: { width: 92, height: 72, borderRadius: Radius.md },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(17, 24, 39, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 92,
    height: 72,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Brand.primaryBorder,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: { marginTop: Space.xl },
  pressed: { opacity: 0.75 },
});
