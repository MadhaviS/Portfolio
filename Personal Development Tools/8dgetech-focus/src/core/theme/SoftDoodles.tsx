import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from './ThemeProvider';
import { IconSpark } from './LineIcons';

type SoftDoodlesProps = {
  density?: 1 | 2 | 3;
  accent?: string;
  playful?: boolean;
};

/**
 * Full-page doodles. Web uses SVG (RN Web often hides dashed+radius borders).
 */
export function SoftDoodles({
  density = 3,
  accent,
  playful = true,
}: SoftDoodlesProps) {
  const { theme, resolved } = useTheme();
  const { width, height } = useWindowDimensions();
  const ink =
    accent ?? (resolved === 'light' ? '#A89888' : theme.colors.doodle);
  const h = Math.max(height, 900);
  const w = Math.max(width, 320);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.root, styles.noPointer, { width: w, height: h }]}>
        <WebDoodleSvg width={w} height={h} color={ink} density={density ?? 3} />
        {playful ? <DoodleExtras ink={ink} /> : null}
      </View>
    );
  }

  const count = density <= 1 ? 5 : density === 2 ? 7 : PATHS.length;
  return (
    <View style={[styles.root, styles.noPointer, { width: w, height: h }]}>
      {PATHS.slice(0, count).map((p, i) => (
        <View
          key={i}
          style={[
            styles.path,
            {
              top: p.top,
              left: p.left,
              right: p.right,
              width: p.w,
              height: p.h,
              borderRadius: p.radius,
              borderColor: ink,
              opacity: p.opacity,
              transform: [{ rotate: p.rotate }],
            },
          ]}
        />
      ))}
      {playful ? <DoodleExtras ink={ink} /> : null}
    </View>
  );
}

function DoodleExtras({ ink }: { ink: string }) {
  return (
    <>
      <View style={styles.sparkLeft}>
        <IconSpark color={ink} size={18} />
      </View>
      <View style={styles.sparkMid}>
        <IconSpark color={ink} size={12} />
      </View>
      <View style={styles.sparkRight}>
        <IconSpark color={ink} size={14} />
      </View>
      <View style={styles.branch}>
        <View style={[styles.stem, { backgroundColor: ink }]} />
        <View style={[styles.leaf, styles.leaf1, { borderColor: ink }]} />
        <View style={[styles.leaf, styles.leaf2, { borderColor: ink }]} />
        <View style={[styles.leaf, styles.leaf3, { borderColor: ink }]} />
      </View>
    </>
  );
}

function WebDoodleSvg({
  width,
  height,
  color,
  density,
}: {
  width: number;
  height: number;
  color: string;
  density: number;
}) {
  const ellipses = [
    { cx: width * -0.02, cy: height * 0.18, rx: 210, ry: 155, rot: -24, o: 0.55 },
    { cx: width * 0.08, cy: height * 0.28, rx: 130, ry: 100, rot: 12, o: 0.4 },
    { cx: width * 1.02, cy: height * 0.14, rx: 200, ry: 145, rot: 18, o: 0.5 },
    { cx: width * 0.92, cy: height * 0.3, rx: 120, ry: 95, rot: -14, o: 0.38 },
    { cx: width * 0.5, cy: height * 0.42, rx: width * 0.42, ry: 75, rot: -5, o: 0.36 },
    { cx: width * 0.55, cy: height * 0.52, rx: width * 0.34, ry: 60, rot: 6, o: 0.32 },
    { cx: width * 0.05, cy: height * 0.7, rx: 180, ry: 130, rot: 12, o: 0.48 },
    { cx: width * 0.98, cy: height * 0.76, rx: 210, ry: 150, rot: -18, o: 0.52 },
    { cx: width * 0.4, cy: height * 0.88, rx: 130, ry: 95, rot: 20, o: 0.4 },
  ].slice(0, density <= 1 ? 5 : density === 2 ? 7 : 9);

  // React Native Web accepts raw SVG DOM tags.
  const Svg = 'svg' as unknown as React.ElementType;
  const Ellipse = 'ellipse' as unknown as React.ElementType;
  const Path = 'path' as unknown as React.ElementType;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {ellipses.map((e, i) => (
        <Ellipse
          key={i}
          cx={e.cx}
          cy={e.cy}
          rx={e.rx}
          ry={e.ry}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="9 7"
          opacity={e.o}
          transform={`rotate(${e.rot} ${e.cx} ${e.cy})`}
        />
      ))}
      {/* flowing S-curve across mid page */}
      <Path
        d={`M ${width * -0.05} ${height * 0.45}
            C ${width * 0.25} ${height * 0.35}, ${width * 0.45} ${height * 0.55}, ${width * 0.7} ${height * 0.42}
            S ${width * 1.05} ${height * 0.55}, ${width * 1.1} ${height * 0.48}`}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray="8 6"
        opacity={0.42}
      />
      <Path
        d={`M ${width * -0.02} ${height * 0.58}
            C ${width * 0.3} ${height * 0.5}, ${width * 0.55} ${height * 0.68}, ${width * 0.85} ${height * 0.56}
            S ${width * 1.08} ${height * 0.62}, ${width * 1.12} ${height * 0.6}`}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray="8 6"
        opacity={0.34}
      />
    </Svg>
  );
}

