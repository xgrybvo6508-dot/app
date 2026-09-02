import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getNode } from '../../lib/db/nodes';
import {
  generateAssistantReply,
  generateThinkingQuestions,
  saveThinkingAnswer,
} from '../../lib/ai/localAssistant';
import type { ChatMessage } from '../../lib/ai/types';

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `msg-${idCounter}`;
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{ mode?: string; nodeId?: string }>();
  const isThinkMode = params.mode === 'think' && !!params.nodeId;
  const thinkNode = isThinkMode ? getNode(params.nodeId as string) : null;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (thinkNode) {
      const questions = generateThinkingQuestions(thinkNode);
      return [
        {
          id: nextId(),
          role: 'assistant',
          text: `Разбираем «${thinkNode.title}» со всех сторон. Отвечай как получится — каждый ответ сохранится заметкой, связанной с этим узлом.`,
        },
        ...questions.map((q) => ({ id: nextId(), role: 'assistant' as const, text: q })),
      ];
    }
    return [
      {
        id: nextId(),
        role: 'assistant',
        text: 'Спроси «что мне делать» или «как я вообще» — отвечу на основе твоего графа.',
      },
    ];
  });
  const [draft, setDraft] = useState('');

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);

    if (thinkNode) {
      saveThinkingAnswer(thinkNode.id, text);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', text: 'Сохранил как заметку, связанную с этим узлом.' },
      ]);
      return;
    }

    const reply = generateAssistantReply(text);
    setMessages((prev) => [...prev, reply]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {thinkNode && (
        <View style={styles.modeBanner}>
          <Text style={styles.modeBannerText}>Мышление: {thinkNode.title}</Text>
        </View>
      )}
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
            ]}
          >
            <Text style={item.role === 'user' ? styles.bubbleTextUser : styles.bubbleText}>
              {item.text}
            </Text>
            {item.actions?.map((action) => (
              <Pressable
                key={action.id}
                style={styles.actionButton}
                onPress={() => {
                  action.run();
                  setMessages((prev) => [
                    ...prev,
                    { id: nextId(), role: 'assistant', text: `Готово: ${action.label}.` },
                  ]);
                }}
              >
                <Text style={styles.actionButtonText}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Написать..."
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable style={styles.sendButton} onPress={handleSend}>
            <Text style={styles.sendButtonText}>→</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  modeBanner: { backgroundColor: '#e8f0fe', padding: 8, alignItems: 'center' },
  modeBannerText: { fontSize: 12, color: '#1a4fb4', fontWeight: '600' },
  list: { padding: 16, gap: 10 },
  bubble: { maxWidth: '85%', borderRadius: 14, padding: 12 },
  bubbleAssistant: { backgroundColor: '#f4f4f6', alignSelf: 'flex-start' },
  bubbleUser: { backgroundColor: '#111', alignSelf: 'flex-end' },
  bubbleText: { color: '#111', fontSize: 15 },
  bubbleTextUser: { color: '#fff', fontSize: 15 },
  actionButton: {
    marginTop: 8,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  actionButtonText: { color: '#fff', fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    backgroundColor: '#f4f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: { color: '#fff', fontSize: 18 },
});
