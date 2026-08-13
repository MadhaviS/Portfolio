import {
  storageGet,
  storageSet,
} from '../../../public/storage/webStorage';
import { authStore } from '../../../public/auth/authStore';
import { isSupabaseConfigured } from '../../../public/supabase/client';
import {
  pullAndMergeDriftSessions,
  schedulePushDriftSessions,
} from '../../../public/supabase/sync';
import { pomodoroRepository } from '../../pulse/data/pomodoroRepository';
import {
  dateKeyFromIso,
  todayKey,
  weekdayShort,
  type DriftCalendarCell,
  type DriftCause,
  type DriftCauseCount,
  type DriftDayLog,
  type DriftDaySummary,
  type DriftEvent,
  type DriftHourBucket,
  type DriftSession,
  type DriftTaskStat,
  type DriftTodayInsight,
  type DriftWeekPoint,
} from '../domain/types';

const LEGACY_SESSIONS_KEY = 'focus.drift.sessions.v1';
const MAX_SESSIONS = 120;

let boundUserId: string | null = null;
let hydrated = false;

function sessionsKey(userId: string) {
  return `focus.drift.sessions.v1.${userId}`;
}

function normalizeSession(raw: Partial<DriftSession> & { id: string }): DriftSession {
  return {
    id: raw.id,
    intention: raw.intention?.trim() || 'Stay with the work',
    taskId: raw.taskId ?? null,
    startedAt: raw.startedAt ?? new Date().toISOString(),
    endedAt: raw.endedAt ?? null,
    events: Array.isArray(raw.events) ? raw.events : [],
  };
}

function migrateLegacyIfNeeded(userId: string) {
  const key = sessionsKey(userId);
  if (storageGet(key) != null) return;
  const legacy = storageGet(LEGACY_SESSIONS_KEY);
  if (legacy == null) return;
  // Guest inherits the original unscoped bucket once.
  if (userId === 'local-guest') {
    storageSet(key, legacy);
  }
}

function readSessions(): DriftSession[] {
  ensureBound();
  const raw = storageGet(sessionsKey(boundUserId!));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DriftSession[];
    return Array.isArray(parsed) ? parsed.map(normalizeSession) : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions: DriftSession[]): void {
  ensureBound();
  const userId = boundUserId!;
  const next = sessions.slice(0, MAX_SESSIONS);
  storageSet(sessionsKey(userId), JSON.stringify(next));
  if (isSupabaseConfigured() && userId !== 'local-guest') {
    schedulePushDriftSessions(userId, () => readSessions());
  }
}

function bindSilent(userId: string): void {
  migrateLegacyIfNeeded(userId);
  boundUserId = userId;
  hydrated = true;
}

function ensureBound(): void {
  const userId = authStore.getUserId();
  if (!hydrated || boundUserId !== userId) {
    bindSilent(userId);
  }
}

function sessionDriftCount(session: DriftSession): number {
  return session.events.filter((e) => e.kind === 'leave' || e.kind === 'manual')
    .length;
}

function sessionReturnStats(session: DriftSession): {
  returns: number;
  awaySeconds: number;
} {
  let returns = 0;
  let awaySeconds = 0;
  for (const ev of session.events) {
    if (ev.kind !== 'return') continue;
    returns += 1;
    awaySeconds += ev.awaySeconds ?? 0;
  }
  return { returns, awaySeconds };
}

function hourLabel(hour: number): string {
  const n = hour % 12 || 12;
  return `${n}${hour < 12 ? 'a' : 'p'}`;
}

function emptyHour(hour: number): DriftHourBucket {
  return {
    hour,
    label: hourLabel(hour),
    drifts: 0,
    awaySeconds: 0,
    focusSeconds: 0,
  };
}

/** Watch / focus / drift timing for a session (includes open leave if still away). */
function sessionTiming(
  session: DriftSession,
  nowMs = Date.now(),
): { watched: number; drifted: number; focus: number } {
  const start = Date.parse(session.startedAt);
  if (Number.isNaN(start)) return { watched: 0, drifted: 0, focus: 0 };
  const end = session.endedAt ? Date.parse(session.endedAt) : nowMs;
  const watched = Math.max(0, Math.round((end - start) / 1000));

  let drifted = 0;
  for (const ev of session.events) {
    if (ev.kind === 'return') drifted += ev.awaySeconds ?? 0;
  }

  const leaveEvents = session.events.filter(
    (e) => e.kind === 'leave' || e.kind === 'manual',
  );
  const lastLeave = leaveEvents[leaveEvents.length - 1];
  if (lastLeave && !session.endedAt) {
    const leaveAt = Date.parse(lastLeave.at);
    const returnedAfter = session.events.some(
      (e) => e.kind === 'return' && Date.parse(e.at) >= leaveAt,
    );
    if (!returnedAfter && !Number.isNaN(leaveAt)) {
      drifted += Math.max(0, Math.round((nowMs - leaveAt) / 1000));
    }
  }

  drifted = Math.min(drifted, watched);
  const focus = Math.max(0, watched - drifted);
  return { watched, drifted, focus };
}

