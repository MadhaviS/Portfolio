import { Platform } from 'react-native';
import { PHASE_THEME, formatTimer, type PomodoroPhase } from '../domain/types';

export type PipTimerState = {
  remaining: number;
  /** Full phase length in seconds — used for lock-screen progress. */
  total: number;
  phase: PomodoroPhase;
  running: boolean;
  /** Active task title — shown under the countdown. */
  taskTitle: string | null;
  /** Wall-clock deadline so lock UI can tick without React updates. */
  endsAt: number | null;
};

type PipHandlers = {
  /** System PiP closed (browser chrome) — fall back to in-app bubble. */
  onClose: () => void;
  /** User tapped X — fully dismiss minimized UI. */
  onDismiss: () => void;
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

/** iOS Clock Live Activity–style chip (Document PiP). */
const PIP_W = 320;
const PIP_H = 88;
const CARD_BG = '#1C1C1E';
const BTN_MUTED = '#3A3A3C';
/** Square stopwatch face for Video PiP + Media Session lock artwork. */
const VIDEO_PIP_SIZE = 512;

function phaseAccent(phase: PomodoroPhase): string {
  return PHASE_THEME[phase].accent;
}

function phaseWash(phase: PomodoroPhase): string {
  return PHASE_THEME[phase].bg;
}

/** Remaining seconds from wall clock when running — stays accurate when JS is throttled. */
function liveRemaining(state: PipTimerState): number {
  if (state.running && state.endsAt != null) {
    return Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
  }
  return Math.max(0, state.remaining);
}

/** Feather stroke icons matching PhaseIconGlyph (watch / coffee / moon). */
function phaseIconSvg(phase: PomodoroPhase, color: string): string {
  const common =
    `viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  if (phase === 'focus') {
    return `<svg ${common} aria-hidden="true"><circle cx="12" cy="12" r="7"/><polyline points="12 9 12 12 13.5 13.5"/><path d="M16.51 17.35l-.35 3.83a2 2 0 0 1-2 1.82H9.83a2 2 0 0 1-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 2 1.82l.35 3.83"/></svg>`;
  }
  if (phase === 'shortBreak') {
    return `<svg ${common} aria-hidden="true"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`;
  }
  return `<svg ${common} aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

let pipWindow: Window | null = null;
let handlersRef: PipHandlers | null = null;
let silentClose = false;

/** Mobile Chrome fallback: canvas → video → system Video PiP (YouTube-style). */
let videoPip: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  raf: number | null;
  tick: ReturnType<typeof setInterval> | null;
  lastState: PipTimerState;
} | null = null;

/** Near-silent audio keeps Chrome from freezing Media Session updates on lock. */
let keepAlive: {
  ctx: AudioContext;
  osc: OscillatorNode;
  gain: GainNode;
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

export function canUseTimerPip(): boolean {
  return getPipApi() != null || canUseVideoPip();
}

export function isTimerPipOpen(): boolean {
  if (pipWindow != null && !pipWindow.closed) return true;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return document.pictureInPictureElement != null && videoPip != null;
  }
  return false;
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

function startKeepAlive() {
  if (keepAlive || typeof window === 'undefined') return;
  const AC =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return;
  try {
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // Near-silent — enough to keep the media session pipeline alive.
    gain.gain.value = 0.00001;
    osc.frequency.value = 20;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    void ctx.resume();
    keepAlive = { ctx, osc, gain };
  } catch {
    keepAlive = null;
  }
}

function stopKeepAlive() {
  if (!keepAlive) return;
  try {
    keepAlive.osc.stop();
    void keepAlive.ctx.close();
  } catch {
    // ignore
  }
  keepAlive = null;
}

function paint(win: Window, state: PipTimerState) {
  const root = win.document.getElementById('card');
  const time = win.document.getElementById('time');
  const task = win.document.getElementById('task');
  const icon = win.document.getElementById('phaseIcon');
  const toggle = win.document.getElementById('toggle');
  if (!root || !time || !task || !icon || !toggle) return;

  const accent = phaseAccent(state.phase);
  const left = liveRemaining(state);
  root.classList.toggle('breathing', !!state.running);
  time.textContent = formatTimer(left);
  task.textContent = taskLabel(state);
  task.title = taskLabel(state);
  icon.innerHTML = phaseIconSvg(state.phase, accent);
  toggle.style.background = accent;
  toggle.setAttribute('aria-label', state.running ? 'Pause' : 'Resume');
  toggle.innerHTML = state.running
    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff" aria-hidden="true"><path d="M8 5.5v13l11-6.5L8 5.5z"/></svg>';
  win.document.title = `${formatTimer(left)} · ${taskLabel(state)}`;
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
    #toggle { background: ${phaseAccent('focus')}; }
    #dismiss { background: ${BTN_MUTED}; }
  </style>`;

  win.document.body.innerHTML = `
    <div id="card">
      <div id="main">
        <span id="phaseIcon"></span>
        <div id="copy">
          <div id="time">00:00</div>
          <div id="task"></div>
        </div>
      </div>
      <div id="actions">
        <button type="button" id="toggle" title="Pause / Resume"></button>
        <button type="button" id="dismiss" title="Dismiss" aria-label="Dismiss">
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
    handlersRef?.onToggleRun();
  });
  win.document.getElementById('dismiss')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Close the PiP window and clear minimized UI (do not resurrect the bubble).
    handlersRef?.onDismiss();
  });
  win.document.getElementById('main')?.addEventListener('click', (e) => {
    e.stopPropagation();
    focusOpenerAndOpen();
  });
}

