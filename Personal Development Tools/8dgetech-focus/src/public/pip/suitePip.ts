/**
 * Single system PiP for Focus suite (Pulse and/or Drift stacked).
 * - Desktop Chrome: Document Picture-in-Picture
 * - Android / mobile Chrome: shared Video PiP (one window; canvas draws both rows)
 */
import { Platform } from 'react-native';
import {
  PHASE_THEME,
  formatTimer,
  type PomodoroPhase,
} from '../../apps/pulse/domain/types';

export type SuitePulseState = {
  remaining: number;
  total: number;
  phase: PomodoroPhase;
  running: boolean;
  taskTitle: string | null;
  endsAt: number | null;
};

export type SuiteDriftState = {
  intention: string;
  driftCount: number;
  nudgeVisible: boolean;
};

export type SuitePulseHandlers = {
  onClose: () => void;
  onDismiss: () => void;
  onOpenApp: () => void;
  onToggleRun: () => void;
  onPause?: () => void;
  onResume?: () => void;
};

export type SuiteDriftHandlers = {
  onClose: () => void;
  onDismiss: () => void;
  onOpenApp: () => void;
  onCountDrift: () => void;
  onMarkReturn: () => void;
};

type PipApi = {
  requestWindow: (opts?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
  }) => Promise<Window>;
};

const PIP_W = 320;
const ROW_H = 88;
const STACK_GAP = 8;
const CARD_BG = '#1C1C1E';
const BTN_MUTED = '#3A3A3C';
const DRIFT_ACCENT = PHASE_THEME.shortBreak.bg;
const VIDEO_PIP_SIZE = 512;

let pipWindow: Window | null = null;
let silentClose = false;
let pulseState: SuitePulseState | null = null;
let driftState: SuiteDriftState | null = null;
let pulseHandlers: SuitePulseHandlers | null = null;
let driftHandlers: SuiteDriftHandlers | null = null;
let layoutKey: string | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;

/** Android / mobile: one Video PiP shared by Pulse + Drift. */
let videoPip: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  tick: ReturnType<typeof setInterval> | null;
} | null = null;
let videoLeaveWired = false;
let applyingVideoSync = false;
let pageHiddenAtMs = 0;
let keepAlive: {
  ctx: AudioContext;
  osc: OscillatorNode;
  gain: GainNode;
} | null = null;

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pageHiddenAtMs = Date.now();
  });
}

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

function phaseAccent(phase: PomodoroPhase): string {
  return PHASE_THEME[phase].accent;
}

function liveRemaining(state: SuitePulseState): number {
  if (state.running && state.endsAt != null) {
    return Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
  }
  return Math.max(0, state.remaining);
}

function pulseTaskLabel(state: SuitePulseState): string {
  const title = state.taskTitle?.trim();
  if (title) return title;
  if (state.phase === 'shortBreak') return 'Short break';
  if (state.phase === 'longBreak') return 'Long break';
  return 'Focus';
}

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

function windIconSvg(color: string): string {
  const common =
    `viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg ${common} aria-hidden="true"><path d="M9.59 4.59A2 2 0 1 1 11 8H2"/><path d="M12.59 19.41A2 2 0 1 0 14 16H2"/><path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2"/></svg>`;
}

