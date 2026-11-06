import { useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Type } from '@/constants/brand';
import { AI_DISCLAIMER, AI_SUGGESTIONS } from '@/features/ai-assistant/constants';
import { askAssistant, type ChatMessage } from '@/features/ai-assistant/service';

export default function MechanicAIAssistantScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const reply = await askAssistant(next);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      Alert.alert('AI tidak tersedia', e instanceof Error ? e.message : 'Coba lagi nanti.');
      setMessages(next);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="AI Asisten" subtitle="Bantu diagnosis awal kerusakan" showBack={false} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View>
              <View style={styles.intro}>
                <View style={styles.introIcon}>
                  <Ionicons name="sparkles" size={20} color={Brand.volt} />
                </View>
                <View style={styles.introCopy}>
                  <Text style={styles.introEyebrow}>ASISTEN DIAGNOSA</Text>
                  <Text style={styles.introTitle}>Tanya apa saja soal kerusakan</Text>
                  <Text style={styles.introText}>
                    Deskripsikan gejala yang kamu temui di lokasi. Hasil AI adalah indikasi awal,
                    bukan pengganti pemeriksaan langsung.
                  </Text>
                </View>
              </View>

              <Text style={styles.hint}>PERTANYAAN CEPAT</Text>
              <View style={styles.suggestions}>
                {AI_SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    onPress={() => send(s)}
                    style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                    <Ionicons name="arrow-forward" size={14} color={Brand.primary} />
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
                    <Ionicons name="sparkles" size={12} color={Brand.volt} />
                  </View>
                ) : null}
                <View style={[styles.bubble, isUser ? styles.user : styles.assistant]}>
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
            <Ionicons name="ellipsis-horizontal" size={14} color={Brand.textMuted} />
            <Text style={styles.typingText}>AI sedang menganalisis…</Text>
          </View>
        ) : null}

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={14} color={Brand.textMuted} />
          <Text style={styles.disclaimerText}>{AI_DISCLAIMER}</Text>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Tanya soal kerusakan..."
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
  list: { flex: 1 },
  listContent: { paddingHorizontal: ScreenPadding, paddingTop: Space.md, paddingBottom: Space.md },
  intro: {
    flexDirection: 'row',
    gap: Space.md,
    backgroundColor: Brand.ink,
    borderRadius: Radius.lg,
    padding: Space.lg,
  },
  introIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introCopy: { flex: 1 },
  introEyebrow: { ...Type.micro, fontSize: 8.5, color: Brand.inkMuted },
  introTitle: { ...Type.title, color: Brand.white, marginTop: 2 },
  introText: { fontSize: 11.5, color: Brand.inkText, lineHeight: 16, marginTop: 4 },
  hint: { ...Type.micro, color: Brand.textMuted, marginTop: Space.xl, marginBottom: Space.sm },
  suggestions: { gap: Space.sm },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.divider,
    paddingHorizontal: Space.md,
    minHeight: 48,
  },
  suggestionText: { flex: 1, fontSize: 12, color: Brand.text, lineHeight: 17 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Space.sm, marginVertical: 4 },
  messageRowUser: { justifyContent: 'flex-end' },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: { maxWidth: '82%', padding: Space.md, borderRadius: Radius.md },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: ScreenPadding,
    paddingBottom: Space.xs,
  },
  typingText: { fontSize: 11, color: Brand.textMuted },
  disclaimer: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'flex-start',
    paddingHorizontal: ScreenPadding,
    paddingBottom: Space.sm,
  },
  disclaimerText: { flex: 1, fontSize: 10, color: Brand.textMuted, lineHeight: 14 },
  inputRow: {
    flexDirection: 'row',
    gap: Space.sm,
    alignItems: 'flex-end',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.35 },
  pressed: { opacity: 0.8 },
});
