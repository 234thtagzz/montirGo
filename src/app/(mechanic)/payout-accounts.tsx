import { useCallback, useState } from 'react';
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
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';
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

export default function PayoutAccountsScreen() {
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

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

  const confirmDelete = (account: PayoutAccount) => {
    Alert.alert(
      'Hapus rekening?',
      `${channelLabel(account.bank_code)} ${maskAccountNumber(account.account_number)} akan dihapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePayoutAccount(account.id);
              await load();
            } catch (e) {
              Alert.alert('Gagal menghapus', e instanceof Error ? e.message : 'Coba lagi.');
            }
          },
        },
      ],
    );
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
          <Text style={styles.section}>Rekening tersimpan</Text>
          {accounts.length === 0 ? (
            <EmptyState
              icon="card-outline"
              message="Belum ada rekening"
              hint="Tambahkan rekening bank atau e-wallet di bawah ini."
            />
          ) : (
            <View style={styles.list}>
              {accounts.map((account) => (
                <View key={account.id} style={styles.accountCard}>
                  <View style={styles.accountTop}>
                    <View style={styles.accountIcon}>
                      <Ionicons
                        name={account.type === 'ewallet' ? 'phone-portrait-outline' : 'business-outline'}
                        size={18}
                        color={Brand.primary}
                      />
                    </View>
                    <View style={styles.accountCopy}>
                      <Text style={styles.accountTitle}>
                        {channelLabel(account.bank_code)}
                        {account.is_primary ? ' · Utama' : ''}
                      </Text>
                      <Text style={styles.accountSub}>
                        {maskAccountNumber(account.account_number)} · {account.account_holder_name}
                      </Text>
                    </View>
                    {account.is_primary ? (
                      <View style={styles.primaryChip}>
                        <Text style={styles.primaryChipText}>Utama</Text>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Jadikan rekening utama"
                        onPress={() => confirmSetPrimary(account)}
                        style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.linkButtonText}>Jadikan utama</Text>
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.accountActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Hapus rekening"
                      onPress={() => confirmDelete(account)}
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

          <Text style={styles.section}>Tambah rekening baru</Text>
          <View style={styles.formCard}>
            <Text style={styles.label}>Jenis rekening</Text>
            <View style={styles.segment}>
              {(
                [
                  { value: 'bank', label: 'Bank', icon: 'business-outline' },
                  { value: 'ewallet', label: 'E-wallet', icon: 'phone-portrait-outline' },
                ] as const
              ).map((option) => {
                const active = type === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => switchType(option.value)}
                    style={({ pressed }) => [
                      styles.segmentItem,
                      active && styles.segmentItemActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={15}
                      color={active ? Brand.primary : Brand.textSecondary}
                    />
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

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
              style={styles.input}
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

            <Button
              label="Simpan Rekening"
              icon="add-circle-outline"
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  flex: { flex: 1 },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  section: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
    marginTop: Space.lg,
    marginBottom: Space.md,
  },
  list: { gap: Space.sm },
  accountCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.md,
  },
  accountTop: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  accountIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCopy: { flex: 1 },
  accountTitle: { fontSize: 13.5, fontWeight: '700', color: Brand.text },
  accountSub: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  primaryChip: {
    backgroundColor: Brand.greenSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  primaryChipText: { fontSize: 10, fontWeight: '700', color: Brand.green },
  linkButton: { paddingVertical: 4 },
  linkButtonText: { fontSize: 11, fontWeight: '700', color: Brand.primary },
  accountActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.divider,
    paddingTop: Space.sm,
  },
  deleteButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  deleteButtonText: { fontSize: 11, fontWeight: '600', color: Brand.red },
  formCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.lg,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.text,
    marginBottom: Space.sm,
    marginTop: Space.md,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: Brand.background,
    borderRadius: Radius.md,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.sm,
    paddingVertical: 9,
  },
  segmentItemActive: { backgroundColor: Brand.surface },
  segmentText: { fontSize: 12.5, fontWeight: '600', color: Brand.textSecondary },
  segmentTextActive: { color: Brand.primary, fontWeight: '700' },
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
  chipText: { fontSize: 11.5, fontWeight: '600', color: Brand.textSecondary },
  chipTextActive: { color: Brand.primary, fontWeight: '700' },
  input: {
    backgroundColor: '#F7F9FC',
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    minHeight: 48,
    fontSize: 13.5,
    color: Brand.text,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginTop: Space.lg,
    marginBottom: Space.lg,
  },
  checkboxText: { fontSize: 12.5, color: Brand.text, fontWeight: '600' },
  note: { fontSize: 11, color: Brand.textMuted, marginTop: Space.lg, lineHeight: 16 },
  pressed: { opacity: 0.75 },
});
