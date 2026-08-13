export type DriftCause =
  | 'tabs'
  | 'chat'
  | 'social'
  | 'email'
  | 'other';

export type DriftEventKind = 'leave' | 'manual' | 'return';

export type DriftEvent = {
  id: string;
  kind: DriftEventKind;
  cause?: DriftCause;
  note?: string;
  at: string;
  /** Seconds away before return (leave → return). */
  awaySeconds?: number;
};

export type DriftSession = {
  id: string;
  intention: string;
  /** Linked Pulse task when started from a task chip. */
  taskId: string | null;
  startedAt: string;
  endedAt: string | null;
  events: DriftEvent[];
};

export type DriftDaySummary = {
  date: string;
  sessions: number;
  drifts: number;
  returns: number;
  totalAwaySeconds: number;
};

export type DriftTaskStat = {
  key: string;
  taskId: string | null;
  title: string;
  drifts: number;
  returns: number;
  sessions: number;
  awaySeconds: number;
  focusSeconds: number;
};

export type DriftHourBucket = {
  hour: number;
  label: string;
  drifts: number;
  awaySeconds: number;
  focusSeconds: number;
};

export type DriftTodayInsight = {
  date: string;
  drifts: number;
  returns: number;
  sessions: number;
  /** Time on-task while watching (session wall − away). */
  focusSeconds: number;
  /** Time away / drifted. */
  driftedSeconds: number;
  /** Total watch wall time today. */
  watchedSeconds: number;
  hours: DriftHourBucket[];
};

/** One day in the week line chart (oldest → newest). */
export type DriftWeekPoint = {
  date: string;
  label: string;
  focusMinutes: number;
  driftedMinutes: number;
  drifts: number;
};

export type DriftCauseCount = {
  cause: DriftCause;
  count: number;
};

export type DriftDayLog = DriftDaySummary & {
  sessionsList: DriftSession[];
  causes: DriftCauseCount[];
};

export type DriftCalendarCell = {
  key: string;
  day: number;
  inMonth: boolean;
  drifts: number;
  sessions: number;
};

export const DRIFT_CAUSES: { id: DriftCause; label: string }[] = [
  { id: 'tabs', label: 'Tabs' },
  { id: 'chat', label: 'Chat' },
  { id: 'social', label: 'Social' },
  { id: 'email', label: 'Email' },
  { id: 'other', label: 'Other' },
];

import { PHASE_THEME } from '../../pulse/domain/types';

export const DRIFT_TEAL = {
  light: PHASE_THEME.shortBreak.pageLight,
  dark: PHASE_THEME.shortBreak.accent,
  washLight: PHASE_THEME.shortBreak.pageLight,
  washDark: PHASE_THEME.shortBreak.pageDark,
  orb: PHASE_THEME.shortBreak.bg,
};

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatAway(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return todayKey(d);
}

export function weekdayShort(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString([], {
    weekday: 'short',
  });
}

export function monthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });
}

/** Soft return roadmap steps shown in Drift report. */
export const DRIFT_ROADMAP = [
  {
    mark: '01',
    title: 'Name the lane',
    body: 'Start with one intention so returns have a destination.',
  },
  {
    mark: '02',
    title: 'Catch the slip',
    body: 'Leaving the tab/app — or tapping a cause — logs a drift early.',
  },
  {
    mark: '03',
    title: 'Return without shame',
    body: 'Acknowledge the nudge, then continue. Restarting is the skill.',
  },
  {
    mark: '04',
    title: 'Read the pattern',
    body: 'Use report and calendar to see when attention usually slides.',
  },
] as const;
