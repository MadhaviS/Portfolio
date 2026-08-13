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

const ACCENT = PHASE_THEME.focus.bg;

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

export function SignInScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { height } = useWindowDimensions();
  const {
    ready,
    isAuthenticated,
    isGuest,
    cloudEnabled,
    passwordRecovery,
    user,
    updateDisplayName,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    clearPasswordRecovery,
    signInAsGuest,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Sign in';
    }
  }, []);

  useEffect(() => {
    if (passwordRecovery) {
      setMode('reset');
      setError(null);
      setInfo('Choose a new password for your account.');
      setPassword('');
      setConfirmPassword('');
    }
  }, [passwordRecovery]);

  const close = () => {
    if (passwordRecovery) clearPasswordRecovery();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/pomodoro');
  };

  if (ready && isAuthenticated && !isGuest && mode !== 'reset') {
    return <Redirect href="/pomodoro" />;
  }

  const afterAccount = async (accountId: string, displayName?: string) => {
    if (displayName?.trim()) {
      await updateDisplayName(displayName.trim());
    }
    pomodoroRepository.switchUser(accountId);
    router.replace('/pomodoro');
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword('');
    setConfirmPassword('');
  };

  const submitSignIn = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const account = await signIn(email, password);
      await afterAccount(account.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const submitSignUp = async () => {
    setError(null);
    setInfo(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const result = await signUp(email, password, name || undefined);
      if (result.needsEmailConfirmation) {
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
        setInfo(
          'Account created. Check your email to confirm, then sign in with your password.',
        );
        return;
      }
      if (result.user) {
        await afterAccount(result.user.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setInfo('If that email exists, we sent a reset link. Open it to set a new password.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send reset email.');
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    setError(null);
    setInfo(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      if (user?.id) {
        pomodoroRepository.switchUser(user.id);
      }
      router.replace('/pomodoro');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update password.');
    } finally {
      setBusy(false);
    }
  };

  const continueAsGuest = async () => {
    setError(null);
    setBusy(true);
    try {
      if (passwordRecovery) clearPasswordRecovery();
      if (!isAuthenticated) await signInAsGuest();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not continue.');
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === 'signin'
      ? 'Welcome back'
      : mode === 'signup'
        ? 'Create your account'
        : mode === 'forgot'
          ? 'Reset password'
          : 'Set new password';

  const subtitle =
    mode === 'signin'
      ? 'Sign in with your email and password.'
      : mode === 'signup'
        ? 'Register with email and choose a password you will use to sign in.'
        : mode === 'forgot'
          ? cloudEnabled
            ? 'We will email you a link to choose a new password.'
            : 'Password reset needs Supabase cloud auth configured.'
          : 'Enter and confirm your new password.';

  const primaryLabel =
    mode === 'signin'
      ? 'Sign in'
      : mode === 'signup'
        ? 'Create account'
        : mode === 'forgot'
          ? 'Send reset link'
          : 'Save new password';

  const onPrimary =
    mode === 'signin'
      ? submitSignIn
      : mode === 'signup'
        ? submitSignUp
        : mode === 'forgot'
          ? submitForgot
          : submitReset;

  return (
    <View style={styles.overlay}>
      <Pressable
        style={styles.backdrop}
        onPress={busy || mode === 'reset' ? undefined : close}
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
              maxHeight: Math.min(height * 0.9, 680),
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.brand, { color: ACCENT, fontFamily: fontDisplay }]}>
              8dgeTech
            </Text>
            {mode !== 'reset' ? (
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
            ) : (
              <View style={{ width: 34 }} />
            )}
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.cardBody}
          >
            <Text style={[styles.title, { color: c.onSurface, fontFamily: fontDisplay }]}>
              {title}
            </Text>
            <Text style={[styles.sub, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
              {subtitle}
            </Text>

            {mode === 'signin' || mode === 'signup' ? (
              <View style={styles.tabs}>
                <Pressable
                  onPress={() => switchMode('signin')}
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
                  onPress={() => switchMode('signup')}
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
            ) : null}

            {mode === 'signup' ? (
              <Field
                label="Name (optional)"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                autoComplete="name"
              />
            ) : null}

            {mode !== 'reset' ? (
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            ) : null}

            {mode === 'signin' || mode === 'signup' || mode === 'reset' ? (
              <Field
                label={mode === 'reset' ? 'New password' : 'Password'}
                value={password}
                onChangeText={setPassword}
                placeholder={
                  mode === 'signin' ? 'Your password' : 'At least 6 characters'
                }
                secureTextEntry
                autoComplete={mode === 'signin' ? 'password' : 'new-password'}
              />
            ) : null}

            {mode === 'signup' || mode === 'reset' ? (
              <Field
                label="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter password"
                secureTextEntry
                autoComplete="new-password"
              />
            ) : null}

            {mode === 'signin' && cloudEnabled ? (
              <Pressable
                onPress={() => switchMode('forgot')}
                disabled={busy}
                hitSlop={6}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, alignSelf: 'flex-start' })}
              >
                <Text
                  style={[styles.link, { color: ACCENT, fontFamily: fontBody }]}
                >
                  Forgot password?
                </Text>
              </Pressable>
            ) : null}

            {info ? (
              <Text style={[styles.info, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
                {info}
              </Text>
            ) : null}

            {error ? (
              <Text style={[styles.error, { color: ACCENT, fontFamily: fontBody }]}>
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={onPrimary}
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
                  {primaryLabel}
                </Text>
              )}
            </Pressable>

            {mode === 'forgot' || mode === 'reset' ? (
              <Pressable
                onPress={() => {
                  if (mode === 'reset') clearPasswordRecovery();
                  switchMode('signin');
                }}
                disabled={busy}
                style={({ pressed }) => [
                  styles.ghostBtn,
                  {
                    borderColor: c.border,
                    opacity: busy ? 0.45 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.ghostLabel, { color: c.onSurface, fontFamily: fontBody }]}
                >
                  Back to sign in
                </Text>
              </Pressable>
            ) : null}

            {mode !== 'reset' ? (
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
                <Text
                  style={[styles.ghostLabel, { color: c.onSurface, fontFamily: fontBody }]}
                >
                  Continue without signing in
                </Text>
              </Pressable>
            ) : null}

            <Text style={[styles.footnote, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
              {cloudEnabled
                ? 'Accounts sync to Supabase. Add your site URL under Authentication → URL Configuration so confirm & reset emails work.'
                : 'Local device account only. Add Supabase keys in .env for cloud sync and password-reset emails.'}
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
            opacity: props.editable === false ? 0.7 : 1,
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
  link: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: -2,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  info: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
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
