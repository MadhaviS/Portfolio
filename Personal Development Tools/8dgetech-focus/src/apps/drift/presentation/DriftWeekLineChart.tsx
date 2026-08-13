import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { fontBody } from '../../../public/theme/fonts';
import { formatAway, type DriftWeekPoint } from '../domain/types';
import { PHASE_THEME } from '../../pulse/domain/types';

const FOCUS = PHASE_THEME.shortBreak.bg;
const DRIFT = '#C47B5A';

type Props = {
  points: DriftWeekPoint[];
  ink: string;
  muted: string;
  track: string;
};

/**
 * One graph, two lines: focus minutes and drifted minutes over the week.
 */
export function DriftWeekLineChart({ points, ink, muted, track }: Props) {
  const { width: winW } = useWindowDimensions();
  const chartW = Math.min(440, Math.max(280, winW - 72));
  const chartH = 168;
  const padL = 28;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const { focusLine, driftLine, maxY, focusTotal, driftTotal } = useMemo(() => {
    const max = Math.max(
      1,
      ...points.map((p) => Math.max(p.focusMinutes, p.driftedMinutes)),
    );
    // Nice headroom so the top of the line isn’t clipped
    const maxY = Math.max(5, Math.ceil(max * 1.15));
    const n = Math.max(1, points.length - 1);
    const toPts = (field: 'focusMinutes' | 'driftedMinutes') =>
      points
        .map((p, i) => {
          const x = padL + (i / n) * innerW;
          const y = padT + innerH - (p[field] / maxY) * innerH;
          return `${x},${y}`;
        })
        .join(' ');
    return {
      focusLine: toPts('focusMinutes'),
      driftLine: toPts('driftedMinutes'),
      maxY,
      focusTotal: points.reduce((s, p) => s + p.focusMinutes, 0),
      driftTotal: points.reduce((s, p) => s + p.driftedMinutes, 0),
    };
  }, [points, innerW, innerH, padL, padT]);

  const n = Math.max(1, points.length - 1);

  return (
    <View style={styles.root}>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryMain, { color: FOCUS }]}>
          {formatAway(focusTotal * 60)}
          <Text style={[styles.summaryUnit, { color: muted }]}> focus</Text>
        </Text>
        <Text style={[styles.summarySep, { color: muted }]}>·</Text>
        <Text style={[styles.summaryMain, { color: DRIFT }]}>
          {formatAway(driftTotal * 60)}
          <Text style={[styles.summaryUnit, { color: muted }]}> drifted</Text>
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: track }]}>
        <Svg width={chartW} height={chartH}>
          {/* Grid */}
          {[0, 0.5, 1].map((t) => {
            const y = padT + innerH * (1 - t);
            return (
              <Line
                key={`g-${t}`}
                x1={padL}
                y1={y}
                x2={padL + innerW}
                y2={y}
                stroke={muted}
                strokeOpacity={0.2}
                strokeWidth={1}
              />
            );
          })}
          <SvgText
            x={4}
            y={padT + 4}
            fill={muted}
            fontSize={9}
            fontFamily={fontBody}
          >
            {maxY}m
          </SvgText>
          <SvgText
            x={4}
            y={padT + innerH}
            fill={muted}
            fontSize={9}
            fontFamily={fontBody}
          >
            0
          </SvgText>

          <Polyline
            points={focusLine}
            fill="none"
            stroke={FOCUS}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Polyline
            points={driftLine}
            fill="none"
            stroke={DRIFT}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((p, i) => {
            const x = padL + (i / n) * innerW;
            const yF = padT + innerH - (p.focusMinutes / maxY) * innerH;
            const yD = padT + innerH - (p.driftedMinutes / maxY) * innerH;
            return (
              <React.Fragment key={p.date}>
                <Circle cx={x} cy={yF} r={3.5} fill={FOCUS} />
                <Circle cx={x} cy={yD} r={3.5} fill={DRIFT} />
                <SvgText
                  x={x}
                  y={chartH - 8}
                  fill={ink}
                  fontSize={10}
                  fontFamily={fontBody}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {p.label}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: FOCUS }]} />
            <Text style={[styles.legendText, { color: muted }]}>Focus</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: DRIFT }]} />
            <Text style={[styles.legendText, { color: muted }]}>Drifted</Text>
          </View>
          <Text style={[styles.legendHint, { color: muted }]}>minutes / day</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  summaryMain: {
    fontFamily: fontBody,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  summaryUnit: {
    fontFamily: fontBody,
    fontSize: 13,
    fontWeight: '600',
  },
  summarySep: {
    fontFamily: fontBody,
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    borderRadius: 14,
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 8,
    alignSelf: 'stretch',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLine: {
    width: 14,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    fontFamily: fontBody,
    fontSize: 12,
    fontWeight: '600',
  },
  legendHint: {
    fontFamily: fontBody,
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 'auto',
  },
});