function xButtonSvg(): string {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`;
}

function pipHeight(): number {
  const rows = (pulseState ? 1 : 0) + (driftState ? 1 : 0);
  if (rows <= 0) return ROW_H;
  if (rows === 1) return ROW_H;
  return ROW_H * 2 + STACK_GAP;
}

function currentLayoutKey(): string {
  return `${pulseState ? 'p' : ''}${driftState ? 'd' : ''}:${pipHeight()}`;
}

function focusOpener() {
  try {
    window.focus();
  } catch {
    // ignore
  }
  try {
    pipWindow?.opener?.focus();
  } catch {
    // ignore
  }
}

function paintPulseRow(win: Window) {
  if (!pulseState) return;
  const state = pulseState;
  const root = win.document.getElementById('pulse-card');
  const time = win.document.getElementById('pulse-time');
  const task = win.document.getElementById('pulse-task');
  const icon = win.document.getElementById('pulse-icon');
  const toggle = win.document.getElementById('pulse-toggle') as HTMLButtonElement | null;
  if (!root || !time || !task || !icon || !toggle) return;

  const accent = phaseAccent(state.phase);
  const left = liveRemaining(state);
  root.classList.toggle('breathing', !!state.running);
  time.textContent = formatTimer(left);
  const label = pulseTaskLabel(state);
  task.textContent = label;
  task.setAttribute('title', label);
  icon.innerHTML = phaseIconSvg(state.phase, accent);
  toggle.style.background = accent;
  toggle.setAttribute('aria-label', state.running ? 'Pause' : 'Resume');
  toggle.innerHTML = state.running
    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff" aria-hidden="true"><path d="M8 5.5v13l11-6.5L8 5.5z"/></svg>';
}

function paintDriftRow(win: Window) {
  if (!driftState) return;
  const state = driftState;
  const root = win.document.getElementById('drift-card');
  const time = win.document.getElementById('drift-time');
  const task = win.document.getElementById('drift-task');
  const icon = win.document.getElementById('drift-icon');
  const toggle = win.document.getElementById('drift-toggle') as HTMLButtonElement | null;
  if (!root || !time || !task || !icon || !toggle) return;

  root.classList.toggle('breathing', !state.nudgeVisible);
  time.textContent = state.nudgeVisible ? 'Back?' : String(state.driftCount);
  const secondary = state.nudgeVisible
    ? 'Tap to return'
    : state.intention.trim() || 'Watching';
  task.textContent = secondary;
  task.setAttribute('title', secondary);
  icon.innerHTML = windIconSvg(DRIFT_ACCENT);
  toggle.style.background = DRIFT_ACCENT;
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
}

function paint(win: Window) {
  paintPulseRow(win);
  paintDriftRow(win);
  const parts: string[] = [];
  if (pulseState) {
    parts.push(`${formatTimer(liveRemaining(pulseState))} · Pulse`);
  }
  if (driftState) {
    parts.push(`Drift · ${driftState.driftCount}`);
  }
  win.document.title = parts.join(' · ') || 'Focus';
}

function rowHtml(
  id: 'pulse' | 'drift',
  toggleTitle: string,
  dismissTitle: string,
  dismissLabel: string,
): string {
  const accent = id === 'pulse' ? phaseAccent('focus') : DRIFT_ACCENT;
  return `
    <div class="card" id="${id}-card">
      <div class="main" id="${id}-main">
        <span class="icon" id="${id}-icon"></span>
        <div class="copy">
          <div class="time" id="${id}-time">—</div>
          <div class="task" id="${id}-task"></div>
        </div>
      </div>
      <div class="actions">
        <button type="button" id="${id}-toggle" title="${toggleTitle}" style="background:${accent}"></button>
        <button type="button" id="${id}-dismiss" title="${dismissTitle}" aria-label="${dismissLabel}" style="background:${BTN_MUTED}">
          ${xButtonSvg()}
        </button>
      </div>
    </div>`;
}

function mount(win: Window) {
  const h = pipHeight();
  const dual = !!(pulseState && driftState);
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
    #stack {
      width: ${PIP_W - 16}px;
      height: ${h - 12}px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: ${dual ? STACK_GAP : 0}px;
    }
    .card {
      width: 100%;
      height: ${ROW_H - 16}px;
      border-radius: 999px;
      padding: 0 10px 0 16px;
      display: flex;
      flex-direction: row;
      align-items: center;
      color: #fff;
      background: ${CARD_BG};
      box-shadow: 0 8px 22px rgba(0,0,0,.35);
      user-select: none;
      transform-origin: center center;
    }
    .card.breathing {
      animation: breathe 6.4s ease-in-out infinite;
    }
    @keyframes breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(0.985); }
    }
    .main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding-right: 8px;
    }
    .icon {
      flex-shrink: 0;
      width: 26px;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .icon svg { display: block; }
    .copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .time {
      font-size: 22px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.03em;
      line-height: 1.15;
      color: #fff;
    }
    .task {
      font-size: 13px;
      font-weight: 500;
      line-height: 1.2;
      color: rgba(255,255,255,.78);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
    }
    .actions {
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
  </style>`;

  const rows: string[] = [];
  if (pulseState) {
    rows.push(
      rowHtml('pulse', 'Pause / Resume', 'Stop & reset', 'Stop and reset timer'),
    );
  }
  if (driftState) {
    rows.push(
      rowHtml('drift', 'Count a drift', 'End session', 'End Drift session'),
    );
  }
  win.document.body.innerHTML = `<div id="stack">${rows.join('')}</div>`;
  paint(win);
  wire(win);
  layoutKey = currentLayoutKey();
}

