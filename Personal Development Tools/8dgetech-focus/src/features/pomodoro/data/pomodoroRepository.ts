import { authStub } from '../../../core/auth/authStub';
import {
  storageGet,
  storageRemove,
  storageSet,
} from '../../../core/storage/webStorage';
import type {
  PomodoroSession,
  PomodoroSettings,
  PomodoroStats,
  PomodoroTask,
} from '../domain/types';
import {
  DEFAULT_SETTINGS,
  computeStats,
  createId,
  buildDayLog,
  toDateKey,
} from '../domain/types';
import type { DayLog } from '../domain/types';

const LEGACY_SETTINGS_KEY = 'eightedge.pomodoro.settings';
const LEGACY_SESSIONS_KEY = 'eightedge.pomodoro.sessions';
const LEGACY_TASKS_KEY = 'eightedge.pomodoro.tasks';
const LEGACY_ACTIVE_TASK_KEY = 'eightedge.pomodoro.activeTask';
const LEGACY_MIGRATED_KEY = '8dgetech.pomodoro.legacyMigrated';
const OLD_LEGACY_MIGRATED_KEY = 'eightedge.pomodoro.legacyMigrated';

type WorkspaceListener = () => void;

let settings: PomodoroSettings = { ...DEFAULT_SETTINGS };
let sessions: PomodoroSession[] = [];
let tasks: PomodoroTask[] = [];
let activeTaskId: string | null = null;
let boundUserId: string | null = null;
let hydrated = false;
const listeners = new Set<WorkspaceListener>();

function readJson<T>(key: string, fallback: T): T {
  const raw = storageGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  storageSet(key, JSON.stringify(value));
}

function keysFor(userId: string) {
  const base = `8dgetech.pomodoro.user.${userId}`;
  return {
    settings: `${base}.settings`,
    sessions: `${base}.sessions`,
    tasks: `${base}.tasks`,
    activeTask: `${base}.activeTask`,
  };
}

function oldKeysFor(userId: string) {
  const base = `eightedge.pomodoro.user.${userId}`;
  return {
    settings: `${base}.settings`,
    sessions: `${base}.sessions`,
    tasks: `${base}.tasks`,
    activeTask: `${base}.activeTask`,
  };
}

function migrateUserKeys(userId: string): void {
  const next = keysFor(userId);
  const prev = oldKeysFor(userId);
  const fields = ['settings', 'sessions', 'tasks', 'activeTask'] as const;
  for (const field of fields) {
    if (storageGet(next[field]) == null) {
      const legacy = storageGet(prev[field]);
      if (legacy != null) {
        storageSet(next[field], legacy);
        storageRemove(prev[field]);
      }
    }
  }
}

function persist(): void {
  if (!boundUserId) return;
  const keys = keysFor(boundUserId);
  writeJson(keys.settings, settings);
  writeJson(keys.sessions, sessions);
  writeJson(keys.tasks, tasks);
  writeJson(keys.activeTask, activeTaskId);
}

function emptyWorkspace(): void {
  settings = { ...DEFAULT_SETTINGS };
  sessions = [];
  tasks = [];
  activeTaskId = null;
}

function loadWorkspace(userId: string): void {
  migrateUserKeys(userId);
  const keys = keysFor(userId);
  const storedSettings = readJson<PomodoroSettings | null>(keys.settings, null);
  settings = storedSettings
    ? { ...DEFAULT_SETTINGS, ...storedSettings }
    : { ...DEFAULT_SETTINGS };
  sessions = readJson<PomodoroSession[]>(keys.sessions, []);
  tasks = readJson<PomodoroTask[]>(keys.tasks, []);
  activeTaskId = readJson<string | null>(keys.activeTask, null);
}

function workspaceHasContent(userId: string): boolean {
  migrateUserKeys(userId);
  const keys = keysFor(userId);
  const storedSessions = readJson<PomodoroSession[]>(keys.sessions, []);
  const storedTasks = readJson<PomodoroTask[]>(keys.tasks, []);
  return storedSessions.length > 0 || storedTasks.length > 0;
}

function copyWorkspaceRaw(fromId: string, toId: string): void {
  migrateUserKeys(fromId);
  migrateUserKeys(toId);
  const from = keysFor(fromId);
  const to = keysFor(toId);
  const fields = ['settings', 'sessions', 'tasks', 'activeTask'] as const;
  for (const field of fields) {
    const raw = storageGet(from[field]);
    if (raw != null) storageSet(to[field], raw);
  }
}

/** Rewrite ownership ids after copying guest → account. */
function reassignStoredOwnership(userId: string): void {
  const keys = keysFor(userId);
  const nextSessions = readJson<PomodoroSession[]>(keys.sessions, []).map((s) => ({
    ...s,
    userId,
  }));
  const nextTasks = readJson<PomodoroTask[]>(keys.tasks, []).map((t) => ({
    ...t,
    userId,
  }));
  writeJson(keys.sessions, nextSessions);
  writeJson(keys.tasks, nextTasks);
}

