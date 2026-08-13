import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { fontBody } from '../../../public/theme/fonts';
import {
  DRIFT_CAUSES,
  type DriftCause,
  type DriftCauseCount,
} from '../domain/types';

const CAUSE_COLORS: Record<DriftCause, string> = {
  tabs: '#3D8B7A',
  chat: '#5B7C99',
  social: '#C47B5A',
  email: '#8B6BAE',
  other: '#7A8A86',
};

type Slice = DriftCauseCount & {
  label: string;
  color: string;
  startAngle: number;
  endAngle: number;
  pct: number;
};

type Props = {
  causes: DriftCauseCount[];
  ink: string;
  muted: string;
  track: string;
  /** Optional heading above the pie. */
  title?: string;
};

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number,
): string {
  const sweep = end - start;
  // Full circle: SVG arc can't draw 360° in one path — use two halves.
  if (sweep >= 359.9) {
    const mid = start + 180;
    const o0 = polar(cx, cy, rOuter, start);
    const o1 = polar(cx, cy, rOuter, mid);
    const o2 = polar(cx, cy, rOuter, end);
    const i0 = polar(cx, cy, rInner, start);
    const i1 = polar(cx, cy, rInner, mid);
    const i2 = polar(cx, cy, rInner, end);
    return [
      `M ${o0.x} ${o0.y}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${o1.x} ${o1.y}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${o2.x} ${o2.y}`,
      `L ${i2.x} ${i2.y}`,
      `A ${rInner} ${rInner} 0 1 0 ${i1.x} ${i1.y}`,
      `A ${rInner} ${rInner} 0 1 0 ${i0.x} ${i0.y}`,
      'Z',
    ].join(' ');
  }
  const large = sweep > 180 ? 1 : 0;
  const o0 = polar(cx, cy, rOuter, start);
  const o1 = polar(cx, cy, rOuter, end);
  const i0 = polar(cx, cy, rInner, start);
  const i1 = polar(cx, cy, rInner, end);
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i0.x} ${i0.y}`,
    'Z',
  ].join(' ');
}

/**
 * Donut of drift reasons (manual/leave causes).
 */
export function DriftCausePieChart({
  causes,
  ink,
  muted,
  track,
  title = 'Reasons',
}: Props) {
  const { width } = useWindowDimensions();
  const stack = width < 420;
  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 72;
  const rInner = 42;

  const { slices, total } = useMemo(() => {
    const total = causes.reduce((s, c) => s + c.count, 0);
    if (total <= 0) return { slices: [] as Slice[], total: 0 };
    let angle = 0;
    const slices: Slice[] = causes.map((c) => {
      const sweep = (c.count / total) * 360;
      const startAngle = angle;
      const endAngle = angle + sweep;
      angle = endAngle;
      return {
        ...c,
        label: DRIFT_CAUSES.find((d) => d.id === c.cause)?.label ?? c.cause,
        color: CAUSE_COLORS[c.cause],
        startAngle,
        endAngle,
        pct: Math.round((c.count / total) * 100),
      };
    });
    return { slices, total };
  }, [causes]);

  if (total <= 0) {
    return (
      <View style={[styles.root, { backgroundColor: track }]}>
        <Text style={[styles.title, { color: muted }]}>{title}</Text>
        <Text style={[styles.empty, { color: muted }]}>
          No tagged reasons yet — log a drift with a cause chip.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: track }]}>
      <Text style={[styles.title, { color: muted }]}>{title}</Text>
      <View style={[styles.row, stack && styles.rowStack]}>
        <View style={styles.pieWrap}>
          <Svg width={size} height={size}>
            <G>
              {slices.map((s) => (
                <Path
                  key={s.cause}
                  d={arcPath(cx, cy, rOuter, rInner, s.startAngle, s.endAngle)}
                  fill={s.color}
                />
              ))}
            </G>
          </Svg>
          <View style={styles.centerLabel} pointerEvents="none">
            <Text style={[styles.centerNum, { color: ink }]}>{total}</Text>
            <Text style={[styles.centerHint, { color: muted }]}>drifts</Text>
          </View>
        </View>

        <View style={styles.legend}>
          {slices.map((s) => (
            <View key={s.cause} style={styles.legendRow}>
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <Text style={[styles.legendLabel, { color: ink }]} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={[styles.legendMeta, { color: muted }]}>
                {s.count} · {s.pct}%
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  title: {
    fontFamily: fontBody,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  empty: {
    fontFamily: fontBody,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  pieWrap: {
    width: 168,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  centerLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerNum: {
    fontFamily: fontBody,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  centerHint: {
    fontFamily: fontBody,
    fontSize: 11,
    fontWeight: '600',
    marginTop: -2,
  },
  legend: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendLabel: {
    flex: 1,
    fontFamily: fontBody,
    fontSize: 13,
    fontWeight: '700',
    minWidth: 0,
  },
  legendMeta: {
    fontFamily: fontBody,
    fontSize: 12,
    fontWeight: '600',
  },
});