/** Spread seconds across local hours between [fromMs, toMs). */
function addSpanToHours(
  hours: DriftHourBucket[],
  fromMs: number,
  toMs: number,
  field: 'focusSeconds' | 'awaySeconds',
): void {
  if (!(toMs > fromMs)) return;
  let cursor = fromMs;
  while (cursor < toMs) {
    const d = new Date(cursor);
    const hourStart = new Date(d);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = hourStart.getTime() + 3600000;
    const sliceEnd = Math.min(toMs, hourEnd);
    const secs = Math.max(0, Math.round((sliceEnd - cursor) / 1000));
    const h = d.getHours();
    hours[h][field] += secs;
    cursor = sliceEnd;
  }
}

function buildTodayInsight(
  sessions: DriftSession[],
  date: string,
  nowMs = Date.now(),
): DriftTodayInsight {
  const hours = Array.from({ length: 24 }, (_, h) => emptyHour(h));
  let drifts = 0;
  let returns = 0;
  let focusSeconds = 0;
  let driftedSeconds = 0;
  let watchedSeconds = 0;

  for (const session of sessions) {
    const timing = sessionTiming(session, nowMs);
    watchedSeconds += timing.watched;
    focusSeconds += timing.focus;
    driftedSeconds += timing.drifted;

    const startMs = Date.parse(session.startedAt);
    const endMs = session.endedAt ? Date.parse(session.endedAt) : nowMs;

    // Focus spans: session wall minus leave→return gaps
    const gaps: { from: number; to: number }[] = [];
    let openLeave: number | null = null;
    for (const ev of session.events) {
      const at = Date.parse(ev.at);
      if (Number.isNaN(at)) continue;
      if (ev.kind === 'leave' || ev.kind === 'manual') {
        drifts += 1;
        hours[new Date(at).getHours()].drifts += 1;
        if (openLeave == null) openLeave = at;
      } else if (ev.kind === 'return') {
        returns += 1;
        if (openLeave != null) {
          const to = at;
          gaps.push({ from: openLeave, to });
          addSpanToHours(hours, openLeave, to, 'awaySeconds');
          openLeave = null;
        } else if (ev.awaySeconds && ev.awaySeconds > 0) {
          const from = at - ev.awaySeconds * 1000;
          gaps.push({ from, to: at });
          addSpanToHours(hours, from, at, 'awaySeconds');
        }
      }
    }
    if (openLeave != null && !session.endedAt) {
      gaps.push({ from: openLeave, to: nowMs });
      addSpanToHours(hours, openLeave, nowMs, 'awaySeconds');
    }

    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
      // Add full span as focus, then we already counted away separately —
      // better: add focus as watched minus gaps within the span.
      const sorted = [...gaps].sort((a, b) => a.from - b.from);
      let cursor = startMs;
      for (const g of sorted) {
        const gapFrom = Math.max(g.from, startMs);
        const gapTo = Math.min(g.to, endMs);
        if (gapFrom > cursor) {
          addSpanToHours(hours, cursor, Math.min(gapFrom, endMs), 'focusSeconds');
        }
        cursor = Math.max(cursor, gapTo);
      }
      if (cursor < endMs) addSpanToHours(hours, cursor, endMs, 'focusSeconds');
    }
  }

  // Full day hours — day ribbon needs every slot for later focus-pattern insights
  return {
    date,
    drifts,
    returns,
    sessions: sessions.length,
    focusSeconds,
    driftedSeconds,
    watchedSeconds,
    hours,
  };
}

function resolveTaskTitle(
  session: DriftSession,
  taskTitles: Map<string, string>,
): string {
  if (session.taskId && taskTitles.has(session.taskId)) {
    return taskTitles.get(session.taskId)!;
  }
  return session.intention.trim() || 'Untitled';
}

function taskTitlesMap(): Map<string, string> {
  try {
    pomodoroRepository.hydrate();
    return new Map(
      pomodoroRepository.listTasks().map((t) => [t.id, t.title.trim() || 'Task']),
    );
  } catch {
    return new Map();
  }
}

function emptyDay(date: string): DriftDaySummary {
  return {
    date,
    sessions: 0,
    drifts: 0,
    returns: 0,
    totalAwaySeconds: 0,
  };
}

function accumulateDay(
  map: Map<string, DriftDaySummary>,
  session: DriftSession,
): void {
  const date = dateKeyFromIso(session.startedAt);
  const row = map.get(date) ?? emptyDay(date);
  row.sessions += 1;
  for (const ev of session.events) {
    if (ev.kind === 'leave' || ev.kind === 'manual') row.drifts += 1;
    if (ev.kind === 'return') {
      row.returns += 1;
      row.totalAwaySeconds += ev.awaySeconds ?? 0;
    }
  }
  map.set(date, row);
}

