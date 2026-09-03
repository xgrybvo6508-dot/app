import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GraphCanvas } from '../../components/GraphCanvas';
import { createNode, listNodes } from '../../lib/db/nodes';
import { createEdge, listAllEdges } from '../../lib/db/edges';
import { decomposeNode } from '../../lib/graph/decompose';
import { toCytoscapeElements } from '../../lib/graph/cytoscapeElements';
import { colors, sharedStyles, spacing } from '../../lib/theme';
import type { GraphNode, NodeType } from '../../lib/db/types';

const QUICK_ADD_TYPES: { type: NodeType; label: string }[] = [
  { type: 'note', label: 'Заметка' },
  { type: 'idea', label: 'Идея' },
];

export default function MapScreen() {
  const [nodes, setNodes] = useState<GraphNode[]>(() => listNodes());
  const [edges, setEdges] = useState(() => listAllEdges());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkFromId, setLinkFromId] = useState<string | null>(null);
  const [decomposeDraft, setDecomposeDraft] = useState('');
  const [decomposing, setDecomposing] = useState(false);
  const [quickAddDraft, setQuickAddDraft] = useState('');
  const [quickAddType, setQuickAddType] = useState<NodeType>('idea');

  const elements = useMemo(() => toCytoscapeElements(nodes, edges), [nodes, edges]);
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  function refresh() {
    setNodes(listNodes());
    setEdges(listAllEdges());
  }

  function handleNodeTap(id: string) {
    if (linkFromId) {
      if (linkFromId !== id) {
        createEdge({ fromId: linkFromId, toId: id, type: 'derived_from' });
        refresh();
      }
      setLinkFromId(null);
      return;
    }
    setSelectedId(id);
    setDecomposing(false);
  }

  function handleQuickAdd() {
    const title = quickAddDraft.trim();
    if (!title) return;
    createNode({ type: quickAddType, title });
    setQuickAddDraft('');
    refresh();
  }

  function handleDecomposeConfirm() {
    if (!selected) return;
    const titles = decomposeDraft
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);
    if (titles.length === 0) return;
    decomposeNode({
      parentId: selected.id,
      parentType: selected.type,
      linkType: 'part_of',
      subNodes: titles.map((title) => ({ title })),
    });
    setDecomposeDraft('');
    setDecomposing(false);
    refresh();
  }

  return (
    <SafeAreaView style={sharedStyles.screen} edges={['bottom']}>
      <View style={[styles.quickAddRow, sharedStyles.hairlineBottom]}>
        {QUICK_ADD_TYPES.map(({ type, label }) => (
          <Pressable
            key={type}
            style={[sharedStyles.chip, quickAddType === type && sharedStyles.chipActive]}
            onPress={() => setQuickAddType(type)}
          >
            <Text style={quickAddType === type ? sharedStyles.chipTextActive : sharedStyles.chipText}>
              {label}
            </Text>
          </Pressable>
        ))}
        <TextInput
          style={[sharedStyles.input, sharedStyles.flex1, styles.quickAddInput]}
          placeholder="Добавить на карту..."
          value={quickAddDraft}
          onChangeText={setQuickAddDraft}
          onSubmitEditing={handleQuickAdd}
          returnKeyType="done"
        />
      </View>

      {linkFromId && (
        <View style={[sharedStyles.bannerAccent, styles.linkBanner]}>
          <Text style={sharedStyles.bannerAccentText}>Режим связывания: выберите второй узел</Text>
          <Pressable onPress={() => setLinkFromId(null)}>
            <Text style={[sharedStyles.bannerAccentText, styles.linkBannerCancel]}>Отмена</Text>
          </Pressable>
        </View>
      )}

      <GraphCanvas elements={elements} focusId={selectedId} onNodeTap={handleNodeTap} />

      {selected && (
        <ScrollView style={[styles.panel, sharedStyles.hairlineTop]} contentContainerStyle={styles.panelContent}>
          <Text style={styles.panelTitle}>{selected.title}</Text>
          <Text style={styles.panelType}>{selected.type}</Text>

          <View style={styles.panelActions}>
            <Pressable
              style={sharedStyles.secondaryButton}
              onPress={() => {
                setLinkFromId(selected.id);
                setSelectedId(null);
              }}
            >
              <Text style={sharedStyles.secondaryButtonText}>Связать</Text>
            </Pressable>
            <Pressable style={sharedStyles.secondaryButton} onPress={() => setDecomposing((d) => !d)}>
              <Text style={sharedStyles.secondaryButtonText}>Разбить</Text>
            </Pressable>
            <Pressable
              style={sharedStyles.secondaryButton}
              onPress={() => router.push({ pathname: '/chat', params: { mode: 'think', nodeId: selected.id } })}
            >
              <Text style={sharedStyles.secondaryButtonText}>Мышление</Text>
            </Pressable>
            <Pressable style={sharedStyles.secondaryButton} onPress={() => setSelectedId(null)}>
              <Text style={sharedStyles.secondaryButtonText}>Закрыть</Text>
            </Pressable>
          </View>

          {decomposing && (
            <View style={styles.decomposeBox}>
              <TextInput
                style={[sharedStyles.input, sharedStyles.multilineInput, styles.decomposeInput]}
                placeholder={'Составляющие, по одной на строку...'}
                value={decomposeDraft}
                onChangeText={setDecomposeDraft}
                multiline
              />
              <Pressable style={sharedStyles.primaryButton} onPress={handleDecomposeConfirm}>
                <Text style={sharedStyles.primaryButtonText}>Создать под-узлы</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  quickAddInput: { paddingHorizontal: 12, paddingVertical: 8 },
  linkBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkBannerCancel: { fontWeight: '700' },
  panel: { maxHeight: 220 },
  panelContent: { padding: spacing.lg },
  panelTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  panelType: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 10 },
  panelActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  decomposeBox: { marginTop: spacing.md, gap: spacing.sm },
  decomposeInput: { minHeight: 70 },
});
