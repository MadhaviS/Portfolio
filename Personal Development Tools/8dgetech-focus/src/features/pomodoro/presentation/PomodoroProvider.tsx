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
import { PHASE_THEME, formatTimer } from '../domain/types';
import { lockScreenTimer } from '../data/lockScreenTimer';
import { usePomodoroTimer } from './usePomodoroTimer';
import {
  closeTimerPip,
  emitOpenFromPip,
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
  const startRef = useRef(timer.start);
  const pauseRef = useRef(timer.pause);
  const runningRef = useRef(timer.running);
  startRef.current = timer.start;
  pauseRef.current = timer.pause;
  runningRef.current = timer.running;

  const pipHandlers = useMemo(
    () => ({
      onClose: () => {
        setPipOpen(false);
        // Keep minimized so the in-app bubble returns (friendlier than vanishing)
        setMinimized(true);
        setOverlayDismissed(false);
      },
      onOpenApp: () => {
        // Navigate via bridge first, then clear floating UI
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
        emitOpenFromPip();
      }
    });
  }, []);

  const expand = useCallback(() => {
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
    setOverlayDismissed(false);
    setMinimized(true);
    void openTimerPip(
      {
        remaining: timer.remaining,
        phase: timer.phase,
        running: timer.running,
      },
      pipHandlers,
    ).then((ok) => {
      setPipOpen(ok);
      // If system PiP isn't available, in-app bubble stays (minimized=true)
    });
  }, [pipHandlers, timer.phase, timer.remaining, timer.running]);

  useEffect(() => {
    updateTimerPip({
      remaining: timer.remaining,
      phase: timer.phase,
      running: timer.running,
    });
  }, [timer.remaining, timer.phase, timer.running]);

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
