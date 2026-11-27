import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Ionicons } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
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
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

const TYPE_OPTIONS: SegmentedOption<PayoutAccountType>[] = [
  { value: 'bank', label: 'Bank' },
  { value: 'ewallet', label: 'E-wallet' },
];

export default function PayoutAccountsScreen() {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();

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
  const [submitted, setSubmitted] = useState(false);

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
      void load();
    }, [load]),
  );

  const channels = type === 'bank' ? BANKS : EWALLETS;

  const switchType = (next: PayoutAccountType) => {
    setType(next);
    setChannelCode(next === 'bank' ? BANKS[0].code : EWALLETS[0].code);
  };

  const cleanNumber = accountNumber.replace(/\s+/g, '');
  const accountNumberError =
    type === 'bank'
      ? /^\d{6,20}$/.test(cleanNumber)
        ? null
        : 'Nomor rekening harus berupa 6–20 digit angka.'
      : /^(\d{8,15}|0\d{9,13})$/.test(cleanNumber)
        ? null
        : 'Isi nomor HP e-wallet terdaftar (contoh 0812xxxx).';

  const holderNameError =
    holderName.trim().length >= 3
      ? null
      : 'Isi nama pemilik sesuai rekening (minimal 3 karakter).';

  const addAccount = async () => {
    setSubmitted(true);
    if (accountNumberError || holderNameError) {
      showToast({
        tone: 'warning',
        message: holderNameError ?? accountNumberError ?? 'Periksa data rekening.',
      });
      return;
    }

    setSaving(true);
    try {
      const created = await createPayoutAccount({
        type,
        bank_code: channelCode,
        account_number: cleanNumber,
        account_holder_name: holderName.trim(),
        is_primary: accounts.length === 0,
      });
      if (makePrimary && accounts.length > 0) {
        await setPrimaryPayoutAccount(created.id);
      }
      setAccountNumber('');
      setHolderName('');
      setMakePrimary(true);
      setSubmitted(false);
      await load();
      showToast({
        tone: 'success',
        title: 'Rekening ditambahkan',
        message: 'Rekening tujuan pencairan berhasil disimpan.',
      });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal menyimpan rekening',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
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
      showToast({ tone: 'info', message: 'Rekening dihapus.' });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal menghapus',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const confirmSetPrimary = async (account: PayoutAccount) => {
    if (account.is_primary) return;
    try {
      await setPrimaryPayoutAccount(account.id);
      await load();
      showToast({
        tone: 'success',
        message: `${channelLabel(account.bank_code)} dijadikan rekening utama.`,
      });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal mengatur rekening utama',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
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
        <ErrorState onRetry={() => void load()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Rekening Pencairan"
        subtitle="Tujuan transfer saldo MontirGo"
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: theme.spacing.xxxl + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={theme.colors.actionPrimaryBg}
              colors={[theme.colors.actionPrimaryBg]}
            />
          }
        >
          <Surface variant="default" padding="lg" style={styles.summaryStrip}>
            <View style={styles.summaryIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={theme.colors.statusInfoFg}
              />
            </View>
            <View style={styles.summaryCopy}>
              <AppText variant="bodyStrong">
                {accounts.length > 0
                  ? `${accounts.length} rekening tersimpan`
                  : 'Belum ada rekening tersimpan'}
              </AppText>
              <AppText variant="caption" tone="secondary">
                Pencairan dikirim ke rekening utama lewat Xendit. Data harus sesuai
                nama pemilik.
              </AppText>
            </View>
          </Surface>

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
                <Surface
                  key={account.id}
                  variant="default"
                  padding="md"
                  style={styles.accountCard}
                >
                  <View style={styles.accountTop}>
                    <View style={styles.accountTile}>
                      <AppText
                        variant="overline"
                        tone="info"
                        numberOfLines={1}
                      >
                        {channelLabel(account.bank_code)}
                      </AppText>
                    </View>
                    <View style={styles.accountCopy}>
                      <View style={styles.accountTitleRow}>
                        <AppText variant="bodyStrong">
                          {channelLabel(account.bank_code)}
                        </AppText>
                        {account.is_primary ? (
                          <Badge size="sm" tone="success" label="UTAMA" />
                        ) : null}
                      </View>
                      <AppText variant="bodyStrong" tabular>
                        {maskAccountNumber(account.account_number)}
                      </AppText>
                      <AppText variant="caption" tone="secondary" numberOfLines={1}>
                        {account.account_holder_name}
                      </AppText>
                    </View>
                  </View>

                  <View style={styles.accountActions}>
                    {account.is_primary ? (
                      <View style={styles.activeNote}>
                        <Ionicons
                          name="checkmark-circle"
                          size={15}
                          color={theme.colors.statusSuccessFg}
                        />
                        <AppText variant="caption" tone="success">
                          Dipakai untuk pencairan
                        </AppText>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Jadikan rekening utama"
                        onPress={() => void confirmSetPrimary(account)}
                        style={({ pressed }) => [
                          styles.primaryAction,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name="arrow-up-circle-outline"
                          size={16}
                          color={theme.colors.statusInfoFg}
                        />
                        <AppText variant="label" tone="info">
                          Jadikan utama
                        </AppText>
                      </Pressable>
                    )}

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Hapus rekening"
                      onPress={() => setDeleteTarget(account)}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={theme.colors.statusDangerFg}
                      />
                      <AppText variant="label" tone="danger">
                        Hapus
                      </AppText>
                    </Pressable>
                  </View>
                </Surface>
              ))}
            </View>
          )}

          <SectionHeader eyebrow="TAMBAH" title="Rekening baru" />
          <Surface variant="default" padding="lg" style={styles.formCard}>
            <AppText variant="label">Jenis rekening</AppText>
            <Segmented options={TYPE_OPTIONS} value={type} onChange={switchType} />

            <AppText variant="label">
              {type === 'bank' ? 'Bank' : 'E-wallet'}
            </AppText>
            <View style={styles.chips}>
              {channels.map((channel) => (
                <Chip
                  key={channel.code}
                  label={channel.short}
                  selected={channel.code === channelCode}
                  tone="info"
                  onPress={() => setChannelCode(channel.code)}
                />
              ))}
            </View>

            <TextField
              label={type === 'bank' ? 'Nomor rekening' : 'Nomor e-wallet'}
              required
              value={accountNumber}
              onChangeText={(text) =>
                setAccountNumber(text.replace(/[^0-9]/g, ''))
              }
              placeholder={
                type === 'bank' ? 'Contoh: 1234567890' : 'Contoh: 081234567890'
              }
              keyboardType="number-pad"
              error={accountNumberError}
              showError={submitted}
            />

            <TextField
              label="Nama pemilik"
              required
              value={holderName}
              onChangeText={setHolderName}
              placeholder="Sesuai buku rekening / akun e-wallet"
              autoCapitalize="words"
              error={holderNameError}
              showError={submitted}
            />

            {accounts.length === 0 ? (
              <Surface variant="outlined" padding="sm" style={styles.firstNote}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={theme.colors.statusInfoFg}
                />
                <AppText variant="caption" tone="secondary" style={styles.firstNoteText}>
                  Rekening pertama otomatis menjadi rekening utama.
                </AppText>
              </Surface>
            ) : (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: makePrimary }}
                onPress={() => setMakePrimary((value) => !value)}
                style={({ pressed }) => [
                  styles.checkboxRow,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={makePrimary ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={
                    makePrimary
                      ? theme.colors.actionPrimaryBg
                      : theme.colors.textMuted
                  }
                />
                <AppText variant="label">Jadikan rekening utama</AppText>
              </Pressable>
            )}

            <Button
              label="Simpan Rekening"
              icon="add-circle-outline"
              variant="primary"
              size="cta"
              loading={saving}
              disabled={saving}
              onPress={() => void addAccount()}
            />
          </Surface>

          <AppText variant="caption" tone="muted" style={styles.note}>
            Pastikan nama pemilik sama dengan data bank/e-wallet. Pencairan yang gagal
            karena data tidak cocok akan dikembalikan ke saldo MontirGo.
          </AppText>
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
        onConfirm={() => void removeAccount()}
        onCancel={() => setDeleteTarget(null)}
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
    padding: theme.spacing.screenPadding,
  },
  summaryStrip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
  list: {
    gap: theme.spacing.sm,
  },
  accountCard: {
    gap: theme.spacing.md,
  },
  accountTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  accountTile: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.statusInfoBg,
    borderWidth: 1,
    borderColor: theme.colors.statusInfoBorder,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.xs,
  },
  accountCopy: {
    flex: 1,
    gap: 2,
  },
  accountTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  accountActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  activeNote: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  primaryAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    minHeight: theme.touchTarget.min,
  },
  deleteButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    minHeight: theme.touchTarget.min,
  },
  formCard: {
    gap: theme.spacing.md,
  },
  chips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.xs,
  },
  firstNote: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.statusInfoBg,
    borderColor: theme.colors.statusInfoBorder,
  },
  firstNoteText: {
    flex: 1,
  },
  checkboxRow: {
    minHeight: theme.touchTarget.min,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  note: {
    marginTop: theme.spacing.lg,
  },
  pressed: {
    opacity: 0.72,
  },
});
