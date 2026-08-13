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
import Svg, { Circle } from 'react-native-svg';

type Props = {
  progress: number;
  size?: number;
  stroke?: number;
  trackColor: string;
  progressColor: string;
  glowColor: string;
  breathing?: boolean;
  children?: React.ReactNode;
};

/** Slow inhale / exhale — calm focus cadence (~6.4s cycle). */
function softBreath() {
  return withRepeat(
    withSequence(
      withTiming(1.035, {
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

export function RitualRing({
  progress,
  size = 280,
  stroke = 3,
  trackColor,
  progressColor,
  glowColor,
  breathing = false,
  children,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  const pulse = useSharedValue(1);

  useEffect(() => {
    if (breathing) {
      pulse.value = softBreath();
    } else {
      pulse.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) });
    }
  }, [breathing, pulse]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const glowStyle = useAnimatedStyle(() => {
    const extra = Math.max(0, pulse.value - 1);
    return {
      opacity: 0.22 + extra * 9,
      transform: [{ scale: 0.96 + extra * 2.4 }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        breathStyle,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: size * 0.78,
            height: size * 0.78,
            borderRadius: size,
            backgroundColor: glowColor,
          },
          glowStyle,
        ]}
      />
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.inner}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 2,
    zIndex: 2,
  },
});
