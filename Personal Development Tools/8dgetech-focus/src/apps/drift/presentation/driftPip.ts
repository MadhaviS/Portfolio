import { Platform } from 'react-native';
import { PHASE_THEME } from '../../pulse/domain/types';

export type PipDriftState = {
  intention: string;
  driftCount: number;
  nudgeVisible: boolean;
};

type PipHandlers = {
  onClose: () => void;
  onDismiss: () => void;
  onOpenApp: () => void;
  /** Quick-count a drift (+). */
  onCountDrift: () => void;
  /** Acknowledge return when nudge is showing. */
  onMarkReturn: () => void;
};

type PipApi = {
  requestWindow: (opts?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
  }) => Promise<Window>;
};

/** Same chip size as Pulse Document PiP. */
const PIP_W = 320;
const PIP_H = 88;
const CARD_BG = '#1C1C1E';
const BTN_MUTED = '#3A3A3C';
const ACCENT = PHASE_THEME.shortBreak.accent;
const VIDEO_PIP_SIZE = 512;

let pipWindow: Window | null = null;
let handlersRef: PipHandlers | null = null;
let silentClose = false;
let lastState: PipDriftState = {
  intention: 'Watching',
  driftCount: 0,
  nudgeVisible: false,
};

let videoPip: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  tick: ReturnType<typeof setInterval> | null;
} | null = null;

function getPipApi(): PipApi | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const api = (window as Window & { documentPictureInPicture?: PipApi })
    .documentPictureInPicture;
  return api ?? null;
}

function canUseVideoPip(): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const doc = document as Document & { pictureInPictureEnabled?: boolean };
  return (
    !!doc.pictureInPictureEnabled &&
    typeof HTMLVideoElement !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof (HTMLCanvasElement.prototype as HTMLCanvasElement).captureStream ===
      'function'
  );
}

export function isDriftPipOpen(): boolean {
  if (pipWindow != null && !pipWindow.closed) return true;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return document.pictureInPictureElement != null && videoPip != null;
  }
  return false;
}

export function setDriftPipHandlers(handlers: PipHandlers) {
  handlersRef = handlers;
}

function windIconSvg(color: string): string {
  const common =
    `viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg ${common} aria-hidden="true"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>`;
}

function primaryLabel(state: PipDriftState): string {
  if (state.nudgeVisible) return 'Come back';
  return `${state.driftCount}`;
}

function secondaryLabel(state: PipDriftState): string {
  if (state.nudgeVisible) return 'Tap to return';
  const title = state.intention.trim() || 'Watching';
  return title;
}

function paint(win: Window, state: PipDriftState) {
  const root = win.document.getElementById('card');
  const time = win.document.getElementById('time');
  const task = win.document.getElementById('task');
  const icon = win.document.getElementById('phaseIcon');
  const toggle = win.document.getElementById('toggle');
  if (!root || !time || !task || !icon || !toggle) return;

  root.classList.toggle('breathing', !state.nudgeVisible);
  time.textContent = primaryLabel(state);
  task.textContent = secondaryLabel(state);
  task.title = secondaryLabel(state);
  icon.innerHTML = windIconSvg(ACCENT);
  toggle.style.background = ACCENT;
  if (state.nudgeVisible) {
    toggle.setAttribute('aria-label', 'I am back');
    toggle.title = 'I am back';
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
  } else {
    toggle.setAttribute('aria-label', 'Count a drift');
    toggle.title = 'Count a drift';
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  }
  win.document.title = `Drift · ${secondaryLabel(state)}`;
}

function mount(win: Window, state: PipDriftState) {
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
      width: ${PIP_W - 24}px;
      height: ${PIP_H - 16}px;
      border-radius: 999px;
      padding: 0 10px 0 16px;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0;
      color: #fff;
      background: ${CARD_BG};
      box-shadow: 0 8px 22px rgba(0,0,0,.35);
      user-select: none;
      transform-origin: center center;
    }
    #card.breathing {
      animation: breathe 6.4s ease-in-out infinite;
    }
    @keyframes breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(0.985); }
    }
    #main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding-right: 8px;
    }
    #phaseIcon {
      flex-shrink: 0;
      width: 26px;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    #phaseIcon svg { display: block; }
    #copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    #time {
      font-size: 22px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.03em;
      line-height: 1.15;
      color: #fff;
    }
    #task {
      font-size: 13px;
      font-weight: 500;
      line-height: 1.2;
      color: rgba(255,255,255,.78);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
    }
    #actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    button {
      appearance: none; border: 0; cursor: pointer;
      color: #fff;
      height: 40px; width: 40px; border-radius: 999px;
      display: inline-flex; align-items: center; justify-content: center;
      transition: opacity .15s ease, transform .12s ease;
    }
    button:active { transform: scale(0.97); opacity: 0.85; }
    #toggle { background: ${ACCENT}; }
    #dismiss { background: ${BTN_MUTED}; }
  </style>`;

  win.document.body.innerHTML = `
    <div id="card">
      <div id="main">
        <span id="phaseIcon"></span>
        <div id="copy">
          <div id="time">0</div>
          <div id="task"></div>
        </div>
      </div>
      <div id="actions">
        <button type="button" id="toggle" title="Count a drift"></button>
        <button type="button" id="dismiss" title="End session" aria-label="End Drift session">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
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
    if (lastState.nudgeVisible) handlersRef?.onMarkReturn();
    else handlersRef?.onCountDrift();
  });
  win.document.getElementById('dismiss')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handlersRef?.onDismiss();
  });
  win.document.getElementById('main')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (lastState.nudgeVisible) {
      handlersRef?.onMarkReturn();
      return;
    }
    focusOpenerAndOpen();
  });
}

