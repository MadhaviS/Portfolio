import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FullWindowOverlay } from 'react-native-screens';
import { ThemeProvider, useTheme } from '../src/public/theme/ThemeProvider';
import { DoodleBackground } from '../src/public/theme/DoodleBackground';
import { AuthProvider, useAuth } from '../src/public/auth/AuthProvider';
import { getSupabase } from '../src/public/supabase/client';
import {
  PipNavigationBridge,
  PomodoroProvider,
  TimerBubble,
  useShowTimerBubble,
} from '../src/apps/pulse';
import {
  DriftProvider,
  DriftBubble,
  DriftPipNavigationBridge,
  useShowDriftBubble,
} from '../src/apps/drift';
import { ensureWebFonts, fontBody } from '../src/public/theme/fonts';
// Future apps: import providers from '../src/apps/<id>' and nest below AuthProvider.

ensureWebFonts();

function BubbleOverlay() {
  const showPulse = useShowTimerBubble();
  const showDrift = useShowDriftBubble();
  if (!showPulse && !showDrift) return null;

  const bubbles = (
    <>
      {showPulse ? <TimerBubble /> : null}
      {showDrift ? <DriftBubble /> : null}
    </>
  );

  if (Platform.OS === 'ios') {
    return (
      <FullWindowOverlay>
        <GestureHandlerRootView pointerEvents="box-none" style={styles.overlay}>
          {bubbles}
        </GestureHandlerRootView>
      </FullWindowOverlay>
    );
  }
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {bubbles}
    </View>
  );
}

/** Soft gate: app is usable without login; only bounce signed-in users off /sign-in. */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { ready, isAuthenticated, isGuest, passwordRecovery } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
    if (!ready) return;
    const onAuth = segments[0] === 'sign-in';
    if (isAuthenticated && !isGuest && onAuth && !passwordRecovery) {
      router.replace('/pomodoro');
    }
  }, [ready, isAuthenticated, isGuest, passwordRecovery, segments, router]);

  // Confirm-email / password-reset deep links
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const isAuthCallback =
        url.includes('access_token') ||
        url.includes('code=') ||
        url.includes('type=recovery') ||
        url.includes('type=signup');
      if (!isAuthCallback) return;
      try {
        await sb.auth.exchangeCodeForSession(url);
      } catch {
        // Hash/token sessions are handled by detectSessionInUrl on web
      }
      if (url.includes('type=recovery') || url.includes('recovery')) {
        router.replace('/sign-in');
      }
    };

    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });
    return () => sub.remove();
  }, [router]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

function RootNavigator() {
  const { theme, resolved } = useTheme();

  return (
    <DoodleBackground>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      <AuthBootstrap>
        <GestureHandlerRootView style={styles.flex}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: 'transparent' },
              headerTintColor: theme.colors.onSurface,
              headerTitleStyle: {
                color: theme.colors.onSurface,
                fontFamily: fontBody,
              },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          >
            <Stack.Screen
              name="index"
              options={{
                title: 'Home',
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Screen
              name="home"
              options={{
                title: 'Home',
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Screen
              name="sign-in"
              options={{
                title: 'Sign in',
                headerShown: false,
                presentation: 'transparentModal',
                animation: 'fade',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Screen
              name="pomodoro"
              options={{
                title: 'Pulse',
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Screen
              name="drift"
              options={{
                title: 'Drift',
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Screen
              name="admin"
              options={{
                title: 'Admin',
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Screen
              name="pomodoro-calendar"
              options={{
                title: 'Calendar',
                headerTintColor: '#FFFFFF',
                headerStyle: { backgroundColor: '#1B2A4A' },
                headerTitleStyle: { color: '#FFFFFF' },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: theme.colors.background },
              }}
            />
          </Stack>
          <PipNavigationBridge />
          <DriftPipNavigationBridge />
          <BubbleOverlay />
        </GestureHandlerRootView>
      </AuthBootstrap>
    </DoodleBackground>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PomodoroProvider>
          <DriftProvider>
            <RootNavigator />
          </DriftProvider>
        </PomodoroProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, position: 'relative' },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
    elevation: 9999,
  },
});