function drawVideoPipFrame(state: PipTimerState) {
  if (!videoPip) return;
  const { canvas } = videoPip;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = VIDEO_PIP_SIZE;
  const left = liveRemaining(state);
  const wash = phaseWash(state.phase);

  // Full-bleed stopwatch face — lock-screen Media Session artwork.
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, size, size);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font =
    '800 148px ui-monospace, SFMono-Regular, Menlo, "Courier New", monospace';
  ctx.fillText(formatTimer(left), size / 2, size / 2 - 28);

  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = '600 36px Outfit, system-ui, sans-serif';
  const label = taskLabel(state);
  let drawn = label;
  while (ctx.measureText(drawn).width > size - 80 && drawn.length > 1) {
    drawn = `${drawn.slice(0, -2)}…`;
  }
  ctx.fillText(drawn, size / 2, size / 2 + 88);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '700 28px Outfit, system-ui, sans-serif';
  ctx.fillText(
    state.running ? PHASE_THEME[state.phase].label : 'Paused',
    size / 2,
    size - 56,
  );
}

function syncVideoPlayback(state: PipTimerState) {
  if (!videoPip) return;
  const { video } = videoPip;
  if (state.running) {
    startKeepAlive();
    if (video.paused) {
      void video.play().catch(() => {});
    }
  } else {
    stopKeepAlive();
    if (!video.paused) {
      video.pause();
    }
  }
}

function refreshVideoPipFromClock() {
  if (!videoPip) return;
  drawVideoPipFrame(videoPip.lastState);
  syncVideoPlayback(videoPip.lastState);
  wireMediaSession(videoPip.lastState);
}

function wireMediaSession(state: PipTimerState) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    const left = liveRemaining(state);
    const artworkSrc = videoPip?.canvas.toDataURL('image/jpeg', 0.92);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: formatTimer(left),
      artist: taskLabel(state),
      album: PHASE_THEME[state.phase].label,
      artwork: artworkSrc
        ? [
            {
              src: artworkSrc,
              sizes: `${VIDEO_PIP_SIZE}x${VIDEO_PIP_SIZE}`,
              type: 'image/jpeg',
            },
          ]
        : [],
    });
    navigator.mediaSession.playbackState = state.running ? 'playing' : 'paused';

    const total = Math.max(1, state.total || left || 1);
    const position = Math.max(0, Math.min(total, total - left));
    try {
      navigator.mediaSession.setPositionState({
        duration: total,
        position,
        playbackRate: 1,
      });
    } catch {
      // Older Chrome builds reject some position states
    }

    navigator.mediaSession.setActionHandler('play', () => {
      if (videoPip?.lastState.running) return;
      handlersRef?.onToggleRun();
      if (videoPip) {
        videoPip.lastState = {
          ...videoPip.lastState,
          running: true,
          endsAt:
            videoPip.lastState.endsAt ??
            Date.now() + liveRemaining(videoPip.lastState) * 1000,
        };
        refreshVideoPipFromClock();
      }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (!videoPip?.lastState.running) return;
      handlersRef?.onToggleRun();
      if (videoPip) {
        const leftNow = liveRemaining(videoPip.lastState);
        videoPip.lastState = {
          ...videoPip.lastState,
          running: false,
          remaining: leftNow,
          endsAt: null,
        };
        refreshVideoPipFromClock();
      }
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      handlersRef?.onOpenApp();
    });
  } catch {
    // Media Session actions not fully supported
  }
}

function stopVideoPip(silent: boolean) {
  if (!videoPip) return;
  if (videoPip.raf != null) {
    cancelAnimationFrame(videoPip.raf);
    videoPip.raf = null;
  }
  if (videoPip.tick != null) {
    clearInterval(videoPip.tick);
    videoPip.tick = null;
  }
  stopKeepAlive();
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
  state: PipTimerState,
  handlers: PipHandlers,
): Promise<boolean> {
  if (!canUseVideoPip()) return false;
  handlersRef = handlers;

  if (videoPip && document.pictureInPictureElement === videoPip.video) {
    videoPip.lastState = state;
    refreshVideoPipFromClock();
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

  const stream = canvas.captureStream(15);
  video.srcObject = stream;

  videoPip = {
    video,
    canvas,
    raf: null,
    tick: null,
    lastState: state,
  };
  refreshVideoPipFromClock();
  videoPip.tick = setInterval(refreshVideoPipFromClock, 1000);

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

export async function openTimerPip(
  state: PipTimerState,
  handlers: PipHandlers,
): Promise<boolean> {
  handlersRef = handlers;

  // Desktop Chrome: interactive Document PiP
  const api = getPipApi();
  if (api) {
    try {
      if (pipWindow && !pipWindow.closed) {
        // Never keep Video PiP alongside Document PiP.
        if (videoPip) stopVideoPip(true);
        paint(pipWindow, state);
        return true;
      }
      // Close any leftover Video PiP before opening Document PiP.
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
      // fall through to video PiP
    }
  }

  // Mobile Chrome / Safari: YouTube-style floating Video PiP over other apps
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

export function updateTimerPip(state: PipTimerState) {
  if (pipWindow && !pipWindow.closed) {
    paint(pipWindow, state);
  }
  if (videoPip) {
    videoPip.lastState = state;
    refreshVideoPipFromClock();
  }
}

export function closeTimerPip() {
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
