import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontBody } from '../../../public/theme/fonts';
import {
  formatAway,
  type DriftHourBucket,
  type DriftTodayInsight,
} from '../domain/types';
import { PHASE_THEME } from '../../pulse/domain/types';

const FOCUS = PHASE_THEME.shortBreak.bg;
const DRIFT = '#C47B5A';
const AXIS = [0, 6, 12, 18, 23];

function hourHasData(h: DriftHourBucket): boolean {
  return h.focusSeconds > 0 || h.awaySeconds > 0;
}

function peakHour(
  hours: DriftHourBucket[],
  field: 'focusSeconds' | 'awaySeconds',
): DriftHourBucket | null {
  let best: DriftHourBucket | null = null;
  for (const h of hours) {
    if (h[field] <= 0) continue;
    if (!best || h[field] > best[field]) best = h;
  }
  return best;
}

function ensureDay(hours: DriftHourBucket[]): DriftHourBucket[] {
  if (hours.length === 24) return hours;
  return Array.from({ length: 24 }, (_, hour) => {
    const found = hours.find((h) => h.hour === hour);
    return (
      found ?? {
        hour,
        label: `${hour % 12 || 12}${hour < 12 ? 'a' : 'p'}`,
        drifts: 0,
        awaySeconds: 0,
        focusSeconds: 0,
      }
    );
  });
}

type Props = {
  insight: DriftTodayInsight;
  ink: string;
  muted: string;
  track: string;
};

/**
 * One chart for the day: 24 equal hour slots.
 * Each slot shows focus (teal, bottom) vs drifted (warm, top) as a simple split —
 * so you can see at a glance when you’re sharp vs when you slip.
 */
export function DriftDayRibbon({ insight, ink, muted, track }: Props) {
  const nowHour = new Date().getHours();
  const [selected, setSelected] = useState<number | null>(nowHour);
  const hours = useMemo(() => ensureDay(insight.hours), [insight.hours]);

  const peakFocus = useMemo(() => peakHour(hours, 'focusSeconds'), [hours]);
  const peakDrift = useMemo(() => peakHour(hours, 'awaySeconds'), [hours]);

  const active =
    selected != null && hourHasData(hours[selected])
      ? hours[selected]
      : hours.find(hourHasData) ?? null;

  const focusPct =
    insight.watchedSeconds > 0
      ? Math.round((insight.focusSeconds / insight.watchedSeconds) * 100)
      : 0;

  return (
    <View style={styles.root}>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryMain, { color: FOCUS }]}>
          {formatAway(insight.focusSeconds)}
          <Text style={[styles.summaryUnit, { color: muted }]}> focus</Text>
        </Text>
        <Text style={[styles.summarySep, { color: muted }]}>·</Text>
        <Text style={[styles.summaryMain, { color: DRIFT }]}>
          {formatAway(insight.driftedSeconds)}
          <Text style={[styles.summaryUnit, { color: muted }]}> drifted</Text>
        </Text>
      </View>
      <Text style={[styles.summarySub, { color: muted }]}>
        {focusPct}% of watched time was focus
        {peakFocus ? ` · sharpest ${peakFocus.label}` : ''}
        {peakDrift ? ` · slippiest ${peakDrift.label}` : ''}
      </Text>

      <View style={[styles.chartCard, { backgroundColor: track }]}>
        <View style={styles.ribbon}>
          {hours.map((h) => {
            const watched = h.focusSeconds + h.awaySeconds;
            const focusShare = watched > 0 ? h.focusSeconds / watched : 0;
            const isNow = h.hour === nowHour;
            const isSel = selected === h.hour;

            return (
              <Pressable
                key={h.hour}
                onPress={() => setSelected(h.hour)}
                style={[
                  styles.col,
                  isSel && styles.colSelected,
                  isNow && !isSel && styles.colNow,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${h.label}: ${formatAway(h.focusSeconds)} focus, ${formatAway(h.awaySeconds)} drifted`}
              >
                {watched > 0 ? (
                  <View style={styles.slot}>
                    <View
                      style={{
                        flex: Math.max(1 - focusShare, 0.02),
                        backgroundColor: DRIFT,
                      }}
                    />
                    <View
                      style={{
                        flex: Math.max(focusShare, 0.02),
                        backgroundColor: FOCUS,
                      }}
                    />
                  </View>
                ) : (
                  <View style={[styles.slotEmpty, { borderColor: muted }]} />
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.axis}>
          {AXIS.map((h) => (
            <Text key={h} style={[styles.axisLabel, { color: muted }]}>
              {hours[h]?.label ?? ''}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: FOCUS }]} />
          <Text style={[styles.legendText, { color: muted }]}>
            Focus (bottom)
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: DRIFT }]} />
          <Text style={[styles.legendText, { color: muted }]}>
            Drifted (top)
          </Text>
        </View>
      </View>

      {active ? (
        <Text style={[styles.detail, { color: ink }]}>
          <Text style={styles.detailStrong}>{active.label}</Text>
          {active.hour === nowHour ? ' (now)' : ''}:{' '}
          {formatAway(active.focusSeconds)} focus,{' '}
          {formatAway(active.awaySeconds)} drifted
          {active.drifts > 0 ? `, ${active.drifts} drifts` : ''}
        </Text>
      ) : (
        <Text style={[styles.detail, { color: muted }]}>
          Empty hours mean you weren’t watching then.
        </Text>
      )}
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
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  summaryUnit: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '600',
  },
  summarySep: {
    fontFamily: fontBody,
    fontSize: 16,
    fontWeight: '600',
  },
  summarySub: {
    fontFamily: fontBody,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: -4,
  },
  chartCard: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
  },
  ribbon: {
    flexDirection: 'row',
    height: 72,
    gap: 2,
  },
  col: {
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  colSelected: {
    opacity: 1,
    transform: [{ scaleY: 1.04 }],
  },
  colNow: {
    opacity: 0.95,
  },
  slot: {
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  slotEmpty: {
    flex: 1,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    opacity: 0.35,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    fontFamily: fontBody,
    fontSize: 10,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: fontBody,
    fontSize: 12,
    fontWeight: '600',
  },
  detail: {
    fontFamily: fontBody,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  detailStrong: {
    fontFamily: fontBody,
    fontWeight: '800',
  },
});
