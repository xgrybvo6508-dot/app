import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { initDatabase } from '../lib/db/schema';
import { supabase } from '../lib/supabase/client';
import { syncNow } from '../lib/sync';

initDatabase();

export default function RootLayout() {
  useEffect(() => {
    if (!supabase) return; // Supabase not configured yet — app stays fully offline (see plan).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        // Best-effort — a signed-in user gets one push+pull on launch; the
        // "Синхронизировать сейчас" button in Settings covers the rest (see plan).
        syncNow().catch((err) => console.warn('Initial sync failed:', err));
      }
    });
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
