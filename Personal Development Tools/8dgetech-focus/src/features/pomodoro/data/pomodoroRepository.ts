import { Platform } from 'react-native';
import { authStub } from '../../../core/auth/authStub';
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
const LEGACY_MIGRATED_KEY = 'eightedge.pomodoro.legacyMigrated';

type WorkspaceListener = () => void;

let settings: PomodoroSettings = { ...DEFAULT_SETTINGS };
let sessions: PomodoroSession[] = [];
let tasks: PomodoroTask[] = [];
let activeTaskId: string | null = null;
let boundUserId: string | null = null;
let hydrated = false;
const listeners = new Set<WorkspaceListener>();

function canUseWebStorage(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof globalThis !== 'undefined' &&
    typeof globalThis.localStorage !== 'undefined'
  );
}

function storageGet(key: string): string | null {
  if (!canUseWebStorage()) return null;
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  if (!canUseWebStorage()) return;
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function storageRemove(key: string): void {
  if (!canUseWebStorage()) return;
  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

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
  const base = `eightedge.pomodoro.user.${userId}`;
  return {
    settings: `${base}.settings`,
    sessions: `${base}.sessions`,
    tasks: `${base}.tasks`,
    activeTask: `${base}.activeTask`,
  };
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
  const keys = keysFor(userId);
  const storedSettings = readJson<PomodoroSettings | null>(keys.settings, null);
  settings = storedSettings
    ? { ...DEFAULT_SETTINGS, ...storedSettings }
    : { ...DEFAULT_SETTINGS };
  sessions = readJson<PomodoroSession[]>(keys.sessions, []);
  tasks = readJson<PomodoroTask[]>(keys.tasks, []);
  activeTaskId = readJson<string | null>(keys.activeTask, null);
}

/** One-time: move pre-account global keys into the guest bucket. */
function migrateLegacyIntoGuest(): void {
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

    if (userId === 'local-guest') {
      migrateLegacyIntoGuest();
    }

    boundUserId = userId;
    hydrated = true;

    if (options?.reset) {
      emptyWorkspace();
      persist();
    } else {
      loadWorkspace(userId);
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
    const userId = authStub.getUserId();
    return sessions
      .filter((s) => !s.userId || s.userId === userId)
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
    const userId = authStub.getUserId();
    return tasks
      .filter((t) => !t.userId || t.userId === userId)
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