function wire(win: Window) {
  win.document.getElementById('pulse-toggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    pulseHandlers?.onToggleRun();
  });
  win.document.getElementById('pulse-dismiss')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    pulseHandlers?.onDismiss();
  });
  win.document.getElementById('pulse-main')?.addEventListener('click', (e) => {
    e.stopPropagation();
    focusOpener();
    pulseHandlers?.onOpenApp();
  });

  win.document.getElementById('drift-toggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (driftState?.nudgeVisible) driftHandlers?.onMarkReturn();
    else driftHandlers?.onCountDrift();
  });
  win.document.getElementById('drift-dismiss')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    driftHandlers?.onDismiss();
  });
  win.document.getElementById('drift-main')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (driftState?.nudgeVisible) {
      driftHandlers?.onMarkReturn();
      return;
    }
    focusOpener();
    driftHandlers?.onOpenApp();
  });
}

function stopTick() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function ensureTick() {
  stopTick();
  if (!pipWindow || pipWindow.closed || !pulseState) return;
  tickTimer = setInterval(() => {
    if (!pipWindow || pipWindow.closed || !pulseState) {
      stopTick();
      return;
    }
    paintPulseRow(pipWindow);
  }, 1000);
}

function ellipsize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  let drawn = text;
  while (ctx.measureText(drawn).width > maxWidth && drawn.length > 1) {
    drawn = `${drawn.slice(0, -2)}…`;
  }
  return drawn;
}

function drawHalf(
  ctx: CanvasRenderingContext2D,
  y: number,
  h: number,
  bg: string,
  primary: string,
  secondary: string,
  badge: string,
) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, y, VIDEO_PIP_SIZE, h);
  const midY = y + h / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font =
    '800 96px ui-monospace, SFMono-Regular, Menlo, "Courier New", monospace';
  ctx.fillText(primary, VIDEO_PIP_SIZE / 2, midY - 18);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = '600 28px Outfit, system-ui, sans-serif';
  ctx.fillText(
    ellipsize(ctx, secondary, VIDEO_PIP_SIZE - 64),
    VIDEO_PIP_SIZE / 2,
    midY + 48,
  );
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '700 22px Outfit, system-ui, sans-serif';
  ctx.fillText(badge, VIDEO_PIP_SIZE / 2, y + h - 28);
}

