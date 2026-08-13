import { Platform } from 'react-native';
import type { SupportedStorage } from '@supabase/supabase-js';

const memory = new Map<string, string>();

const memoryStorage: SupportedStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

function localStorageSafe(): SupportedStorage {
  return {
    getItem: (key) => {
      if (typeof window === 'undefined') return null;
      try {
        return window.localStorage.getItem(key);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    setItem: (key, value) => {
      if (typeof window === 'undefined') {
        memory.set(key, value);
        return;
      }
      try {
        window.localStorage.setItem(key, value);
      } catch {
        memory.set(key, value);
      }
    },
    removeItem: (key) => {
      if (typeof window === 'undefined') {
        memory.delete(key);
        return;
      }
      try {
        window.localStorage.removeItem(key);
      } catch {
        memory.delete(key);
      }
    },
  };
}

/**
 * Auth storage that never touches `window` during Expo web SSR.
 * Web (browser): localStorage · Native: AsyncStorage · SSR: memory
 */
export function createAuthStorage(): SupportedStorage {
  // SSR / Node (expo-router static render)
  if (typeof window === 'undefined') {
    return memoryStorage;
  }

  if (Platform.OS === 'web') {
    return localStorageSafe();
  }

  // Lazy-require so SSR never loads the AsyncStorage web impl
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  return AsyncStorage as SupportedStorage;
}
