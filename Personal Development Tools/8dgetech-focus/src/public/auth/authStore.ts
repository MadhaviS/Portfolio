import { storageGet, storageRemove, storageSet } from '../storage/webStorage';
import {
  authRedirectTo,
  getSupabase,
  isSupabaseConfigured,
} from '../supabase/client';
import { fetchIsAdmin } from '../../shell/admin/adminApi';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  emailVerified?: boolean;
  provider?: 'local' | 'supabase';
};

export type AuthState = {
  user: AuthUser | null;
  isGuest: boolean;
  isAuthenticated: boolean;
  ready: boolean;
  /** Free cloud auth available (env configured). */
  cloudEnabled: boolean;
  /** profiles.role === 'admin' (Supabase). */
  isAdmin: boolean;
  /** User opened a password-reset link; show set-new-password UI. */
  passwordRecovery: boolean;
};

export type SignUpResult = {
  user: AuthUser | null;
  /** True when email confirmation is required before sign-in. */
  needsEmailConfirmation: boolean;
};

type StoredAccount = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
};

const SESSION_KEY = '8dgetech.auth.session';
const ACCOUNTS_KEY = '8dgetech.auth.accounts';
const LEGACY_SESSION_KEY = 'eightedge.auth.session';
const LEGACY_ACCOUNTS_KEY = 'eightedge.auth.accounts';

const GUEST: AuthUser = {
  id: 'local-guest',
  email: 'guest@local',
  displayName: 'Guest',
  provider: 'local',
};

type Listener = () => void;

let currentUser: AuthUser | null = null;
let ready = false;
let isAdmin = false;
let passwordRecovery = false;
const listeners = new Set<Listener>();
let authListenerBound = false;

function emit() {
  listeners.forEach((l) => l());
}

