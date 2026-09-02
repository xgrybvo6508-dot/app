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
import { logEvent } from '../../lib/db/activityLog';
import { decomposeNode } from '../../lib/graph/decompose';
import {
  addDays,
  computeMasteryLevel,
  DEFAULT_SM2_STATE,
  nextSm2State,
  type Sm2State,
} from '../../lib/learning/sm2';
import type { GraphNode, KnowledgeItemAttributes } from '../../lib/db/types';

const RATING_BUTTONS: { label: string; quality: number }[] = [
  { label: 'Забыл', quality: 2 },
  { label: 'Сложно', quality: 3 },
  { label: 'Хорошо', quality: 4 },
  { label: 'Легко', quality: 5 },
];

function getAttrs(node: GraphNode): KnowledgeItemAttributes {
  return node.attributes as KnowledgeItemAttributes;
}

function isDue(node: GraphNode, now: Date): boolean {
  const attrs = getAttrs(node);
  if (attrs.learningPath === 'complex') return false;
  if (!attrs.reviewDueAt) return true;
  return new Date(attrs.reviewDueAt) <= now;
}

export default function LearningScreen() {
  const [nodes, setNodes] = useState<GraphNode[]>(() => listNodes({ type: 'knowledge_item' }));
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftPath, setDraftPath] = useState<'simple' | 'complex'>('simple');
  const [decomposeDraftById, setDecomposeDraftById] = useState<Record<string, string>>({});
  const [goalDraftById, setGoalDraftById] = useState<Record<string, string>>({});

  function refresh() {
    setNodes(listNodes({ type: 'knowledge_item' }));
  }

  const now = new Date();
  const dueQueue = useMemo(() => nodes.filter((n) => isDue(n, now)), [nodes]);
  const complexRoots = useMemo(
    () => nodes.filter((n) => getAttrs(n).learningPath === 'complex'),
    [nodes],
  );
  const orphans = useMemo(
    () =>
      nodes.filter(
        (n) =>
          !getAttrs(n).curiosityOnly &&
          getAttrs(n).learningPath !== 'complex' &&
          getOutgoingEdges(n.id, 'applies_to').length === 0 &&
          getOutgoingEdges(n.id, 'learned_for').length === 0,
      ),
    [nodes],
  );

  const reviewing = nodes.find((n) => n.id === reviewingId) ?? null;

  function handleAdd() {
    const title = draft.trim();
    if (!title) return;
    const attrs: KnowledgeItemAttributes =
      draftPath === 'simple'
        ? { ...DEFAULT_SM2_STATE, reviewDueAt: new Date().toISOString(), learningPath: 'simple' }
        : { learningPath: 'complex' };
    createNode({ type: 'knowledge_item', title, attributes: attrs });
    setDraft('');
    refresh();
  }

  function handleRate(quality: number) {
    if (!reviewing) return;
    const attrs = getAttrs(reviewing);
    const prevState: Sm2State = {
      reviewCount: attrs.reviewCount ?? 0,
      easeFactor: attrs.easeFactor ?? DEFAULT_SM2_STATE.easeFactor,
      reviewIntervalDays: attrs.reviewIntervalDays ?? 0,
    };
    const next = nextSm2State(prevState, quality);
    const reviewDueAt = addDays(new Date(), next.reviewIntervalDays).toISOString();

    updateNode(reviewing.id, {
      attributes: {
        ...attrs,
        ...next,
        reviewDueAt,
        masteryLevel: computeMasteryLevel(next),
      },
    });
    logEvent({ type: 'review_completed', nodeId: reviewing.id, metadata: { quality } });

    setReviewingId(null);
    setRevealed(false);
    refresh();
  }

  function handleDecompose(node: GraphNode) {
    const titles = (decomposeDraftById[node.id] ?? '')
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);
    if (titles.length === 0) return;
    decomposeNode({
      parentId: node.id,
      parentType: 'knowledge_item',
      linkType: 'part_of',
      subNodes: titles.map((title) => ({ title })),
    });
    setDecomposeDraftById((prev) => ({ ...prev, [node.id]: '' }));
    refresh();
  }

  function handleMarkCuriosity(node: GraphNode) {
    updateNode(node.id, { attributes: { ...getAttrs(node), curiosityOnly: true } });
    refresh();
  }

  function handleLinkGoal(node: GraphNode) {
    const goalTitle = (goalDraftById[node.id] ?? '').trim();
    if (!goalTitle) return;
    const existing = listNodes({ type: 'life_domain' }).find(
      (n) => n.title.toLowerCase() === goalTitle.toLowerCase(),
    );
    const domain = existing ?? createNode({ type: 'life_domain', title: goalTitle });
    createEdge({ fromId: node.id, toId: domain.id, type: 'learned_for' });
    setGoalDraftById((prev) => ({ ...prev, [node.id]: '' }));
    refresh();
  }

  if (reviewing) {
    const attrs = getAttrs(reviewing);
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.reviewBox}>
          <Text style={styles.reviewTitle}>{reviewing.title}</Text>
          {revealed && reviewing.body ? <Text style={styles.reviewBody}>{reviewing.body}</Text> : null}
          {!revealed ? (
            <Pressable style={styles.actionButton} onPress={() => setRevealed(true)}>
              <Text style={styles.actionButtonText}>Показать ответ</Text>
            </Pressable>
          ) : (
            <View style={styles.ratingRow}>
              {RATING_BUTTONS.map((r) => (
                <Pressable key={r.label} style={styles.ratingButton} onPress={() => handleRate(r.quality)}>
                  <Text style={styles.actionButtonText}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Text style={styles.mastery}>Mastery: {attrs.masteryLevel ?? 0}</Text>
          <Pressable
            onPress={() => {
              setReviewingId(null);
              setRevealed(false);
            }}
          >
            <Text style={styles.cancelLink}>Отмена</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.sectionTitle}>Повторение сегодня ({dueQueue.length})</Text>
        {dueQueue.map((item) => (
          <Pressable key={item.id} style={styles.card} onPress={() => setReviewingId(item.id)}>
            <Text style={styles.cardTitle}>{item.title}</Text>
          </Pressable>
        ))}
        {dueQueue.length === 0 && <Text style={styles.empty}>Очередь пуста.</Text>}

        {complexRoots.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Сложные темы (карта)</Text>
            {complexRoots.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.rowGap}>
                  <TextInput
                    style={styles.decomposeInput}
                    placeholder="Составляющие темы, по одной на строку..."
                    value={decomposeDraftById[item.id] ?? ''}
                    onChangeText={(t) => setDecomposeDraftById((prev) => ({ ...prev, [item.id]: t }))}
                    multiline
                  />
                  <Pressable style={styles.actionButton} onPress={() => handleDecompose(item)}>
                    <Text style={styles.actionButtonText}>Разбить</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => router.push({ pathname: '/chat', params: { mode: 'think', nodeId: item.id } })}
                  >
                    <Text style={styles.actionButtonText}>Объяснить своими словами</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {orphans.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Зачем ты это учишь?</Text>
            {orphans.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.rowGap}>
                  <TextInput
                    style={styles.quickAddInput}
                    placeholder="Для чего/кого — задача, тема, «понимание себя»..."
                    value={goalDraftById[item.id] ?? ''}
                    onChangeText={(t) => setGoalDraftById((prev) => ({ ...prev, [item.id]: t }))}
                    onSubmitEditing={() => handleLinkGoal(item)}
                  />
                  <Pressable style={styles.actionButtonMuted} onPress={() => handleMarkCuriosity(item)}>
                    <Text style={styles.actionButtonText}>Просто интересно</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.addBox}>
        <View style={styles.typeChipsRow}>
          <Pressable
            style={[styles.typeChip, draftPath === 'simple' && styles.typeChipActive]}
            onPress={() => setDraftPath('simple')}
          >
            <Text style={draftPath === 'simple' ? styles.typeChipTextActive : styles.typeChipText}>
              Прочитать
            </Text>
          </Pressable>
          <Pressable
            style={[styles.typeChip, draftPath === 'complex' && styles.typeChipActive]}
            onPress={() => setDraftPath('complex')}
          >
            <Text style={draftPath === 'complex' ? styles.typeChipTextActive : styles.typeChipText}>
              Разобрать по карте
            </Text>
          </Pressable>
        </View>
        <View style={styles.rowGap}>
          <TextInput
            style={styles.quickAddInput}
            placeholder="Новая тема/термин..."
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <Pressable style={styles.actionButton} onPress={handleAdd}>
            <Text style={styles.actionButtonText}>Добавить</Text>
          </Pressable>
        </View>
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
  rowGap: { gap: 8 },
  addBox: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd', gap: 8 },
  typeChipsRow: { flexDirection: 'row', gap: 6 },
  typeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f0f0f0' },
  typeChipActive: { backgroundColor: '#111' },
  typeChipText: { fontSize: 12, color: '#333' },
  typeChipTextActive: { fontSize: 12, color: '#fff' },
  quickAddInput: { backgroundColor: '#f4f4f6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  decomposeInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actionButton: { backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  actionButtonMuted: { backgroundColor: '#999', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontSize: 13 },
  reviewBox: { flex: 1, padding: 20, justifyContent: 'center', gap: 16 },
  reviewTitle: { fontSize: 22, fontWeight: '600', textAlign: 'center' },
  reviewBody: { fontSize: 16, textAlign: 'center', color: '#444' },
  ratingRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  ratingButton: { backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  mastery: { textAlign: 'center', color: '#888', fontSize: 12 },
  cancelLink: { textAlign: 'center', color: '#888', marginTop: 8 },
});
