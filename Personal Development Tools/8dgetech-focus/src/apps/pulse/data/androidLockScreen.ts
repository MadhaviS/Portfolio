import { AppState, PermissionsAndroid, Platform, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import { PHASE_THEME, formatTimer, type PomodoroPhase } from '../domain/types';

export type AndroidLockAction = 'pause' | 'resume' | 'open';

type StickyModule = typeof import('react-native-sticky-notification').default;
type StickyOptions = import('react-native-sticky-notification').StickyNotificationOptions & {
  systemStyle?: boolean;
  usesChronometer?: boolean;
  chronometerCountDown?: boolean;
  showWhen?: boolean;
  when?: number;
  requestPromotedOngoing?: boolean;
  category?: string;
  shortCriticalText?: string;
};

type ChipModule = {
  canDrawOverlays: () => boolean;
  openOverlaySettings: () => void;
  showCountdown: (endsAtMs: number, accentHex?: string) => void;
  showPaused: (label: string, accentHex?: string) => void;
  hide: () => void;
};

const CHANNEL_ID = 'focus-pomodoro-timer-chrono';
const NOTIFICATION_ID = 82471;

const isExpoGo = Constants.appOwnership === 'expo';
const enabled = !isExpoGo && Platform.OS === 'android';

let sticky: StickyModule | null | undefined;
let chip: ChipModule | null | undefined;
let serviceActive = false;
let endsAtMs: number | null = null;
let pausedRemaining = 0;
let currentPhase: PomodoroPhase = 'focus';
let currentTaskTitle = 'Pulse';
let sessionMode: 'running' | 'paused' | 'idle' = 'idle';
/** Drift watch line stacked into the same sticky when both are active. */
let driftCompanion: {
  count: number;
  intention: string;
  nudgeVisible: boolean;
} | null = null;
let permissionAsked = false;
let overlayPrompted = false;
let actionWired = false;
let appStateWired = false;
let appState: AppStateStatus = AppState.currentState;

type ActionHandler = (action: AndroidLockAction) => void;
const actionHandlers = new Set<ActionHandler>();

function getSticky(): StickyModule | null {
  if (!enabled) return null;
  if (sticky !== undefined) return sticky;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sticky = require('react-native-sticky-notification').default as StickyModule;
  } catch {
    sticky = null;
  }
  return sticky;
}

function getChip(): ChipModule | null {
  if (!enabled) return null;
  if (chip !== undefined) return chip;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    chip = require('focus-timer-chip').focusTimerChip as ChipModule;
  } catch {
    chip = null;
  }
  return chip;
}

