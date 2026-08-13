import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { useAuth } from '../../../public/auth/AuthProvider';
import { pomodoroRepository } from '../../pulse/data/pomodoroRepository';
import { usePomodoro } from '../../pulse/presentation/PomodoroProvider';
import type { PomodoroTask } from '../../pulse/domain/types';
import { driftRepository } from '../data/driftRepository';
import {
  newId,
  type DriftCause,
  type DriftDaySummary,
  type DriftEvent,
  type DriftSession,
  type DriftTaskStat,
  type DriftTodayInsight,
} from '../domain/types';

type DriftHook = {
  session: DriftSession | null;
  intentionDraft: string;
  setIntentionDraft: (v: string) => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  pulseTasks: PomodoroTask[];
  nudgeVisible: boolean;
  dismissNudge: () => void;
  summaries: DriftDaySummary[];
  taskStats: DriftTaskStat[];
  todayInsight: DriftTodayInsight;
  driftCount: number;
  start: () => void;
  stop: () => void;
  logManual: (cause: DriftCause, note?: string) => void;
  markReturn: () => void;
  refresh: () => void;
};

const emptyInsight = (): DriftTodayInsight => ({
  date: '',
  drifts: 0,
  returns: 0,
  sessions: 0,
  focusSeconds: 0,
  driftedSeconds: 0,
  watchedSeconds: 0,
  hours: [],
});

