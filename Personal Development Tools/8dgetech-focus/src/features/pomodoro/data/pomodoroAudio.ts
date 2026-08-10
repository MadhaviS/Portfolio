import { Audio, type AVPlaybackSource } from 'expo-av';
import type { AlarmSoundId, FocusSoundId, PomodoroSettings } from '../domain/types';

const ALARM_SOURCES: Record<Exclude<AlarmSoundId, 'none'>, AVPlaybackSource> = {
  kitchen: require('../../../../assets/sounds/alarm_kitchen.wav'),
  bell: require('../../../../assets/sounds/alarm_bell.wav'),
  bird: require('../../../../assets/sounds/alarm_bird.wav'),
  digital: require('../../../../assets/sounds/alarm_digital.wav'),
  wood: require('../../../../assets/sounds/alarm_wood.wav'),
  alarmClock: require('../../../../assets/sounds/alarm_alarmClock.wav'),
};

const FOCUS_SOURCES: Record<Exclude<FocusSoundId, 'none'>, AVPlaybackSource> = {
  tickingFast: require('../../../../assets/sounds/focus_tickingFast.wav'),
  tickingSlow: require('../../../../assets/sounds/focus_tickingSlow.wav'),
  whiteNoise: require('../../../../assets/sounds/focus_whiteNoise.wav'),
  brownNoise: require('../../../../assets/sounds/focus_brownNoise.wav'),
};

let configured = false;
let focusSound: Audio.Sound | null = null;
let focusSoundId: FocusSoundId | null = null;
let alarmSound: Audio.Sound | null = null;
let alarmCancel: (() => void) | null = null;

async function ensureAudioMode(): Promise<void> {
  if (configured) return;
  configured = true;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    // Web / unsupported platforms may ignore audio mode.
  }
}

function volume01(percent: number): number {
  return Math.max(0, Math.min(1, percent / 100));
}

async function unload(sound: Audio.Sound | null): Promise<null> {
  if (!sound) return null;
  try {
    await sound.stopAsync();
  } catch {
    // already stopped
  }
  try {
    await sound.unloadAsync();
  } catch {
    // already unloaded
  }
  return null;
}

async function loadAndPlay(
  source: AVPlaybackSource,
  options: {
    volume: number;
    isLooping?: boolean;
    shouldPlay?: boolean;
  },
): Promise<Audio.Sound> {
  await ensureAudioMode();
  const { sound } = await Audio.Sound.createAsync(source, {
    volume: volume01(options.volume),
    isLooping: options.isLooping ?? false,
    shouldPlay: options.shouldPlay ?? true,
  });
  return sound;
}

export async function stopFocusSound(): Promise<void> {
  focusSound = await unload(focusSound);
  focusSoundId = null;
}

export async function syncFocusSound(opts: {
  running: boolean;
  phase: string;
  focusSound: FocusSoundId;
  focusVolume: number;
}): Promise<void> {
  const soundId = opts.focusSound;
  const shouldPlay =
    opts.running && opts.phase === 'focus' && soundId !== 'none';

  if (!shouldPlay) {
    await stopFocusSound();
    return;
  }

  if (focusSound && focusSoundId === soundId) {
    try {
      await focusSound.setVolumeAsync(volume01(opts.focusVolume));
      const status = await focusSound.getStatusAsync();
      if (status.isLoaded && !status.isPlaying) {
        await focusSound.playAsync();
      }
    } catch {
      await stopFocusSound();
    }
    if (focusSound) return;
  }

  await stopFocusSound();
  try {
    focusSound = await loadAndPlay(FOCUS_SOURCES[soundId], {
      volume: opts.focusVolume,
      isLooping: true,
      shouldPlay: true,
    });
    focusSoundId = soundId;
  } catch {
    focusSound = null;
    focusSoundId = null;
  }
}

export async function stopAlarmSound(): Promise<void> {
  if (alarmCancel) {
    alarmCancel();
    alarmCancel = null;
  }
  alarmSound = await unload(alarmSound);
}

export async function playAlarmSound(opts: {
  alarmSound: AlarmSoundId;
  alarmVolume: number;
  alarmRepeat: number;
}): Promise<void> {
  await stopAlarmSound();
  if (opts.alarmSound === 'none' || opts.alarmVolume <= 0) return;

  const source = ALARM_SOURCES[opts.alarmSound];
  const repeats = Math.max(0, Math.min(60, Math.round(opts.alarmRepeat)));
  if (repeats <= 0) return;
  let cancelled = false;
  alarmCancel = () => {
    cancelled = true;
  };

  try {
    for (let i = 0; i < repeats; i++) {
      if (cancelled) break;
      alarmSound = await unload(alarmSound);
      const sound = await loadAndPlay(source, {
        volume: opts.alarmVolume,
        isLooping: false,
        shouldPlay: true,
      });
      alarmSound = sound;

      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) finish();
        });
        // Fallback if status updates are missed (esp. web).
        void sound.getStatusAsync().then((status) => {
          if (!status.isLoaded) {
            finish();
            return;
          }
          const duration = status.durationMillis ?? 800;
          setTimeout(finish, duration + 80);
        });
      });
    }
  } catch {
    // Ignore playback failures (missing asset / autoplay policy).
  } finally {
    if (!cancelled) {
      alarmSound = await unload(alarmSound);
      alarmCancel = null;
    }
  }
}

/** Short preview for settings pickers / volume changes. */
export async function previewSound(
  kind: 'alarm' | 'focus',
  id: AlarmSoundId | FocusSoundId,
  volume: number,
): Promise<void> {
  if (id === 'none' || volume <= 0) return;
  await stopAlarmSound();
  try {
    const source =
      kind === 'alarm'
        ? ALARM_SOURCES[id as Exclude<AlarmSoundId, 'none'>]
        : FOCUS_SOURCES[id as Exclude<FocusSoundId, 'none'>];
    const sound = await loadAndPlay(source, {
      volume,
      isLooping: false,
      shouldPlay: true,
    });
    alarmSound = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        void unload(sound).then(() => {
          if (alarmSound === sound) alarmSound = null;
        });
      }
    });
  } catch {
    // ignore
  }
}

export function alarmOptsFromSettings(settings: PomodoroSettings) {
  return {
    alarmSound: settings.alarmSound,
    alarmVolume: settings.alarmVolume,
    alarmRepeat: settings.alarmRepeat,
  };
}

export function focusOptsFromSettings(
  settings: PomodoroSettings,
  running: boolean,
  phase: string,
) {
  return {
    running,
    phase,
    focusSound: settings.focusSound,
    focusVolume: settings.focusVolume,
  };
}
