export type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak';

export type AlarmSoundId =
  | 'none'
  | 'kitchen'
  | 'bell'
  | 'bird'
  | 'digital'
  | 'wood'
  | 'alarmClock';

export type FocusSoundId =
  | 'none'
  | 'tickingFast'
  | 'tickingSlow'
  | 'whiteNoise'
  | 'brownNoise';

export const ALARM_SOUND_OPTIONS: { id: AlarmSoundId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bell', label: 'Bell' },
  { id: 'bird', label: 'Bird' },
  { id: 'digital', label: 'Digital' },
  { id: 'wood', label: 'Wood' },
  { id: 'alarmClock', label: 'Alarm Clock' },
];

export const FOCUS_SOUND_OPTIONS: { id: FocusSoundId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'tickingFast', label: 'Ticking Fast' },
  { id: 'tickingSlow', label: 'Ticking Slow' },
  { id: 'whiteNoise', label: 'White Noise' },
  { id: 'brownNoise', label: 'Brown Noise' },
];

export type PomodoroSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsUntilLongBreak: number;
  /** After a focus session ends, auto-start the break. */
  autoStartBreaks: boolean;
  /** After a break ends, auto-start the next focus. */
  autoStartPomodoros: boolean;
  /** When estimate is reached, mark the task done automatically. */
  autoCheckTasks: boolean;
  /** Keep completed tasks at the bottom of the list. */
  moveCompletedToBottom: boolean;
  alarmSound: AlarmSoundId;
  alarmVolume: number;
  alarmRepeat: number;
  focusSound: FocusSoundId;
  focusVolume: number;
};

export type PomodoroSession = {
  id: string;
  userId: string;
  phase: PomodoroPhase;
  plannedSeconds: number;
  startedAt: string;
  endedAt: string | null;
  completed: boolean;
  taskId: string | null;
};

export type PomodoroTask = {
  id: string;
  userId: string;
  title: string;
  note: string;
  estimatePomodoros: number;
  completedPomodoros: number;
  done: boolean;
  createdAt: string;
};

export type PomodoroStats = {
  focusCompletedToday: number;
  focusMinutesToday: number;
  breakMinutesToday: number;
  focusCompletedAllTime: number;
  focusMinutesAllTime: number;
  totalSessions: number;
};

/** Pomofocus-like mode colors */
export const PHASE_THEME: Record<
  PomodoroPhase,
  { bg: string; panel: string; accent: string; label: string }
> = {
  focus: {
    bg: '#BA4949',
    panel: 'rgba(255,255,255,0.16)',
    accent: '#C15C5C',
    label: 'Pomodoro',
  },
  shortBreak: {
    bg: '#38858A',
    panel: 'rgba(255,255,255,0.16)',
    accent: '#4A9B9F',
    label: 'Short Break',
  },
  longBreak: {
    bg: '#397097',
    panel: 'rgba(255,255,255,0.16)',
    accent: '#4A84A8',
    label: 'Long Break',
  },
};

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: true,
  autoStartPomodoros: false,
  autoCheckTasks: false,
  moveCompletedToBottom: true,
  alarmSound: 'wood',
  alarmVolume: 50,
  alarmRepeat: 1,
  focusSound: 'tickingFast',
  focusVolume: 50,
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function asAlarmSound(value: unknown): AlarmSoundId {
  return ALARM_SOUND_OPTIONS.some((o) => o.id === value)
    ? (value as AlarmSoundId)
    : DEFAULT_SETTINGS.alarmSound;
}

function asFocusSound(value: unknown): FocusSoundId {
  return FOCUS_SOUND_OPTIONS.some((o) => o.id === value)
    ? (value as FocusSoundId)
    : DEFAULT_SETTINGS.focusSound;
}

