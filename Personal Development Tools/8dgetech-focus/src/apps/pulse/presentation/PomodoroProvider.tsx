import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { PHASE_THEME, formatTimer, type PomodoroPhase } from '../domain/types';
import { lockScreenTimer } from '../data/lockScreenTimer';
import { usePomodoroTimer } from './usePomodoroTimer';
import {
  closeTimerPip,
  emitOpenFromPip,
  isTimerPipOpen,
  openTimerPip,
  setTimerPipHandlers,
  updateTimerPip,
} from './timerPip';
import { closeDriftPip } from '../../drift/presentation/driftPip';

type PomodoroTimerApi = ReturnType<typeof usePomodoroTimer>;

type PomodoroContextValue = PomodoroTimerApi & {
  minimized: boolean;
  pipOpen: boolean;
  overlayDismissed: boolean;
  minimize: () => void;
  expand: () => void;
  dismissOverlay: () => void;
};

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const timer = usePomodoroTimer();
  const [minimized, setMinimized] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  /** Phase tab captured at minimize — reopen must land on this tab. */
  const minimizedPhaseRef = useRef<PomodoroPhase>(timer.phase);
  const startRef = useRef(timer.start);
  const pauseRef = useRef(timer.pause);
  const resetRef = useRef(timer.reset);
  const runningRef = useRef(timer.running);
  const restorePhaseRef = useRef(timer.restorePhase);
  startRef.current = timer.start;
  pauseRef.current = timer.pause;
  resetRef.current = timer.reset;
  runningRef.current = timer.running;
  restorePhaseRef.current = timer.restorePhase;

  const pipHandlers = useMemo(
    () => ({
      onClose: () => {
        setPipOpen(false);
        // Browser closed PiP — keep a single in-app bubble as fallback.
        setMinimized(true);
        setOverlayDismissed(false);
      },
      onDismiss: () => {
        // X next to pause: stop + reset timer, clear minimized UI.
        resetRef.current();
        closeTimerPip();
        setPipOpen(false);
        setMinimized(false);
        setOverlayDismissed(true);
      },
      onOpenApp: () => {
        restorePhaseRef.current(minimizedPhaseRef.current);
        emitOpenFromPip();
        closeTimerPip();
        setPipOpen(false);
        setMinimized(false);
        setOverlayDismissed(false);
      },
      onToggleRun: () => {
        if (runningRef.current) pauseRef.current();
        else startRef.current();
      },
      onPause: () => {
        pauseRef.current();
      },
      onResume: () => {
        startRef.current();
      },
    }),
    [],
  );

  useEffect(() => {
    setTimerPipHandlers(pipHandlers);
  }, [pipHandlers]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    return lockScreenTimer.subscribeAndroidActions((action) => {
      if (action === 'pause') {
        pauseRef.current();
        return;
      }
      if (action === 'resume') {
        startRef.current();
        return;
      }
      if (action === 'open') {
        restorePhaseRef.current(minimizedPhaseRef.current);
        emitOpenFromPip();
      }
    });
  }, []);

  const expand = useCallback(() => {
    restorePhaseRef.current(minimizedPhaseRef.current);
    closeTimerPip();
    setPipOpen(false);
    setMinimized(false);
    setOverlayDismissed(false);
  }, []);

  const dismissOverlay = useCallback(() => {
    resetRef.current();
    closeTimerPip();
    setPipOpen(false);
    setMinimized(false);
    setOverlayDismissed(true);
  }, []);

  const minimize = useCallback(() => {
    minimizedPhaseRef.current = timer.phase;
    setOverlayDismissed(false);
    // One sticky surface at a time — close Drift PiP if open.
    closeDriftPip();
    // Prefer a single surface: try system PiP first, then fall back to the
    // in-app bubble only if PiP is unavailable — never show both.
    void openTimerPip(
      {
        remaining: timer.remaining,
        total: timer.total,
        phase: timer.phase,
        running: timer.running,
        taskTitle: timer.activeTask?.title ?? null,
        endsAt: timer.endsAt,
      },
      pipHandlers,
    ).then((ok) => {
      setPipOpen(ok);
      setMinimized(true);
    });
  }, [
    pipHandlers,
    timer.activeTask?.title,
    timer.endsAt,
    timer.phase,
    timer.remaining,
    timer.running,
    timer.total,
  ]);

  const minimizeRef = useRef(minimize);
  minimizeRef.current = minimize;

  /** Leaving the browser tab / app pops the timer out (no Minimize button). */
  useEffect(() => {
    const active = timer.running || timer.isPartial;
    if (!active) return;

    const hideAway = () => {
      minimizeRef.current();
    };

    const onAppState = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') hideAway();
    };
    const sub = AppState.addEventListener('change', onAppState);

    let onVis: (() => void) | null = null;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      onVis = () => {
        if (document.visibilityState === 'hidden') hideAway();
      };
      document.addEventListener('visibilitychange', onVis);
    }

    return () => {
      sub.remove();
      if (onVis && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
    };
  }, [timer.running, timer.isPartial]);

  // Keep React state aligned with the real PiP window (avoids bubble + PiP).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const sync = () => {
      const open = isTimerPipOpen();
      setPipOpen((prev) => (prev === open ? prev : open));
    };
    sync();
    const id = setInterval(sync, 800);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  // If phase advances while minimized (auto-break), keep the reopen tab in sync.
  useEffect(() => {
    if (minimized || pipOpen) {
      minimizedPhaseRef.current = timer.phase;
    }
  }, [minimized, pipOpen, timer.phase]);

  useEffect(() => {
    updateTimerPip({
      remaining: timer.remaining,
      total: timer.total,
      phase: timer.phase,
      running: timer.running,
      taskTitle: timer.activeTask?.title ?? null,
      endsAt: timer.endsAt,
    });
  }, [
    timer.activeTask?.title,
    timer.endsAt,
    timer.remaining,
    timer.total,
    timer.phase,
    timer.running,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.title = `${formatTimer(timer.remaining)} — ${PHASE_THEME[timer.phase].label}`;
  }, [timer.remaining, timer.phase]);

  const value = useMemo(
    () => ({
      ...timer,
      minimized,
      pipOpen,
      overlayDismissed,
      minimize,
      expand,
      dismissOverlay,
    }),
    [
      timer,
      minimized,
      pipOpen,
      overlayDismissed,
      minimize,
      expand,
      dismissOverlay,
    ],
  );

  return (
    <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>
  );
}

export function usePomodoro() {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error('usePomodoro must be used within PomodoroProvider');
  return ctx;
}
