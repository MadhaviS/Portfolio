import { getSupabase, isSupabaseConfigured } from '../../core/supabase/client';

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

export type AdminStats = {
  userCount: number;
  sessionCount: number;
  completedFocus: number;
  taskCount: number;
};

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

export async function fetchAdminStats(): Promise<AdminStats> {
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
