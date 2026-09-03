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
import { createNode } from '../../lib/db/nodes';
import { useNodeList } from '../../lib/hooks/useNodeList';
import { sharedStyles } from '../../lib/theme';

export default function NotesScreen() {
  const { nodes, refresh } = useNodeList({ type: 'note' });
  const [draft, setDraft] = useState('');

  function handleAdd() {
    const title = draft.trim();
    if (!title) return;
    createNode({ type: 'note', title });
    setDraft('');
    refresh();
  }

  return (
    <SafeAreaView style={sharedStyles.screen} edges={['bottom']}>
      <FlatList
        data={nodes}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={sharedStyles.emptyText}>Пока нет заметок — запишите первую мысль ниже.</Text>
        }
        renderItem={({ item }) => (
          <View style={sharedStyles.card}>
            <Text style={sharedStyles.cardTitle}>{item.title}</Text>
          </View>
        )}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inputRow, sharedStyles.hairlineTop]}>
          <TextInput
            style={[sharedStyles.input, sharedStyles.flex1]}
            placeholder="Новая заметка..."
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <Pressable style={sharedStyles.roundButton} onPress={handleAdd}>
            <Text style={sharedStyles.roundButtonText}>+</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 8, flexGrow: 1 },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8 },
});
