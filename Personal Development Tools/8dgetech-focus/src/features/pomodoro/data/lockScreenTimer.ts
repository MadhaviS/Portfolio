import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { PHASE_THEME, formatTimer, type PomodoroPhase } from '../domain/types';
import { androidLockScreen } from './androidLockScreen';

const COMPLETE_ID = 'pomodoro-lock-complete';
const CHANNEL_ID = 'pomodoro-timer';

let liveActivityId: string | null = null;
let handlerReady = false;
let permissionAsked = false;

const isExpoGo = Constants.appOwnership === 'expo';
const lockScreenNative = !isExpoGo && Platform.OS !== 'web';

type NotificationsModule = typeof import('expo-notifications');
type LiveActivityModule = typeof import('expo-live-activity');

function notifications(): NotificationsModule | null {
  if (!lockScreenNative) return null;
  try {
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

function liveActivity(): LiveActivityModule | null {
  if (!lockScreenNative || Platform.OS !== 'ios') return null;
  try {
    return require('expo-live-activity') as LiveActivityModule;
  } catch {
    return null;
  }
}

function ensureHandler(Notifications: NotificationsModule) {
  if (handlerReady) return;
  handlerReady = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensurePermissions(): Promise<NotificationsModule | null> {
  const Notifications = notifications();
  if (!Notifications) return null;
  ensureHandler(Notifications);
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Focus session alerts',
        importance: Notifications.AndroidImportance.HIGH,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return Notifications;
    if (permissionAsked) return current.granted ? Notifications : null;
    permissionAsked = true;
    const next = await Notifications.requestPermissionsAsync();
    return next.granted ? Notifications : null;
  } catch {
    return null;
  }
}

function activityState(
  phase: PomodoroPhase,
  subtitle: string,
  progressBar: { date: number } | { progress: number },
) {
  return {
    title: PHASE_THEME[phase].label,
    subtitle,
    progressBar,
    imageName: 'focus',
    dynamicIslandImageName: 'focus',
  };
}

function activityConfig(phase: PomodoroPhase) {
  const theme = PHASE_THEME[phase];
  return {
    backgroundColor: theme.bg,
    titleColor: '#FFFFFF',
    subtitleColor: '#FFFFFF',
    progressViewTint: '#FFFFFF',
    progressViewLabelColor: '#FFFFFF',
    deepLinkUrl: '/pomodoro',
    timerType: 'digital' as const,
    imagePosition: 'left' as const,
  };
}

function startOrUpdateLiveActivity(
  phase: PomodoroPhase,
  subtitle: string,
  progressBar: { date: number } | { progress: number },
) {
  const LiveActivity = liveActivity();
  if (!LiveActivity) return;
  const state = activityState(phase, subtitle, progressBar);
  try {
    if (liveActivityId) {
      LiveActivity.updateActivity(liveActivityId, state);
      return;
    }
    const id = LiveActivity.startActivity(state, activityConfig(phase));
    liveActivityId = typeof id === 'string' ? id : null;
  } catch {
    liveActivityId = null;
  }
}

function stopLiveActivity(phase: PomodoroPhase, subtitle: string) {
  const LiveActivity = liveActivity();
  if (!LiveActivity || !liveActivityId) return;
  try {
    LiveActivity.stopActivity(
      liveActivityId,
      activityState(phase, subtitle, { progress: 1 }),
    );
  } catch {
    // unsupported
  }
  liveActivityId = null;
}

async function cancelComplete(Notifications: NotificationsModule) {
  try {
    await Notifications.cancelScheduledNotificationAsync(COMPLETE_ID);
  } catch {
    // ignore
  }
}

async function scheduleComplete(
  Notifications: NotificationsModule,
  atMs: number,
  title: string,
) {
  try {
    await Notifications.cancelScheduledNotificationAsync(COMPLETE_ID);
    if (atMs <= Date.now() + 500) return;
    await Notifications.scheduleNotificationAsync({
      identifier: COMPLETE_ID,
      content: {
        title,
        body: 'Session finished. Time to switch.',
        sound: true,
        interruptionLevel: 'timeSensitive',
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(atMs),
      },
    });
  } catch {
    // ignore
  }
}

export const lockScreenTimer = {
  subscribeAndroidActions: androidLockScreen.subscribe,

  async running(input: {
    phase: PomodoroPhase;
    endsAt: number;
    remaining: number;
  }) {
    if (!lockScreenNative) return;
    const label = PHASE_THEME[input.phase].label;
    const subtitle = `${formatTimer(input.remaining)} remaining`;

    if (Platform.OS === 'ios') {
      startOrUpdateLiveActivity(input.phase, subtitle, { date: input.endsAt });
    } else if (Platform.OS === 'android') {
      await androidLockScreen.running(input);
    }

    const Notifications = await ensurePermissions();
    if (!Notifications) return;
    await scheduleComplete(Notifications, input.endsAt, `${label} complete`);
  },

  async paused(input: {
    phase: PomodoroPhase;
    remaining: number;
    total: number;
  }) {
    if (!lockScreenNative) return;
    const subtitle = `Paused · ${formatTimer(input.remaining)}`;
    const progress =
      input.total <= 0 ? 0 : 1 - Math.min(1, input.remaining / input.total);

    if (Platform.OS === 'ios') {
      startOrUpdateLiveActivity(input.phase, subtitle, { progress });
    } else if (Platform.OS === 'android') {
      await androidLockScreen.paused(input);
    }

    const Notifications = await ensurePermissions();
    if (!Notifications) return;
    await cancelComplete(Notifications);
  },

  async idle(input: { phase: PomodoroPhase; completed: boolean }) {
    if (!lockScreenNative) return;
    const label = PHASE_THEME[input.phase].label;

    if (Platform.OS === 'ios') {
      stopLiveActivity(input.phase, input.completed ? 'Done' : 'Stopped');
    } else if (Platform.OS === 'android') {
      await androidLockScreen.idle();
    }

    const Notifications = notifications();
    if (!Notifications) return;
    await cancelComplete(Notifications);
    if (!input.completed) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${label} complete`,
          body: 'Session finished. Time to switch.',
          sound: true,
          interruptionLevel: 'timeSensitive',
          ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null),
        },
        trigger: null,
      });
    } catch {
      // ignore
    }
  },
};