function causeBreakdown(sessions: DriftSession[]): DriftCauseCount[] {
  const counts: Record<DriftCause, number> = {
    tabs: 0,
    chat: 0,
    social: 0,
    email: 0,
    other: 0,
  };
  for (const s of sessions) {
    for (const ev of s.events) {
      if (ev.kind !== 'manual' && ev.kind !== 'leave') continue;
      const cause = ev.cause ?? 'other';
      counts[cause] += 1;
    }
  }
  return (Object.keys(counts) as DriftCause[])
    .map((cause) => ({ cause, count: counts[cause] }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

export const driftRepository = {
  getBoundUserId(): string | null {
    return boundUserId;
  },

  hydrate(): void {
    ensureBound();
  },

  /** Load (and optionally cloud-merge) Drift watches for a user. */
  switchUser(userId: string): void {
    if (hydrated && boundUserId === userId) return;
    if (hydrated && boundUserId && boundUserId !== userId) {
      const prevId = boundUserId;
      const raw = storageGet(sessionsKey(prevId));
      let outgoing: DriftSession[] = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as DriftSession[];
          outgoing = Array.isArray(parsed) ? parsed.map(normalizeSession) : [];
        } catch {
          outgoing = [];
        }
      }
      if (isSupabaseConfigured() && prevId !== 'local-guest') {
        schedulePushDriftSessions(prevId, () => outgoing);
      }
    }
    bindSilent(userId);
    if (userId !== 'local-guest' && isSupabaseConfigured()) {
      void (async () => {
        const local = readSessions();
        const merged = await pullAndMergeDriftSessions(userId, local);
        if (boundUserId !== userId) return;
        storageSet(sessionsKey(userId), JSON.stringify(merged.slice(0, MAX_SESSIONS)));
        schedulePushDriftSessions(userId, () => merged);
      })();
    }
  },

  listSessions(): DriftSession[] {
    return readSessions();
  },

  getActiveSession(): DriftSession | null {
    return readSessions().find((s) => !s.endedAt) ?? null;
  },

  saveSession(session: DriftSession): void {
    const all = readSessions().filter((s) => s.id !== session.id);
    all.unshift(session);
    writeSessions(all);
  },

  endSession(
    sessionId: string,
    endedAt = new Date().toISOString(),
  ): DriftSession | null {
    const all = readSessions();
    const idx = all.findIndex((s) => s.id === sessionId);
    if (idx < 0) return null;
    const next = { ...all[idx], endedAt };
    all[idx] = next;
    writeSessions(all);
    return next;
  },

  appendEvent(sessionId: string, event: DriftEvent): DriftSession | null {
    const all = readSessions();
    const idx = all.findIndex((s) => s.id === sessionId);
    if (idx < 0) return null;
    const next = {
      ...all[idx],
      events: [...all[idx].events, event],
    };
    all[idx] = next;
    writeSessions(all);
    return next;
  },

  summarizeRecent(days = 7): DriftDaySummary[] {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      keys.push(todayKey(d));
    }
    const map = new Map<string, DriftDaySummary>();
    for (const key of keys) map.set(key, emptyDay(key));

    for (const session of readSessions()) {
      const date = dateKeyFromIso(session.startedAt);
      if (!map.has(date)) continue;
      accumulateDay(map, session);
    }

    return keys.map((k) => map.get(k)!);
  },

  /** Last N days oldest → newest (for charts). */
  chartSeries(days = 7): DriftDaySummary[] {
    return [...this.summarizeRecent(days)].reverse();
  },

  /** Focus + drifted minutes per day (oldest → newest) for the week line chart. */
  weekLineSeries(days = 7): DriftWeekPoint[] {
    const nowMs = Date.now();
    const keys: string[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      keys.push(todayKey(d));
    }
    const byDate = new Map<string, DriftSession[]>();
    for (const key of keys) byDate.set(key, []);
    for (const session of readSessions()) {
      const date = dateKeyFromIso(session.startedAt);
      const list = byDate.get(date);
      if (list) list.push(session);
    }
    return keys.map((date) => {
      const insight = buildTodayInsight(byDate.get(date) ?? [], date, nowMs);
      return {
        date,
        label: weekdayShort(date),
        focusMinutes: Math.round(insight.focusSeconds / 60),
        driftedMinutes: Math.round(insight.driftedSeconds / 60),
        drifts: insight.drifts,
      };
    });
  },

  getDayLog(dateKey: string): DriftDayLog {
    const sessionsList = readSessions().filter(
      (s) => dateKeyFromIso(s.startedAt) === dateKey,
    );
    const summary = emptyDay(dateKey);
    summary.sessions = sessionsList.length;
    for (const s of sessionsList) {
      for (const ev of s.events) {
        if (ev.kind === 'leave' || ev.kind === 'manual') summary.drifts += 1;
        if (ev.kind === 'return') {
          summary.returns += 1;
          summary.totalAwaySeconds += ev.awaySeconds ?? 0;
        }
      }
    }
    return {
      ...summary,
      sessionsList,
      causes: causeBreakdown(sessionsList),
    };
  },

  causeBreakdownRecent(days = 7): DriftCauseCount[] {
    const cutoff = Date.now() - days * 86400000;
    const sessions = readSessions().filter((s) => {
      const t = Date.parse(s.startedAt);
      return !Number.isNaN(t) && t >= cutoff;
    });
    return causeBreakdown(sessions);
  },

  /** Drifts grouped by Pulse task / intention (most drifts first). */
  taskBreakdownRecent(days = 7): DriftTaskStat[] {
    const allowed = new Set<string>();
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      allowed.add(todayKey(d));
    }
    return this.taskBreakdownForDates(allowed);
  },

  taskBreakdownToday(): DriftTaskStat[] {
    return this.taskBreakdownForDates(new Set([todayKey()]));
  },

  taskBreakdownForDates(allowedDates: Set<string>): DriftTaskStat[] {
    const titles = taskTitlesMap();
    const map = new Map<string, DriftTaskStat>();
    const nowMs = Date.now();

    for (const session of readSessions()) {
      const date = dateKeyFromIso(session.startedAt);
      if (!allowedDates.has(date)) continue;
      const title = resolveTaskTitle(session, titles);
      const key = session.taskId
        ? `task:${session.taskId}`
        : `intent:${title.toLowerCase()}`;
      const row =
        map.get(key) ??
        ({
          key,
          taskId: session.taskId,
          title,
          drifts: 0,
          returns: 0,
          sessions: 0,
          awaySeconds: 0,
          focusSeconds: 0,
        } satisfies DriftTaskStat);
      row.sessions += 1;
      row.drifts += sessionDriftCount(session);
      const timing = sessionTiming(session, nowMs);
      row.returns += sessionReturnStats(session).returns;
      row.awaySeconds += timing.drifted;
      row.focusSeconds += timing.focus;
      if (session.taskId) row.taskId = session.taskId;
      if (titles.has(session.taskId ?? '') || !row.title) row.title = title;
      map.set(key, row);
    }

    return [...map.values()].sort(
      (a, b) => b.drifts - a.drifts || b.sessions - a.sessions,
    );
  },

  getTodayInsight(): DriftTodayInsight {
    const date = todayKey();
    const sessions = readSessions().filter(
      (s) => dateKeyFromIso(s.startedAt) === date,
    );
    return buildTodayInsight(sessions, date);
  },

  totalsRecent(days = 7): {
    drifts: number;
    returns: number;
    sessions: number;
    awaySeconds: number;
  } {
    const rows = this.summarizeRecent(days);
    return rows.reduce(
      (acc, row) => {
        acc.drifts += row.drifts;
        acc.returns += row.returns;
        acc.sessions += row.sessions;
        acc.awaySeconds += row.totalAwaySeconds;
        return acc;
      },
      { drifts: 0, returns: 0, sessions: 0, awaySeconds: 0 },
    );
  },

  buildMonthCells(year: number, monthIndex: number): DriftCalendarCell[] {
    const first = new Date(year, monthIndex, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const prevDays = new Date(year, monthIndex, 0).getDate();

    const map = new Map<string, DriftDaySummary>();
    for (const session of readSessions()) {
      accumulateDay(map, session);
    }

    const cells: DriftCalendarCell[] = [];
    for (let i = 0; i < startPad; i++) {
      const day = prevDays - startPad + 1 + i;
      const d = new Date(year, monthIndex - 1, day);
      const key = todayKey(d);
      const row = map.get(key);
      cells.push({
        key,
        day,
        inMonth: false,
        drifts: row?.drifts ?? 0,
        sessions: row?.sessions ?? 0,
      });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const key = todayKey(new Date(year, monthIndex, day));
      const row = map.get(key);
      cells.push({
        key,
        day,
        inMonth: true,
        drifts: row?.drifts ?? 0,
        sessions: row?.sessions ?? 0,
      });
    }
    while (cells.length % 7 !== 0) {
      const day = cells.length - (startPad + daysInMonth) + 1;
      const d = new Date(year, monthIndex + 1, day);
      const key = todayKey(d);
      const row = map.get(key);
      cells.push({
        key,
        day,
        inMonth: false,
        drifts: row?.drifts ?? 0,
        sessions: row?.sessions ?? 0,
      });
    }
    return cells;
  },
};
