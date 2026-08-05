import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from './ThemeProvider';

type SoftDoodlesProps = {
  /** Keep sparse — 1 = light, 2 = a bit more */
  density?: 1 | 2;
  accent?: string;
};

/**
 * Soft decorative doodles with one slow breathing motion.
 * Intentionally minimal so it never competes with content.
 */
export function SoftDoodles({ density = 1, accent }: SoftDoodlesProps) {
  const { theme } = useTheme();
  const ink = accent ?? theme.colors.doodle;
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [drift]);

  const floatA = useAnimatedStyle(() => ({
    transform: [{ translateY: drift.value * -6 }, { rotate: `${drift.value * 4}deg` }],
  }));

  const floatB = useAnimatedStyle(() => ({
    transform: [{ translateY: drift.value * 5 }, { rotate: `${-drift.value * 3}deg` }],
  }));

  return (
    <View style={[styles.root, styles.noPointer]}>
      <Animated.View
        style={[
          styles.blob,
          styles.blobA,
          floatA,
          { borderColor: ink, backgroundColor: `${ink}18` },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          styles.ringA,
          floatB,
          { borderColor: `${ink}66` },
        ]}
      />
      {density > 1 ? (
        <>
          <View style={[styles.arc, styles.arcA, { borderColor: ink }]} />
          <View style={[styles.dot, styles.dotA, { backgroundColor: ink }]} />
          <View style={[styles.dot, styles.dotB, { backgroundColor: ink }]} />
        </>
      ) : (
        <View style={[styles.dot, styles.dotA, { backgroundColor: ink }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  noPointer: {
    pointerEvents: 'none',
  },
  blob: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 999,
  },
  blobA: {
    width: 120,
    height: 120,
    top: -28,
    right: -24,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 999,
  },
  ringA: {
    width: 64,
    height: 64,
    bottom: 18,
    left: 12,
    opacity: 0.55,
  },
  arc: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    opacity: 0.45,
  },
  arcA: {
    top: '42%',
    right: 16,
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.4,
  },
  dotA: { top: 36, left: 22 },
  dotB: { bottom: 48, right: 28, width: 4, height: 4 },
});
