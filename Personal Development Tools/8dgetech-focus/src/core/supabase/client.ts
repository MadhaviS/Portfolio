import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { createAuthStorage } from './authStorage';

function normalizeSupabaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '')
    .replace(/\/auth\/v1$/i, '');
}

const url = normalizeSupabaseUrl(
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
    (Constants.expoConfig?.extra as { supabaseUrl?: string } | undefined)
      ?.supabaseUrl ??
    '',
);
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra as { supabaseAnonKey?: string } | undefined)
    ?.supabaseAnonKey ??
  '';

const configured =
  !!url &&
  !!anonKey &&
  !url.includes('YOUR_PROJECT') &&
  !anonKey.includes('YOUR_ANON');

export function isSupabaseConfigured(): boolean {
  return configured;
}

let client: SupabaseClient | null = null;

/** Free-tier Supabase client. Returns null when env is not set (local-only mode). */
export function getSupabase(): SupabaseClient | null {
  if (!configured) return null;
  if (client) return client;
  client = createClient(url, anonKey, {
    auth: {
      storage: createAuthStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web' && typeof window !== 'undefined',
      flowType: 'pkce',
    },
  });
  return client;
}

export function authRedirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/sign-in`;
  }
  return '8dgetech-focus://sign-in';
}
