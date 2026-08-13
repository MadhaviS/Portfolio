import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { PHASE_THEME, formatTimer, type PomodoroPhase } from '../domain/types';
import { fontBody } from '../../../public/theme/fonts';
import { usePomodoro } from './PomodoroProvider';
import { PhaseIconGlyph } from './PhaseIcon';
import { subscribeOpenFromPip, isTimerPipOpen } from './timerPip';

/** iOS Clock Live Activity–style chip */
const CARD_W = Platform.OS === 'web' ? 304 : 292;
const CARD_H = 72;
const MARGIN = 12;
const CLOSE_SIZE = 64;
const CARD_BG = '#1C1C1E';
const BTN_MUTED = '#3A3A3C';

type BubblePos = { x: number; y: number };
let savedPos: BubblePos | null = null;

function defaultPos(
  width: number,
  height: number,
  topInset: number,
  bottomInset: number,
): BubblePos {
  return {
    x: Math.max(MARGIN, width - CARD_W - MARGIN),
    y: Math.max(topInset + MARGIN, height - CARD_H - bottomInset - MARGIN),
  };
}

function softBreath() {
  return withRepeat(
    withSequence(
      withTiming(0.985, {
        duration: 3200,
        easing: Easing.inOut(Easing.sin),
      }),
      withTiming(1, {
        duration: 3200,
        easing: Easing.inOut(Easing.sin),
      }),
    ),
    -1,
    false,
  );
}

function headingFor(
  phase: PomodoroPhase,
  taskTitle: string | null | undefined,
): string {
  const title = taskTitle?.trim();
  if (title) return title;
  if (phase === 'shortBreak') return 'Short break';
  if (phase === 'longBreak') return 'Long break';
  return 'Focus';
}

export function useShowTimerBubble() {
  const { running, isPartial, minimized, overlayDismissed, pipOpen } =
    usePomodoro();
  const segments = useSegments();
  const onPomodoro = segments[0] === 'pomodoro';
  const onSignIn = segments[0] === 'sign-in';

  if (overlayDismissed || onSignIn) return false;

  // Never stack the in-app chip on top of Document/Video PiP.
  if (pipOpen || isTimerPipOpen()) return false;

  // After minimize when system PiP is unavailable — single in-app chip.
  if (minimized) return true;

  // Timer running while browsing other screens (home, admin, …)
  return !onPomodoro && (running || isPartial);
}

/** Always-mounted: Picture-in-Picture / bubble open → full pomodoro screen. */
export function PipNavigationBridge() {
  const router = useRouter();
  const { expand } = usePomodoro();

  useEffect(
    () =>
      subscribeOpenFromPip(() => {
        router.push('/pomodoro');
        expand();
      }),
    [expand, router],
  );

  return null;
}

