import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  authStore,
  type AuthState,
  type AuthUser,
  type SignUpResult,
} from './authStore';

type AuthContextValue = AuthState & {
  updateDisplayName: (name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<SignUpResult>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  clearPasswordRecovery: () => void;
  signInAsGuest: () => Promise<AuthUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => authStore.hydrate());

  useEffect(() => authStore.subscribe(() => setState(authStore.getState())), []);

  const updateDisplayName = useCallback(
    (name: string) => authStore.updateDisplayName(name),
    [],
  );
  const signIn = useCallback(
    (email: string, password: string) => authStore.signIn(email, password),
    [],
  );
  const signUp = useCallback(
    (email: string, password: string, displayName?: string) =>
      authStore.signUp(email, password, displayName),
    [],
  );
  const requestPasswordReset = useCallback(
    (email: string) => authStore.requestPasswordReset(email),
    [],
  );
  const updatePassword = useCallback(
    (password: string) => authStore.updatePassword(password),
    [],
  );
  const clearPasswordRecovery = useCallback(
    () => authStore.clearPasswordRecovery(),
    [],
  );
  const signInAsGuest = useCallback(() => authStore.signInAsGuest(), []);
  const signOut = useCallback(() => authStore.signOut(), []);

  const value = useMemo(
    () => ({
      ...state,
      updateDisplayName,
      signIn,
      signUp,
      requestPasswordReset,
      updatePassword,
      clearPasswordRecovery,
      signInAsGuest,
      signOut,
    }),
    [
      state,
      updateDisplayName,
      signIn,
      signUp,
      requestPasswordReset,
      updatePassword,
      clearPasswordRecovery,
      signInAsGuest,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