async function ensurePostNotifications(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (typeof Platform.Version === 'number' && Platform.Version < 33) return true;
  try {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (granted) return true;
    if (permissionAsked) return false;
    permissionAsked = true;
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function ensureOverlayPermission() {
  const mod = getChip();
  if (!mod) return;
  try {
    if (mod.canDrawOverlays()) return;
    if (overlayPrompted) return;
    overlayPrompted = true;
    // Opens system “Display over other apps” — required for Clock-like chip.
    mod.openOverlaySettings();
  } catch {
    // ignore
  }
}

function wireActions(mod: StickyModule) {
  if (actionWired) return;
  actionWired = true;
  mod.addActionListener((event) => {
    const id = event.actionId as AndroidLockAction;
    if (id === 'pause' || id === 'resume' || id === 'open') {
      actionHandlers.forEach((handler) => handler(id));
    }
  });
}

function wireAppState() {
  if (!enabled || appStateWired) return;
  appStateWired = true;
  AppState.addEventListener('change', (next) => {
    appState = next;
    void syncChip();
  });
}

function remainingSeconds(): number {
  if (endsAtMs != null) {
    return Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
  }
  return Math.max(0, pausedRemaining);
}

function driftSuffix(): string {
  if (!driftCompanion) return '';
  if (driftCompanion.nudgeVisible) return ' · Drift · come back';
  const intention = driftCompanion.intention.trim();
  return intention
    ? ` · Drift ×${driftCompanion.count} · ${intention}`
    : ` · Drift ×${driftCompanion.count}`;
}

function driftChipHint(): string | undefined {
  if (!driftCompanion) return undefined;
  if (driftCompanion.nudgeVisible) return 'Back?';
  return `D${driftCompanion.count}`;
}

function chronoOptions(
  title: string,
  text: string,
  accent: string,
  actions: StickyOptions['actions'],
  chrono: { endsAt?: number; countdown: boolean; chipText?: string },
): StickyOptions {
  return {
    channelId: CHANNEL_ID,
    channelName: 'Pulse timer',
    channelDescription: 'Ongoing Pulse countdown',
    notificationId: NOTIFICATION_ID,
    title,
    text,
    smallIcon: 'ic_stat_focus',
    color: accent,
    priority: 'low',
    ongoing: true,
    autoCancel: false,
    openAppOnAction: true,
    closeOnAction: false,
    repostOnDismiss: true,
    foregroundServiceBehavior: 'immediate',
    // Compact shade row with system chronometer (Clock-style countdown).
    systemStyle: true,
    requestPromotedOngoing: false,
    category: 'progress',
    shortCriticalText: chrono.chipText,
    usesChronometer: chrono.countdown && chrono.endsAt != null,
    chronometerCountDown: chrono.countdown && chrono.endsAt != null,
    showWhen: chrono.countdown && chrono.endsAt != null,
    when: chrono.endsAt,
    actions,
  };
}

async function present(options: StickyOptions) {
  const mod = getSticky();
  if (!mod) return;
  wireActions(mod);
  const ok = await ensurePostNotifications();
  if (!ok) return;
  try {
    if (serviceActive) {
      await mod.updateNotification(options);
    } else {
      await mod.startService(options);
      serviceActive = true;
    }
  } catch {
    try {
      await mod.startService(options);
      serviceActive = true;
    } catch {
      serviceActive = false;
    }
  }
}

async function hideService() {
  const mod = getSticky();
  if (!mod || !serviceActive) {
    serviceActive = false;
    return;
  }
  try {
    await mod.stopService();
  } catch {
    // ignore
  }
  serviceActive = false;
}

async function renderRunning() {
  const theme = PHASE_THEME[currentPhase];
  const endsAt = endsAtMs ?? Date.now() + remainingSeconds() * 1000;
  const left = remainingSeconds();
  const chip = [formatTimer(left), driftChipHint()].filter(Boolean).join(' · ');
  // Title/text stay static; Android chronometer (when) is the live countdown.
  await present(
    chronoOptions(
      currentTaskTitle,
      `${theme.label}${driftSuffix()}`,
      theme.bg,
      [
        { id: 'pause', title: 'Pause', payload: '/pomodoro' },
        { id: 'open', title: 'Open', payload: '/pomodoro' },
      ],
      {
        endsAt,
        countdown: true,
        chipText: chip,
      },
    ),
  );
}

async function renderPaused() {
  const theme = PHASE_THEME[currentPhase];
  const left = formatTimer(pausedRemaining);
  const chip = [left, driftChipHint()].filter(Boolean).join(' · ');
  await present(
    chronoOptions(
      left,
      `${currentTaskTitle} · Paused${driftSuffix()}`,
      theme.bg,
      [
        { id: 'resume', title: 'Resume', payload: '/pomodoro' },
        { id: 'open', title: 'Open', payload: '/pomodoro' },
      ],
      {
        countdown: false,
        chipText: chip,
      },
    ),
  );
}

async function renderDriftOnly() {
  if (!driftCompanion) return;
  const title = driftCompanion.nudgeVisible
    ? 'Come back'
    : `Drift ×${driftCompanion.count}`;
  const text = driftCompanion.nudgeVisible
    ? 'Tap Open to return'
    : driftCompanion.intention.trim() || 'Watching';
  await present(
    chronoOptions(
      title,
      text,
      PHASE_THEME.shortBreak.bg,
      [{ id: 'open', title: 'Open', payload: '/drift' }],
      {
        countdown: false,
        chipText: driftChipHint(),
      },
    ),
  );
}

/**
 * Round floating chip (unlocked home / lock when OEM allows overlay).
 * Shown whenever the session is active and the app is not in the foreground.
 */
function syncChip() {
  const mod = getChip();
  if (!mod) return;
  if (sessionMode === 'idle' || appState === 'active') {
    mod.hide();
    return;
  }
  const theme = PHASE_THEME[currentPhase];
  if (sessionMode === 'running' && endsAtMs != null) {
    mod.showCountdown(endsAtMs, theme.bg);
    return;
  }
  if (sessionMode === 'paused') {
    mod.showPaused(formatTimer(pausedRemaining), theme.bg);
  }
}

async function syncSessionUi() {
  if (!enabled) return;
  if (sessionMode === 'idle' && !driftCompanion) {
    await hideService();
    getChip()?.hide();
    return;
  }
  // Sticky notif stays up for lock screen + shade (even while in-app).
  if (sessionMode === 'running') {
    await renderRunning();
  } else if (sessionMode === 'paused') {
    await renderPaused();
  } else if (driftCompanion) {
    await renderDriftOnly();
  }
  syncChip();
}

export const androidLockScreen = {
  subscribe(handler: ActionHandler) {
    actionHandlers.add(handler);
    const mod = getSticky();
    if (mod) wireActions(mod);
    return () => {
      actionHandlers.delete(handler);
    };
  },

  async running(input: {
    phase: PomodoroPhase;
    endsAt: number;
    remaining: number;
    taskTitle?: string | null;
  }) {
    if (!enabled) return;
    wireAppState();
    ensureOverlayPermission();
    currentPhase = input.phase;
    currentTaskTitle = input.taskTitle?.trim() || PHASE_THEME[input.phase].label;
    endsAtMs = input.endsAt;
    pausedRemaining = input.remaining;
    sessionMode = 'running';
    await syncSessionUi();
  },

  async paused(input: {
    phase: PomodoroPhase;
    remaining: number;
    taskTitle?: string | null;
  }) {
    if (!enabled) return;
    wireAppState();
    ensureOverlayPermission();
    currentPhase = input.phase;
    currentTaskTitle = input.taskTitle?.trim() || PHASE_THEME[input.phase].label;
    endsAtMs = null;
    pausedRemaining = input.remaining;
    sessionMode = 'paused';
    await syncSessionUi();
  },

  async idle() {
    if (!enabled) return;
    endsAtMs = null;
    pausedRemaining = 0;
    sessionMode = 'idle';
    await syncSessionUi();
  },

  /** Stack Drift into the same Android sticky / Live Update chip as Pulse. */
  async setDriftCompanion(
    input: {
      count: number;
      intention: string;
      nudgeVisible: boolean;
    } | null,
  ) {
    if (!enabled) return;
    wireAppState();
    driftCompanion = input;
    await syncSessionUi();
  },
};
