// The only place the RN client talks to Supabase directly — for auth + the
// nodes/edges/activity_log tables that RLS scopes to auth.uid(). Real LLM
// calls stay server-side in supabase/functions (see plan's "Финальные
// архитектурные решения": Anthropic key never reaches the client).
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// `supabase-js` throws synchronously if the URL/key are missing, which would
// crash the whole app at import time (this module is pulled in from the root
// layout) — the app is local-first (see plan) and must keep working fully
// offline when Supabase isn't configured yet, so we degrade to `null` instead.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

if (!supabase) {
  console.warn(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set — copy .env.example to .env ' +
      'and fill in your Supabase project values. The app works fully offline until then; ' +
      'Auth/sync in Settings will report "not configured".',
  );
}
