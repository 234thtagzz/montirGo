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
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';
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
        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={15} color={Brand.amber} />
          <Text style={styles.disclaimerText}>{AI_DISCLAIMER}</Text>
        </View>

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
              <Text style={styles.hint}>Contoh pertanyaan cepat:</Text>
              <View style={styles.chips}>
                {AI_SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    onPress={() => send(s)}
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                  >
                    <Text style={styles.chipText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.user : styles.assistant]}>
              <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>
                {item.content}
              </Text>
            </View>
          )}
        />

        {sending ? (
          <View style={styles.typing}>
            <Ionicons name="ellipsis-horizontal" size={14} color={Brand.textMuted} />
            <Text style={styles.typingText}>AI sedang mengetik…</Text>
          </View>
        ) : null}

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
            <Ionicons name="send" size={18} color={Brand.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  flex: { flex: 1 },
  disclaimer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: Brand.amberSoft,
    marginHorizontal: ScreenPadding,
    marginTop: Space.md,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  disclaimerText: { flex: 1, fontSize: 11, color: Brand.amber, lineHeight: 15 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: ScreenPadding, paddingTop: Space.md, paddingBottom: Space.sm },
  hint: { fontSize: 12, color: Brand.textSecondary, marginBottom: Space.sm, marginTop: Space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  chip: {
    backgroundColor: Brand.primarySoft,
    paddingVertical: 9,
    paddingHorizontal: Space.md,
    borderRadius: Radius.pill,
  },
  chipText: { color: Brand.primary, fontSize: 12, fontWeight: '600' },
  bubble: { maxWidth: '85%', padding: Space.md, borderRadius: Radius.md, marginVertical: 4 },
  user: { alignSelf: 'flex-end', backgroundColor: Brand.primary, borderBottomRightRadius: 4 },
  assistant: {
    alignSelf: 'flex-start',
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.divider,
    borderBottomLeftRadius: 4,
  },
  userText: { color: Brand.white, fontSize: 13.5, lineHeight: 19 },
  assistantText: { color: Brand.text, fontSize: 13.5, lineHeight: 19 },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: ScreenPadding,
    paddingBottom: Space.sm,
  },
  typingText: { fontSize: 11.5, color: Brand.textMuted },
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
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingHorizontal: Space.md,
    paddingVertical: 11,
    fontSize: 13.5,
    color: Brand.text,
    maxHeight: 110,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});