function mergeById<T extends { id: string }>(primary: T[], extra: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of primary) map.set(item.id, item);
  for (const item of extra) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return Array.from(map.values());
}

/**
 * Bring guest tasks/sessions into the account so pre-login work is kept.
 * - Empty account → full copy from guest
 * - Existing account → merge guest items that aren't already present
 */
function adoptGuestWorkspaceIfNeeded(userId: string): void {
  if (!userId || userId === 'local-guest') return;
  migrateLegacyIntoGuest();
  if (!workspaceHasContent('local-guest')) return;

  const guestKeys = keysFor('local-guest');
  const userKeys = keysFor(userId);
  migrateUserKeys(userId);

  const guestSessions = readJson<PomodoroSession[]>(guestKeys.sessions, []).map(
    (s) => ({ ...s, userId }),
  );
  const guestTasks = readJson<PomodoroTask[]>(guestKeys.tasks, []).map((t) => ({
    ...t,
    userId,
  }));
  const guestSettings = readJson<PomodoroSettings | null>(guestKeys.settings, null);
  const guestActive = readJson<string | null>(guestKeys.activeTask, null);

  if (!workspaceHasContent(userId)) {
    copyWorkspaceRaw('local-guest', userId);
    reassignStoredOwnership(userId);
    return;
  }

  const userSessions = readJson<PomodoroSession[]>(userKeys.sessions, []);
  const userTasks = readJson<PomodoroTask[]>(userKeys.tasks, []);
  writeJson(userKeys.sessions, mergeById(userSessions, guestSessions));
  writeJson(userKeys.tasks, mergeById(userTasks, guestTasks));

  if (storageGet(userKeys.settings) == null && guestSettings) {
    writeJson(userKeys.settings, { ...DEFAULT_SETTINGS, ...guestSettings });
  }
  if (storageGet(userKeys.activeTask) == null && guestActive) {
    writeJson(userKeys.activeTask, guestActive);
  }
}

/** One-time: move pre-account global keys into the guest bucket. */
function migrateLegacyIntoGuest(): void {
  if (storageGet(OLD_LEGACY_MIGRATED_KEY) === '1') {
    storageSet(LEGACY_MIGRATED_KEY, '1');
    storageRemove(OLD_LEGACY_MIGRATED_KEY);
  }
  migrateUserKeys('local-guest');
  if (storageGet(LEGACY_MIGRATED_KEY) === '1') return;
  const guestKeys = keysFor('local-guest');
  const hasGuestData =
    storageGet(guestKeys.sessions) != null ||
    storageGet(guestKeys.tasks) != null ||
    storageGet(guestKeys.settings) != null;

  const legacySessions = readJson<PomodoroSession[] | null>(LEGACY_SESSIONS_KEY, null);
  const legacyTasks = readJson<PomodoroTask[] | null>(LEGACY_TASKS_KEY, null);
  const legacySettings = readJson<PomodoroSettings | null>(LEGACY_SETTINGS_KEY, null);
  const hasLegacy =
    legacySessions != null || legacyTasks != null || legacySettings != null;

  if (!hasGuestData && hasLegacy) {
    if (legacySettings) {
      writeJson(guestKeys.settings, { ...DEFAULT_SETTINGS, ...legacySettings });
    }
    if (legacySessions) writeJson(guestKeys.sessions, legacySessions);
    if (legacyTasks) writeJson(guestKeys.tasks, legacyTasks);
    const legacyActive = readJson<string | null>(LEGACY_ACTIVE_TASK_KEY, null);
    writeJson(guestKeys.activeTask, legacyActive);
  }

  storageRemove(LEGACY_SETTINGS_KEY);
  storageRemove(LEGACY_SESSIONS_KEY);
  storageRemove(LEGACY_TASKS_KEY);
  storageRemove(LEGACY_ACTIVE_TASK_KEY);
  storageSet(LEGACY_MIGRATED_KEY, '1');
}

function emit() {
  // Defer so subscribers never setState during another component's render.
  queueMicrotask(() => {
    listeners.forEach((l) => l());
  });
}

function bindSilent(userId: string): void {
  if (userId === 'local-guest') {
    migrateLegacyIntoGuest();
  } else {
    adoptGuestWorkspaceIfNeeded(userId);
  }
  boundUserId = userId;
  hydrated = true;
  loadWorkspace(userId);
}

function ensureBound(): void {
  const userId = authStub.getUserId();
  if (!hydrated || boundUserId !== userId) {
    bindSilent(userId);
  }
}

