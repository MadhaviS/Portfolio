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
} from './authStore';

type AuthContextValue = AuthState & {
  requestEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<AuthUser>;
  updateDisplayName: (name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (email: string, password: string, displayName?: string) => Promise<AuthUser>;
  signInAsGuest: () => Promise<AuthUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => authStore.hydrate());

  useEffect(() => authStore.subscribe(() => setState(authStore.getState())), []);

  const requestEmailOtp = useCallback(
    (email: string) => authStore.requestEmailOtp(email),
    [],
  );
  const verifyEmailOtp = useCallback(
    (email: string, token: string) => authStore.verifyEmailOtp(email, token),
    [],
  );
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
  const signInAsGuest = useCallback(() => authStore.signInAsGuest(), []);
  const signOut = useCallback(() => authStore.signOut(), []);

  const value = useMemo(
    () => ({
      ...state,
      requestEmailOtp,
      verifyEmailOtp,
      updateDisplayName,
      signIn,
      signUp,
      signInAsGuest,
      signOut,
    }),
    [
      state,
      requestEmailOtp,
      verifyEmailOtp,
      updateDisplayName,
      signIn,
      signUp,
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
