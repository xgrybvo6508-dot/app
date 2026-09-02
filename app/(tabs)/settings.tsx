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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleAuthSubmit() {
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

  if (loadingSession) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={styles.centered} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.form}>
          <Text style={styles.title}>{authMode === 'signUp' ? 'Регистрация' : 'Вход'}</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Пароль"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {message && <Text style={styles.message}>{message}</Text>}
          <Pressable style={styles.actionButton} onPress={handleAuthSubmit} disabled={authBusy}>
            <Text style={styles.actionButtonText}>
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.form}>
        <Text style={styles.title}>Настройки</Text>
        <Text style={styles.email}>{session.user.email}</Text>

        {message && <Text style={styles.message}>{message}</Text>}

        <Pressable style={styles.actionButton} onPress={handleSync} disabled={syncing}>
          <Text style={styles.actionButtonText}>
            {syncing ? 'Синхронизация...' : 'Синхронизировать сейчас'}
          </Text>
        </Pressable>

        <Pressable style={styles.actionButtonMuted} onPress={handleSignOut}>
          <Text style={styles.actionButtonText}>Выйти</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center' },
  form: { padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
  email: { color: '#555', marginBottom: 12 },
  input: {
    backgroundColor: '#f4f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  message: { color: '#b3261e', fontSize: 13 },
  actionButton: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonMuted: {
    backgroundColor: '#999',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontSize: 15 },
  switchModeLink: { textAlign: 'center', color: '#666', marginTop: 8 },
});
