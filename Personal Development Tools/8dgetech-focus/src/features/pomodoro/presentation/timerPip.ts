import { Platform } from 'react-native';
import { PHASE_THEME, formatTimer, type PomodoroPhase } from '../domain/types';

export type PipTimerState = {
  remaining: number;
  phase: PomodoroPhase;
  running: boolean;
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

function paint(win: Window, state: PipTimerState) {
  const root = win.document.getElementById('card');
  const time = win.document.getElementById('time');
  const label = win.document.getElementById('label');
  const icon = win.document.getElementById('icon');
  const toggle = win.document.getElementById('toggle');
  if (!root || !time || !label || !toggle) return;

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
  label.textContent = phaseName;
  if (icon) {
    icon.textContent =
      state.phase === 'focus' ? '◎' : state.phase === 'shortBreak' ? '☕' : '☾';
  }
  toggle.setAttribute('aria-label', state.running ? 'Pause' : 'Resume');
  toggle.innerHTML = state.running
    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5L8 5.5z"/></svg>';
  win.document.title = `${formatTimer(state.remaining)} · ${phaseName}`;
}

function mount(win: Window, state: PipTimerState) {
  win.document.head.innerHTML = `<style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; height: 100%;
      background: transparent;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    #card {
      width: 100%; height: 100%;
      padding: 14px 14px 12px;
      display: flex; flex-direction: column; justify-content: space-between;
      color: #fff;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,.28);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.18);
      user-select: none;
      transform-origin: center;
    }
    #card.breathing {
      animation: breathe 6.4s ease-in-out infinite;
    }
    @keyframes breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.025); }
    }
    #top {
      display: flex; align-items: center; gap: 6px;
    }
    #icon { font-size: 14px; line-height: 1; }
    #label {
      font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
      opacity: 0.92;
    }
    #time {
      font-size: 34px; font-weight: 800;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.04em;
      line-height: 1;
      margin: 6px 0 10px;
    }
    #actions {
      display: flex; align-items: center; gap: 8px;
    }
    button {
      appearance: none; border: 0; cursor: pointer;
      color: #fff; background: rgba(255,255,255,.16);
      border: 1px solid rgba(255,255,255,.22);
      height: 36px; width: 36px; border-radius: 999px;
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
      <div id="top">
        <span id="icon" aria-hidden="true"></span>
        <span id="label"></span>
      </div>
      <div id="time">00:00</div>
      <div id="actions">
        <button type="button" id="toggle" title="Pause / Resume"></button>
        <button type="button" id="open" title="Open timer" aria-label="Open timer">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  paint(win, state);

  win.document.getElementById('toggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlersRef?.onToggleRun();
  });
  win.document.getElementById('open')?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlersRef?.onOpenApp();
  });
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
      width: 248,
      height: 148,
      disallowReturnToOpener: true,
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
  openAppListener?.();
}
