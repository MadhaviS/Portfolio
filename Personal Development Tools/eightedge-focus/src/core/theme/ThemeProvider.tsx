import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import {
  darkTheme,
  lightTheme,
  type AppTheme,
  type ThemeMode,
} from './tokens';

const STORAGE_KEY = 'eightedge.theme.mode';

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  theme: AppTheme;
  setMode: (mode: ThemeMode) => void;
  toggleLightDark: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredMode(): ThemeMode | null {
  if (
    Platform.OS !== 'web' ||
    typeof globalThis === 'undefined' ||
    typeof globalThis.localStorage === 'undefined'
  ) {
    return null;
  }
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // ignore
  }
  return null;
}

function writeStoredMode(mode: ThemeMode): void {
  if (
    Platform.OS !== 'web' ||
    typeof globalThis === 'undefined' ||
    typeof globalThis.localStorage === 'undefined'
  ) {
    return;
  }
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

function applyWebPageBackground(background: string, text: string, resolved: 'light' | 'dark') {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.documentElement.style.backgroundColor = background;
  document.body.style.backgroundColor = background;
  document.body.style.color = text;

  const roots = document.querySelectorAll<HTMLElement>(
    '#root, #root > div, [data-testid="root"], body > div',
  );
  roots.forEach((el) => {
    el.style.backgroundColor = background;
    el.style.minHeight = '100%';
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(
    () => readStoredMode() ?? 'light',
  );

  const resolved: 'light' | 'dark' =
    mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;

  const theme = resolved === 'dark' ? darkTheme : lightTheme;

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    writeStoredMode(next);
  }, []);

  const toggleLightDark = useCallback(() => {
    setModeState((current) => {
      const currentResolved =
        current === 'system'
          ? system === 'dark'
            ? 'dark'
            : 'light'
          : current;
      const next = currentResolved === 'dark' ? 'light' : 'dark';
      writeStoredMode(next);
      return next;
    });
  }, [system]);

  useEffect(() => {
    applyWebPageBackground(
      theme.colors.background,
      theme.colors.text,
      resolved,
    );
    void SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [resolved, theme.colors.background, theme.colors.text]);

  const value = useMemo(
    () => ({ mode, resolved, theme, setMode, toggleLightDark }),
    [mode, resolved, theme, setMode, toggleLightDark],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
