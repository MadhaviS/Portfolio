import { storageGet, storageRemove, storageSet } from '../storage/webStorage';
import {
  authRedirectTo,
  getSupabase,
  isSupabaseConfigured,
} from '../supabase/client';
import { fetchIsAdmin } from '../../features/admin/adminApi';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  /** True when using free Supabase email OTP (verified). */
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
  sb.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      if (currentUser?.provider === 'supabase') {
        applyUser(GUEST);
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

  /** Free: send email OTP (creates user if new). */
  async requestEmailOtp(email: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      throw new Error(
        'Cloud auth is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env',
      );
    }
    const normalized = normalizeEmail(email);
    if (!normalized.includes('@')) {
      throw new Error('Enter a valid email address.');
    }
    const { error } = await sb.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: authRedirectTo(),
      },
    });
    if (error) throw new Error(error.message);
  },

  /** Free: verify 6-digit code from email. */
  async verifyEmailOtp(email: string, token: string): Promise<AuthUser> {
    const sb = getSupabase();
    if (!sb) {
      throw new Error('Cloud auth is not configured.');
    }
    const normalized = normalizeEmail(email);
    const code = token.trim();
    if (code.length < 6) {
      throw new Error('Enter the 6-digit code from your email.');
    }
    const { data, error } = await sb.auth.verifyOtp({
      email: normalized,
      token: code,
      type: 'email',
    });
    if (error) throw new Error(error.message);
    const u = data.user ?? data.session?.user;
    if (!u) throw new Error('Verification failed. Try again.');
    const user = userFromSupabase(
      u.id,
      u.email,
      u.user_metadata as Record<string, unknown>,
      !!u.email_confirmed_at,
    );
    applyUser(user);
    return user;
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

  /** Local-only fallback when Supabase env is missing. */
  async signIn(email: string, password: string): Promise<AuthUser> {
    if (isSupabaseConfigured()) {
      throw new Error('Use the email code sign-in (OTP) instead of a password.');
    }
    const normalized = normalizeEmail(email);
    if (!normalized || !password) {
      throw new Error('Email and password are required.');
    }
    if (!normalized.includes('@')) {
      throw new Error('Enter a valid email address.');
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

  async signUp(email: string, password: string, displayName?: string): Promise<AuthUser> {
    if (isSupabaseConfigured()) {
      throw new Error('Use the email code sign-in (OTP) to create an account.');
    }
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

    const accounts = readAccounts();
    if (accounts.some((a) => a.email === normalized)) {
      throw new Error('An account with that email already exists. Sign in instead.');
    }

    const user: AuthUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      email: normalized,
      displayName: (displayName || displayNameFromEmail(normalized)).trim(),
      provider: 'local',
    };

    accounts.push({
      ...user,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    });
    writeAccounts(accounts);
    applyUser(user);
    return user;
  },

  async signInAsGuest(): Promise<AuthUser> {
    const sb = getSupabase();
    if (sb && currentUser?.provider === 'supabase') {
      await sb.auth.signOut();
    }
    applyUser(GUEST);
    return GUEST;
  },

  async signOut(): Promise<void> {
    const sb = getSupabase();
    if (sb) {
      await sb.auth.signOut();
    }
    applyUser(null);
  },
};

export const authStub = {
  getState: () => authStore.getState(),
  getUserId: () => authStore.getUserId(),
  signInAsGuest: () => authStore.signInAsGuest(),
};