export function TimerBubble() {
  const {
    remaining,
    phase,
    running,
    activeTask,
    start,
    pause,
    expand,
    dismissOverlay,
  } = usePomodoro();
  const visible = useShowTimerBubble();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const heading = headingFor(phase, activeTask?.title);
  const accent = PHASE_THEME[phase].accent;

  const startPos =
    savedPos ?? defaultPos(width, height, insets.top, insets.bottom);
  const x = useSharedValue(startPos.x);
  const y = useSharedValue(startPos.y);
  const dragging = useSharedValue(0);
  const overClose = useSharedValue(0);
  const breath = useSharedValue(1);

  useEffect(() => {
    const next =
      savedPos ?? defaultPos(width, height, insets.top, insets.bottom);
    const minX = MARGIN;
    const maxX = Math.max(minX, width - CARD_W - MARGIN);
    const minY = insets.top + MARGIN;
    const maxY = Math.max(minY, height - CARD_H - insets.bottom - MARGIN);
    x.value = Math.min(maxX, Math.max(minX, next.x));
    y.value = Math.min(maxY, Math.max(minY, next.y));
  }, [width, height, insets.top, insets.bottom, x, y]);

  useEffect(() => {
    if (running && visible) {
      breath.value = softBreath();
    } else {
      breath.value = withTiming(1, { duration: 420 });
    }
  }, [running, visible, breath]);

  const persistPos = useCallback((nextX: number, nextY: number) => {
    savedPos = { x: nextX, y: nextY };
  }, []);

  const openTimer = useCallback(() => {
    router.push('/pomodoro');
    expand();
  }, [expand, router]);

  const toggleRun = useCallback(() => {
    if (running) pause();
    else start();
  }, [pause, running, start]);

  const gesture = useMemo(() => {
    const closeCx = width / 2;
    const closeCy = height - (insets.bottom + 16) - CLOSE_SIZE / 2;

    return Gesture.Pan()
      .minDistance(6)
      .onBegin(() => {
        dragging.value = 1;
      })
      .onChange((e) => {
        x.value += e.changeX;
        y.value += e.changeY;
        const cx = x.value + CARD_W / 2;
        const cy = y.value + CARD_H / 2;
        const dist = Math.hypot(cx - closeCx, cy - closeCy);
        overClose.value = dist < CLOSE_SIZE + 8 ? 1 : 0;
      })
      .onEnd(() => {
        dragging.value = 0;
        if (overClose.value) {
          overClose.value = 0;
          runOnJS(dismissOverlay)();
          return;
        }
        const minX = MARGIN;
        const maxX = Math.max(minX, width - CARD_W - MARGIN);
        const minY = insets.top + MARGIN;
        const maxY = Math.max(minY, height - CARD_H - insets.bottom - MARGIN);
        const snapRight = x.value + CARD_W / 2 > width / 2;
        const nextX = snapRight ? maxX : minX;
        const nextY = Math.min(maxY, Math.max(minY, y.value));
        x.value = nextX;
        y.value = nextY;
        runOnJS(persistPos)(nextX, nextY);
      })
      .onFinalize(() => {
        dragging.value = 0;
        overClose.value = 0;
      });
  }, [
    dismissOverlay,
    height,
    insets.bottom,
    insets.top,
    persistPos,
    width,
    x,
    y,
    dragging,
    overClose,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: (overClose.value ? 0.96 : 1) * breath.value },
    ],
    opacity: overClose.value ? 0.82 : 1,
  }));

  const closeZoneStyle = useAnimatedStyle(() => ({
    opacity: dragging.value,
    transform: [{ scale: overClose.value ? 1.12 : 1 }],
  }));

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.closeWrap,
          { bottom: insets.bottom + 16 },
          closeZoneStyle,
        ]}
      >
        <View style={styles.closeZone}>
          <Text style={styles.closeMark}>×</Text>
        </View>
      </Animated.View>

      <Animated.View
        accessibilityLabel={`${heading}. ${formatTimer(remaining)}. Drag to move.`}
        style={[
          styles.card,
          animatedStyle,
          Platform.OS === 'web'
            ? ({
                position: 'fixed',
                userSelect: 'none',
              } as object)
            : null,
        ]}
      >
        <GestureDetector gesture={gesture}>
          <Pressable
            onPress={openTimer}
            style={[
              styles.main,
              Platform.OS === 'web' ? ({ cursor: 'grab' } as object) : null,
            ]}
          >
            <PhaseIconGlyph phase={phase} color={accent} size={26} />
            <View style={styles.copy}>
              <Text style={styles.time} numberOfLines={1}>
                {formatTimer(remaining)}
              </Text>
              <Text style={styles.task} numberOfLines={1}>
                {heading}
              </Text>
            </View>
          </Pressable>
        </GestureDetector>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={running ? 'Pause' : 'Resume'}
            onPress={toggleRun}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: accent },
              pressed && styles.pressed,
            ]}
          >
            <Feather
              name={running ? 'pause' : 'play'}
              size={16}
              color="#FFFFFF"
              style={running ? undefined : { marginLeft: 2 }}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop and reset timer"
            hitSlop={8}
            onPress={() => {
              dismissOverlay();
            }}
            style={({ pressed }) => [
              styles.iconBtn,
              styles.dismissBtn,
              pressed && styles.pressed,
              Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
            ]}
          >
            <Feather name="x" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  closeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  closeZone: {
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: CLOSE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  closeMark: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 34,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CARD_W,
    height: CARD_H,
    borderRadius: CARD_H / 2,
    backgroundColor: CARD_BG,
    paddingLeft: 16,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 14,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    paddingRight: 8,
    gap: 10,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  time: {
    fontFamily: fontBody,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  task: {
    fontFamily: fontBody,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtn: {
    backgroundColor: BTN_MUTED,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
