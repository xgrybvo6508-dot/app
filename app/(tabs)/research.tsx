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
import { sharedStyles, spacing } from '../../lib/theme';
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
    <SafeAreaView style={sharedStyles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={sharedStyles.sectionTitle}>Все находки ({findings.length})</Text>
        {findings.map((item) => (
          <View key={item.id} style={sharedStyles.card}>
            <Text style={sharedStyles.cardTitle}>{item.title}</Text>
            <Text style={sharedStyles.cardMeta}>
              Подтверждений: {corroborationCount(item)}
              {getAttrs(item).sourceUrl ? ` · ${getAttrs(item).sourceUrl}` : ''}
            </Text>
            <Pressable
              style={sharedStyles.secondaryButton}
              onPress={() => router.push({ pathname: '/chat', params: { mode: 'think', nodeId: item.id } })}
            >
              <Text style={sharedStyles.secondaryButtonText}>Разобрать со всех сторон</Text>
            </Pressable>
          </View>
        ))}
        {findings.length === 0 && <Text style={sharedStyles.emptyText}>Пока нет находок.</Text>}

        {orphans.length > 0 && (
          <>
            <Text style={sharedStyles.sectionTitle}>Без связи с задачей — зачем это?</Text>
            {orphans.map((item) => (
              <View key={item.id} style={sharedStyles.card}>
                <Text style={sharedStyles.cardTitle}>{item.title}</Text>
                <View style={sharedStyles.columnGap}>
                  <TextInput
                    style={sharedStyles.input}
                    placeholder="Какую задачу это обслуживает..."
                    value={goalDraftById[item.id] ?? ''}
                    onChangeText={(t) => setGoalDraftById((prev) => ({ ...prev, [item.id]: t }))}
                    onSubmitEditing={() => handleLinkGoal(item)}
                  />
                  <Pressable style={sharedStyles.secondaryButton} onPress={() => handleMarkReference(item)}>
                    <Text style={sharedStyles.secondaryButtonText}>Просто справочно</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={[styles.addBox, sharedStyles.hairlineTop]}>
        <TextInput
          style={sharedStyles.input}
          placeholder="Ссылка на источник (опционально)"
          value={sourceUrl}
          onChangeText={setSourceUrl}
        />
        <TextInput
          style={[sharedStyles.input, sharedStyles.multilineInput, styles.sourceInput]}
          placeholder="Вставь текст статьи/источника..."
          value={sourceText}
          onChangeText={setSourceText}
          multiline
        />
        <Pressable style={sharedStyles.primaryButton} onPress={handleExtract}>
          <Text style={sharedStyles.primaryButtonText}>Разбить на утверждения</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm },
  addBox: { padding: spacing.md, gap: spacing.sm },
  sourceInput: { minHeight: 80 },
});
