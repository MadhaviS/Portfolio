import type {
  PomodoroSession,
  PomodoroSettings,
  PomodoroTask,
} from '../../features/pomodoro/domain/types';
import { normalizeSettings } from '../../features/pomodoro/domain/types';
import { getSupabase, isSupabaseConfigured } from './client';

export type CloudWorkspace = {
  settings: PomodoroSettings;
  tasks: PomodoroTask[];
  sessions: PomodoroSession[];
  activeTaskId: string | null;
};

function taskToRow(t: PomodoroTask) {
  return {
    id: t.id,
    user_id: t.userId,
    title: t.title,
    note: t.note,
    estimate_pomodoros: t.estimatePomodoros,
    completed_pomodoros: t.completedPomodoros,
    done: t.done,
    created_at: t.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function rowToTask(r: Record<string, unknown>): PomodoroTask {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    title: String(r.title ?? 'New task'),
    note: String(r.note ?? ''),
    estimatePomodoros: Math.max(1, Number(r.estimate_pomodoros) || 1),
    completedPomodoros: Math.max(0, Number(r.completed_pomodoros) || 0),
    done: !!r.done,
    createdAt: String(r.created_at ?? new Date().toISOString()),
  };
}

function sessionToRow(s: PomodoroSession) {
  return {
    id: s.id,
    user_id: s.userId,
    phase: s.phase,
    planned_seconds: s.plannedSeconds,
    started_at: s.startedAt,
    ended_at: s.endedAt,
    completed: s.completed,
    task_id: s.taskId,
  };
}

function rowToSession(r: Record<string, unknown>): PomodoroSession {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    phase: (r.phase as PomodoroSession['phase']) ?? 'focus',
    plannedSeconds: Number(r.planned_seconds) || 0,
    startedAt: String(r.started_at),
    endedAt: r.ended_at ? String(r.ended_at) : null,
    completed: !!r.completed,
    taskId: r.task_id ? String(r.task_id) : null,
  };
}

function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of remote) map.set(item.id, item);
  for (const item of local) map.set(item.id, item);
  return [...map.values()];
}

/** Pull cloud workspace and merge with local (local wins on id conflict). */
export async function pullAndMergeWorkspace(
  userId: string,
  local: CloudWorkspace,
): Promise<CloudWorkspace> {
  const sb = getSupabase();
  if (!sb || !isSupabaseConfigured() || userId === 'local-guest') {
    return local;
  }

  const [settingsRes, tasksRes, sessionsRes] = await Promise.all([
    sb.from('pomodoro_settings').select('payload').eq('user_id', userId).maybeSingle(),
    sb.from('pomodoro_tasks').select('*').eq('user_id', userId),
    sb
      .from('pomodoro_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(200),
  ]);

  if (settingsRes.error || tasksRes.error || sessionsRes.error) {
    console.warn(
      '[sync] pull failed',
      settingsRes.error?.message ?? tasksRes.error?.message ?? sessionsRes.error?.message,
    );
    return local;
  }

  const remoteSettings = settingsRes.data?.payload
    ? normalizeSettings(settingsRes.data.payload as PomodoroSettings)
    : null;
  const remoteTasks = (tasksRes.data ?? []).map((r) =>
    rowToTask(r as Record<string, unknown>),
  );
  const remoteSessions = (sessionsRes.data ?? []).map((r) =>
    rowToSession(r as Record<string, unknown>),
  );

  const settings = local.settings ?? remoteSettings!;
  const mergedSettings = remoteSettings
    ? normalizeSettings({ ...remoteSettings, ...local.settings })
    : local.settings;

  const activeFromSettings =
    (settingsRes.data?.payload as { activeTaskId?: string | null } | undefined)
      ?.activeTaskId ?? null;

  return {
    settings: mergedSettings,
    tasks: mergeById(local.tasks, remoteTasks).map((t) => ({ ...t, userId })),
    sessions: mergeById(local.sessions, remoteSessions)
      .map((s) => ({ ...s, userId }))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 200),
    activeTaskId: local.activeTaskId ?? activeFromSettings,
  };
}

/** Upsert current workspace to Supabase (free tier). */
export async function pushWorkspace(
  userId: string,
  workspace: CloudWorkspace,
): Promise<void> {
  const sb = getSupabase();
  if (!sb || !isSupabaseConfigured() || userId === 'local-guest') return;

  const payload = {
    ...workspace.settings,
    activeTaskId: workspace.activeTaskId,
  };

  const { error: settingsErr } = await sb.from('pomodoro_settings').upsert({
    user_id: userId,
    payload,
    updated_at: new Date().toISOString(),
  });
  if (settingsErr) {
    console.warn('[sync] settings push', settingsErr.message);
  }

  if (workspace.tasks.length) {
    const { error } = await sb
      .from('pomodoro_tasks')
      .upsert(workspace.tasks.map(taskToRow), { onConflict: 'id' });
    if (error) console.warn('[sync] tasks push', error.message);
  }

  if (workspace.sessions.length) {
    const { error } = await sb
      .from('pomodoro_sessions')
      .upsert(workspace.sessions.map(sessionToRow), { onConflict: 'id' });
    if (error) console.warn('[sync] sessions push', error.message);
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePushWorkspace(
  userId: string,
  getWorkspace: () => CloudWorkspace,
): void {
  if (!isSupabaseConfigured() || userId === 'local-guest') return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushWorkspace(userId, getWorkspace());
  }, 1200);
}