/** Normalize stored settings (incl. legacy `autoContinue`). */
export function normalizeSettings(
  raw: Partial<PomodoroSettings> & { autoContinue?: boolean } | null | undefined,
): PomodoroSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  const { autoContinue, ...rest } = raw;
  const merged: PomodoroSettings = {
    ...DEFAULT_SETTINGS,
    ...rest,
    alarmSound: asAlarmSound(rest.alarmSound ?? DEFAULT_SETTINGS.alarmSound),
    alarmVolume: clampInt(rest.alarmVolume ?? DEFAULT_SETTINGS.alarmVolume, 0, 100, 50),
    alarmRepeat: clampInt(rest.alarmRepeat ?? DEFAULT_SETTINGS.alarmRepeat, 0, 60, 1),
    focusSound: asFocusSound(rest.focusSound ?? DEFAULT_SETTINGS.focusSound),
    focusVolume: clampInt(rest.focusVolume ?? DEFAULT_SETTINGS.focusVolume, 0, 100, 50),
  };
  if (
    autoContinue !== undefined &&
    raw.autoStartBreaks === undefined &&
    raw.autoStartPomodoros === undefined
  ) {
    merged.autoStartBreaks = autoContinue;
    merged.autoStartPomodoros = autoContinue;
  }
  return merged;
}

export function minutesToSeconds(minutes: number): number {
  return Math.max(1, Math.round(minutes * 60));
}

