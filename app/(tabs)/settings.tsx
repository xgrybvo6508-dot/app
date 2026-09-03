import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase/client';
import { syncNow } from '../../lib/sync';
import { colors, sharedStyles, spacing } from '../../lib/theme';

export default function SettingsScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
  const [authBusy, setAuthBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!supabase) {
      // Not configured — the app stays fully usable offline (see plan);
      // this screen just explains why Auth/Sync are unavailable.
      setLoadingSession(false);
      return;
    }
    const client = supabase;
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data: subscription } = client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleAuthSubmit() {
    if (!supabase) return;
    setAuthBusy(true);
    setMessage(null);
    const { error } =
      authMode === 'signUp'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    setAuthBusy(false);
    if (error) {
      setMessage(error.message);
    } else if (authMode === 'signUp') {
      setMessage('Проверь почту для подтверждения регистрации (если включено в проекте).');
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    try {
      await syncNow();
      setMessage('Синхронизация завершена.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  if (!supabase) {
    return (
      <SafeAreaView style={sharedStyles.screen} edges={['bottom']}>
        <View style={styles.form}>
          <Text style={styles.title}>Настройки</Text>
          <Text style={styles.message}>
            Supabase не настроен. Скопируй .env.example в .env и впиши
            EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY своего проекта — тогда
            появятся вход и синхронизация. Всё остальное в приложении работает и без этого.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadingSession) {
    return (
      <SafeAreaView style={sharedStyles.screen}>
        <ActivityIndicator style={styles.centered} color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={sharedStyles.screen} edges={['bottom']}>
        <View style={styles.form}>
          <Text style={styles.title}>{authMode === 'signUp' ? 'Регистрация' : 'Вход'}</Text>
          <TextInput
            style={sharedStyles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={sharedStyles.input}
            placeholder="Пароль"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {message && <Text style={styles.message}>{message}</Text>}
          <Pressable style={sharedStyles.primaryButton} onPress={handleAuthSubmit} disabled={authBusy}>
            <Text style={styles.primaryButtonText}>
              {authBusy ? 'Подождите...' : authMode === 'signUp' ? 'Зарегистрироваться' : 'Войти'}
            </Text>
          </Pressable>
          <Pressable onPress={() => setAuthMode((m) => (m === 'signUp' ? 'signIn' : 'signUp'))}>
            <Text style={styles.switchModeLink}>
              {authMode === 'signUp' ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={sharedStyles.screen} edges={['bottom']}>
      <View style={styles.form}>
        <Text style={styles.title}>Настройки</Text>
        <Text style={styles.email}>{session.user.email}</Text>

        {message && <Text style={styles.message}>{message}</Text>}

        <Pressable style={sharedStyles.primaryButton} onPress={handleSync} disabled={syncing}>
          <Text style={styles.primaryButtonText}>
            {syncing ? 'Синхронизация...' : 'Синхронизировать сейчас'}
          </Text>
        </Pressable>

        <Pressable style={sharedStyles.secondaryButton} onPress={handleSignOut}>
          <Text style={sharedStyles.secondaryButtonText}>Выйти</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center' },
  form: { padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 22, fontWeight: '600', marginBottom: spacing.sm, color: colors.textPrimary },
  email: { color: colors.textSecondary, marginBottom: spacing.md },
  message: { color: colors.danger, fontSize: 13 },
  primaryButtonText: { color: colors.textInverse, fontSize: 15 },
  switchModeLink: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.sm },
});
