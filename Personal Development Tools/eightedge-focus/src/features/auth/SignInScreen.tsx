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
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SoftDoodles } from '../../core/theme/SoftDoodles';
import { useTheme } from '../../core/theme/ThemeProvider';
import { useAuth } from '../../core/auth/AuthProvider';

const fontDisplay = Platform.select({
  web: 'Fraunces, Georgia, serif',
  default: 'serif',
});
const fontBody = Platform.select({
  web: 'Outfit, system-ui, sans-serif',
  default: 'System',
});

type Mode = 'signin' | 'signup';

export function SignInScreen() {
  const { theme, resolved } = useTheme();
  const c = theme.colors;
  const isLight = resolved === 'light';
  const router = useRouter();
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

  if (ready && isAuthenticated && !isGuest) {
    return <Redirect href="/pomodoro" />;
  }

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password, name || undefined);
      }
      router.replace('/pomodoro');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const backToTimer = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!isAuthenticated) await signInAsGuest();
      router.replace('/pomodoro');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open timer.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <SoftDoodles density={1} accent={isLight ? '#C9A39A' : '#5A4040'} />

          <Text style={[styles.brand, { color: c.onSurface, fontFamily: fontDisplay }]}>
            8dgeTech
          </Text>
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
                mode === 'signin' && {
                  backgroundColor: isLight ? '#F0D6C8' : c.backgroundAlt,
                  borderColor: c.primary,
                },
              ]}
            >
              <Text style={[styles.tabText, { color: c.onSurface, fontFamily: fontBody }]}>
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
                mode === 'signup' && {
                  backgroundColor: isLight ? '#F0D6C8' : c.backgroundAlt,
                  borderColor: c.primary,
                },
              ]}
            >
              <Text style={[styles.tabText, { color: c.onSurface, fontFamily: fontBody }]}>
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
            <Text style={[styles.error, { color: c.danger, fontFamily: fontBody }]}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={busy}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: isLight ? '#F0D6C8' : c.primary,
                borderColor: c.primary,
                opacity: busy ? 0.7 : pressed ? 0.9 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={c.primaryText} />
            ) : (
              <Text
                style={[styles.primaryLabel, { color: c.primaryText, fontFamily: fontBody }]}
              >
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={backToTimer}
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
              Back to timer
            </Text>
          </Pressable>

          <Text style={[styles.footnote, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
            Accounts stay on this device for now. You can keep using Pomodoro without signing in.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 40,
  },
  card: {
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
    gap: 12,
    overflow: 'hidden',
  },
  brand: {
    fontSize: 16,
    fontWeight: '700',
    zIndex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    zIndex: 1,
  },
  sub: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: 4,
    zIndex: 1,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    zIndex: 1,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  field: { gap: 6, zIndex: 1 },
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
    zIndex: 1,
  },
  primaryBtn: {
    marginTop: 4,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    zIndex: 1,
  },
  primaryLabel: { fontSize: 15, fontWeight: '700' },
  ghostBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    zIndex: 1,
  },
  ghostLabel: { fontSize: 14, fontWeight: '700' },
  footnote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
    zIndex: 1,
  },
});