export const pomodoroRepository = {
  subscribe(listener: WorkspaceListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getBoundUserId(): string | null {
    return boundUserId;
  },

  /** Load (or reset) the workspace for a user id. */
  switchUser(userId: string, options?: { reset?: boolean }): void {
    const unchanged =
      hydrated && boundUserId === userId && !options?.reset;
    if (unchanged) return;

    // Flush the outgoing workspace so nothing is lost mid-switch.
    if (hydrated && boundUserId && boundUserId !== userId) {
      persist();
    }

    if (userId === 'local-guest') {
      migrateLegacyIntoGuest();
    }

    boundUserId = userId;
    hydrated = true;

    if (options?.reset) {
      emptyWorkspace();
      persist();
    } else {
      if (userId !== 'local-guest') {
        adoptGuestWorkspaceIfNeeded(userId);
      }
      loadWorkspace(userId);
      // Normalize ownership tags to the bound account.
      if (userId !== 'local-guest') {
        sessions = sessions.map((s) => ({ ...s, userId }));
        tasks = tasks.map((t) => ({ ...t, userId }));
        persist();
      }
    }

    emit();
  },

  /** Wipe current user's stored pomodoro data (used after logout → guest). */
  resetWorkspace(): void {
    ensureBound();
    emptyWorkspace();
    persist();
    emit();
  },

  hydrate(): void {
    ensureBound();
  },

  getSettings(): PomodoroSettings {
    ensureBound();
    return { ...settings };
  },

  saveSettings(next: PomodoroSettings): PomodoroSettings {
    ensureBound();
    settings = { ...next };
    persist();
    return this.getSettings();
  },

  listSessions(): PomodoroSession[] {
    ensureBound();
    // Workspace is already partitioned by user storage keys.
    return sessions
      .slice()
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  },

  addSession(session: PomodoroSession): PomodoroSession {
    ensureBound();
    sessions = [session, ...sessions].slice(0, 200);
    persist();
    return session;
  },

  completeSession(id: string, completed: boolean): PomodoroSession | null {
    ensureBound();
    const found = sessions.find((s) => s.id === id);
    if (!found) return null;
    found.endedAt = new Date().toISOString();
    found.completed = completed;
    persist();
    return found;
  },

  getStats(): PomodoroStats {
    return computeStats(this.listSessions());
  },

  listTasks(): PomodoroTask[] {
    ensureBound();
    // Workspace is already partitioned by user storage keys.
    return tasks
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  getActiveTaskId(): string | null {
    ensureBound();
    return activeTaskId;
  },

  setActiveTaskId(id: string | null): void {
    ensureBound();
    activeTaskId = id;
    persist();
  },

  addTask(title: string, estimatePomodoros = 1): PomodoroTask {
    ensureBound();
    const task: PomodoroTask = {
      id: createId('task'),
      userId: authStub.getUserId(),
      title: title.trim() || 'New task',
      estimatePomodoros: Math.max(1, estimatePomodoros),
      completedPomodoros: 0,
      done: false,
      createdAt: new Date().toISOString(),
    };
    tasks = [...tasks, task];
    if (!activeTaskId) activeTaskId = task.id;
    persist();
    return task;
  },

  updateTask(
    id: string,
    patch: Partial<
      Pick<
        PomodoroTask,
        'title' | 'estimatePomodoros' | 'completedPomodoros' | 'done'
      >
    >,
  ): PomodoroTask | null {
    ensureBound();
    const found = tasks.find((t) => t.id === id);
    if (!found) return null;
    Object.assign(found, patch);
    if (typeof patch.estimatePomodoros === 'number') {
      found.estimatePomodoros = Math.max(1, patch.estimatePomodoros);
    }
    persist();
    return found;
  },

  deleteTask(id: string): void {
    ensureBound();
    tasks = tasks.filter((t) => t.id !== id);
    if (activeTaskId === id) {
      activeTaskId = tasks.find((t) => !t.done)?.id ?? null;
    }
    persist();
  },

  incrementActiveTaskPomodoro(): void {
    ensureBound();
    if (!activeTaskId) return;
    const found = tasks.find((t) => t.id === activeTaskId);
    if (!found || found.done) return;
    found.completedPomodoros += 1;
    if (found.completedPomodoros >= found.estimatePomodoros) {
      found.done = true;
      activeTaskId = tasks.find((t) => !t.done)?.id ?? null;
    }
    persist();
  },

  getDayLog(dateKey: string): DayLog {
    return buildDayLog(dateKey, this.listSessions(), this.listTasks());
  },

  getActivityDateKeys(): string[] {
    const keys = new Set<string>();
    for (const s of this.listSessions()) {
      keys.add(toDateKey(s.startedAt));
    }
    for (const t of this.listTasks()) {
      keys.add(toDateKey(t.createdAt));
    }
    return [...keys].sort();
  },
};
