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

/** Theme-aware page atmosphere — soft wash + one slow doodle drift */
export function DoodleBackground({ children }: { children: React.ReactNode }) {
  const { theme, resolved } = useTheme();
  const c = theme.colors.doodle;
  const base = theme.colors.background;
  const washA = theme.colors.backgroundAlt;
  const washB = resolved === 'dark' ? '#1C2533' : '#E8F0EC';
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [drift]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: drift.value * -8 },
      { translateX: drift.value * 4 },
    ],
  }));

  return (
    <View key={resolved} style={[styles.root, { backgroundColor: base }]}>
      <View style={[styles.wash, styles.washA, { backgroundColor: washA }]} />
      <View style={[styles.wash, styles.washB, { backgroundColor: washB }]} />
      <Animated.View
        style={[
          styles.blob,
          styles.blobTL,
          floatStyle,
          { borderColor: c, backgroundColor: `${c}33` },
        ]}
      />
      <View
        style={[
          styles.blob,
          styles.blobBR,
          { borderColor: c, backgroundColor: `${c}28` },
        ]}
      />
      <View style={[styles.arc, { borderColor: c }]} />
      <View style={[styles.ring, { borderColor: `${c}99` }]} />
      <View style={[styles.dot, styles.dot1, { backgroundColor: c }]} />
      <View style={[styles.dot, styles.dot2, { backgroundColor: c }]} />
      <View style={[styles.dot, styles.dot3, { backgroundColor: c }]} />
      <View style={[styles.content, { backgroundColor: 'transparent' }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
  wash: {
    position: 'absolute',
    borderRadius: 999,
  },
  washA: {
    width: 520,
    height: 520,
    top: -180,
    right: -120,
    opacity: 0.55,
  },
  washB: {
    width: 420,
    height: 420,
    bottom: -160,
    left: -100,
    opacity: 0.4,
  },
  blob: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 140,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  blobTL: {
    top: -60,
    left: -50,
  },
  blobBR: {
    bottom: -80,
    right: -70,
    width: 280,
    height: 280,
  },
  arc: {
    position: 'absolute',
    top: '38%',
    right: 24,
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderStyle: 'dashed',
    opacity: 0.55,
  },
  ring: {
    position: 'absolute',
    bottom: '22%',
    left: '18%',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    opacity: 0.45,
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.55,
  },
  dot1: { top: 120, right: 48 },
  dot2: { bottom: 160, left: 36 },
  dot3: { top: '55%', left: 20, width: 5, height: 5 },
});
