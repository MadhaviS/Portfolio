import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTheme } from '../../core/theme/ThemeProvider';
import { useAuth } from '../../core/auth/AuthProvider';
import { PHASE_THEME } from '../pomodoro/domain/types';
import { pomodoroRepository } from '../pomodoro/data/pomodoroRepository';

const fontDisplay = Platform.select({
  web: 'Fraunces, Georgia, serif',
  default: 'serif',
});
const fontBody = Platform.select({
  web: 'Outfit, system-ui, sans-serif',
  default: 'System',
});

/** Same red as Pomodoro focus cards / brand. */
const ACCENT = PHASE_THEME.focus.bg;

type Mode = 'signin' | 'signup';

export function SignInScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { ready, isAuthenticated, isGuest, signIn, signUp, signInAsGuest } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Sign in';
    }
  }, []);

  const close = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/pomodoro');
  };

  if (ready && isAuthenticated && !isGuest) {
    return <Redirect href="/pomodoro" />;
  }

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const account =
        mode === 'signin'
          ? await signIn(email, password)
          : await signUp(email, password, name || undefined);
      // Bind workspace now (adopts guest data into empty accounts).
      pomodoroRepository.switchUser(account.id);
      router.replace('/pomodoro');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const continueAsGuest = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!isAuthenticated) await signInAsGuest();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not continue.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <Pressable
        style={styles.backdrop}
        onPress={busy ? undefined : close}
        accessibilityLabel="Close sign in"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              maxHeight: Math.min(height * 0.9, 640),
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.brand, { color: ACCENT, fontFamily: fontDisplay }]}>
              8dgeTech
            </Text>
            <Pressable
              onPress={close}
              disabled={busy}
              hitSlop={10}
              accessibilityLabel="Close"
              style={({ pressed }) => [
                styles.closeBtn,
                {
                  backgroundColor: c.backgroundAlt,
                  opacity: busy ? 0.4 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.closeText, { color: c.onSurface }]}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.cardBody}
          >
            <Text style={[styles.title, { color: c.onSurface, fontFamily: fontDisplay }]}>
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={[styles.sub, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
              Optional — use the timer freely, or sign in to keep an account on this device.
            </Text>

            <View style={styles.tabs}>
              <Pressable
                onPress={() => {
                  setMode('signin');
                  setError(null);
                }}
                style={[
                  styles.tab,
                  {
                    borderColor: mode === 'signin' ? ACCENT : c.border,
                    backgroundColor: mode === 'signin' ? ACCENT : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: mode === 'signin' ? '#FFFFFF' : c.onSurfaceMuted,
                      fontFamily: fontBody,
                    },
                  ]}
                >
                  Sign in
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMode('signup');
                  setError(null);
                }}
                style={[
                  styles.tab,
                  {
                    borderColor: mode === 'signup' ? ACCENT : c.border,
                    backgroundColor: mode === 'signup' ? ACCENT : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: mode === 'signup' ? '#FFFFFF' : c.onSurfaceMuted,
                      fontFamily: fontBody,
                    },
                  ]}
                >
                  Create account
                </Text>
              </Pressable>
            </View>

            {mode === 'signup' ? (
              <Field
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                autoComplete="name"
              />
            ) : null}

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
              secureTextEntry
              autoComplete={mode === 'signup' ? 'new-password' : 'password'}
            />

            {error ? (
              <Text style={[styles.error, { color: ACCENT, fontFamily: fontBody }]}>
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: ACCENT,
                  opacity: busy ? 0.7 : pressed ? 0.9 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={[styles.primaryLabel, { color: '#FFFFFF', fontFamily: fontBody }]}
                >
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={continueAsGuest}
              disabled={busy}
              style={({ pressed }) => [
                styles.ghostBtn,
                {
                  borderColor: c.border,
                  opacity: busy ? 0.45 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.ghostLabel, { color: c.onSurface, fontFamily: fontBody }]}>
                Continue without signing in
              </Text>
            </Pressable>

            <Text style={[styles.footnote, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
              Accounts stay on this device for now. You can keep using Pomodoro without signing in.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  ...props
}: {
  label: string;
} & React.ComponentProps<typeof TextInput>) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: c.onSurface, fontFamily: fontBody }]}>
        {label}
      </Text>
      <TextInput
        {...props}
        placeholderTextColor={c.onSurfaceMuted}
        style={[
          styles.input,
          {
            color: c.onSurface,
            borderColor: c.border,
            backgroundColor: c.background,
            fontFamily: fontBody,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(20, 16, 24, 0.55)',
  },
  sheetWrap: {
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
      } as object,
      default: {
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  cardBody: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    gap: 12,
  },
  brand: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: -1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: 2,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 12 : 14,
    fontSize: 15,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    marginTop: 4,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryLabel: { fontSize: 15, fontWeight: '700' },
  ghostBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ghostLabel: { fontSize: 14, fontWeight: '700' },
  footnote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 2,
  },
});
