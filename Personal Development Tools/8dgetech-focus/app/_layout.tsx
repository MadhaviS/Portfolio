import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../src/core/theme/ThemeProvider';
import { DoodleBackground } from '../src/core/theme/DoodleBackground';
import { AuthProvider, useAuth } from '../src/core/auth/AuthProvider';

/** Soft gate: app is usable without login; only bounce signed-in users off /sign-in. */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { ready, isAuthenticated, isGuest } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
    if (!ready) return;
    const onAuth = segments[0] === 'sign-in';
    if (isAuthenticated && !isGuest && onAuth) {
      router.replace('/pomodoro');
    }
  }, [ready, isAuthenticated, isGuest, segments, router]);

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
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: 'transparent' },
            headerTintColor: theme.colors.onSurface,
            headerTitleStyle: { color: theme.colors.onSurface },
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
              title: 'Pomodoro',
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
      </AuthBootstrap>
    </DoodleBackground>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
