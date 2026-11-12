import { Ionicons } from "@/components/ui/icon";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Brand, Radius, ScreenPadding, Space, Type } from "@/constants/brand";
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
} from "@/features/ai-assistant/constants";
import {
  askAssistant,
  type ChatMessage,
} from "@/features/ai-assistant/service";
import { useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface AssistantChatProps {
  persona: AssistantPersona;
  /** Order terkait, dipakai server untuk menyimpan transkrip diagnosa. */
  requestId?: string;
  /** Pilihan kendaraan dari Garasi (khusus client). */
  vehicles?: AssistantVehicleOption[];
}

const EMPTY_THREADS: Record<AssistantMode, ChatMessage[]> = {
  diagnose: [],
  sparepart: [],
};

/**
 * Layar chat AI bersama untuk client dan montir.
 *
 * Dua mode dipisah agar konteks tidak tercampur: `diagnose` untuk gejala
 * kerusakan, `sparepart` untuk tanya harga part. Tiap mode punya riwayat
 * sendiri, dan client bisa memilih kendaraan dari Garasi sebagai konteks.
 */
export function AssistantChat({
  persona,
  requestId,
  vehicles,
}: AssistantChatProps) {
  const [mode, setMode] = useState<AssistantMode>("diagnose");
  const [threads, setThreads] =
    useState<Record<AssistantMode, ChatMessage[]>>(EMPTY_THREADS);
  const [input, setInput] = useState("");
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
    setInput("");
    scrollToEnd(false);
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;

    const activeMode = mode;
    const next: ChatMessage[] = [
      ...threads[activeMode],
      { role: "user", content },
    ];
    setThreads((prev) => ({ ...prev, [activeMode]: next }));
    setInput("");
    setSending(true);
    try {
      const reply = await askAssistant(next, {
        requestId,
        vehicle: selectedVehicle?.label,
        mode: activeMode,
        persona,
      });
      setThreads((prev) => ({
        ...prev,
        [activeMode]: [
          ...prev[activeMode],
          { role: "assistant", content: reply },
        ],
      }));
    } catch (e) {
      Alert.alert(
        "AI tidak tersedia",
        e instanceof Error ? e.message : "Coba lagi nanti.",
      );
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
                  size={14}
                  color={active ? Brand.volt : Brand.textMuted}
                />
                <Text
                  style={[
                    styles.segmentText,
                    active && styles.segmentTextActive,
                  ]}
                >
                  {item.label}
                </Text>
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
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: vehicleId === null }}
              onPress={() => setVehicleId(null)}
              style={[
                styles.vehicleChip,
                vehicleId === null && styles.vehicleChipActive,
              ]}
            >
              <Ionicons
                name="globe-outline"
                size={12}
                color={vehicleId === null ? Brand.volt : Brand.textMuted}
              />
              <Text
                style={[
                  styles.vehicleText,
                  vehicleId === null && styles.vehicleTextActive,
                ]}
              >
                Umum
              </Text>
            </Pressable>
            {vehicles.map((vehicle) => {
              const active = vehicle.id === vehicleId;
              return (
                <Pressable
                  key={vehicle.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setVehicleId(vehicle.id)}
                  style={[
                    styles.vehicleChip,
                    active && styles.vehicleChipActive,
                  ]}
                >
                  <Ionicons
                    name="car-sport-outline"
                    size={12}
                    color={active ? Brand.volt : Brand.textMuted}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.vehicleText,
                      active && styles.vehicleTextActive,
                    ]}
                  >
                    {vehicle.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, index) => String(index)}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View>
              <View style={styles.intro}>
                <View style={styles.introIcon}>
                  <Ionicons
                    name={mode === "sparepart" ? "pricetag" : "sparkles"}
                    size={20}
                    color={Brand.volt}
                  />
                </View>
                <View style={styles.introCopy}>
                  <Text style={styles.introEyebrow}>{intro.eyebrow}</Text>
                  <Text style={styles.introTitle}>{intro.title}</Text>
                  <Text style={styles.introText}>{intro.text}</Text>
                </View>
              </View>

              <Text style={styles.hint}>PERTANYAAN CEPAT</Text>
              <View style={styles.suggestions}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    accessibilityRole="button"
                    onPress={() => send(suggestion)}
                    style={({ pressed }) => [
                      styles.suggestion,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={Brand.primary}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const isUser = item.role === "user";
            return (
              <View
                style={[styles.messageRow, isUser && styles.messageRowUser]}
              >
                {!isUser ? (
                  <View style={styles.avatar}>
                    <Ionicons name="sparkles" size={12} color={Brand.volt} />
                  </View>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    isUser ? styles.user : styles.assistant,
                  ]}
                >
                  <Text style={isUser ? styles.userText : styles.assistantText}>
                    {item.content}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {sending ? (
          <View style={styles.typing}>
            <Ionicons
              name="ellipsis-horizontal"
              size={14}
              color={Brand.textMuted}
            />
            <Text style={styles.typingText}>
              {mode === "sparepart"
                ? "AI sedang mengecek kisaran harga…"
                : "AI sedang menganalisis…"}
            </Text>
          </View>
        ) : null}

        <View style={styles.disclaimer}>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={Brand.textMuted}
            style={{ paddingTop: 6 }}
          />
          <Text style={styles.disclaimerText}>{AI_DISCLAIMER[mode]}</Text>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={getInputPlaceholder(mode)}
            placeholderTextColor={Brand.textMuted}
            selectionColor={Brand.primary}
            style={styles.input}
            multiline
            editable={!sending}
            onSubmitEditing={() => send(input)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kirim pertanyaan"
            disabled={sending || !input.trim()}
            onPress={() => send(input)}
            style={({ pressed }) => [
              styles.send,
              (sending || !input.trim()) && styles.sendDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="arrow-up" size={19} color={Brand.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  flex: { flex: 1 },
  segmentWrap: {
    paddingHorizontal: ScreenPadding,
    paddingBottom: Space.sm,
    backgroundColor: Brand.background,
  },
  segment: {
    flexDirection: "row",
    gap: Space.xs,
    padding: 4,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  segmentItem: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: Space.sm,
    borderRadius: Radius.sm,
  },
  segmentItemActive: { backgroundColor: Brand.ink },
  segmentText: { fontSize: 12, fontWeight: "600", color: Brand.textSecondary },
  segmentTextActive: { color: Brand.white, fontWeight: "700" },
  vehicleWrap: { backgroundColor: Brand.background, paddingBottom: Space.sm },
  vehicleRow: { paddingHorizontal: ScreenPadding, gap: Space.sm },
  vehicleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 210,
    paddingHorizontal: Space.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  vehicleChipActive: { backgroundColor: Brand.ink, borderColor: Brand.ink },
  vehicleText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: Brand.textSecondary,
  },
  vehicleTextActive: { color: Brand.white, fontWeight: "700" },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Space.md,
    paddingBottom: Space.md,
  },
  intro: {
    flexDirection: "row",
    gap: Space.md,
    backgroundColor: Brand.ink,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.inkBorder,
    padding: Space.lg,
  },
  introIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  introCopy: { flex: 1 },
  introEyebrow: { ...Type.micro, fontSize: 8.5, color: Brand.inkMuted },
  introTitle: { ...Type.title, color: Brand.white, marginTop: 2 },
  introText: {
    fontSize: 11.5,
    color: Brand.inkText,
    lineHeight: 16,
    marginTop: 4,
  },
  hint: {
    ...Type.micro,
    color: Brand.textMuted,
    marginTop: Space.xl,
    marginBottom: Space.sm,
  },
  suggestions: { gap: Space.sm },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.divider,
    paddingHorizontal: Space.md,
    minHeight: 48,
  },
  suggestionText: { flex: 1, fontSize: 12, color: Brand.text, lineHeight: 17 },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Space.sm,
    marginVertical: 4,
  },
  messageRowUser: { justifyContent: "flex-end" },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Brand.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: { maxWidth: "82%", padding: Space.md, borderRadius: Radius.md },
  user: { backgroundColor: Brand.primary, borderBottomRightRadius: 4 },
  assistant: {
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.divider,
    borderBottomLeftRadius: 4,
  },
  userText: { color: Brand.white, fontSize: 13, lineHeight: 19 },
  assistantText: { color: Brand.text, fontSize: 13, lineHeight: 19 },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: ScreenPadding,
    paddingBottom: Space.xs,
  },
  typingText: { fontSize: 11, color: Brand.textMuted },
  disclaimer: {
    flexDirection: "row",
    gap: 5,
    alignItems: "flex-start",
    paddingHorizontal: ScreenPadding,
    paddingBottom: Space.sm,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 10,
    color: Brand.textMuted,
    lineHeight: 14,
    paddingTop: 6,
  },
  inputRow: {
    flexDirection: "row",
    gap: Space.sm,
    alignItems: "flex-end",
    paddingHorizontal: ScreenPadding,
    paddingTop: Space.sm,
    paddingBottom: Space.md,
    borderTopWidth: 1,
    borderTopColor: Brand.divider,
    backgroundColor: Brand.surface,
  },
  input: {
    flex: 1,
    backgroundColor: Brand.background,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingHorizontal: Space.lg,
    paddingVertical: 12,
    fontSize: 13.5,
    color: Brand.text,
    maxHeight: 110,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Brand.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.35 },
  pressed: { opacity: 0.8 },
});
