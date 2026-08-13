import { Platform } from 'react-native';
import { PHASE_THEME, formatTimer, type PomodoroPhase } from '../domain/types';

export type PipTimerState = {
  remaining: number;
  phase: PomodoroPhase;
  running: boolean;
  /** Active task title — shown in the round minimized window. */
  taskTitle: string | null;
};

type PipHandlers = {
  onClose: () => void;
  onOpenApp: () => void;
  onToggleRun: () => void;
};

type PipApi = {
  requestWindow: (opts?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
  }) => Promise<Window>;
};

const PIP_SIZE = 196;

let pipWindow: Window | null = null;
let handlersRef: PipHandlers | null = null;
let silentClose = false;

function getPipApi(): PipApi | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const api = (window as Window & { documentPictureInPicture?: PipApi })
    .documentPictureInPicture;
  return api ?? null;
}

export function canUseTimerPip(): boolean {
  return getPipApi() != null;
}

export function isTimerPipOpen(): boolean {
  return pipWindow != null && !pipWindow.closed;
}

export function setTimerPipHandlers(handlers: PipHandlers) {
  handlersRef = handlers;
}

function taskLabel(state: PipTimerState): string {
  const title = state.taskTitle?.trim();
  if (title) return title;
  if (state.phase === 'shortBreak') return 'Short break';
  if (state.phase === 'longBreak') return 'Long break';
  return 'Focus';
}

function paint(win: Window, state: PipTimerState) {
  const root = win.document.getElementById('card');
  const time = win.document.getElementById('time');
  const task = win.document.getElementById('task');
  const label = win.document.getElementById('label');
  const toggle = win.document.getElementById('toggle');
  if (!root || !time || !task || !label || !toggle) return;

  const theme = PHASE_THEME[state.phase];
  const phaseName =
    state.phase === 'focus'
      ? 'FOCUS'
      : state.phase === 'shortBreak'
        ? 'SHORT BREAK'
        : 'LONG BREAK';
  root.style.background = theme.bg;
  root.classList.toggle('breathing', !!state.running);
  time.textContent = formatTimer(state.remaining);
  task.textContent = taskLabel(state);
  task.title = taskLabel(state);
  label.textContent = phaseName;
  toggle.setAttribute('aria-label', state.running ? 'Pause' : 'Resume');
  toggle.innerHTML = state.running
    ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
    : '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5L8 5.5z"/></svg>';
  win.document.title = `${formatTimer(state.remaining)} · ${taskLabel(state)}`;
}

function mount(win: Window, state: PipTimerState) {
  win.document.head.innerHTML = `<style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; height: 100%;
      background: transparent;
      font-family: "Outfit", "Segoe UI", system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    #card {
      /* Leave margin so the circle never clips Chrome's PiP frame */
      width: ${PIP_SIZE - 36}px;
      height: ${PIP_SIZE - 36}px;
      border-radius: 50%;
      padding: 16px 14px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      color: #fff;
      border: 2px solid rgba(255,255,255,.32);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.18),
        0 8px 22px rgba(0,0,0,.24);
      user-select: none;
      transform-origin: center center;
      text-align: center;
    }
    #card.breathing {
      animation: breathe 6.4s ease-in-out infinite;
    }
    /* Inward pulse only — scaling up clips the round edge in PiP */
    @keyframes breathe {
      0%, 100% {
        transform: scale(1);
        border-color: rgba(255,255,255,.32);
      }
      50% {
        transform: scale(0.96);
        border-color: rgba(255,255,255,.5);
      }
    }
    #task {
      max-width: 100%;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.25;
      letter-spacing: 0.01em;
      opacity: 0.95;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      padding: 0 6px;
    }
    #label {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.1em;
      opacity: 0.72;
      text-transform: uppercase;
    }
    #time {
      font-size: 28px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.04em;
      line-height: 1;
      margin: 2px 0 6px;
      cursor: pointer;
    }
    #actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    button {
      appearance: none; border: 0; cursor: pointer;
      color: #fff; background: rgba(255,255,255,.16);
      border: 1px solid rgba(255,255,255,.22);
      height: 32px; width: 32px; border-radius: 999px;
      display: inline-flex; align-items: center; justify-content: center;
      transition: background .15s ease, transform .12s ease;
    }
    button:hover { background: rgba(255,255,255,.26); }
    button:active { transform: scale(0.97); }
    #toggle {
      background: rgba(255,255,255,.92); color: #1a1a1a;
      border-color: transparent;
    }
    #toggle:hover { background: #fff; }
  </style>`;

  win.document.body.innerHTML = `
    <div id="card">
      <div id="task"></div>
      <div id="label"></div>
      <div id="time">00:00</div>
      <div id="actions">
        <button type="button" id="toggle" title="Pause / Resume"></button>
        <button type="button" id="open" title="Open timer" aria-label="Open timer">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  paint(win, state);

  const focusOpenerAndOpen = () => {
    try {
      window.focus();
    } catch {
      // ignore
    }
    try {
      win.opener?.focus();
    } catch {
      // ignore
    }
    handlersRef?.onOpenApp();
  };

  win.document.getElementById('toggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlersRef?.onToggleRun();
  });
  win.document.getElementById('open')?.addEventListener('click', (e) => {
    e.stopPropagation();
    focusOpenerAndOpen();
  });
  win.document.getElementById('time')?.addEventListener('click', (e) => {
    e.stopPropagation();
    focusOpenerAndOpen();
  });
  win.document.getElementById('time')?.setAttribute(
    'title',
    'Open pomodoro tab',
  );
}

export async function openTimerPip(
  state: PipTimerState,
  handlers: PipHandlers,
): Promise<boolean> {
  const api = getPipApi();
  if (!api) return false;
  handlersRef = handlers;
  try {
    if (pipWindow && !pipWindow.closed) {
      paint(pipWindow, state);
      return true;
    }
    const win = await api.requestWindow({
      width: PIP_SIZE,
      height: PIP_SIZE,
      disallowReturnToOpener: false,
    });
    pipWindow = win;
    mount(win, state);
    win.addEventListener('pagehide', () => {
      pipWindow = null;
      if (silentClose) {
        silentClose = false;
        return;
      }
      handlersRef?.onClose();
    });
    return true;
  } catch {
    return false;
  }
}

export function updateTimerPip(state: PipTimerState) {
  if (!pipWindow || pipWindow.closed) return;
  paint(pipWindow, state);
}

export function closeTimerPip() {
  if (!pipWindow) return;
  silentClose = true;
  try {
    pipWindow.close();
  } catch {
    // ignore
  }
  pipWindow = null;
}

let openAppListener: (() => void) | null = null;

/** Register app-level handler to open the full pomodoro screen (all platforms). */
export function subscribeOpenFromPip(onOpen: () => void): () => void {
  openAppListener = onOpen;
  return () => {
    if (openAppListener === onOpen) openAppListener = null;
  };
}

export function emitOpenFromPip() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.focus();
    } catch {
      // ignore
    }
  }
  openAppListener?.();
}
