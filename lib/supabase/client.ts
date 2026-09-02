// The only place the RN client talks to Supabase directly — for auth + the
// nodes/edges/activity_log tables that RLS scopes to auth.uid(). Real LLM
// calls stay server-side in supabase/functions (see plan's "Финальные
// архитектурные решения": Anthropic key never reaches the client).
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set — copy .env.example to .env ' +
      'and fill in your Supabase project values. Auth/sync will fail until then.',
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
