import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { colors, sharedStyles, spacing } from '../../lib/theme';
import type { ChatMessage } from '../../lib/ai/types';
import type { GraphNode } from '../../lib/db/types';

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `msg-${idCounter}`;
}

function buildInitialMessages(thinkNode: GraphNode | null): ChatMessage[] {
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
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{ mode?: string; nodeId?: string }>();
  const isThinkMode = params.mode === 'think' && !!params.nodeId;
  const nodeId = isThinkMode ? (params.nodeId as string) : null;
  // Memoized on nodeId (not re-run on every keystroke/render) — and used as the
  // conversation's `key` below so switching to a different node's "Мышление"
  // remounts a fresh conversation instead of appending onto the old one.
  const thinkNode = useMemo(() => (nodeId ? getNode(nodeId) : null), [nodeId]);

  return <ChatConversation key={nodeId ?? 'default'} thinkNode={thinkNode} />;
}

function ChatConversation({ thinkNode }: { thinkNode: GraphNode | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => buildInitialMessages(thinkNode));
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
    <SafeAreaView style={sharedStyles.screen} edges={['bottom']}>
      {thinkNode && (
        <View style={sharedStyles.bannerAccent}>
          <Text style={sharedStyles.bannerAccentText}>Мышление: {thinkNode.title}</Text>
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
                style={[sharedStyles.primaryButton, styles.actionButton]}
                onPress={() => {
                  action.run();
                  setMessages((prev) => [
                    ...prev,
                    { id: nextId(), role: 'assistant', text: `Готово: ${action.label}.` },
                  ]);
                }}
              >
                <Text style={sharedStyles.primaryButtonText}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inputRow, sharedStyles.hairlineTop]}>
          <TextInput
            style={[sharedStyles.input, sharedStyles.flex1]}
            placeholder="Написать..."
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable style={sharedStyles.roundButton} onPress={handleSend}>
            <Text style={sharedStyles.roundButtonText}>→</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: 10 },
  bubble: { maxWidth: '85%', borderRadius: 14, padding: spacing.md },
  bubbleAssistant: { backgroundColor: colors.surface, alignSelf: 'flex-start' },
  bubbleUser: { backgroundColor: colors.accent, alignSelf: 'flex-end' },
  bubbleText: { color: colors.textPrimary, fontSize: 15 },
  bubbleTextUser: { color: colors.textInverse, fontSize: 15 },
  actionButton: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  inputRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
});
