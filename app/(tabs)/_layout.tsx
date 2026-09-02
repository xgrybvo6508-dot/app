import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerTitleStyle: { fontWeight: '600' } }}>
      <Tabs.Screen name="notes" options={{ title: 'Заметки' }} />
      <Tabs.Screen name="map" options={{ title: 'Карта' }} />
      <Tabs.Screen name="planning" options={{ title: 'Планирование' }} />
      <Tabs.Screen name="chat" options={{ title: 'Обращение' }} />
      <Tabs.Screen name="learning" options={{ title: 'Обучение' }} />
      <Tabs.Screen name="research" options={{ title: 'Ресерч' }} />
    </Tabs>
  );
}
