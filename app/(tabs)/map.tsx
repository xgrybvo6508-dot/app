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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.quickAddRow}>
        {QUICK_ADD_TYPES.map(({ type, label }) => (
          <Pressable
            key={type}
            style={[styles.typeChip, quickAddType === type && styles.typeChipActive]}
            onPress={() => setQuickAddType(type)}
          >
            <Text style={quickAddType === type ? styles.typeChipTextActive : styles.typeChipText}>
              {label}
            </Text>
          </Pressable>
        ))}
        <TextInput
          style={styles.quickAddInput}
          placeholder="Добавить на карту..."
          value={quickAddDraft}
          onChangeText={setQuickAddDraft}
          onSubmitEditing={handleQuickAdd}
          returnKeyType="done"
        />
      </View>

      {linkFromId && (
        <View style={styles.linkBanner}>
          <Text style={styles.linkBannerText}>Режим связывания: выберите второй узел</Text>
          <Pressable onPress={() => setLinkFromId(null)}>
            <Text style={styles.linkBannerCancel}>Отмена</Text>
          </Pressable>
        </View>
      )}

      <GraphCanvas elements={elements} focusId={selectedId} onNodeTap={handleNodeTap} />

      {selected && (
        <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
          <Text style={styles.panelTitle}>{selected.title}</Text>
          <Text style={styles.panelType}>{selected.type}</Text>

          <View style={styles.panelActions}>
            <Pressable
              style={styles.actionButton}
              onPress={() => {
                setLinkFromId(selected.id);
                setSelectedId(null);
              }}
            >
              <Text style={styles.actionButtonText}>Связать</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => setDecomposing((d) => !d)}>
              <Text style={styles.actionButtonText}>Разбить</Text>
            </Pressable>
            <Pressable
              style={styles.actionButton}
              onPress={() => router.push({ pathname: '/chat', params: { mode: 'think', nodeId: selected.id } })}
            >
              <Text style={styles.actionButtonText}>Мышление</Text>
            </Pressable>
            <Pressable style={styles.actionButtonMuted} onPress={() => setSelectedId(null)}>
              <Text style={styles.actionButtonText}>Закрыть</Text>
            </Pressable>
          </View>

          {decomposing && (
            <View style={styles.decomposeBox}>
              <TextInput
                style={styles.decomposeInput}
                placeholder={'Составляющие, по одной на строку...'}
                value={decomposeDraft}
                onChangeText={setDecomposeDraft}
                multiline
              />
              <Pressable style={styles.actionButton} onPress={handleDecomposeConfirm}>
                <Text style={styles.actionButtonText}>Создать под-узлы</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
  },
  typeChipActive: { backgroundColor: '#111' },
  typeChipText: { fontSize: 12, color: '#333' },
  typeChipTextActive: { fontSize: 12, color: '#fff' },
  quickAddInput: {
    flex: 1,
    backgroundColor: '#f4f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  linkBannerText: { fontSize: 12, color: '#664d03' },
  linkBannerCancel: { fontSize: 12, color: '#664d03', fontWeight: '600' },
  panel: {
    maxHeight: 220,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
  },
  panelContent: { padding: 16 },
  panelTitle: { fontSize: 17, fontWeight: '600' },
  panelType: { fontSize: 12, color: '#888', marginTop: 2, marginBottom: 10 },
  panelActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonMuted: {
    backgroundColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonText: { color: '#fff', fontSize: 13 },
  decomposeBox: { marginTop: 12, gap: 8 },
  decomposeInput: {
    backgroundColor: '#f4f4f6',
    borderRadius: 10,
    padding: 10,
    minHeight: 70,
    textAlignVertical: 'top',
  },
});