const PATHS = [
  { top: '3%', left: -80, right: undefined as number | undefined, w: 380, h: 280, radius: 190, rotate: '-22deg', opacity: 0.55 },
  { top: '12%', left: -40, right: undefined, w: 240, h: 180, radius: 120, rotate: '10deg', opacity: 0.4 },
  { top: '2%', left: undefined, right: -90, w: 360, h: 260, radius: 180, rotate: '16deg', opacity: 0.5 },
  { top: '20%', left: undefined, right: -50, w: 220, h: 170, radius: 110, rotate: '-14deg', opacity: 0.38 },
  { top: '36%', left: 40, right: undefined, w: 640, h: 150, radius: 999, rotate: '-5deg', opacity: 0.35 },
  { top: '46%', left: 90, right: undefined, w: 520, h: 120, radius: 999, rotate: '6deg', opacity: 0.32 },
  { top: '58%', left: -70, right: undefined, w: 320, h: 230, radius: 160, rotate: '12deg', opacity: 0.48 },
  { top: '64%', left: undefined, right: -100, w: 380, h: 270, radius: 190, rotate: '-18deg', opacity: 0.52 },
  { top: '78%', left: 100, right: undefined, w: 240, h: 170, radius: 120, rotate: '20deg', opacity: 0.4 },
];

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
  noPointer: {
    pointerEvents: 'none',
  },
  path: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  sparkLeft: {
    position: 'absolute',
    top: '34%',
    left: '6%',
    opacity: 0.75,
  },
  sparkMid: {
    position: 'absolute',
    top: '12%',
    left: '46%',
    opacity: 0.6,
  },
  sparkRight: {
    position: 'absolute',
    top: '52%',
    right: '10%',
    opacity: 0.65,
  },
  branch: {
    position: 'absolute',
    bottom: '10%',
    right: '5%',
    width: 80,
    height: 100,
  },
  stem: {
    position: 'absolute',
    bottom: 4,
    left: 36,
    width: 2,
    height: 74,
    opacity: 0.7,
    transform: [{ rotate: '14deg' }],
  },
  leaf: {
    position: 'absolute',
    borderWidth: 1.6,
    borderStyle: 'dashed',
    opacity: 0.7,
  },
  leaf1: {
    bottom: 48,
    left: 4,
    width: 32,
    height: 44,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 36,
    transform: [{ rotate: '-30deg' }],
  },
  leaf2: {
    bottom: 36,
    right: 0,
    width: 28,
    height: 38,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 6,
    transform: [{ rotate: '26deg' }],
  },
  leaf3: {
    bottom: 14,
    left: 18,
    width: 24,
    height: 32,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 24,
    transform: [{ rotate: '-6deg' }],
  },
});
