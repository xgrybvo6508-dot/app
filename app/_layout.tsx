import { Stack } from 'expo-router';
import { initDatabase } from '../lib/db/schema';

initDatabase();

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
