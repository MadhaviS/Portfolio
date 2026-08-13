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
import { fontBody } from '../../../public/theme/fonts';
import { IconDrift } from '../../../public/theme/LineIcons';
import { PHASE_THEME } from '../../pulse/domain/types';
import { useDrift } from './DriftProvider';
import { isDriftPipOpen, subscribeOpenFromDriftPip } from './driftPip';

/** Match Pulse TimerBubble chip. */
const CARD_W = Platform.OS === 'web' ? 304 : 292;
const CARD_H = 72;
const MARGIN = 12;
const CLOSE_SIZE = 64;
const CARD_BG = '#1C1C1E';
const ACCENT = PHASE_THEME.shortBreak.accent;
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

export function useShowDriftBubble() {
  const { session, minimized, overlayDismissed, pipOpen } = useDrift();
  const segments = useSegments();
  const onDrift = segments[0] === 'drift';
  const onSignIn = segments[0] === 'sign-in';

  if (!session || overlayDismissed || onSignIn) return false;
  if (pipOpen || isDriftPipOpen()) return false;
  if (minimized) return true;
  if (!onDrift) return true;
  return false;
}

/** Always-mounted: sticky PiP / bubble → full Drift screen. */
export function DriftPipNavigationBridge() {
  const router = useRouter();
  const { expand } = useDrift();

  useEffect(
    () =>
      subscribeOpenFromDriftPip(() => {
        router.push('/drift');
        expand();
      }),
    [expand, router],
  );

  return null;
}

export function DriftBubble() {
  const {
    session,
    driftCount,
    nudgeVisible,
    expand,
    dismissOverlay,
    markReturn,
    logManual,
  } = useDrift();
  const visible = useShowDriftBubble();
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
    if (visible) breath.value = softBreath();
    else breath.value = withTiming(1, { duration: 420 });
  }, [visible, breath]);

  const persistPos = useCallback((nextX: number, nextY: number) => {
    savedPos = { x: nextX, y: nextY };
  }, []);

  const openDrift = useCallback(() => {
    router.push('/drift');
    expand();
  }, [expand, router]);

  const onPrimaryAction = useCallback(() => {
    if (nudgeVisible) markReturn();
    else logManual('other');
  }, [logManual, markReturn, nudgeVisible]);

  const gesture = useMemo(() => {
    const closeCx = width / 2;
    const closeCy = height - (insets.bottom + 16) - CLOSE_SIZE / 2;

    return Gesture.Pan()
      .onBegin(() => {
        dragging.value = 1;
      })
      .onUpdate((e) => {
        x.value = e.absoluteX - CARD_W / 2;
        y.value = e.absoluteY - CARD_H / 2;
        const dx = e.absoluteX - closeCx;
        const dy = e.absoluteY - closeCy;
        overClose.value = Math.hypot(dx, dy) < CLOSE_SIZE ? 1 : 0;
      })
      .onEnd(() => {
        const minX = MARGIN;
        const maxX = Math.max(minX, width - CARD_W - MARGIN);
        const minY = insets.top + MARGIN;
        const maxY = Math.max(
          minY,
          height - CARD_H - insets.bottom - MARGIN,
        );
        if (overClose.value) {
          runOnJS(dismissOverlay)();
        } else {
          const snapRight = x.value + CARD_W / 2 > width / 2;
          const nextX = snapRight ? maxX : minX;
          const nextY = Math.min(maxY, Math.max(minY, y.value));
          x.value = nextX;
          y.value = nextY;
          runOnJS(persistPos)(nextX, nextY);
        }
        dragging.value = 0;
        overClose.value = 0;
      });
  }, [
    dismissOverlay,
    height,
    insets.bottom,
    insets.top,
    overClose,
    persistPos,
    dragging,
    width,
    x,
    y,
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

  if (!visible || !session) return null;

  const heading = nudgeVisible
    ? 'Come back'
    : String(driftCount);
  const sub = nudgeVisible
    ? 'Tap to return'
    : session.intention.trim() || 'Watching';

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
        accessibilityLabel={`Drift. ${sub}. ${heading} drifts.`}
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
            onPress={nudgeVisible ? markReturn : openDrift}
            style={[
              styles.main,
              Platform.OS === 'web' ? ({ cursor: 'grab' } as object) : null,
            ]}
          >
            <IconDrift color={ACCENT} size={26} />
            <View style={styles.copy}>
              <Text style={styles.time} numberOfLines={1}>
                {heading}
              </Text>
              <Text style={styles.task} numberOfLines={1}>
                {sub}
              </Text>
            </View>
          </Pressable>
        </GestureDetector>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              nudgeVisible ? 'I am back' : 'Count a drift'
            }
            onPress={onPrimaryAction}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: ACCENT },
              pressed && styles.pressed,
            ]}
          >
            <Feather
              name={nudgeVisible ? 'check' : 'plus'}
              size={16}
              color="#FFFFFF"
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="End Drift session"
            hitSlop={8}
            onPress={dismissOverlay}
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
    backgroundColor: '#FF453A',
  },
  closeMark: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '600',
    marginTop: -2,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CARD_W,
    height: CARD_H,
    borderRadius: 999,
    backgroundColor: CARD_BG,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 10,
    zIndex: 10000,
    elevation: 10000,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    paddingRight: 8,
  },
  copy: { flex: 1, minWidth: 0 },
  time: {
    fontFamily: fontBody,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  task: {
    fontFamily: fontBody,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '500',
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
  pressed: { opacity: 0.85 },
});