function drawVideoPipFrame(state: PipDriftState) {
  if (!videoPip) return;
  const { canvas } = videoPip;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = VIDEO_PIP_SIZE;

  ctx.fillStyle = PHASE_THEME.shortBreak.bg;
  ctx.fillRect(0, 0, size, size);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font =
    '800 148px ui-monospace, SFMono-Regular, Menlo, "Courier New", monospace';
  ctx.fillText(String(state.driftCount), size / 2, size / 2 - 28);

  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = '600 36px Outfit, system-ui, sans-serif';
  let drawn = secondaryLabel(state);
  while (ctx.measureText(drawn).width > size - 80 && drawn.length > 1) {
    drawn = `${drawn.slice(0, -2)}…`;
  }
  ctx.fillText(drawn, size / 2, size / 2 + 88);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '700 28px Outfit, system-ui, sans-serif';
  ctx.fillText(state.nudgeVisible ? 'Come back' : 'Drift', size / 2, size - 56);
}

function stopVideoPip(silent: boolean) {
  if (!videoPip) return;
  if (videoPip.tick != null) {
    clearInterval(videoPip.tick);
    videoPip.tick = null;
  }
  const { video } = videoPip;
  try {
    if (document.pictureInPictureElement === video) {
      silentClose = silent;
      void document.exitPictureInPicture();
    }
  } catch {
    // ignore
  }
  try {
    video.pause();
    const stream = video.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    video.remove();
  } catch {
    // ignore
  }
  videoPip = null;
  if (!silent) {
    handlersRef?.onClose();
  }
}

async function openVideoPip(
  state: PipDriftState,
  handlers: PipHandlers,
): Promise<boolean> {
  if (!canUseVideoPip()) return false;
  handlersRef = handlers;
  lastState = state;

  if (videoPip && document.pictureInPictureElement === videoPip.video) {
    drawVideoPipFrame(state);
    return true;
  }

  stopVideoPip(true);

  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_PIP_SIZE;
  canvas.height = VIDEO_PIP_SIZE;

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.style.position = 'fixed';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  video.style.bottom = '0';
  video.style.right = '0';
  document.body.appendChild(video);

  const stream = canvas.captureStream(8);
  video.srcObject = stream;
  videoPip = { video, canvas, tick: null };
  drawVideoPipFrame(state);
  videoPip.tick = setInterval(() => drawVideoPipFrame(lastState), 1000);

  const onLeave = () => {
    video.removeEventListener('leavepictureinpicture', onLeave);
    if (silentClose) {
      silentClose = false;
      stopVideoPip(true);
      return;
    }
    stopVideoPip(false);
  };
  video.addEventListener('leavepictureinpicture', onLeave);

  try {
    await video.play();
    await video.requestPictureInPicture();
    return true;
  } catch {
    stopVideoPip(true);
    return false;
  }
}

export async function openDriftPip(
  state: PipDriftState,
  handlers: PipHandlers,
): Promise<boolean> {
  handlersRef = handlers;
  lastState = state;

  const api = getPipApi();
  if (api) {
    try {
      if (pipWindow && !pipWindow.closed) {
        if (videoPip) stopVideoPip(true);
        paint(pipWindow, state);
        return true;
      }
      if (videoPip) stopVideoPip(true);
      const win = await api.requestWindow({
        width: PIP_W,
        height: PIP_H,
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
      // fall through
    }
  }

  if (pipWindow && !pipWindow.closed) {
    try {
      silentClose = true;
      pipWindow.close();
    } catch {
      // ignore
    }
    pipWindow = null;
  }
  return openVideoPip(state, handlers);
}

export function updateDriftPip(state: PipDriftState) {
  lastState = state;
  if (pipWindow && !pipWindow.closed) {
    paint(pipWindow, state);
  }
  if (videoPip) {
    drawVideoPipFrame(state);
  }
}

export function closeDriftPip() {
  if (pipWindow) {
    silentClose = true;
    try {
      pipWindow.close();
    } catch {
      // ignore
    }
    pipWindow = null;
  }
  if (videoPip) {
    stopVideoPip(true);
  }
}

let openAppListener: (() => void) | null = null;

export function subscribeOpenFromDriftPip(onOpen: () => void): () => void {
  openAppListener = onOpen;
  return () => {
    if (openAppListener === onOpen) openAppListener = null;
  };
}

export function emitOpenFromDriftPip() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.focus();
    } catch {
      // ignore
    }
  }
  openAppListener?.();
}
