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

type LocalMode = 'signin' | 'signup';
type CloudStep = 'email' | 'otp';

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
    requestEmailOtp,
    verifyEmailOtp,
    updateDisplayName,
    signIn,
    signUp,
    signInAsGuest,
  } = useAuth();

  const [localMode, setLocalMode] = useState<LocalMode>('signin');
  const [cloudStep, setCloudStep] = useState<CloudStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
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

  const afterAccount = async (accountId: string, displayName?: string) => {
    if (displayName?.trim()) {
      await updateDisplayName(displayName.trim());
    }
    pomodoroRepository.switchUser(accountId);
    router.replace('/pomodoro');
  };

  const sendOtp = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await requestEmailOtp(email);
      setCloudStep('otp');
      setInfo('Check your email for a 6-digit code (free Supabase mail).');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send code.');
    } finally {
      setBusy(false);
    }
  };

  const confirmOtp = async () => {
    setError(null);
    setBusy(true);
    try {
      const account = await verifyEmailOtp(email, otp);
      await afterAccount(account.id, name || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid code.');
    } finally {
      setBusy(false);
    }
  };

  const submitLocal = async () => {
    setError(null);
    setBusy(true);
    try {
      const account =
        localMode === 'signin'
          ? await signIn(email, password)
          : await signUp(email, password, name || undefined);
      await afterAccount(account.id);
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
              {cloudEnabled
                ? cloudStep === 'email'
                  ? 'Sign in with email'
                  : 'Enter verification code'
                : localMode === 'signin'
                  ? 'Welcome back'
                  : 'Create your account'}
            </Text>
            <Text style={[styles.sub, { color: c.onSurfaceMuted, fontFamily: fontBody }]}>
              {cloudEnabled
                ? 'Free verified email login. No password. Phone OTP comes later (SMS costs money).'
                : 'Cloud auth not configured yet — local device account. Add Supabase keys to .env for free email OTP.'}
            </Text>

            {!cloudEnabled ? (
              <View style={styles.tabs}>
                <Pressable
                  onPress={() => {
                    setLocalMode('signin');
                    setError(null);
                  }}
                  style={[
                    styles.tab,
                    {
                      borderColor: localMode === 'signin' ? ACCENT : c.border,
                      backgroundColor: localMode === 'signin' ? ACCENT : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: localMode === 'signin' ? '#FFFFFF' : c.onSurfaceMuted,
                        fontFamily: fontBody,
                      },
                    ]}
                  >
                    Sign in
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setLocalMode('signup');
                    setError(null);
                  }}
                  style={[
                    styles.tab,
                    {
                      borderColor: localMode === 'signup' ? ACCENT : c.border,
                      backgroundColor: localMode === 'signup' ? ACCENT : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: localMode === 'signup' ? '#FFFFFF' : c.onSurfaceMuted,
                        fontFamily: fontBody,
                      },
                    ]}
                  >
                    Create account
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {(!cloudEnabled && localMode === 'signup') ||
            (cloudEnabled && cloudStep === 'email') ? (
              <Field
                label="Name (optional)"
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
              editable={!(cloudEnabled && cloudStep === 'otp')}
            />

            {cloudEnabled && cloudStep === 'otp' ? (
              <Field
                label="6-digit code"
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
              />
            ) : null}

            {!cloudEnabled ? (
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder={
                  localMode === 'signup' ? 'At least 6 characters' : 'Your password'
                }
                secureTextEntry
                autoComplete={localMode === 'signup' ? 'new-password' : 'password'}
              />
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
              onPress={
                cloudEnabled
                  ? cloudStep === 'email'
                    ? sendOtp
                    : confirmOtp
                  : submitLocal
              }
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
                  {cloudEnabled
                    ? cloudStep === 'email'
                      ? 'Send code'
                      : 'Verify & continue'
                    : localMode === 'signin'
                      ? 'Sign in'
                      : 'Create account'}
                </Text>
              )}
            </Pressable>

            {cloudEnabled && cloudStep === 'otp' ? (
              <Pressable
                onPress={() => {
                  setCloudStep('email');
                  setOtp('');
                  setInfo(null);
                  setError(null);
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
                  Use a different email
                </Text>
              </Pressable>
            ) : null}

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
              {cloudEnabled
                ? 'Verified accounts sync tasks & sessions to free Supabase. Admin: set role=admin in profiles table.'
                : 'Copy .env.example → .env, create a free Supabase project, run supabase/schema.sql, restart Expo.'}
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
