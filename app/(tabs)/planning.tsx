import { useState } from 'react';
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
import { createEdge } from '../../lib/db/edges';
import { getPartOfChainInGraph } from '../../lib/graph';
import { colors, radius, sharedStyles, spacing } from '../../lib/theme';
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
    <SafeAreaView style={sharedStyles.screen} edges={['bottom']}>
      {planItems.length > 0 && (
        <ScrollView horizontal style={[styles.planItemRow, sharedStyles.hairlineBottom]} showsHorizontalScrollIndicator={false}>
          <Pressable
            style={[sharedStyles.chip, styles.planChip, selectedPlanItemId === null && sharedStyles.chipActive]}
            onPress={() => setSelectedPlanItemId(null)}
          >
            <Text style={selectedPlanItemId === null ? sharedStyles.chipTextActive : sharedStyles.chipText}>
              Без цели
            </Text>
          </Pressable>
          {planItems.map((p) => (
            <Pressable
              key={p.id}
              style={[sharedStyles.chip, styles.planChip, selectedPlanItemId === p.id && sharedStyles.chipActive]}
              onPress={() => setSelectedPlanItemId(p.id)}
            >
              <Text style={selectedPlanItemId === p.id ? sharedStyles.chipTextActive : sharedStyles.chipText}>
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
                    <View key={task.id} style={[sharedStyles.card, styles.taskCard]}>
                      <Text style={sharedStyles.cardTitle}>{task.title}</Text>
                      {breadcrumb ? <Text style={sharedStyles.cardMeta}>{breadcrumb}</Text> : null}
                      <View style={styles.cardActions}>
                        <Pressable
                          disabled={!prevStatus(task.status)}
                          onPress={() => moveTask(task, prevStatus(task.status))}
                        >
                          <Text style={[styles.moveArrow, !prevStatus(task.status) && styles.moveArrowDisabled]}>←</Text>
                        </Pressable>
                        <Pressable
                          disabled={!nextStatus(task.status)}
                          onPress={() => moveTask(task, nextStatus(task.status))}
                        >
                          <Text style={[styles.moveArrow, !nextStatus(task.status) && styles.moveArrowDisabled]}>→</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.addBox, sharedStyles.hairlineTop]}>
        <View style={sharedStyles.columnGap}>
          <TextInput
            style={sharedStyles.input}
            placeholder="Новая веха/цель..."
            value={planItemDraft}
            onChangeText={setPlanItemDraft}
            onSubmitEditing={handleAddPlanItem}
          />
        </View>
        <View style={sharedStyles.rowGap}>
          <TextInput
            style={[sharedStyles.input, sharedStyles.flex1]}
            placeholder={selectedPlanItemId ? 'Новая задача для выбранной цели...' : 'Новая задача...'}
            value={taskDraft}
            onChangeText={setTaskDraft}
            onSubmitEditing={handleAddTask}
          />
          <Pressable style={[sharedStyles.roundButton, styles.addTaskButton]} onPress={handleAddTask}>
            <Text style={sharedStyles.roundButtonText}>+</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  planItemRow: { maxHeight: 44 },
  planChip: { marginHorizontal: 4, marginVertical: 6 },
  board: { padding: spacing.md, gap: spacing.sm },
  column: {
    width: 220,
    backgroundColor: colors.backgroundMuted,
    borderRadius: radius.lg,
    padding: spacing.sm + 2,
    marginRight: spacing.sm + 2,
  },
  columnTitle: { fontWeight: '600', marginBottom: spacing.sm, color: colors.textSecondary },
  taskCard: { backgroundColor: colors.background, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between' },
  moveArrow: { fontSize: 16, paddingHorizontal: spacing.sm, color: colors.textPrimary },
  moveArrowDisabled: { color: colors.textMuted },
  addBox: { padding: spacing.md, gap: spacing.sm },
  addTaskButton: { width: 40, height: 40, borderRadius: radius.md },
});
