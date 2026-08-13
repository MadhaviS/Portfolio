/**
 * Shared Focus suite platform — import from here or deep paths under `src/public/*`.
 * Do not put product-specific logic here; that belongs in `src/apps/<name>`.
 */
export { ThemeProvider, useTheme } from './theme/ThemeProvider';
export { AuthProvider, useAuth } from './auth/AuthProvider';
export { getSupabase, isSupabaseConfigured } from './supabase/client';
export * from './registry/appRegistry';
