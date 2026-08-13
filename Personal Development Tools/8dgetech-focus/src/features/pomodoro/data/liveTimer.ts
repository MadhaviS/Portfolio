import { storageGet, storageRemove, storageSet } from '../../../core/storage/webStorage';
import type { PomodoroPhase } from '../domain/types';

export type LiveTimerSnapshot = {
  userId: string;
  phase: PomodoroPhase;
  remaining: number;
  running: boolean;
  endsAt: number | null;
  sessionId: string | null;
};

const PHASES: PomodoroPhase[] = ['focus', 'shortBreak', 'longBreak'];

function keyFor(userId: string) {
  return `8dgetech.pomodoro.live.${userId}`;
}

export function readLiveTimer(userId: string): LiveTimerSnapshot | null {
  const raw = storageGet(keyFor(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LiveTimerSnapshot>;
    if (
      parsed.userId !== userId ||
      !PHASES.includes(parsed.phase as PomodoroPhase) ||
      typeof parsed.remaining !== 'number'
    ) {
      return null;
    }
    return {
      userId,
      phase: parsed.phase as PomodoroPhase,
      remaining: Math.max(0, Math.round(parsed.remaining)),
      running: !!parsed.running,
      endsAt:
        typeof parsed.endsAt === 'number' && Number.isFinite(parsed.endsAt)
          ? parsed.endsAt
          : null,
      sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : null,
    };
  } catch {
    return null;
  }
}

export function writeLiveTimer(snap: LiveTimerSnapshot): void {
  storageSet(keyFor(snap.userId), JSON.stringify(snap));
}

export function clearLiveTimer(userId: string): void {
  storageRemove(keyFor(userId));
}

/** Resolve remaining seconds from a snapshot (recompute if still running). */
export function resolveLiveRemaining(snap: LiveTimerSnapshot, now = Date.now()): number {
  if (snap.running && snap.endsAt != null) {
    return Math.max(0, Math.ceil((snap.endsAt - now) / 1000));
  }
  return Math.max(0, snap.remaining);
}
