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
import { getPartOfChainInGraph } from '../../lib/graph';
import type { GraphNode, NodeStatus } from '../../lib/db/types';

// v1 uses tap-to-advance instead of real drag gesture (see plan's UX section on
// "перетаскиваемое ощущение контроля") — a DnD library is a follow-up once this
// runs on a device/simulator to tune; tap keeps the interaction verifiable now.
const COLUMNS: { status: NodeStatus; label: string }[] = [
  { status: 'active', label: 'Todo' },
  { status: 'in_progress', label: 'В работе' },
  { status: 'done', label: 'Готово' },
];

function nextStatus(status: NodeStatus): NodeStatus | null {
  const idx = COLUMNS.findIndex((c) => c.status === status);
  return idx >= 0 && idx < COLUMNS.length - 1 ? COLUMNS[idx + 1].status : null;
}

function prevStatus(status: NodeStatus): NodeStatus | null {
  const idx = COLUMNS.findIndex((c) => c.status === status);
  return idx > 0 ? COLUMNS[idx - 1].status : null;
}

export default function PlanningScreen() {
  const [tasks, setTasks] = useState<GraphNode[]>(() => listNodes({ type: 'task' }));
  const [planItems, setPlanItems] = useState<GraphNode[]>(() => listNodes({ type: 'plan_item' }));
  const [selectedPlanItemId, setSelectedPlanItemId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState('');
  const [planItemDraft, setPlanItemDraft] = useState('');

  function refresh() {
    setTasks(listNodes({ type: 'task' }));
    setPlanItems(listNodes({ type: 'plan_item' }));
  }

  function handleAddTask() {
    const title = taskDraft.trim();
    if (!title) return;
    const task = createNode({ type: 'task', title, status: 'active' });
    if (selectedPlanItemId) {
      createEdge({ fromId: task.id, toId: selectedPlanItemId, type: 'part_of' });
    }
    setTaskDraft('');
    refresh();
  }

  function handleAddPlanItem() {
    const title = planItemDraft.trim();
    if (!title) return;
    createNode({ type: 'plan_item', title });
    setPlanItemDraft('');
    refresh();
  }

  function moveTask(task: GraphNode, status: NodeStatus | null) {
    if (!status) return;
    updateNode(task.id, { status });
    refresh();
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {planItems.length > 0 && (
        <ScrollView horizontal style={styles.planItemRow} showsHorizontalScrollIndicator={false}>
          <Pressable
            style={[styles.planChip, selectedPlanItemId === null && styles.planChipActive]}
            onPress={() => setSelectedPlanItemId(null)}
          >
            <Text style={selectedPlanItemId === null ? styles.planChipTextActive : styles.planChipText}>
              Без цели
            </Text>
          </Pressable>
          {planItems.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.planChip, selectedPlanItemId === p.id && styles.planChipActive]}
              onPress={() => setSelectedPlanItemId(p.id)}
            >
              <Text style={selectedPlanItemId === p.id ? styles.planChipTextActive : styles.planChipText}>
                {p.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ScrollView horizontal contentContainerStyle={styles.board} showsHorizontalScrollIndicator={false}>
        {COLUMNS.map((column) => (
          <View key={column.status} style={styles.column}>
            <Text style={styles.columnTitle}>{column.label}</Text>
            <ScrollView>
              {tasks
                .filter((t) => t.status === column.status)
                .map((task) => {
                  const chain = getPartOfChainInGraph(task.id);
                  const breadcrumb = chain
                    .slice(1)
                    .map((c) => c.node.title)
                    .join(' → ');
                  return (
                    <View key={task.id} style={styles.card}>
                      <Text style={styles.cardTitle}>{task.title}</Text>
                      {breadcrumb ? <Text style={styles.breadcrumb}>{breadcrumb}</Text> : null}
                      <View style={styles.cardActions}>
                        <Pressable
                          disabled={!prevStatus(task.status)}
                          onPress={() => moveTask(task, prevStatus(task.status))}
                        >
                          <Text style={styles.moveArrow}>←</Text>
                        </Pressable>
                        <Pressable
                          disabled={!nextStatus(task.status)}
                          onPress={() => moveTask(task, nextStatus(task.status))}
                        >
                          <Text style={styles.moveArrow}>→</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      <View style={styles.addBox}>
        <View style={styles.rowGap}>
          <TextInput
            style={styles.quickAddInput}
            placeholder="Новая веха/цель..."
            value={planItemDraft}
            onChangeText={setPlanItemDraft}
            onSubmitEditing={handleAddPlanItem}
          />
        </View>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.quickAddInput, styles.flex1]}
            placeholder={selectedPlanItemId ? 'Новая задача для выбранной цели...' : 'Новая задача...'}
            value={taskDraft}
            onChangeText={setTaskDraft}
            onSubmitEditing={handleAddTask}
          />
          <Pressable style={styles.actionButton} onPress={handleAddTask}>
            <Text style={styles.actionButtonText}>+</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  planItemRow: { maxHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  planChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
    marginVertical: 6,
  },
  planChipActive: { backgroundColor: '#111' },
  planChipText: { fontSize: 12, color: '#333' },
  planChipTextActive: { fontSize: 12, color: '#fff' },
  board: { padding: 12, gap: 10 },
  column: { width: 220, backgroundColor: '#fafafa', borderRadius: 12, padding: 10, marginRight: 10 },
  columnTitle: { fontWeight: '600', marginBottom: 8, color: '#333' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 8, elevation: 1 },
  cardTitle: { fontSize: 14 },
  breadcrumb: { fontSize: 11, color: '#888', marginTop: 4 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  moveArrow: { fontSize: 16, paddingHorizontal: 8 },
  addBox: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd', gap: 8 },
  rowGap: { gap: 8 },
  addRow: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  quickAddInput: { backgroundColor: '#f4f4f6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: { color: '#fff', fontSize: 18 },
});
