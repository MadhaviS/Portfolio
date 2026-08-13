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
import { Platform } from 'react-native';
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
  const runningRef = useRef(timer.running);
  const restorePhaseRef = useRef(timer.restorePhase);
  startRef.current = timer.start;
  pauseRef.current = timer.pause;
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
    closeTimerPip();
    setPipOpen(false);
    setMinimized(false);
    setOverlayDismissed(true);
  }, []);

  const minimize = useCallback(() => {
    minimizedPhaseRef.current = timer.phase;
    setOverlayDismissed(false);
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