function drawVideoFrame() {
  if (!videoPip) return;
  const { canvas } = videoPip;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dual = !!(pulseState && driftState);
  const size = VIDEO_PIP_SIZE;

  if (!pulseState && !driftState) {
    ctx.fillStyle = CARD_BG;
    ctx.fillRect(0, 0, size, size);
    return;
  }

  if (dual) {
    const half = size / 2;
    const p = pulseState!;
    const d = driftState!;
    drawHalf(
      ctx,
      0,
      half,
      PHASE_THEME[p.phase].bg,
      formatTimer(liveRemaining(p)),
      pulseTaskLabel(p),
      p.running ? PHASE_THEME[p.phase].label : 'Paused',
    );
    drawHalf(
      ctx,
      half,
      half,
      PHASE_THEME.shortBreak.bg,
      d.nudgeVisible ? 'Back?' : String(d.driftCount),
      d.nudgeVisible ? 'Tap to return' : d.intention.trim() || 'Watching',
      'Drift',
    );
    // Hairline between rows
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, half - 1, size, 2);
    return;
  }

  if (pulseState) {
    const p = pulseState;
    ctx.fillStyle = PHASE_THEME[p.phase].bg;
    ctx.fillRect(0, 0, size, size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font =
      '800 148px ui-monospace, SFMono-Regular, Menlo, "Courier New", monospace';
    ctx.fillText(formatTimer(liveRemaining(p)), size / 2, size / 2 - 28);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '600 36px Outfit, system-ui, sans-serif';
    ctx.fillText(
      ellipsize(ctx, pulseTaskLabel(p), size - 80),
      size / 2,
      size / 2 + 88,
    );
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '700 28px Outfit, system-ui, sans-serif';
    ctx.fillText(
      p.running ? PHASE_THEME[p.phase].label : 'Paused',
      size / 2,
      size - 56,
    );
    return;
  }

  const d = driftState!;
  ctx.fillStyle = PHASE_THEME.shortBreak.bg;
  ctx.fillRect(0, 0, size, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font =
    '800 148px ui-monospace, SFMono-Regular, Menlo, "Courier New", monospace';
  ctx.fillText(
    d.nudgeVisible ? 'Back?' : String(d.driftCount),
    size / 2,
    size / 2 - 28,
  );
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = '600 36px Outfit, system-ui, sans-serif';
  ctx.fillText(
    ellipsize(
      ctx,
      d.nudgeVisible ? 'Tap to return' : d.intention.trim() || 'Watching',
      size - 80,
    ),
    size / 2,
    size / 2 + 88,
  );
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '700 28px Outfit, system-ui, sans-serif';
  ctx.fillText('Drift', size / 2, size - 56);
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

function syncVideoPlayback() {
  if (!videoPip) return;
  const { video } = videoPip;
  const running = !!pulseState?.running;
  applyingVideoSync = true;
  try {
    if (running) {
      startKeepAlive();
      if (video.paused) void video.play().catch(() => {});
    } else if (pulseState) {
      stopKeepAlive();
      if (!video.paused) video.pause();
    } else {
      // Drift-only: keep playing so Android PiP stays alive.
      startKeepAlive();
      if (video.paused) void video.play().catch(() => {});
    }
  } finally {
    window.setTimeout(() => {
      applyingVideoSync = false;
    }, 80);
  }
}

function wireMediaSession() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    const parts: string[] = [];
    if (pulseState) {
      parts.push(formatTimer(liveRemaining(pulseState)));
    }
    if (driftState) {
      parts.push(
        driftState.nudgeVisible
          ? 'Drift · Back?'
          : `Drift · ${driftState.driftCount}`,
      );
    }
    const artworkSrc = videoPip?.canvas.toDataURL('image/jpeg', 0.92);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: parts[0] ?? 'Focus',
      artist: parts.slice(1).join(' · ') || (pulseState ? pulseTaskLabel(pulseState) : 'Drift'),
      album: 'Focus suite',
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
    navigator.mediaSession.playbackState = pulseState?.running
      ? 'playing'
      : 'paused';

    if (pulseState) {
      navigator.mediaSession.setActionHandler('play', () => {
        if (pulseHandlers?.onResume) pulseHandlers.onResume();
        else pulseHandlers?.onToggleRun();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (pulseHandlers?.onPause) pulseHandlers.onPause();
        else pulseHandlers?.onToggleRun();
      });
    } else {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
    }
    navigator.mediaSession.setActionHandler('stop', () => {
      (pulseHandlers ?? driftHandlers)?.onOpenApp();
    });
  } catch {
    // ignore
  }
}

function refreshVideoPip() {
  drawVideoFrame();
  syncVideoPlayback();
  wireMediaSession();
}

function notifySystemClosed() {
  const p = pulseHandlers;
  const d = driftHandlers;
  pulseState = null;
  driftState = null;
  p?.onClose();
  d?.onClose();
}

function stopVideoPip(silent: boolean) {
  if (!videoPip) return;
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
  videoLeaveWired = false;
  if (!silent) notifySystemClosed();
}

