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
import { colors, sharedStyles, spacing } from '../../lib/theme';
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
      <SafeAreaView style={sharedStyles.screen} edges={['bottom']}>
        <View style={styles.reviewBox}>
          <Text style={styles.reviewTitle}>{reviewing.title}</Text>
          {revealed && reviewing.body ? <Text style={styles.reviewBody}>{reviewing.body}</Text> : null}
          {!revealed ? (
            <Pressable style={sharedStyles.primaryButton} onPress={() => setRevealed(true)}>
              <Text style={sharedStyles.primaryButtonText}>Показать ответ</Text>
            </Pressable>
          ) : (
            <View style={styles.ratingRow}>
              {RATING_BUTTONS.map((r) => (
                <Pressable key={r.label} style={sharedStyles.primaryButton} onPress={() => handleRate(r.quality)}>
                  <Text style={sharedStyles.primaryButtonText}>{r.label}</Text>
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
    <SafeAreaView style={sharedStyles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={sharedStyles.sectionTitle}>Повторение сегодня ({dueQueue.length})</Text>
        {dueQueue.map((item) => (
          <Pressable key={item.id} style={sharedStyles.card} onPress={() => setReviewingId(item.id)}>
            <Text style={sharedStyles.cardTitle}>{item.title}</Text>
          </Pressable>
        ))}
        {dueQueue.length === 0 && <Text style={sharedStyles.emptyText}>Очередь пуста.</Text>}

        {complexRoots.length > 0 && (
          <>
            <Text style={sharedStyles.sectionTitle}>Сложные темы (карта)</Text>
            {complexRoots.map((item) => (
              <View key={item.id} style={sharedStyles.card}>
                <Text style={sharedStyles.cardTitle}>{item.title}</Text>
                <View style={sharedStyles.columnGap}>
                  <TextInput
                    style={[sharedStyles.input, sharedStyles.multilineInput, styles.decomposeInput]}
                    placeholder="Составляющие темы, по одной на строку..."
                    value={decomposeDraftById[item.id] ?? ''}
                    onChangeText={(t) => setDecomposeDraftById((prev) => ({ ...prev, [item.id]: t }))}
                    multiline
                  />
                  <Pressable style={sharedStyles.primaryButton} onPress={() => handleDecompose(item)}>
                    <Text style={sharedStyles.primaryButtonText}>Разбить</Text>
                  </Pressable>
                  <Pressable
                    style={sharedStyles.secondaryButton}
                    onPress={() => router.push({ pathname: '/chat', params: { mode: 'think', nodeId: item.id } })}
                  >
                    <Text style={sharedStyles.secondaryButtonText}>Объяснить своими словами</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {orphans.length > 0 && (
          <>
            <Text style={sharedStyles.sectionTitle}>Зачем ты это учишь?</Text>
            {orphans.map((item) => (
              <View key={item.id} style={sharedStyles.card}>
                <Text style={sharedStyles.cardTitle}>{item.title}</Text>
                <View style={sharedStyles.columnGap}>
                  <TextInput
                    style={sharedStyles.input}
                    placeholder="Для чего/кого — задача, тема, «понимание себя»..."
                    value={goalDraftById[item.id] ?? ''}
                    onChangeText={(t) => setGoalDraftById((prev) => ({ ...prev, [item.id]: t }))}
                    onSubmitEditing={() => handleLinkGoal(item)}
                  />
                  <Pressable style={sharedStyles.secondaryButton} onPress={() => handleMarkCuriosity(item)}>
                    <Text style={sharedStyles.secondaryButtonText}>Просто интересно</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={[styles.addBox, sharedStyles.hairlineTop]}>
        <View style={styles.typeChipsRow}>
          <Pressable
            style={[sharedStyles.chip, draftPath === 'simple' && sharedStyles.chipActive]}
            onPress={() => setDraftPath('simple')}
          >
            <Text style={draftPath === 'simple' ? sharedStyles.chipTextActive : sharedStyles.chipText}>
              Прочитать
            </Text>
          </Pressable>
          <Pressable
            style={[sharedStyles.chip, draftPath === 'complex' && sharedStyles.chipActive]}
            onPress={() => setDraftPath('complex')}
          >
            <Text style={draftPath === 'complex' ? sharedStyles.chipTextActive : sharedStyles.chipText}>
              Разобрать по карте
            </Text>
          </Pressable>
        </View>
        <View style={sharedStyles.rowGap}>
          <TextInput
            style={[sharedStyles.input, sharedStyles.flex1]}
            placeholder="Новая тема/термин..."
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <Pressable style={sharedStyles.primaryButton} onPress={handleAdd}>
            <Text style={sharedStyles.primaryButtonText}>Добавить</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm },
  addBox: { padding: spacing.md, gap: spacing.sm },
  typeChipsRow: { flexDirection: 'row', gap: 6 },
  decomposeInput: { minHeight: 60 },
  reviewBox: { flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg },
  reviewTitle: { fontSize: 22, fontWeight: '600', textAlign: 'center', color: colors.textPrimary },
  reviewBody: { fontSize: 16, textAlign: 'center', color: colors.textSecondary },
  ratingRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', flexWrap: 'wrap' },
  mastery: { textAlign: 'center', color: colors.textMuted, fontSize: 12 },
  cancelLink: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.sm },
});
