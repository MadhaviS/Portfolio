/**
 * Re-export auth store API used by data layer.
 * Prefer `useAuth()` in UI components.
 */
export { authStub, authStore } from './authStore';
export type { AuthUser, AuthState } from './authStore';