function readAccounts(): StoredAccount[] {
  try {
    const raw = storageGet(ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredAccount[];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredAccount[]) {
  storageSet(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function readSession(): AuthUser | null {
  try {
    const raw = storageGet(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function writeSession(user: AuthUser | null) {
  if (!user) {
    storageRemove(SESSION_KEY);
    return;
  }
  storageSet(SESSION_KEY, JSON.stringify(user));
}

function migrateAuthKeys() {
  if (!storageGet(ACCOUNTS_KEY)) {
    const legacyAccounts = storageGet(LEGACY_ACCOUNTS_KEY);
    if (legacyAccounts) {
      storageSet(ACCOUNTS_KEY, legacyAccounts);
      storageRemove(LEGACY_ACCOUNTS_KEY);
    }
  }
  if (!storageGet(SESSION_KEY)) {
    const legacySession = storageGet(LEGACY_SESSION_KEY);
    if (legacySession) {
      storageSet(SESSION_KEY, legacySession);
      storageRemove(LEGACY_SESSION_KEY);
    }
  }
}

async function hashPassword(password: string): Promise<string> {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto?.subtle &&
    typeof TextEncoder !== 'undefined'
  ) {
    const data = new TextEncoder().encode(`8dgetech:${password}`);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 0;
  const s = `8dgetech:${password}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `fallback_${h}`;
}

async function hashPasswordLegacy(password: string): Promise<string> {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto?.subtle &&
    typeof TextEncoder !== 'undefined'
  ) {
    const data = new TextEncoder().encode(`eightedge:${password}`);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 0;
  const s = `eightedge:${password}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `fallback_${h}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'User';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function userFromSupabase(
  id: string,
  email: string | undefined,
  meta?: Record<string, unknown> | null,
  verified?: boolean,
): AuthUser {
  const em = (email ?? '').toLowerCase();
  const name =
    (typeof meta?.display_name === 'string' && meta.display_name) ||
    displayNameFromEmail(em || 'user');
  return {
    id,
    email: em,
    displayName: name,
    emailVerified: !!verified,
    provider: 'supabase',
  };
}

function getState(): AuthState {
  return {
    user: currentUser,
    isGuest: !!currentUser && currentUser.id === 'local-guest',
    isAuthenticated: !!currentUser,
    ready,
    cloudEnabled: isSupabaseConfigured(),
    isAdmin,
    passwordRecovery,
  };
}

function applyUser(user: AuthUser | null) {
  currentUser = user;
  writeSession(user);
  if (!user || user.id === 'local-guest' || user.provider !== 'supabase') {
    isAdmin = false;
  } else {
    void refreshAdminFlag(user.id);
  }
  emit();
}

async function refreshAdminFlag(userId: string) {
  const next = await fetchIsAdmin(userId);
  if (currentUser?.id !== userId) return;
  if (isAdmin !== next) {
    isAdmin = next;
    emit();
  }
}

function bindSupabaseAuthListener() {
  const sb = getSupabase();
  if (!sb || authListenerBound) return;
  authListenerBound = true;
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      passwordRecovery = true;
    }
    if (!session?.user) {
      if (currentUser?.provider === 'supabase') {
        applyUser(GUEST);
      } else {
        emit();
      }
      return;
    }
    const u = session.user;
    applyUser(
      userFromSupabase(
        u.id,
        u.email,
        u.user_metadata as Record<string, unknown>,
        !!u.email_confirmed_at,
      ),
    );
  });
}

function validateCredentials(email: string, password: string) {
  const normalized = normalizeEmail(email);
  if (!normalized || !password) {
    throw new Error('Email and password are required.');
  }
  if (!normalized.includes('@')) {
    throw new Error('Enter a valid email address.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  return normalized;
}

export const authStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getState,

  getUserId(): string {
    return currentUser?.id ?? 'local-guest';
  },

  isCloudEnabled(): boolean {
    return isSupabaseConfigured();
  },

  hydrate() {
    if (ready) return getState();
    migrateAuthKeys();
    bindSupabaseAuthListener();

    const sb = getSupabase();
    if (sb) {
      void sb.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          const u = data.session.user;
          applyUser(
            userFromSupabase(
              u.id,
              u.email,
              u.user_metadata as Record<string, unknown>,
              !!u.email_confirmed_at,
            ),
          );
        } else if (!currentUser) {
          applyUser(readSession() ?? GUEST);
        }
        ready = true;
        emit();
      });
      // Optimistic local session while network resolves
      currentUser = readSession() ?? GUEST;
      ready = true;
      emit();
      return getState();
    }

    currentUser = readSession() ?? GUEST;
    ready = true;
    emit();
    return getState();
  },

  async updateDisplayName(displayName: string): Promise<void> {
    const name = displayName.trim();
    if (!name || !currentUser || currentUser.id === 'local-guest') return;
    currentUser = { ...currentUser, displayName: name };
    writeSession(currentUser);
    emit();
    const sb = getSupabase();
    if (sb && currentUser.provider === 'supabase') {
      await sb.auth.updateUser({ data: { display_name: name } });
      await sb.from('profiles').upsert({
        id: currentUser.id,
        display_name: name,
        email: currentUser.email,
        updated_at: new Date().toISOString(),
      });
    }
  },

  async signIn(email: string, password: string): Promise<AuthUser> {
    const normalized = validateCredentials(email, password);

    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.auth.signInWithPassword({
        email: normalized,
        password,
      });
      if (error) throw new Error(error.message);
      const u = data.user ?? data.session?.user;
      if (!u) throw new Error('Sign in failed. Try again.');
      const user = userFromSupabase(
        u.id,
        u.email,
        u.user_metadata as Record<string, unknown>,
        !!u.email_confirmed_at,
      );
      passwordRecovery = false;
      applyUser(user);
      return user;
    }

    const accounts = readAccounts();
    const found = accounts.find((a) => a.email === normalized);
    if (!found) {
      throw new Error('No account found for that email. Create one instead.');
    }

    const hash = await hashPassword(password);
    const legacyHash = await hashPasswordLegacy(password);
    if (hash !== found.passwordHash && legacyHash !== found.passwordHash) {
      throw new Error('Incorrect password.');
    }

    if (found.passwordHash === legacyHash && hash !== legacyHash) {
      found.passwordHash = hash;
      writeAccounts(accounts);
    }

    const user: AuthUser = {
      id: found.id,
      email: found.email,
      displayName: found.displayName,
      provider: 'local',
    };
    applyUser(user);
    return user;
  },

  async signUp(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<SignUpResult> {
    const normalized = validateCredentials(email, password);
    const name = (displayName || displayNameFromEmail(normalized)).trim();

    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.auth.signUp({
        email: normalized,
        password,
        options: {
          emailRedirectTo: authRedirectTo(),
          data: { display_name: name },
        },
      });
      if (error) throw new Error(error.message);

      const u = data.user;
      // Email confirmation required → no session yet
      if (!data.session) {
        return { user: null, needsEmailConfirmation: true };
      }
      if (!u) throw new Error('Sign up failed. Try again.');
      const user = userFromSupabase(
        u.id,
        u.email,
        u.user_metadata as Record<string, unknown>,
        !!u.email_confirmed_at,
      );
      passwordRecovery = false;
      applyUser(user);
      return { user, needsEmailConfirmation: false };
    }

    const accounts = readAccounts();
    if (accounts.some((a) => a.email === normalized)) {
      throw new Error('An account with that email already exists. Sign in instead.');
    }

    const user: AuthUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      email: normalized,
      displayName: name,
      provider: 'local',
    };

    accounts.push({
      ...user,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    });
    writeAccounts(accounts);
    applyUser(user);
    return { user, needsEmailConfirmation: false };
  },

  async requestPasswordReset(email: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      throw new Error(
        'Password reset needs cloud auth. Add Supabase keys to .env, or create a new local account.',
      );
    }
    const normalized = normalizeEmail(email);
    if (!normalized.includes('@')) {
      throw new Error('Enter a valid email address.');
    }
    const { error } = await sb.auth.resetPasswordForEmail(normalized, {
      redirectTo: authRedirectTo(),
    });
    if (error) throw new Error(error.message);
  },

  async updatePassword(password: string): Promise<void> {
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    const sb = getSupabase();
    if (!sb) {
      throw new Error('Cloud auth is not configured.');
    }
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw new Error(error.message);
    passwordRecovery = false;
    emit();
  },

  clearPasswordRecovery() {
    if (!passwordRecovery) return;
    passwordRecovery = false;
    emit();
  },

  async signInAsGuest(): Promise<AuthUser> {
    const sb = getSupabase();
    if (sb && currentUser?.provider === 'supabase') {
      await sb.auth.signOut();
    }
    passwordRecovery = false;
    applyUser(GUEST);
    return GUEST;
  },

  async signOut(): Promise<void> {
    const sb = getSupabase();
    if (sb) {
      await sb.auth.signOut();
    }
    passwordRecovery = false;
    applyUser(null);
  },
};

export const authStub = {
  getState: () => authStore.getState(),
  getUserId: () => authStore.getUserId(),
  signInAsGuest: () => authStore.signInAsGuest(),
};