export function formatTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatMinutesShort(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function phaseLabel(phase: PomodoroPhase): string {
  return PHASE_THEME[phase].label;
}

export function nextPhase(
  current: PomodoroPhase,
  completedFocusCount: number,
  settings: PomodoroSettings,
): PomodoroPhase {
  if (current === 'focus') {
    const nextCount = completedFocusCount + 1;
    if (nextCount % settings.sessionsUntilLongBreak === 0) {
      return 'longBreak';
    }
    return 'shortBreak';
  }
  return 'focus';
}

export function durationForPhase(
  phase: PomodoroPhase,
  settings: PomodoroSettings,
): number {
  switch (phase) {
    case 'focus':
      return minutesToSeconds(settings.focusMinutes);
    case 'shortBreak':
      return minutesToSeconds(settings.shortBreakMinutes);
    case 'longBreak':
      return minutesToSeconds(settings.longBreakMinutes);
  }
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clampMinutes(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function formatSessionWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}

export function sessionDurationLabel(session: PomodoroSession): string {
  if (!session.endedAt) return 'In progress';
  const ms =
    new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return formatMinutesShort(Math.round(seconds / 60));
}

export function computeStats(sessions: PomodoroSession[]): PomodoroStats {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  let focusCompletedToday = 0;
  let focusMinutesToday = 0;
  let breakMinutesToday = 0;
  let focusCompletedAllTime = 0;
  let focusMinutesAllTime = 0;

  for (const s of sessions) {
    if (!s.completed || !s.endedAt) continue;
    const elapsedMin = Math.max(
      1,
      Math.round(
        (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) /
          60000,
      ),
    );
    const plannedMin = Math.round(s.plannedSeconds / 60);
    const credited = Math.min(elapsedMin, plannedMin);

    if (s.phase === 'focus') {
      focusCompletedAllTime += 1;
      focusMinutesAllTime += credited;
      if (new Date(s.startedAt) >= startOfDay) {
        focusCompletedToday += 1;
        focusMinutesToday += credited;
      }
    } else if (new Date(s.startedAt) >= startOfDay) {
      breakMinutesToday += credited;
    }
  }

  return {
    focusCompletedToday,
    focusMinutesToday,
    breakMinutesToday,
    focusCompletedAllTime,
    focusMinutesAllTime,
    totalSessions: sessions.length,
  };
}

/** Finish-time estimate like Pomofocus (remaining pomodoros × focus + breaks). */
export function estimateFinishAt(
  tasks: PomodoroTask[],
  settings: PomodoroSettings,
  focusDoneTowardLong: number,
): Date {
  const open = tasks.filter((t) => !t.done);
  let remainingPomos = 0;
  for (const t of open) {
    remainingPomos += Math.max(0, t.estimatePomodoros - t.completedPomodoros);
  }

  let minutes = 0;
  let towardLong = focusDoneTowardLong % settings.sessionsUntilLongBreak;

  for (let i = 0; i < remainingPomos; i++) {
    minutes += settings.focusMinutes;
    towardLong += 1;
    if (towardLong % settings.sessionsUntilLongBreak === 0) {
      minutes += settings.longBreakMinutes;
    } else {
      minutes += settings.shortBreakMinutes;
    }
  }

  return new Date(Date.now() + minutes * 60_000);
}

export function formatFinishClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function toDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function creditedMinutes(session: PomodoroSession): number {
  if (!session.endedAt || !session.completed) return 0;
  const elapsedMin = Math.max(
    1,
    Math.round(
      (new Date(session.endedAt).getTime() -
        new Date(session.startedAt).getTime()) /
        60000,
    ),
  );
  const plannedMin = Math.round(session.plannedSeconds / 60);
  return Math.min(elapsedMin, plannedMin);
}

export type DayTaskActivity = {
  task: PomodoroTask;
  focusSessions: number;
  focusMinutes: number;
};

export type DayLog = {
  dateKey: string;
  sessions: PomodoroSession[];
  focusCompleted: number;
  focusMinutes: number;
  breakMinutes: number;
  tasksWorked: DayTaskActivity[];
  tasksCreated: PomodoroTask[];
  hasActivity: boolean;
};

export function buildDayLog(
  dateKey: string,
  sessions: PomodoroSession[],
  tasks: PomodoroTask[],
): DayLog {
  const daySessions = sessions
    .filter((s) => toDateKey(s.startedAt) === dateKey)
    .slice()
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  let focusCompleted = 0;
  let focusMinutes = 0;
  let breakMinutes = 0;
  const taskFocus = new Map<string, { count: number; minutes: number }>();

  for (const s of daySessions) {
    const mins = creditedMinutes(s);
    if (s.phase === 'focus' && s.completed) {
      focusCompleted += 1;
      focusMinutes += mins;
      if (s.taskId) {
        const prev = taskFocus.get(s.taskId) ?? { count: 0, minutes: 0 };
        taskFocus.set(s.taskId, {
          count: prev.count + 1,
          minutes: prev.minutes + mins,
        });
      }
    } else if (s.phase !== 'focus' && s.completed) {
      breakMinutes += mins;
    }
  }

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const tasksWorked: DayTaskActivity[] = [];
  for (const [taskId, stats] of taskFocus) {
    const task = taskById.get(taskId);
    if (!task) continue;
    tasksWorked.push({
      task,
      focusSessions: stats.count,
      focusMinutes: stats.minutes,
    });
  }
  tasksWorked.sort((a, b) => b.focusMinutes - a.focusMinutes);

  const tasksCreated = tasks.filter((t) => toDateKey(t.createdAt) === dateKey);

  return {
    dateKey,
    sessions: daySessions,
    focusCompleted,
    focusMinutes,
    breakMinutes,
    tasksWorked,
    tasksCreated,
    hasActivity:
      daySessions.length > 0 ||
      tasksCreated.length > 0 ||
      tasksWorked.length > 0,
  };
}

export type CalendarCell = {
  dateKey: string | null;
  dayOfMonth: number | null;
  isToday: boolean;
  log: DayLog | null;
};

export function buildMonthGrid(
  year: number,
  monthIndex: number,
  sessions: PomodoroSession[],
  tasks: PomodoroTask[],
): CalendarCell[] {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startWeekday = first.getDay(); // 0 Sun
  const todayKey = toDateKey(new Date());
  const cells: CalendarCell[] = [];

  for (let i = 0; i < startWeekday; i++) {
    cells.push({ dateKey: null, dayOfMonth: null, isToday: false, log: null });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = toDateKey(new Date(year, monthIndex, day));
    const log = buildDayLog(dateKey, sessions, tasks);
    cells.push({
      dateKey,
      dayOfMonth: day,
      isToday: dateKey === todayKey,
      log,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ dateKey: null, dayOfMonth: null, isToday: false, log: null });
  }

  return cells;
}

export function monthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });
}

export function formatDayHeading(dateKey: string): string {
  const d = parseDateKey(dateKey);
  const today = toDateKey(new Date());
  const label = d.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return dateKey === today ? `Today · ${label}` : label;
}
