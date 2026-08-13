import { getSupabase, isSupabaseConfigured } from '../../public/supabase/client';
import type { DriftCause, DriftEvent } from '../../apps/drift/domain/types';

export type AdminProfile = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: string;
  createdAt: string;
};

export type AdminSessionRow = {
  id: string;
  userId: string;
  phase: string;
  plannedSeconds: number;
  startedAt: string;
  endedAt: string | null;
  completed: boolean;
  email?: string | null;
};

export type AdminTaskRow = {
  id: string;
  userId: string;
  title: string;
  estimatePomodoros: number;
  completedPomodoros: number;
  done: boolean;
  createdAt: string;
  email?: string | null;
};

export type AdminDriftSessionRow = {
  id: string;
  userId: string;
  intention: string;
  taskId: string | null;
  startedAt: string;
  endedAt: string | null;
  driftCount: number;
  returnCount: number;
  email?: string | null;
};

export type AdminCauseRow = {
  cause: DriftCause;
  count: number;
};

export type AdminPulseStats = {
  userCount: number;
  sessionCount: number;
  completedFocus: number;
  taskCount: number;
};

export type AdminDriftStats = {
  userCount: number;
  watchCount: number;
  driftEventCount: number;
  activeWatches: number;
};

/** @deprecated use AdminPulseStats — kept for older imports */
export type AdminStats = AdminPulseStats;

export async function fetchIsAdmin(userId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !isSupabaseConfigured() || userId === 'local-guest') return false;
  const { data, error } = await sb
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[admin] role check', error.message);
    return false;
  }
  return data?.role === 'admin';
}

export async function fetchAdminStats(): Promise<AdminPulseStats> {
  return fetchAdminPulseStats();
}

export async function fetchAdminPulseStats(): Promise<AdminPulseStats> {
  const sb = getSupabase();
  if (!sb) {
    return { userCount: 0, sessionCount: 0, completedFocus: 0, taskCount: 0 };
  }

  const [users, sessions, focus, tasks] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('pomodoro_sessions').select('id', { count: 'exact', head: true }),
    sb
      .from('pomodoro_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('phase', 'focus')
      .eq('completed', true),
    sb.from('pomodoro_tasks').select('id', { count: 'exact', head: true }),
  ]);

  return {
    userCount: users.count ?? 0,
    sessionCount: sessions.count ?? 0,
    completedFocus: focus.count ?? 0,
    taskCount: tasks.count ?? 0,
  };
}

export async function fetchAdminDriftStats(): Promise<AdminDriftStats> {
  const sb = getSupabase();
  if (!sb) {
    return {
      userCount: 0,
      watchCount: 0,
      driftEventCount: 0,
      activeWatches: 0,
    };
  }

  const [users, watches, active, recent] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('drift_sessions').select('id', { count: 'exact', head: true }),
    sb
      .from('drift_sessions')
      .select('id', { count: 'exact', head: true })
      .is('ended_at', null),
    sb
      .from('drift_sessions')
      .select('events')
      .order('started_at', { ascending: false })
      .limit(500),
  ]);

  let driftEventCount = 0;
  for (const row of recent.data ?? []) {
    const events = Array.isArray(row.events) ? (row.events as DriftEvent[]) : [];
    driftEventCount += events.filter(
      (e) => e.kind === 'leave' || e.kind === 'manual',
    ).length;
  }

  return {
    userCount: users.count ?? 0,
    watchCount: watches.count ?? 0,
    driftEventCount,
    activeWatches: active.count ?? 0,
  };
}

export async function fetchAdminProfiles(): Promise<AdminProfile[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('profiles')
    .select('id, email, display_name, role, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    role: r.role,
    createdAt: r.created_at,
  }));
}

export async function fetchAdminSessions(): Promise<AdminSessionRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('pomodoro_sessions')
    .select('id, user_id, phase, planned_seconds, started_at, ended_at, completed')
    .order('started_at', { ascending: false })
    .limit(150);
  if (error) throw new Error(error.message);

  const userIds = [...new Set((data ?? []).map((r) => r.user_id))];
  const emailById = await emailsForUsers(userIds);

  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    phase: r.phase,
    plannedSeconds: r.planned_seconds,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    completed: r.completed,
    email: emailById.get(r.user_id) ?? null,
  }));
}

export async function fetchAdminTasks(): Promise<AdminTaskRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('pomodoro_tasks')
    .select(
      'id, user_id, title, estimate_pomodoros, completed_pomodoros, done, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(150);
  if (error) throw new Error(error.message);

  const userIds = [...new Set((data ?? []).map((r) => r.user_id))];
  const emailById = await emailsForUsers(userIds);

  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    estimatePomodoros: r.estimate_pomodoros,
    completedPomodoros: r.completed_pomodoros,
    done: r.done,
    createdAt: r.created_at,
    email: emailById.get(r.user_id) ?? null,
  }));
}

export async function fetchAdminDriftSessions(): Promise<AdminDriftSessionRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('drift_sessions')
    .select('id, user_id, intention, task_id, started_at, ended_at, events')
    .order('started_at', { ascending: false })
    .limit(150);
  if (error) throw new Error(error.message);

  const userIds = [...new Set((data ?? []).map((r) => r.user_id))];
  const emailById = await emailsForUsers(userIds);

  return (data ?? []).map((r) => {
    const events = Array.isArray(r.events) ? (r.events as DriftEvent[]) : [];
    return {
      id: r.id,
      userId: r.user_id,
      intention: r.intention || 'Stay with the work',
      taskId: r.task_id ?? null,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      driftCount: events.filter((e) => e.kind === 'leave' || e.kind === 'manual')
        .length,
      returnCount: events.filter((e) => e.kind === 'return').length,
      email: emailById.get(r.user_id) ?? null,
    };
  });
}

export async function fetchAdminDriftCauses(): Promise<AdminCauseRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('drift_sessions')
    .select('events')
    .order('started_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const counts: Record<DriftCause, number> = {
    tabs: 0,
    chat: 0,
    social: 0,
    email: 0,
    other: 0,
  };
  for (const row of data ?? []) {
    const events = Array.isArray(row.events) ? (row.events as DriftEvent[]) : [];
    for (const ev of events) {
      if (ev.kind !== 'manual' && ev.kind !== 'leave') continue;
      const cause = (ev.cause ?? 'other') as DriftCause;
      if (cause in counts) counts[cause] += 1;
      else counts.other += 1;
    }
  }
  return (Object.keys(counts) as DriftCause[])
    .map((cause) => ({ cause, count: counts[cause] }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

async function emailsForUsers(userIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!userIds.length) return map;
  const sb = getSupabase();
  if (!sb) return map;
  const { data } = await sb.from('profiles').select('id, email').in('id', userIds);
  for (const row of data ?? []) {
    map.set(row.id, row.email);
  }
  return map;
}
