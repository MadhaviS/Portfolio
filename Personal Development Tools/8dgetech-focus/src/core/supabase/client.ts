import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra as { supabaseUrl?: string } | undefined)?.supabaseUrl ??
  '';
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
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
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
