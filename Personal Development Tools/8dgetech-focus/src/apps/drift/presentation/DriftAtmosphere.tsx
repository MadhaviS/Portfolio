import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';

type Props = {
  orbSize: number;
  /** Quieter decoration while a session is active. */
  quiet?: boolean;
};

/** Side / top arcs only, with clear air from the orb edge. */
const ORBIT_ICONS: {
  name: React.ComponentProps<typeof Feather>['name'];
  ring: 0 | 1;
  angle: number;
}[] = [
  { name: 'eye', ring: 0, angle: -28 },
  { name: 'message-circle', ring: 0, angle: 48 },
  { name: 'smartphone', ring: 0, angle: 220 },
  { name: 'book-open', ring: 1, angle: 12 },
  { name: 'coffee', ring: 1, angle: 100 },
  { name: 'moon', ring: 1, angle: 300 },
];

/**
 * Orbit decoration. Rings sit outside the orb with real padding so chips
 * never kiss the content circle.
 */
export function DriftAtmosphere({ orbSize, quiet = false }: Props) {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: quiet ? 140000 : 110000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [spin, quiet]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const counterSpinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-spin.value}deg` }],
  }));

  // Clear gap from orb edge → ring → chip (chip radius 17)
  const gap = quiet ? 28 : 34;
  const inner = orbSize + gap * 2;
  const outer = inner + (quiet ? 36 : 44);
  const icons = quiet ? ORBIT_ICONS.filter((_, i) => i % 2 === 0) : ORBIT_ICONS;
  const chip = '#FFFFFF';
  const chipInk = '#3D6862';
  const ringColor = quiet
    ? 'rgba(255,255,255,0.28)'
    : 'rgba(255,255,255,0.5)';

  return (
    <View pointerEvents="none" style={styles.root}>
      <View
        style={[
          styles.orbitWrap,
          {
            width: outer,
            height: outer,
            marginLeft: -outer / 2,
            marginTop: -outer / 2,
          },
        ]}
      >
        <View
          style={[
            styles.ring,
            {
              width: outer,
              height: outer,
              borderRadius: outer / 2,
              borderColor: ringColor,
            },
          ]}
        />
        <View
          style={[
            styles.ring,
            {
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              borderColor: ringColor,
              top: (outer - inner) / 2,
              left: (outer - inner) / 2,
            },
          ]}
        />

        <Animated.View style={[styles.iconLayer, spinStyle]}>
          {icons.map((item) => {
            const radius = (item.ring === 0 ? inner : outer) / 2;
            const rad = (item.angle * Math.PI) / 180;
            const x = outer / 2 + Math.cos(rad) * radius - 17;
            const y = outer / 2 + Math.sin(rad) * radius - 17;
            return (
              <View
                key={`${item.name}-${item.angle}`}
                style={{ position: 'absolute', left: x, top: y }}
              >
                <Animated.View
                  style={[
                    styles.chip,
                    {
                      backgroundColor: chip,
                      opacity: quiet ? 0.85 : 1,
                      shadowColor: '#0F1A18',
                    },
                    counterSpinStyle,
                  ]}
                >
                  <Feather name={item.name} size={13} color={chipInk} />
                </Animated.View>
              </View>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

/** Space the hero needs so outer ring + chips are fully visible. */
export function driftHeroHeight(orbSize: number, quiet = false): number {
  const gap = quiet ? 28 : 34;
  const inner = orbSize + gap * 2;
  const outer = inner + (quiet ? 36 : 44);
  return outer + 16;
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  orbitWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.25,
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});
