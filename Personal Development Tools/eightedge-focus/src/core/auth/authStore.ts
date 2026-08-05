import { storageGet, storageRemove, storageSet } from '../storage/webStorage';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type AuthState = {
  user: AuthUser | null;
  isGuest: boolean;
  isAuthenticated: boolean;
  ready: boolean;
};

type StoredAccount = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
};

const SESSION_KEY = 'eightedge.auth.session';
const ACCOUNTS_KEY = 'eightedge.auth.accounts';

const GUEST: AuthUser = {
  id: 'local-guest',
  email: 'guest@local',
  displayName: 'Guest',
};

type Listener = () => void;

let currentUser: AuthUser | null = null;
let ready = false;
const listeners = new Set<Listener>();

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

async function hashPassword(password: string): Promise<string> {
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
  // Fallback (non-web runtimes without SubtleCrypto)
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

function getState(): AuthState {
  return {
    user: currentUser,
    isGuest: !!currentUser && currentUser.id === 'local-guest',
    isAuthenticated: !!currentUser,
    ready,
  };
}

export const authStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getState,

  getUserId(): string {
    return currentUser?.id ?? 'local-guest';
  },

  hydrate() {
    if (ready) return getState();
    currentUser = readSession() ?? GUEST;
    ready = true;
    emit();
    return getState();
  },

  async signIn(email: string, password: string): Promise<AuthUser> {
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
    if (hash !== found.passwordHash) {
      throw new Error('Incorrect password.');
    }

    currentUser = {
      id: found.id,
      email: found.email,
      displayName: found.displayName,
    };
    writeSession(currentUser);
    emit();
    return currentUser;
  },

  async signUp(email: string, password: string, displayName?: string): Promise<AuthUser> {
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
    };

    accounts.push({
      ...user,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    });
    writeAccounts(accounts);

    currentUser = user;
    writeSession(currentUser);
    emit();
    return currentUser;
  },

  async signInAsGuest(): Promise<AuthUser> {
    currentUser = GUEST;
    writeSession(currentUser);
    emit();
    return GUEST;
  },

  async signOut(): Promise<void> {
    currentUser = null;
    writeSession(null);
    emit();
  },
};

/** Back-compat for repositories */
export const authStub = {
  getState: () => authStore.getState(),
  getUserId: () => authStore.getUserId(),
  signInAsGuest: () => authStore.signInAsGuest(),
};
