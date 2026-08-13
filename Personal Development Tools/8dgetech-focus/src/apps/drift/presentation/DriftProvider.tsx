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
import { useDriftSession } from './useDriftSession';
import {
  closeDriftPip,
  emitOpenFromDriftPip,
  isDriftPipOpen,
  openDriftPip,
  setDriftPipHandlers,
  updateDriftPip,
} from './driftPip';

type DriftContextValue = ReturnType<typeof useDriftSession> & {
  minimized: boolean;
  pipOpen: boolean;
  overlayDismissed: boolean;
  minimize: () => void;
  expand: () => void;
  dismissOverlay: () => void;
};

const DriftContext = createContext<DriftContextValue | null>(null);

export function DriftProvider({ children }: { children: ReactNode }) {
  const {
    session,
    intentionDraft,
    setIntentionDraft,
    selectedTaskId,
    setSelectedTaskId,
    pulseTasks,
    nudgeVisible,
    dismissNudge,
    summaries,
    taskStats,
    todayInsight,
    driftCount,
    start: startSession,
    stop: stopSession,
    logManual,
    markReturn,
    refresh,
  } = useDriftSession();

  const [minimized, setMinimized] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [overlayDismissed, setOverlayDismissed] = useState(false);

  const logManualRef = useRef(logManual);
  const markReturnRef = useRef(markReturn);
  const stopRef = useRef(stopSession);
  logManualRef.current = logManual;
  markReturnRef.current = markReturn;
  stopRef.current = stopSession;

  const pipHandlers = useMemo(
    () => ({
      onClose: () => {
        setPipOpen(false);
        setMinimized(true);
        setOverlayDismissed(false);
      },
      onDismiss: () => {
        // X next to action: end the Drift watch session.
        stopRef.current();
        closeDriftPip();
        setPipOpen(false);
        setMinimized(false);
        setOverlayDismissed(true);
      },
      onOpenApp: () => {
        emitOpenFromDriftPip();
        closeDriftPip();
        setPipOpen(false);
        setMinimized(false);
        setOverlayDismissed(false);
      },
      onCountDrift: () => {
        logManualRef.current('other');
      },
      onMarkReturn: () => {
        markReturnRef.current();
      },
    }),
    [],
  );

  useEffect(() => {
    setDriftPipHandlers(pipHandlers);
  }, [pipHandlers]);

  const pipState = useMemo(
    () => ({
      intention: session?.intention ?? intentionDraft,
      driftCount,
      nudgeVisible,
    }),
    [session?.intention, intentionDraft, driftCount, nudgeVisible],
  );

  useEffect(() => {
    if (!minimized && !pipOpen) return;
    updateDriftPip(pipState);
  }, [minimized, pipOpen, pipState]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const sync = () => {
      const open = isDriftPipOpen();
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

  const minimize = useCallback(() => {
    if (!session) return;
    setOverlayDismissed(false);
    void openDriftPip(
      {
        intention: session.intention,
        driftCount,
        nudgeVisible,
      },
      pipHandlers,
    ).then((ok) => {
      setPipOpen(ok);
      setMinimized(true);
    });
  }, [session, driftCount, nudgeVisible, pipHandlers]);

  const minimizeRef = useRef(minimize);
  minimizeRef.current = minimize;

  /** Leaving the browser tab / app keeps watching via sticky chip (no Minimize button). */
  useEffect(() => {
    if (!session) return;

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
  }, [session]);

  const expand = useCallback(() => {
    closeDriftPip();
    setPipOpen(false);
    setMinimized(false);
    setOverlayDismissed(false);
  }, []);

  const dismissOverlay = useCallback(() => {
    stopSession();
    closeDriftPip();
    setPipOpen(false);
    setMinimized(false);
    setOverlayDismissed(true);
  }, [stopSession]);

  const stop = useCallback(() => {
    closeDriftPip();
    stopSession();
    setPipOpen(false);
    setMinimized(false);
    setOverlayDismissed(false);
  }, [stopSession]);

  const start = useCallback(() => {
    startSession();
    setPipOpen(false);
    setMinimized(false);
    setOverlayDismissed(false);
  }, [startSession]);

  const value = useMemo(
    () => ({
      session,
      intentionDraft,
      setIntentionDraft,
      selectedTaskId,
      setSelectedTaskId,
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
      minimized,
      pipOpen,
      overlayDismissed,
      minimize,
      expand,
      dismissOverlay,
    }),
    [
      session,
      intentionDraft,
      setIntentionDraft,
      selectedTaskId,
      setSelectedTaskId,
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
      minimized,
      pipOpen,
      overlayDismissed,
      minimize,
      expand,
      dismissOverlay,
    ],
  );

  return (
    <DriftContext.Provider value={value}>{children}</DriftContext.Provider>
  );
}

export function useDrift(): DriftContextValue {
  const ctx = useContext(DriftContext);
  if (!ctx) {
    throw new Error('useDrift must be used within DriftProvider');
  }
  return ctx;
}
