import { useCallback, useEffect, useRef, useState } from 'react';
import { authStub } from '../../../core/auth/authStub';
import { useAuth } from '../../../core/auth/AuthProvider';
import {
  alarmOptsFromSettings,
  focusOptsFromSettings,
  playAlarmSound,
  stopAlarmSound,
  stopFocusSound,
  syncFocusSound,
} from '../data/pomodoroAudio';
import { lockScreenTimer } from '../data/lockScreenTimer';
import { pomodoroRepository } from '../data/pomodoroRepository';
import {
  clampMinutes,
  createId,
  durationForPhase,
  estimateFinishAt,
  nextPhase,
  normalizeSettings,
  type PomodoroPhase,
  type PomodoroSession,
  type PomodoroSettings,
  type PomodoroStats,
  type PomodoroTask,
} from '../domain/types';

export function usePomodoroTimer() {
  const { user } = useAuth();
  const userId = user?.id ?? 'local-guest';

  const [settings, setSettings] = useState(() => {
    pomodoroRepository.hydrate();
    return pomodoroRepository.getSettings();
  });
  const [phase, setPhase] = useState<PomodoroPhase>('focus');
  const [remaining, setRemaining] = useState(() =>
    durationForPhase('focus', pomodoroRepository.getSettings()),
  );
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<PomodoroStats>(() =>
    pomodoroRepository.getStats(),
  );
  const [history, setHistory] = useState<PomodoroSession[]>(() =>
    pomodoroRepository.listSessions(),
  );
  const [tasks, setTasks] = useState<PomodoroTask[]>(() =>
    pomodoroRepository.listTasks(),
  );
  const [activeTaskId, setActiveTaskId] = useState<string | null>(() =>
    pomodoroRepository.getActiveTaskId(),
  );

  const sessionIdRef = useRef<string | null>(null);
  const endsAtRef = useRef<number | null>(null);
  const [endsAt, setEndsAtState] = useState<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(phase);
  const settingsRef = useRef(settings);
  const completedFocusRef = useRef(stats.focusCompletedToday);
  const finishingRef = useRef(false);
  const activeTaskRef = useRef(activeTaskId);

  phaseRef.current = phase;
  settingsRef.current = settings;
  completedFocusRef.current = stats.focusCompletedToday;
  activeTaskRef.current = activeTaskId;

  const setDeadline = useCallback((value: number | null) => {
    endsAtRef.current = value;
    setEndsAtState(value);
  }, []);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const refreshInsight = useCallback(() => {
    setStats(pomodoroRepository.getStats());
    setHistory(pomodoroRepository.listSessions());
    setTasks(pomodoroRepository.listTasks());
    setActiveTaskId(pomodoroRepository.getActiveTaskId());
  }, []);

  const reloadFromWorkspace = useCallback(() => {
    clearTick();
    sessionIdRef.current = null;
    setDeadline(null);
    finishingRef.current = false;
    setRunning(false);
    void stopFocusSound();
    void stopAlarmSound();
    void lockScreenTimer.idle({ phase: 'focus', completed: false });

    const nextSettings = pomodoroRepository.getSettings();
    setSettings(nextSettings);
    setPhase('focus');
    setRemaining(durationForPhase('focus', nextSettings));
    refreshInsight();
  }, [clearTick, refreshInsight, setDeadline]);

  useEffect(() => {
    pomodoroRepository.switchUser(userId);
    reloadFromWorkspace();
    return pomodoroRepository.subscribe(reloadFromWorkspace);
  }, [userId, reloadFromWorkspace]);

  const applyPhase = useCallback((next: PomodoroPhase) => {
    const nextSettings = settingsRef.current;
    setPhase(next);
    setRemaining(durationForPhase(next, nextSettings));
    setRunning(false);
    sessionIdRef.current = null;
    setDeadline(null);
  }, [setDeadline]);

  const beginSession = useCallback(
    (forPhase: PomodoroPhase, seconds: number) => {
      const id = createId('pomodoro');
      sessionIdRef.current = id;
      const endsAt = Date.now() + seconds * 1000;
      setDeadline(endsAt);
      pomodoroRepository.addSession({
        id,
        userId: authStub.getUserId(),
        phase: forPhase,
        plannedSeconds: seconds,
        startedAt: new Date().toISOString(),
        endedAt: null,
        completed: false,
        taskId: forPhase === 'focus' ? activeTaskRef.current : null,
      });
      refreshInsight();
      setRemaining(seconds);
      setRunning(true);
      void lockScreenTimer.running({
        phase: forPhase,
        endsAt,
        remaining: seconds,
      });
    },
    [refreshInsight, setDeadline],
  );

  const finishPhase = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    const currentPhase = phaseRef.current;
    const cfg = settingsRef.current;

    if (sessionIdRef.current) {
      pomodoroRepository.completeSession(sessionIdRef.current, true);
      sessionIdRef.current = null;
    }
    setDeadline(null);
    clearTick();
    setRunning(false);
    void stopFocusSound();
    void playAlarmSound(alarmOptsFromSettings(cfg));
    void lockScreenTimer.idle({ phase: currentPhase, completed: true });

    if (currentPhase === 'focus') {
      pomodoroRepository.incrementActiveTaskPomodoro();
    }

    const focusBefore = completedFocusRef.current;
    const upcoming = nextPhase(currentPhase, focusBefore, cfg);

    refreshInsight();
    applyPhase(upcoming);

    const shouldAuto =
      (currentPhase === 'focus' && cfg.autoStartBreaks) ||
      ((currentPhase === 'shortBreak' || currentPhase === 'longBreak') &&
        cfg.autoStartPomodoros);
    finishingRef.current = false;

    if (shouldAuto) {
      const seconds = durationForPhase(upcoming, cfg);
      setTimeout(() => beginSession(upcoming, seconds), 400);
    }
  }, [applyPhase, beginSession, clearTick, refreshInsight, setDeadline]);

  const start = useCallback(() => {
    if (running) return;
    if (sessionIdRef.current && remaining > 0) {
      const endsAt = Date.now() + remaining * 1000;
      setDeadline(endsAt);
      setRunning(true);
      void lockScreenTimer.running({
        phase,
        endsAt,
        remaining,
      });
      return;
    }
    const seconds =
      remaining > 0 ? remaining : durationForPhase(phase, settings);
    beginSession(phase, seconds);
  }, [beginSession, phase, remaining, running, setDeadline, settings]);

  const pause = useCallback(() => {
    const left = endsAtRef.current
      ? Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000))
      : remaining;
    setRemaining(left);
    setDeadline(null);
    setRunning(false);
    void stopFocusSound();
    void lockScreenTimer.paused({
      phase: phaseRef.current,
      remaining: left,
      total: durationForPhase(phaseRef.current, settingsRef.current),
    });
  }, [remaining, setDeadline]);

  const selectPhase = useCallback(
    (next: PomodoroPhase) => {
      if (next === phase && !running) return;
      if (sessionIdRef.current) {
        pomodoroRepository.completeSession(sessionIdRef.current, false);
        sessionIdRef.current = null;
      }
      setDeadline(null);
      void stopFocusSound();
      void stopAlarmSound();
      void lockScreenTimer.idle({ phase: next, completed: false });
      refreshInsight();
      applyPhase(next);
    },
    [applyPhase, phase, refreshInsight, running, setDeadline],
  );

  const reset = useCallback(() => {
    if (sessionIdRef.current) {
      pomodoroRepository.completeSession(sessionIdRef.current, false);
      sessionIdRef.current = null;
    }
    setDeadline(null);
    void stopFocusSound();
    void stopAlarmSound();
    void lockScreenTimer.idle({ phase, completed: false });
    refreshInsight();
    applyPhase(phase);
  }, [applyPhase, phase, refreshInsight, setDeadline]);

  useEffect(() => {
    void syncFocusSound(focusOptsFromSettings(settings, running, phase));
  }, [
    running,
    phase,
    settings.focusSound,
    settings.focusVolume,
  ]);

  useEffect(() => {
    return () => {
      void stopFocusSound();
      void stopAlarmSound();
    };
  }, []);

  useEffect(() => {
    if (!running || endsAtRef.current == null) {
      clearTick();
      return;
    }
    const sync = () => {
      const end = endsAtRef.current;
      if (end == null) return;
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearTick();
        setRunning(false);
        finishPhase();
      }
    };
    sync();
    tickRef.current = setInterval(sync, 250);
    return clearTick;
  }, [running, clearTick, finishPhase]);

  const updateSettings = useCallback(
    (partial: Partial<PomodoroSettings>) => {
      const merged = normalizeSettings({ ...settings, ...partial });
      merged.focusMinutes = clampMinutes(merged.focusMinutes, 1, 120);
      merged.shortBreakMinutes = clampMinutes(merged.shortBreakMinutes, 1, 60);
      merged.longBreakMinutes = clampMinutes(merged.longBreakMinutes, 1, 60);
      merged.sessionsUntilLongBreak = clampMinutes(
        merged.sessionsUntilLongBreak,
        1,
        12,
      );
      const next = pomodoroRepository.saveSettings(merged);
      setSettings(next);
      if (!running && !sessionIdRef.current) {
        setRemaining(durationForPhase(phase, next));
      }
      refreshInsight();
    },
    [phase, refreshInsight, running, settings],
  );

  const addTask = useCallback(
    (title: string, estimate = 1, note = '') => {
      pomodoroRepository.addTask(title, estimate, note);
      refreshInsight();
    },
    [refreshInsight],
  );

  const updateTaskDetails = useCallback(
    (
      id: string,
      patch: { title: string; estimate: number; note: string },
    ) => {
      pomodoroRepository.updateTask(id, {
        title: patch.title,
        estimatePomodoros: patch.estimate,
        note: patch.note,
      });
      refreshInsight();
    },
    [refreshInsight],
  );

  const selectTask = useCallback(
    (id: string) => {
      pomodoroRepository.setActiveTaskId(id);
      refreshInsight();
    },
    [refreshInsight],
  );

  const toggleTaskDone = useCallback(
    (id: string) => {
      const task = pomodoroRepository.listTasks().find((t) => t.id === id);
      if (!task) return;
      pomodoroRepository.updateTask(id, { done: !task.done });
      refreshInsight();
    },
    [refreshInsight],
  );

  const changeEstimate = useCallback(
    (id: string, delta: number) => {
      const task = pomodoroRepository.listTasks().find((t) => t.id === id);
      if (!task) return;
      pomodoroRepository.updateTask(id, {
        estimatePomodoros: Math.max(1, Math.min(99, task.estimatePomodoros + delta)),
      });
      refreshInsight();
    },
    [refreshInsight],
  );

  const setEstimate = useCallback(
    (id: string, value: number) => {
      const task = pomodoroRepository.listTasks().find((t) => t.id === id);
      if (!task) return;
      const next = Number.isFinite(value) ? Math.round(value) : task.estimatePomodoros;
      pomodoroRepository.updateTask(id, {
        estimatePomodoros: Math.max(1, Math.min(99, next)),
      });
      refreshInsight();
    },
    [refreshInsight],
  );

  const deleteTask = useCallback(
    (id: string) => {
      pomodoroRepository.deleteTask(id);
      refreshInsight();
    },
    [refreshInsight],
  );

  const total = durationForPhase(phase, settings);
  const progress = total === 0 ? 0 : Math.min(1, Math.max(0, 1 - remaining / total));
  const isPartial = remaining > 0 && remaining < total;
  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;
  const finishAt = estimateFinishAt(
    tasks,
    settings,
    stats.focusCompletedToday,
  );

  return {
    settings,
    phase,
    remaining,
    total,
    progress,
    endsAt,
    isPartial,
    running,
    stats,
    history,
    tasks,
    activeTask,
    activeTaskId,
    finishAt,
    start,
    pause,
    reset,
    selectPhase,
    updateSettings,
    addTask,
    updateTaskDetails,
    selectTask,
    toggleTaskDone,
    changeEstimate,
    setEstimate,
    deleteTask,
  };
}
