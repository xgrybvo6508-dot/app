import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitleStyle: { fontWeight: '600', color: colors.textPrimary },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="notes" options={{ title: 'Заметки' }} />
      <Tabs.Screen name="map" options={{ title: 'Карта' }} />
      <Tabs.Screen name="planning" options={{ title: 'Планирование' }} />
      <Tabs.Screen name="chat" options={{ title: 'Обращение' }} />
      <Tabs.Screen name="learning" options={{ title: 'Обучение' }} />
      <Tabs.Screen name="research" options={{ title: 'Ресерч' }} />
      <Tabs.Screen name="settings" options={{ title: 'Настройки' }} />
    </Tabs>
  );
}
