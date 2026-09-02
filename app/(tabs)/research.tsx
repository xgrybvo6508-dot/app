import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createNode, listNodes, updateNode } from '../../lib/db/nodes';
import { createEdge, getOutgoingEdges } from '../../lib/db/edges';
import type { GraphNode, ResearchFindingAttributes } from '../../lib/db/types';

// Naive local stand-in for the `extract-candidates` Supabase Edge Function
// (see plan: "переиспользуем тот же экстрактор, что уже спроектирован для
// массового ввода в обучении"). Splits pasted text into candidate claims by
// sentence — a real LLM call replaces this function's body later, keeping
// the same (text) => string[] signature.
function extractCandidateClaims(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

function getAttrs(node: GraphNode): ResearchFindingAttributes {
  return node.attributes as ResearchFindingAttributes;
}

export default function ResearchScreen() {
  const [nodes, setNodes] = useState<GraphNode[]>(() => listNodes({ type: 'research_finding' }));
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [goalDraftById, setGoalDraftById] = useState<Record<string, string>>({});

  function refresh() {
    setNodes(listNodes({ type: 'research_finding' }));
  }

  const findings = nodes;
  const orphans = useMemo(
    () =>
      findings.filter(
        (n) =>
          !getAttrs(n).credibilityNote?.includes('справочно') &&
          getOutgoingEdges(n.id, 'applies_to').length === 0,
      ),
    [findings],
  );

  function handleExtract() {
    const claims = extractCandidateClaims(sourceText);
    for (const title of claims) {
      createNode({
        type: 'research_finding',
        title,
        attributes: { sourceUrl: sourceUrl.trim() || undefined },
      });
    }
    setSourceText('');
    refresh();
  }

  function corroborationCount(node: GraphNode): number {
    return getOutgoingEdges(node.id, 'supports').length;
  }

  function handleLinkGoal(node: GraphNode) {
    const goalTitle = (goalDraftById[node.id] ?? '').trim();
    if (!goalTitle) return;
    const existing = listNodes({ type: 'task' }).find(
      (n) => n.title.toLowerCase() === goalTitle.toLowerCase(),
    );
    const task = existing ?? createNode({ type: 'task', title: goalTitle });
    createEdge({ fromId: node.id, toId: task.id, type: 'applies_to' });
    setGoalDraftById((prev) => ({ ...prev, [node.id]: '' }));
    refresh();
  }

  function handleMarkReference(node: GraphNode) {
    updateNode(node.id, {
      attributes: { ...getAttrs(node), credibilityNote: 'справочно' },
    });
    refresh();
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.sectionTitle}>Все находки ({findings.length})</Text>
        {findings.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>
              Подтверждений: {corroborationCount(item)}
              {getAttrs(item).sourceUrl ? ` · ${getAttrs(item).sourceUrl}` : ''}
            </Text>
            <Pressable
              style={styles.actionButtonMuted}
              onPress={() => router.push({ pathname: '/chat', params: { mode: 'think', nodeId: item.id } })}
            >
              <Text style={styles.actionButtonText}>Разобрать со всех сторон</Text>
            </Pressable>
          </View>
        ))}
        {findings.length === 0 && <Text style={styles.empty}>Пока нет находок.</Text>}

        {orphans.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Без связи с задачей — зачем это?</Text>
            {orphans.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.rowGap}>
                  <TextInput
                    style={styles.quickAddInput}
                    placeholder="Какую задачу это обслуживает..."
                    value={goalDraftById[item.id] ?? ''}
                    onChangeText={(t) => setGoalDraftById((prev) => ({ ...prev, [item.id]: t }))}
                    onSubmitEditing={() => handleLinkGoal(item)}
                  />
                  <Pressable style={styles.actionButtonMuted} onPress={() => handleMarkReference(item)}>
                    <Text style={styles.actionButtonText}>Просто справочно</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.addBox}>
        <TextInput
          style={styles.quickAddInput}
          placeholder="Ссылка на источник (опционально)"
          value={sourceUrl}
          onChangeText={setSourceUrl}
        />
        <TextInput
          style={styles.sourceInput}
          placeholder="Вставь текст статьи/источника..."
          value={sourceText}
          onChangeText={setSourceText}
          multiline
        />
        <Pressable style={styles.actionButton} onPress={handleExtract}>
          <Text style={styles.actionButtonText}>Разбить на утверждения</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 16, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 4, color: '#555' },
  empty: { color: '#888' },
  card: { backgroundColor: '#f4f4f6', borderRadius: 12, padding: 14, marginBottom: 8, gap: 8 },
  cardTitle: { fontSize: 16 },
  cardMeta: { fontSize: 12, color: '#888' },
  rowGap: { gap: 8 },
  addBox: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd', gap: 8 },
  quickAddInput: { backgroundColor: '#f4f4f6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  sourceInput: {
    backgroundColor: '#f4f4f6',
    borderRadius: 10,
    padding: 10,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionButton: { backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  actionButtonMuted: { backgroundColor: '#999', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontSize: 13 },
});