export function useDriftSession(): DriftHook {
  const pulse = usePomodoro();
  const { user } = useAuth();
  const userId = user?.id ?? 'local-guest';
  const [session, setSession] = useState<DriftSession | null>(null);
  const [intentionDraft, setIntentionDraft] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pulseTasks, setPulseTasks] = useState<PomodoroTask[]>([]);
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [summaries, setSummaries] = useState<DriftDaySummary[]>([]);
  const [taskStats, setTaskStats] = useState<DriftTaskStat[]>([]);
  const [todayInsight, setTodayInsight] = useState<DriftTodayInsight>(emptyInsight);
  const awaySinceRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  /** Pulse task id already mirrored into Drift for this Pulse run. */
  const adoptedPulseTaskRef = useRef<string | null>(null);

  const refreshStats = useCallback(() => {
    setSummaries(driftRepository.summarizeRecent(7));
    setTaskStats(driftRepository.taskBreakdownToday());
    setTodayInsight(driftRepository.getTodayInsight());
  }, []);

  const refresh = useCallback(() => {
    const active = driftRepository.getActiveSession();
    setSession(active);
    sessionIdRef.current = active?.id ?? null;
    if (active?.intention) setIntentionDraft(active.intention);
    if (active?.taskId) setSelectedTaskId(active.taskId);
    refreshStats();
    try {
      pomodoroRepository.hydrate();
      const open = pomodoroRepository.listTasks().filter((t) => !t.done);
      const activeId = pomodoroRepository.getActiveTaskId();
      const activeTask = activeId
        ? open.find((t) => t.id === activeId) ??
          pomodoroRepository.listTasks().find((t) => t.id === activeId)
        : null;
      const list = [...open];
      if (activeTask && !list.some((t) => t.id === activeTask.id)) {
        list.unshift(activeTask);
      }
      setPulseTasks(list.slice(0, 8));
    } catch {
      setPulseTasks([]);
    }
  }, [refreshStats]);

  useEffect(() => {
    driftRepository.switchUser(userId);
    refresh();
  }, [userId, refresh]);

  const pickTask = useCallback((task: PomodoroTask | null) => {
    if (!task) {
      setSelectedTaskId(null);
      return;
    }
    setSelectedTaskId(task.id);
    setIntentionDraft(task.title);
  }, []);

  // When Pulse is already running, mirror its active task into Drift setup.
  useEffect(() => {
    if (session) return;
    const live = pulse.running || pulse.isPartial;
    const task = pulse.activeTask;
    if (!live || !task || task.done) {
      adoptedPulseTaskRef.current = null;
      return;
    }
    if (adoptedPulseTaskRef.current === task.id) return;
    adoptedPulseTaskRef.current = task.id;
    pickTask(task);
    setPulseTasks((prev) => {
      if (prev.some((t) => t.id === task.id)) return prev;
      return [task, ...prev].slice(0, 8);
    });
  }, [session, pulse.running, pulse.isPartial, pulse.activeTask, pickTask]);

  // Live focus / drifted clocks while a session is open
  useEffect(() => {
    if (!session) return;
    const id = setInterval(refreshStats, 15000);
    return () => clearInterval(id);
  }, [session, refreshStats]);

  const persist = useCallback((next: DriftSession) => {
    driftRepository.saveSession(next);
    setSession(next);
    sessionIdRef.current = next.id;
  }, []);

  const start = useCallback(() => {
    const intention = intentionDraft.trim() || 'Stay with the work';
    const existing = driftRepository.getActiveSession();
    if (existing) {
      driftRepository.endSession(existing.id);
    }
    const next: DriftSession = {
      id: newId('drift'),
      intention,
      taskId: selectedTaskId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      events: [],
    };
    persist(next);
    setNudgeVisible(false);
    awaySinceRef.current = null;
    refreshStats();
  }, [intentionDraft, persist, selectedTaskId, refreshStats]);

  const stop = useCallback(() => {
    const id = sessionIdRef.current;
    if (!id) return;
    driftRepository.endSession(id);
    setSession(null);
    sessionIdRef.current = null;
    setNudgeVisible(false);
    awaySinceRef.current = null;
    refreshStats();
  }, [refreshStats]);

  const append = useCallback(
    (event: DriftEvent) => {
      const id = sessionIdRef.current;
      if (!id) return;
      const next = driftRepository.appendEvent(id, event);
      if (next) setSession(next);
      refreshStats();
    },
    [refreshStats],
  );

  const onLeft = useCallback(() => {
    if (!sessionIdRef.current || awaySinceRef.current != null) return;
    awaySinceRef.current = Date.now();
    append({
      id: newId('ev'),
      kind: 'leave',
      at: new Date().toISOString(),
    });
    setNudgeVisible(true);
  }, [append]);

  const markReturn = useCallback(() => {
    if (!sessionIdRef.current) return;
    const leftAt = awaySinceRef.current;
    const awaySeconds =
      leftAt != null
        ? Math.max(0, Math.round((Date.now() - leftAt) / 1000))
        : undefined;
    awaySinceRef.current = null;
    append({
      id: newId('ev'),
      kind: 'return',
      at: new Date().toISOString(),
      awaySeconds,
    });
    setNudgeVisible(false);
  }, [append]);

  const logManual = useCallback(
    (cause: DriftCause, note?: string) => {
      if (!sessionIdRef.current) return;
      if (awaySinceRef.current == null) {
        awaySinceRef.current = Date.now();
      }
      append({
        id: newId('ev'),
        kind: 'manual',
        cause,
        note: note?.trim() || undefined,
        at: new Date().toISOString(),
      });
      setNudgeVisible(true);
    },
    [append],
  );

  const dismissNudge = useCallback(() => {
    setNudgeVisible(false);
  }, []);

  useEffect(() => {
    if (!session) return;

    const onAppState = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') onLeft();
    };
    const sub = AppState.addEventListener('change', onAppState);

    let onVis: (() => void) | null = null;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      onVis = () => {
        if (document.visibilityState === 'hidden') onLeft();
      };
      document.addEventListener('visibilitychange', onVis);
    }

    return () => {
      sub.remove();
      if (onVis && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
    };
  }, [session, onLeft]);

  const driftCount = useMemo(
    () =>
      session?.events.filter((e) => e.kind === 'leave' || e.kind === 'manual')
        .length ?? 0,
    [session],
  );

  return {
    session,
    intentionDraft,
    setIntentionDraft: (v: string) => {
      setIntentionDraft(v);
      // Free-text edits clear Pulse task link unless it still matches
      if (selectedTaskId) {
        const task = pulseTasks.find((t) => t.id === selectedTaskId);
        if (!task || task.title !== v) setSelectedTaskId(null);
      }
    },
    selectedTaskId,
    setSelectedTaskId: (id: string | null) => {
      if (!id) {
        pickTask(null);
        return;
      }
      const task = pulseTasks.find((t) => t.id === id) ?? null;
      if (task) pickTask(task);
      else setSelectedTaskId(id);
    },
    pulseTasks,
    nudgeVisible,
    dismissNudge,
    summaries,
    taskStats,
    todayInsight,
    driftCount,
    start,
    stop,
    logManual,
    markReturn,
    refresh,
  };
}
