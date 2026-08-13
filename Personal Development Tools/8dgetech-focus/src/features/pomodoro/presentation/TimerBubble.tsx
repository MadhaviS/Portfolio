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
import { usePomodoro } from './PomodoroProvider';
import { subscribeOpenFromPip } from './timerPip';
import { PhaseIconGlyph } from './PhaseIcon';

const CARD_W = Platform.OS === 'web' ? 210 : 188;
const CARD_H = Platform.OS === 'web' ? 108 : 100;
const MARGIN = 12;
const CLOSE_SIZE = 64;

const PHASE_SHORT: Record<PomodoroPhase, string> = {
  focus: 'FOCUS',
  shortBreak: 'SHORT BREAK',
  longBreak: 'LONG BREAK',
};

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

/** Soft breath scale for the floating bubble while running. */
function softBreath() {
  return withRepeat(
    withSequence(
      withTiming(1.025, {
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

export function useShowTimerBubble() {
  const { running, isPartial, minimized, overlayDismissed, pipOpen } =
    usePomodoro();
  const segments = useSegments();
  const onPomodoro = segments[0] === 'pomodoro';
  // Stay visible on home until we actually reach /pomodoro (avoid flicker-hide)
  return (
    !overlayDismissed &&
    !pipOpen &&
    !onPomodoro &&
    segments[0] !== 'sign-in' &&
    (running || isPartial || minimized)
  );
}

/** Always-mounted: Picture-in-Picture / bubble open → full pomodoro screen. */
export function PipNavigationBridge() {
  const router = useRouter();
  const { expand } = usePomodoro();

  useEffect(
    () =>
      subscribeOpenFromPip(() => {
        // Push first so the route change isn't lost if expand re-renders
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
    start,
    pause,
    expand,
    dismissOverlay,
  } = usePomodoro();
  const visible = useShowTimerBubble();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

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
      { scale: (overClose.value ? 0.92 : 1) * breath.value },
    ],
    opacity: overClose.value ? 0.82 : 1,
  }));

  const closeZoneStyle = useAnimatedStyle(() => ({
    opacity: dragging.value,
    transform: [{ scale: overClose.value ? 1.12 : 1 }],
  }));

  const theme = PHASE_THEME[phase];

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
        <View style={[styles.closeZone, { backgroundColor: theme.bg }]}>
          <Text style={styles.closeMark}>×</Text>
        </View>
      </Animated.View>

      <Animated.View
        accessibilityLabel={`${PHASE_SHORT[phase]} ${formatTimer(remaining)}. Drag to move.`}
        style={[
          styles.card,
          animatedStyle,
          {
            backgroundColor: theme.bg,
            borderColor: running
              ? 'rgba(255,255,255,0.45)'
              : 'rgba(255,255,255,0.28)',
          },
          Platform.OS === 'web'
            ? ({
                position: 'fixed',
                userSelect: 'none',
              } as object)
            : null,
        ]}
      >
        <GestureDetector gesture={gesture}>
          <View
            style={[
              styles.dragArea,
              Platform.OS === 'web' ? ({ cursor: 'grab' } as object) : null,
            ]}
          >
            <View style={styles.metaRow}>
              <PhaseIconGlyph phase={phase} color="#FFFFFF" size={16} />
              <Text style={styles.phase} numberOfLines={1}>
                {PHASE_SHORT[phase]}
              </Text>
            </View>
            <Text style={styles.time} numberOfLines={1}>
              {formatTimer(remaining)}
            </Text>
          </View>
        </GestureDetector>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={running ? 'Pause' : 'Resume'}
            onPress={toggleRun}
            style={({ pressed }) => [
              styles.iconBtn,
              styles.primaryBtn,
              pressed && styles.pressed,
            ]}
          >
            <Feather
              name={running ? 'pause' : 'play'}
              size={16}
              color="#1A1A1A"
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open timer"
            onPress={openTimer}
            style={({ pressed }) => [
              styles.iconBtn,
              styles.openBtn,
              pressed && styles.pressed,
            ]}
          >
            <Feather name="maximize-2" size={15} color="#FFFFFF" />
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
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
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
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    justifyContent: 'space-between',
    zIndex: 9999,
    elevation: 14,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  dragArea: {
    flex: 1,
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  phase: {
    flex: 1,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  time: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  openBtn: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
