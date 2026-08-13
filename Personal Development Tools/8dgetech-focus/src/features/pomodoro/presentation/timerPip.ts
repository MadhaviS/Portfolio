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

const OPEN_APP_EVENT = '8dgetech-open-pomodoro';

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
  const status = win.document.getElementById('status');
  const toggle = win.document.getElementById('toggle');
  if (!root || !time || !label || !status || !toggle) return;

  const theme = PHASE_THEME[state.phase];
  root.style.background = theme.bg;
  time.textContent = formatTimer(state.remaining);
  label.textContent = theme.label;
  status.textContent = state.running ? 'Running' : 'Paused';
  status.dataset.running = state.running ? '1' : '0';
  toggle.setAttribute('aria-label', state.running ? 'Pause' : 'Resume');
  toggle.innerHTML = state.running
    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5L8 5.5z"/></svg>';
  win.document.title = `${formatTimer(state.remaining)} · ${theme.label}`;
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
    }
    #top {
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px;
    }
    #label {
      font-size: 12px; font-weight: 700; letter-spacing: 0.02em;
      opacity: 0.92;
    }
    #status {
      font-size: 11px; font-weight: 600;
      padding: 3px 8px; border-radius: 999px;
      background: rgba(255,255,255,.16);
      border: 1px solid rgba(255,255,255,.18);
    }
    #status[data-running="0"] {
      background: rgba(0,0,0,.18);
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
      height: 36px; border-radius: 999px;
      display: inline-flex; align-items: center; justify-content: center;
      gap: 6px; padding: 0 12px;
      font: 700 12px/1 inherit;
      transition: background .15s ease, transform .12s ease;
    }
    button:hover { background: rgba(255,255,255,.26); }
    button:active { transform: scale(0.97); }
    #toggle {
      width: 40px; padding: 0;
      background: rgba(255,255,255,.92); color: #1a1a1a;
      border-color: transparent;
    }
    #toggle:hover { background: #fff; }
    #open { flex: 1; }
    #close {
      width: 36px; padding: 0;
      background: rgba(0,0,0,.18);
    }
  </style>`;

  win.document.body.innerHTML = `
    <div id="card">
      <div id="top">
        <span id="label"></span>
        <span id="status"></span>
      </div>
      <div id="time">00:00</div>
      <div id="actions">
        <button type="button" id="toggle" title="Pause / Resume"></button>
        <button type="button" id="open" title="Open timer">Open</button>
        <button type="button" id="close" title="Close" aria-label="Close">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18"/>
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
  win.document.getElementById('close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlersRef?.onClose();
    closeTimerPip();
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

export function subscribeOpenFromPip(onOpen: () => void): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => {};
  const handler = () => onOpen();
  window.addEventListener(OPEN_APP_EVENT, handler);
  return () => window.removeEventListener(OPEN_APP_EVENT, handler);
}

export function emitOpenFromPip() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OPEN_APP_EVENT));
}