async function ensureVideoPip(): Promise<boolean> {
  if (!canUseVideoPip()) return false;
  if (!pulseState && !driftState) {
    stopVideoPip(true);
    return false;
  }

  if (videoPip && document.pictureInPictureElement === videoPip.video) {
    refreshVideoPip();
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

  const stream = canvas.captureStream(12);
  video.srcObject = stream;
  videoPip = { video, canvas, tick: null };
  refreshVideoPip();
  videoPip.tick = setInterval(refreshVideoPip, 1000);

  if (!videoLeaveWired) {
    videoLeaveWired = true;
    video.addEventListener('leavepictureinpicture', () => {
      if (silentClose) {
        silentClose = false;
        stopVideoPip(true);
        return;
      }
      stopVideoPip(false);
    });
    video.addEventListener('play', () => {
      if (applyingVideoSync || !pulseState) return;
      if (!pulseState.running) {
        if (pulseHandlers?.onResume) pulseHandlers.onResume();
        else pulseHandlers?.onToggleRun();
      }
    });
    video.addEventListener('pause', () => {
      if (applyingVideoSync || !pulseState) return;
      if (document.hidden && Date.now() - pageHiddenAtMs < 800) {
        if (pulseState.running) {
          applyingVideoSync = true;
          void video.play().finally(() => {
            window.setTimeout(() => {
              applyingVideoSync = false;
            }, 80);
          });
        }
        return;
      }
      if (pulseState.running) {
        if (pulseHandlers?.onPause) pulseHandlers.onPause();
        else pulseHandlers?.onToggleRun();
      }
    });
  }

  try {
    await video.play();
    await video.requestPictureInPicture();
    return true;
  } catch {
    stopVideoPip(true);
    return false;
  }
}

async function closeDocumentSilent() {
  if (!pipWindow) return;
  silentClose = true;
  try {
    pipWindow.close();
  } catch {
    // ignore
  }
  pipWindow = null;
  layoutKey = null;
  stopTick();
}

async function closeAllSilent() {
  await closeDocumentSilent();
  stopVideoPip(true);
}

async function ensureDocumentWindow(): Promise<boolean> {
  const api = getPipApi();
  if (!api) return false;

  const key = currentLayoutKey();
  if (pipWindow && !pipWindow.closed && layoutKey === key) {
    paint(pipWindow);
    ensureTick();
    return true;
  }

  if (pipWindow && !pipWindow.closed) {
    await closeDocumentSilent();
  }

  try {
    const win = await api.requestWindow({
      width: PIP_W,
      height: pipHeight(),
      disallowReturnToOpener: false,
    });
    pipWindow = win;
    mount(win);
    ensureTick();
    win.addEventListener('pagehide', () => {
      pipWindow = null;
      layoutKey = null;
      stopTick();
      if (silentClose) {
        silentClose = false;
        return;
      }
      notifySystemClosed();
    });
    return true;
  } catch {
    pipWindow = null;
    layoutKey = null;
    return false;
  }
}

async function ensureWindow(): Promise<boolean> {
  if (!pulseState && !driftState) {
    await closeAllSilent();
    return false;
  }

  // Prefer interactive Document PiP when available (desktop Chrome).
  if (getPipApi()) {
    const ok = await ensureDocumentWindow();
    if (ok) {
      stopVideoPip(true);
      return true;
    }
  }

  // Android / mobile Chrome — one Video PiP with both stacked.
  return ensureVideoPip();
}

function isDocumentSuiteOpen(): boolean {
  return pipWindow != null && !pipWindow.closed;
}

function isVideoSuiteOpen(): boolean {
  return (
    videoPip != null &&
    typeof document !== 'undefined' &&
    document.pictureInPictureElement === videoPip.video
  );
}

export function isSuitePipOpen(): boolean {
  return isDocumentSuiteOpen() || isVideoSuiteOpen();
}

export function isPulseInSuitePip(): boolean {
  return isSuitePipOpen() && pulseState != null;
}

export function isDriftInSuitePip(): boolean {
  return isSuitePipOpen() && driftState != null;
}

export async function suiteOpenPulse(
  state: SuitePulseState,
  handlers: SuitePulseHandlers,
): Promise<boolean> {
  pulseState = state;
  pulseHandlers = handlers;
  return ensureWindow();
}

export async function suiteOpenDrift(
  state: SuiteDriftState,
  handlers: SuiteDriftHandlers,
): Promise<boolean> {
  driftState = state;
  driftHandlers = handlers;
  return ensureWindow();
}

export function suiteUpdatePulse(state: SuitePulseState) {
  if (!pulseState && !pulseHandlers) return;
  pulseState = state;
  if (isDocumentSuiteOpen()) {
    paintPulseRow(pipWindow!);
    ensureTick();
  }
  if (isVideoSuiteOpen()) refreshVideoPip();
}

export function suiteUpdateDrift(state: SuiteDriftState) {
  if (!driftState && !driftHandlers) return;
  driftState = state;
  if (isDocumentSuiteOpen()) {
    paintDriftRow(pipWindow!);
  }
  if (isVideoSuiteOpen()) refreshVideoPip();
}

export async function suiteClosePulse(): Promise<void> {
  pulseState = null;
  pulseHandlers = null;
  if (!driftState) {
    await closeAllSilent();
    return;
  }
  await ensureWindow();
}

export async function suiteCloseDrift(): Promise<void> {
  driftState = null;
  driftHandlers = null;
  if (!pulseState) {
    await closeAllSilent();
    return;
  }
  await ensureWindow();
}

export function setSuitePulseHandlers(handlers: SuitePulseHandlers) {
  pulseHandlers = handlers;
}

export function setSuiteDriftHandlers(handlers: SuiteDriftHandlers) {
  driftHandlers = handlers;
}

export function canUseSuiteDocumentPip(): boolean {
  return getPipApi() != null;
}

/** True when suite can open Document PiP or shared Video PiP (Android Chrome). */
export function canUseSuitePip(): boolean {
  return canUseSuiteDocumentPip() || canUseVideoPip();
}
