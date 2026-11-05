import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { SectionHeader } from '@/components/ui/section-header';
import { Ionicons } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Brand, Radius, ScreenPadding, Space, Tabular, Type } from '@/constants/brand';
import {
  BANKS,
  EWALLETS,
  channelLabel,
  maskAccountNumber,
} from '@/features/finance/constants';
import {
  createPayoutAccount,
  deletePayoutAccount,
  listPayoutAccounts,
  setPrimaryPayoutAccount,
  type PayoutAccount,
  type PayoutAccountType,
} from '@/features/finance/service';

const TYPE_OPTIONS: SegmentedOption<PayoutAccountType>[] = [
  { value: 'bank', label: 'Bank' },
  { value: 'ewallet', label: 'E-wallet' },
];

export default function PayoutAccountsScreen() {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PayoutAccount | null>(null);

  const [type, setType] = useState<PayoutAccountType>('bank');
  const [channelCode, setChannelCode] = useState('BCA');
  const [accountNumber, setAccountNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [makePrimary, setMakePrimary] = useState(true);

  const load = useCallback(async () => {
    try {
      setAccounts(await listPayoutAccounts());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const channels = type === 'bank' ? BANKS : EWALLETS;

  const switchType = (next: PayoutAccountType) => {
    setType(next);
    setChannelCode(next === 'bank' ? BANKS[0].code : EWALLETS[0].code);
  };

  const addAccount = async () => {
    const clean = accountNumber.replace(/\s+/g, '');
    if (holderName.trim().length < 3) {
      Alert.alert('Nama pemilik', 'Isi nama sesuai buku rekening (minimal 3 karakter).');
      return;
    }
    if (type === 'bank' && !/^\d{6,20}$/.test(clean)) {
      Alert.alert('Nomor rekening', 'Nomor rekening harus berupa 6–20 digit angka.');
      return;
    }
    if (type === 'ewallet' && !/^(\d{8,15}|0\d{9,13})$/.test(clean)) {
      Alert.alert('Nomor e-wallet', 'Isi nomor HP e-wallet yang terdaftar (contoh 0812xxxx).');
      return;
    }

    setSaving(true);
    try {
      const created = await createPayoutAccount({
        type,
        bank_code: channelCode,
        account_number: clean,
        account_holder_name: holderName.trim(),
        is_primary: accounts.length === 0 ? true : false,
      });
      if (makePrimary && accounts.length > 0) {
        await setPrimaryPayoutAccount(created.id);
      }
      setAccountNumber('');
      setHolderName('');
      setMakePrimary(true);
      await load();
      Alert.alert('Rekening ditambahkan', 'Rekening tujuan pencairan berhasil disimpan.');
    } catch (e) {
      Alert.alert('Gagal menyimpan', e instanceof Error ? e.message : 'Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePayoutAccount(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      Alert.alert('Gagal menghapus', e instanceof Error ? e.message : 'Coba lagi.');
    } finally {
      setDeleting(false);
    }
  };

  const confirmSetPrimary = async (account: PayoutAccount) => {
    if (account.is_primary) return;
    try {
      await setPrimaryPayoutAccount(account.id);
      await load();
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Coba lagi.');
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Rekening Pencairan" />
        <LoadingState message="Memuat rekening..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Rekening Pencairan" />
        <ErrorState onRetry={load} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Rekening Pencairan" subtitle="Tujuan transfer saldo MontirGo" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={Brand.primary}
              colors={[Brand.primary]}
            />
          }
        >
          <View style={styles.summaryStrip}>
            <View style={styles.summaryIcon}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Brand.primary} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>
                {accounts.length > 0
                  ? `${accounts.length} rekening tersimpan`
                  : 'Belum ada rekening tersimpan'}
              </Text>
              <Text style={styles.summaryText}>
                Pencairan dikirim ke rekening utama lewat Xendit. Data harus sesuai nama pemilik.
              </Text>
            </View>
          </View>

          <SectionHeader
            eyebrow="TERSIMPAN"
            title="Rekening tujuan"
            actionLabel={accounts.length > 0 ? 'Tambah baru' : undefined}
            onPressAction={
              accounts.length > 0
                ? () => scrollRef.current?.scrollToEnd({ animated: true })
                : undefined
            }
          />
          {accounts.length === 0 ? (
            <EmptyState
              icon="card-outline"
              message="Belum ada rekening"
              hint="Tambahkan rekening bank atau e-wallet di formulir bawah."
            />
          ) : (
            <View style={styles.list}>
              {accounts.map((account) => (
                <View key={account.id} style={styles.accountCard}>
                  <View style={styles.accountTop}>
                    <View style={styles.accountTile}>
                      <Text style={styles.accountTileText} numberOfLines={1}>
                        {channelLabel(account.bank_code)}
                      </Text>
                    </View>
                    <View style={styles.accountCopy}>
                      <View style={styles.accountTitleRow}>
                        <Text style={styles.accountTitle}>
                          {channelLabel(account.bank_code)}
                        </Text>
                        {account.is_primary ? (
                          <View style={styles.primaryChip}>
                            <Text style={styles.primaryChipText}>UTAMA</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.accountNumber, Tabular]}>
                        {maskAccountNumber(account.account_number)}
                      </Text>
                      <Text style={styles.accountHolder} numberOfLines={1}>
                        {account.account_holder_name}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.accountActions}>
                    {account.is_primary ? (
                      <View style={styles.activeNote}>
                        <Ionicons name="checkmark-circle" size={14} color={Brand.green} />
                        <Text style={styles.activeNoteText}>Dipakai untuk pencairan</Text>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Jadikan rekening utama"
                        onPress={() => confirmSetPrimary(account)}
                        style={({ pressed }) => [
                          styles.primaryAction,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons name="arrow-up-circle-outline" size={14} color={Brand.primary} />
                        <Text style={styles.primaryActionText}>Jadikan utama</Text>
                      </Pressable>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Hapus rekening"
                      onPress={() => setDeleteTarget(account)}
                      style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                    >
                      <Ionicons name="trash-outline" size={14} color={Brand.red} />
                      <Text style={styles.deleteButtonText}>Hapus</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <SectionHeader eyebrow="TAMBAH" title="Rekening baru" />
          <View style={styles.formCard}>
            <Text style={styles.label}>Jenis rekening</Text>
            <Segmented options={TYPE_OPTIONS} value={type} onChange={switchType} />

            <Text style={styles.label}>{type === 'bank' ? 'Bank' : 'E-wallet'}</Text>
            <View style={styles.chips}>
              {channels.map((channel) => {
                const active = channel.code === channelCode;
                return (
                  <Pressable
                    key={channel.code}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setChannelCode(channel.code)}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {channel.short}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>
              {type === 'bank' ? 'Nomor rekening' : 'Nomor e-wallet'}
            </Text>
            <TextInput
              value={accountNumber}
              onChangeText={(text) => setAccountNumber(text.replace(/[^0-9]/g, ''))}
              placeholder={type === 'bank' ? 'Contoh: 1234567890' : 'Contoh: 081234567890'}
              placeholderTextColor={Brand.textMuted}
              keyboardType="number-pad"
              selectionColor={Brand.primary}
              style={[styles.input, Tabular]}
            />

            <Text style={styles.label}>Nama pemilik</Text>
            <TextInput
              value={holderName}
              onChangeText={setHolderName}
              placeholder="Sesuai buku rekening / akun e-wallet"
              placeholderTextColor={Brand.textMuted}
              autoCapitalize="words"
              selectionColor={Brand.primary}
              style={styles.input}
            />

            {accounts.length === 0 ? (
              <View style={styles.firstNote}>
                <Ionicons name="information-circle-outline" size={15} color={Brand.primary} />
                <Text style={styles.firstNoteText}>
                  Rekening pertama otomatis menjadi rekening utama.
                </Text>
              </View>
            ) : (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: makePrimary }}
                onPress={() => setMakePrimary((value) => !value)}
                style={({ pressed }) => [styles.checkboxRow, pressed && styles.pressed]}
              >
                <Ionicons
                  name={makePrimary ? 'checkbox' : 'square-outline'}
                  size={19}
                  color={makePrimary ? Brand.primary : Brand.textMuted}
                />
                <Text style={styles.checkboxText}>Jadikan rekening utama</Text>
              </Pressable>
            )}

            <Button
              label="Simpan Rekening"
              icon="add-circle-outline"
              variant="ink"
              loading={saving}
              disabled={saving}
              onPress={addAccount}
            />
          </View>

          <Text style={styles.note}>
            Pastikan nama pemilik sama dengan data bank/e-wallet. Pencairan yang gagal karena data
            tidak cocok akan dikembalikan ke saldo MontirGo.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmSheet
        visible={deleteTarget !== null}
        title="Hapus rekening?"
        message={
          deleteTarget
            ? `${channelLabel(deleteTarget.bank_code)} ${maskAccountNumber(
                deleteTarget.account_number,
              )} akan dihapus dari daftar tujuan pencairan.`
            : undefined
        }
        confirmLabel="Hapus rekening"
        destructive
        icon="trash-outline"
        loading={deleting}
        onConfirm={removeAccount}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  flex: { flex: 1 },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Space.lg,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: { flex: 1 },
  summaryTitle: { ...Type.bodyStrong, color: Brand.text, fontWeight: '700' },
  summaryText: { ...Type.meta, color: Brand.textSecondary, marginTop: 2, lineHeight: 16 },
  list: { gap: Space.sm },
  accountCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Space.md,
  },
  accountTop: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  accountTile: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  accountTileText: { ...Type.micro, color: Brand.volt, fontSize: 9, letterSpacing: 0.2 },
  accountCopy: { flex: 1 },
  accountTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accountTitle: { ...Type.bodyStrong, color: Brand.text, fontWeight: '700' },
  accountNumber: { ...Type.bodyStrong, color: Brand.text, marginTop: 2, letterSpacing: 0.6 },
  accountHolder: { ...Type.meta, color: Brand.textSecondary, marginTop: 1 },
  primaryChip: {
    backgroundColor: Brand.greenSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  primaryChipText: { ...Type.micro, color: Brand.green, fontSize: 8.5 },
  accountActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.md,
    paddingTop: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.divider,
  },
  activeNote: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activeNoteText: { ...Type.meta, color: Brand.green, fontWeight: '600' },
  primaryAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  primaryActionText: { ...Type.meta, color: Brand.primary, fontWeight: '700' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  deleteButtonText: { ...Type.meta, color: Brand.red, fontWeight: '600' },
  formCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Space.lg,
  },
  label: { ...Type.meta, color: Brand.text, fontWeight: '700', marginBottom: Space.sm, marginTop: Space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: 7,
    backgroundColor: Brand.surface,
  },
  chipActive: { borderColor: Brand.primary, backgroundColor: Brand.primarySoft },
  chipText: { ...Type.meta, color: Brand.textSecondary, fontWeight: '600' },
  chipTextActive: { color: Brand.primaryDark, fontWeight: '800' },
  input: {
    backgroundColor: '#F7F9FC',
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    minHeight: 48,
    fontSize: 14,
    color: Brand.text,
  },
  firstNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.sm,
    padding: Space.sm,
    marginTop: Space.lg,
    marginBottom: Space.lg,
  },
  firstNoteText: { flex: 1, ...Type.meta, color: Brand.primaryDark, lineHeight: 16 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginTop: Space.lg,
    marginBottom: Space.lg,
  },
  checkboxText: { ...Type.meta, color: Brand.text, fontWeight: '600' },
  note: { ...Type.meta, color: Brand.textMuted, marginTop: Space.lg, lineHeight: 16 },
  pressed: { opacity: 0.72 },
});
