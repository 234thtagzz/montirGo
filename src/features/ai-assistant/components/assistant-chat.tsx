import { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { Chip } from '@/components/ui/chip';
import { Ionicons } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import {
  AI_DISCLAIMER,
  AI_MODES,
  AI_SUGGESTIONS,
  getAssistantIntro,
  getAssistantSubtitle,
  getInputPlaceholder,
  type AssistantMode,
  type AssistantPersona,
  type AssistantVehicleOption,
} from '@/features/ai-assistant/constants';
import {
  askAssistant,
  type ChatMessage,
} from '@/features/ai-assistant/service';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface AssistantChatProps {
  persona: AssistantPersona;
  requestId?: string;
  vehicles?: AssistantVehicleOption[];
}

const EMPTY_THREADS: Record<AssistantMode, ChatMessage[]> = {
  diagnose: [],
  sparepart: [],
};

/**
 * Layar chat AI bersama untuk client dan montir.
 */
export function AssistantChat({
  persona,
  requestId,
  vehicles,
}: AssistantChatProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();

  const [mode, setMode] = useState<AssistantMode>('diagnose');
  const [threads, setThreads] =
    useState<Record<AssistantMode, ChatMessage[]>>(EMPTY_THREADS);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const messages = threads[mode];
  const intro = getAssistantIntro(mode, persona);
  const suggestions = AI_SUGGESTIONS[mode];
  const selectedVehicle = vehicles?.find((vehicle) => vehicle.id === vehicleId);

  const scrollToEnd = (animated = true) => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated }), 100);
  };

  const switchMode = (next: AssistantMode) => {
    if (next === mode || sending) return;
    setMode(next);
    setInput('');
    scrollToEnd(false);
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;

    const activeMode = mode;
    const next: ChatMessage[] = [
      ...threads[activeMode],
      { role: 'user', content },
    ];
    setThreads((prev) => ({ ...prev, [activeMode]: next }));
    setInput('');
    setSending(true);
    const vehicleContext = selectedVehicle
      ? selectedVehicle.type
        ? `${
            selectedVehicle.type === 'motor'
              ? 'Sepeda motor'
              : selectedVehicle.type === 'mobil'
                ? 'Mobil'
                : selectedVehicle.type
          } — ${selectedVehicle.label}`
        : selectedVehicle.label
      : undefined;

    try {
      const reply = await askAssistant(next, {
        requestId,
        vehicle: vehicleContext,
        mode: activeMode,
        persona,
      });
      setThreads((prev) => ({
        ...prev,
        [activeMode]: [
          ...prev[activeMode],
          { role: 'assistant', content: reply },
        ],
      }));
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'AI tidak tersedia',
        message: e instanceof Error ? e.message : 'Coba lagi nanti.',
      });
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="AI Asisten"
        subtitle={getAssistantSubtitle(persona)}
        showBack={false}
      />

      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {AI_MODES.map((item) => {
            const active = item.id === mode;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Mode ${item.label}`}
                disabled={sending}
                onPress={() => switchMode(item.id)}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
              >
                <Ionicons
                  name={item.icon}
                  size={15}
                  color={active ? theme.colors.actionPrimaryFg : theme.colors.textMuted}
                />
                <AppText
                  variant="caption"
                  tone={active ? 'inverse' : 'secondary'}
                >
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {vehicles && vehicles.length > 0 ? (
        <View style={styles.vehicleWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.vehicleRow}
            keyboardShouldPersistTaps="handled"
          >
            <Chip
              label="Umum"
              icon="globe-outline"
              selected={vehicleId === null}
              onPress={() => setVehicleId(null)}
            />
            {vehicles.map((vehicle) => (
              <Chip
                key={vehicle.id}
                label={vehicle.label}
                icon={vehicle.type === 'motor' ? 'bicycle-outline' : 'car-sport-outline'}
                selected={vehicle.id === vehicleId}
                onPress={() => setVehicleId(vehicle.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, index) => String(index)}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Surface variant="default" padding="lg" style={styles.intro}>
                <View style={styles.introIcon}>
                  <Ionicons
                    name={mode === 'sparepart' ? 'pricetag' : 'sparkles'}
                    size={20}
                    color={theme.colors.statusInfoFg}
                  />
                </View>
                <View style={styles.introCopy}>
                  <AppText variant="overline" tone="info">
                    {intro.eyebrow}
                  </AppText>
                  <AppText variant="title">{intro.title}</AppText>
                  <AppText variant="caption" tone="secondary">
                    {intro.text}
                  </AppText>
                </View>
              </Surface>

              <AppText variant="overline" tone="muted" style={styles.hint}>
                PERTANYAAN CEPAT
              </AppText>
              <View style={styles.suggestions}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    accessibilityRole="button"
                    onPress={() => void send(suggestion)}
                    style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                  >
                    <AppText variant="body" style={styles.flexCopy}>
                      {suggestion}
                    </AppText>
                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color={theme.colors.actionPrimaryAltBg}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
                {!isUser ? (
                  <View style={styles.avatar}>
                    <Ionicons name="sparkles" size={13} color={theme.colors.actionPrimaryFg} />
                  </View>
                ) : null}
                <View style={[styles.bubble, isUser ? styles.user : styles.assistant]}>
                  <AppText
                    variant="body"
                    tone={isUser ? 'inverse' : 'primary'}
                  >
                    {item.content}
                  </AppText>
                </View>
              </View>
            );
          }}
        />

        {sending ? (
          <View style={styles.typing}>
            <Ionicons name="ellipsis-horizontal" size={15} color={theme.colors.textMuted} />
            <AppText variant="caption" tone="muted">
              {mode === 'sparepart'
                ? 'AI sedang mengecek kisaran harga…'
                : 'AI sedang menganalisis…'}
            </AppText>
          </View>
        ) : null}

        <View style={styles.disclaimer}>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={theme.colors.textMuted}
          />
          <AppText variant="caption" tone="muted" style={styles.flexCopy}>
            {AI_DISCLAIMER[mode]}
          </AppText>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={getInputPlaceholder(mode)}
            placeholderTextColor={theme.colors.textMuted}
            selectionColor={theme.colors.borderFocus}
            style={styles.input}
            multiline
            editable={!sending}
            onSubmitEditing={() => void send(input)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kirim pertanyaan"
            disabled={sending || !input.trim()}
            onPress={() => void send(input)}
            style={({ pressed }) => [
              styles.send,
              (sending || !input.trim()) && styles.sendDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="arrow-up" size={20} color={theme.colors.actionPrimaryFg} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  flex: { flex: 1 },
  flexCopy: { flex: 1 },
  segmentWrap: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.bgCanvas,
  },
  segment: {
    flexDirection: 'row' as const,
    gap: theme.spacing.xs,
    padding: 4,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  segmentItem: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.sm,
  },
  segmentItemActive: {
    backgroundColor: theme.colors.actionPrimaryBg,
  },
  vehicleWrap: {
    backgroundColor: theme.colors.bgCanvas,
    paddingBottom: theme.spacing.sm,
  },
  vehicleRow: {
    paddingHorizontal: theme.spacing.screenPadding,
    gap: theme.spacing.sm,
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  emptyWrap: {
    gap: theme.spacing.md,
  },
  intro: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
  },
  introIcon: {
    width: 42,
    height: 42,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  introCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  hint: {
    marginTop: theme.spacing.xs,
  },
  suggestions: {
    gap: theme.spacing.sm,
  },
  suggestion: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: theme.touchTarget.min,
  },
  messageRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: theme.spacing.sm,
    marginVertical: 4,
  },
  messageRowUser: {
    justifyContent: 'flex-end' as const,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.actionPrimaryBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  bubble: {
    maxWidth: '82%' as const,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  user: {
    backgroundColor: theme.colors.actionPrimaryBg,
    borderBottomRightRadius: 4,
  },
  assistant: {
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderBottomLeftRadius: 4,
  },
  typing: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.xs,
  },
  disclaimer: {
    flexDirection: 'row' as const,
    gap: theme.spacing.xs,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.sm,
  },
  inputRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    alignItems: 'flex-end' as const,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.borderInput,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    fontFamily: theme.fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    minHeight: theme.touchTarget.min,
    maxHeight: 112,
  },
  send: {
    width: theme.touchTarget.min,
    height: theme.touchTarget.min,
    borderRadius: theme.touchTarget.min / 2,
    backgroundColor: theme.colors.actionPrimaryBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sendDisabled: { opacity: 0.38 },
  pressed: { opacity: 0.8 },
});
