import { Platform } from 'react-native';

const memory = new Map<string, string>();

export function canUseWebStorage(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof globalThis !== 'undefined' &&
    typeof globalThis.localStorage !== 'undefined'
  );
}

export function storageGet(key: string): string | null {
  if (canUseWebStorage()) {
    try {
      return globalThis.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  }
  return memory.get(key) ?? null;
}

export function storageSet(key: string, value: string): void {
  memory.set(key, value);
  if (!canUseWebStorage()) return;
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // keep memory only
  }
}

export function storageRemove(key: string): void {
  memory.delete(key);
  if (!canUseWebStorage()) return;
  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function storageGetBool(key: string, fallback = false): boolean {
  const raw = storageGet(key);
  if (raw == null) return fallback;
  return raw === '1' || raw === 'true';
}

export function storageSetBool(key: string, value: boolean): void {
  storageSet(key, value ? '1' : '0');
}
