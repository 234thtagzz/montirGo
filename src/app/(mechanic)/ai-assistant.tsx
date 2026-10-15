import { useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}>
      <Text style={styles.title}>AI Asisten Montir</Text>
      <Text style={styles.disclaimer}>{AI_DISCLAIMER}</Text>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        style={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View>
            <Text style={styles.muted}>Contoh pertanyaan cepat:</Text>
            <View style={styles.chips}>
              {AI_SUGGESTIONS.map((s) => (
                <Pressable key={s} style={styles.chip} onPress={() => send(s)}>
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
      {sending && <Text style={styles.muted}>AI sedang mengetik...</Text>}

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Tanya soal kerusakan..."
          style={styles.input}
          multiline
          editable={!sending}
          onSubmitEditing={() => send(input)}
        />
        <Pressable
          style={[styles.send, sending && styles.sendDisabled]}
          disabled={sending}
          onPress={() => send(input)}>
          <Text style={styles.sendText}>Kirim</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 56 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  disclaimer: {
    fontSize: 12, color: '#a16207', backgroundColor: '#fef9c3',
    padding: 10, borderRadius: 10, marginVertical: 8,
  },
  list: { flex: 1 },
  muted: { fontSize: 13, color: '#60646c', marginVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#eef4ff', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20 },
  chipText: { color: '#3c87f7', fontSize: 13, fontWeight: '600' },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 14, marginVertical: 4 },
  user: { alignSelf: 'flex-end', backgroundColor: '#3c87f7' },
  assistant: { alignSelf: 'flex-start', backgroundColor: '#f5f5f7' },
  userText: { color: '#fff', fontSize: 14 },
  assistantText: { color: '#1a1a1a', fontSize: 14 },
  inputRow: { flexDirection: 'row', gap: 8, paddingVertical: 12, alignItems: 'flex-end' },
  input: {
    flex: 1, backgroundColor: '#f5f5f7', borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14, color: '#1a1a1a', maxHeight: 100,
  },
  send: { backgroundColor: '#3c87f7', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18 },
  sendDisabled: { opacity: 0.6 },
  sendText: { color: '#fff', fontWeight: '600' },
});
